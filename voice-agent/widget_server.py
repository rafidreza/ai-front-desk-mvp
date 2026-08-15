"""Production voice runtime for the web widget.

The browser gets a signed session token from the TS API (POST /widget-voice/session), then sends
its WebRTC offer here with that token attached. This server verifies the token, learns the tenant
from it, and runs the shared pipeline against a SmallWebRTC transport.

    browser --(offer + sessionToken)--> widget_server.py --(internal token)--> hono-api /voice/*

Why the token and not a clientId in the body: the widget runs in an anonymous visitor's browser.
Anything it *claims* is attacker-controlled. The token is HMAC-signed by the API with a shared
secret, so the tenant, the expiry, and the call-duration cap all arrive tamper-proof.

This replaces the parked Twilio server.py. There is no phone number, carrier, or SIP trunk
anywhere in this path.

Run:
    python3 widget_server.py            # listens on VOICE_RUNTIME_PORT (default 7860)
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

import aiohttp
import uvicorn
from aiortc import RTCIceServer
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field

from pipecat.transports.smallwebrtc.request_handler import SmallWebRTCRequest, SmallWebRTCRequestHandler
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from pipeline import default_transport_params, run_voice_session
from widget_token import InvalidSessionToken, verify_session_token

load_dotenv()

# Hard ceiling on simultaneous calls. Each one holds a Deepgram socket, an LLM stream and an
# ElevenLabs socket, so this bounds both memory and spend. Raise it only with an SFU in front.
MAX_CONCURRENT_CALLS = int(os.getenv("VOICE_MAX_CONCURRENT_CALLS", "10"))

# Browser origins allowed to post an offer. The token is the real authority, but a tight CORS
# list keeps casual cross-origin embedding out.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("WEB_APP_URL", "http://localhost:3002").split(",") if o.strip()]

_active_calls: set[asyncio.Task] = set()


def ice_servers() -> list[RTCIceServer]:
    """ICE servers for the answering peer.

    STUN alone strands the ~15-20% of visitors behind symmetric NAT or a corporate firewall — set
    WEBRTC_TURN_URL (+ user/pass) in production or those calls connect for nobody and you will
    only hear about it as "the call button doesn't work".
    """
    servers = [RTCIceServer(urls=os.getenv("WEBRTC_STUN_URL", "stun:stun.l.google.com:19302"))]
    turn_url = os.getenv("WEBRTC_TURN_URL")
    if turn_url:
        servers.append(
            RTCIceServer(
                urls=turn_url,
                username=os.getenv("WEBRTC_TURN_USERNAME"),
                credential=os.getenv("WEBRTC_TURN_PASSWORD"),
            )
        )
    else:
        logger.warning("WEBRTC_TURN_URL is not set — calls from restrictive networks will fail to connect.")
    return servers


webrtc_handler = SmallWebRTCRequestHandler(ice_servers=ice_servers())


class OfferRequest(BaseModel):
    """The browser's SDP offer plus the session token that authorises it.

    Note the two spellings of the same field. Pipecat's *Python* type is `request_data`, but the
    *JavaScript* client posts `requestData` (camelCase) — see the offer body it builds in
    @pipecat-ai/small-webrtc-transport. Accept both, or the token silently reads as absent and
    every real browser call is rejected with 401 while server-side tests pass.
    """

    model_config = ConfigDict(populate_by_name=True)

    sdp: str
    type: str
    pc_id: Optional[str] = None
    restart_pc: Optional[bool] = False
    request_data: Optional[dict[str, Any]] = Field(default=None, alias="requestData")


async def warm_tts() -> None:
    """Synthesize one throwaway phrase so the first real caller doesn't wait on a cold voice.

    ElevenLabs loads a voice on first use: measured 20.3s to first byte on a cold voice versus
    1.2s once warm. On a live call that silence reads as "the agent is broken" — and it lands on
    the very first question of a demo, which is the worst possible moment. Best-effort only; a
    failure here must never stop the server from starting.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID")
    model = os.getenv("TTS_MODEL") or "eleven_v3"
    if not (api_key and voice_id):
        logger.warning("ELEVENLABS_API_KEY/VOICE_ID not set — skipping TTS warm-up.")
        return
    try:
        async with aiohttp.ClientSession() as session:
            started = time.monotonic()
            async with session.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
                headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                json={"text": "Hello", "model_id": model},
                params={"output_format": "mp3_22050_32"},
                timeout=aiohttp.ClientTimeout(total=60),
            ) as response:
                await response.read()
                logger.info(f">>> TTS warm-up done in {time.monotonic() - started:.1f}s (HTTP {response.status})")
    except Exception as exc:  # noqa: BLE001 - never block startup on a warm-up
        logger.warning(f"TTS warm-up failed ({exc}); first call may be slow.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await warm_tts()
    yield
    for task in list(_active_calls):
        task.cancel()
    await webrtc_handler.close()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "activeCalls": len(_active_calls), "maxConcurrentCalls": MAX_CONCURRENT_CALLS}


@app.post("/api/offer")
async def offer(request: OfferRequest):
    """Accept a WebRTC offer, verify the session token, and start a call for that tenant."""
    token = (request.request_data or {}).get("sessionToken")
    if not isinstance(token, str) or token == "":
        raise HTTPException(status_code=401, detail="A voice session token is required.")

    try:
        session = verify_session_token(token)
    except InvalidSessionToken as exc:
        # Deliberately vague to the caller; the detail goes to our logs, not the browser.
        logger.warning(f"rejected offer: {exc}")
        raise HTTPException(status_code=401, detail="Voice session token is invalid or expired.") from exc

    # Reject before doing WebRTC work — a full pipeline is expensive to spin up and tear down.
    if len(_active_calls) >= MAX_CONCURRENT_CALLS:
        logger.warning(f"rejected offer for {session.client_id}: at capacity ({MAX_CONCURRENT_CALLS})")
        raise HTTPException(status_code=503, detail="All agents are busy right now. Please try again shortly.")

    async def start_call(connection) -> None:
        """Runs once the peer connection is negotiated. Owns one call, start to finish."""
        transport = SmallWebRTCTransport(webrtc_connection=connection, params=default_transport_params())

        async def run() -> None:
            try:
                await run_voice_session(
                    transport,
                    client_id=session.client_id,
                    language_posture="web",
                    # The cap is signed into the token, so the browser cannot extend its own call.
                    max_duration_s=session.max_duration_s or None,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - one failed call must not take the server down
                logger.exception(f"voice session for {session.client_id} failed: {exc}")

        task = asyncio.create_task(run())
        _active_calls.add(task)
        task.add_done_callback(_active_calls.discard)

    answer = await webrtc_handler.handle_web_request(
        SmallWebRTCRequest(
            sdp=request.sdp,
            type=request.type,
            pc_id=request.pc_id,
            restart_pc=request.restart_pc,
            request_data=request.request_data,
        ),
        start_call,
    )
    if answer is None:
        raise HTTPException(status_code=500, detail="Could not negotiate the voice connection.")
    return answer


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("VOICE_RUNTIME_HOST", "0.0.0.0"),
        port=int(os.getenv("VOICE_RUNTIME_PORT", "7860")),
    )
