"""The voice pipeline, shared by every transport.

This is the single place the agent's behaviour lives: Deepgram STT -> OpenRouter LLM ->
ElevenLabs TTS, with Silero VAD for endpointing and barge-in, RTVI for the client protocol, and
a TranscriptProcessor that persists finalized turns to the TS backend.

It is transport-agnostic on purpose. `run_voice_session` takes an already-built Pipecat transport,
so the same pipeline serves:
  - web.py          -> local dev, Pipecat Playground UI, CLIENT_ID from .env
  - widget_server.py -> production web widget, clientId from a signed session token

Extracted from web.py on 2026-07-28 when the widget path was built, so the two runners could not
drift apart.
"""

import asyncio
import os
from typing import Awaitable, Callable, Optional

import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    EndFrame,
    Frame,
    LLMContextAssistantTurnFrame,
    LLMRunFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi import RTVIObserver, RTVIProcessor
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsHttpTTSService, ElevenLabsTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import BaseTransport, TransportParams

from backend_client import BackendClient, build_grounded_prompt
from persona import SYSTEM_PROMPT  # fallback prompt when no backend is configured

# Phrases that mean "get me a person". Matched against finalized user turns in both languages the
# product supports. Kept here (not in the backend) so the check costs nothing per turn.
ESCALATION_KEYWORDS = [
    "talk to a human",
    "real person",
    "speak to someone",
    "customer service",
    "manush",
    "kotha bolbo",
    "agent er sathe",
]


class TranscriptRecorder(FrameProcessor):
    """Reports finalized conversation turns as they pass through the pipeline.

    Pipecat 1.5.0 has no TranscriptProcessor (the helper the earlier spike imported was from an
    older release and does not exist here), so we read the two frames that mark a completed turn:

      - TranscriptionFrame with finalized=True -> the caller finished saying something
      - LLMContextAssistantTurnFrame           -> the agent finished a reply

    The frame is always forwarded first, so a slow or failing sink can never stall the call —
    persistence is strictly a side effect.
    """

    def __init__(self, on_turn: Callable[[str, str], Awaitable[None]]):
        super().__init__()
        self._on_turn = on_turn

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)

        speaker: Optional[str] = None
        if isinstance(frame, TranscriptionFrame) and getattr(frame, "finalized", True):
            speaker = "caller"
        elif isinstance(frame, LLMContextAssistantTurnFrame):
            speaker = "ai"

        text = (getattr(frame, "text", "") or "").strip()
        if speaker is not None and text != "":
            try:
                await self._on_turn(speaker, text)
            except Exception as exc:  # noqa: BLE001 - never let a sink error break the call
                logger.warning(f"transcript sink failed: {exc}")


def deepgram_settings() -> DeepgramSTTService.Settings:
    """STT configuration for a Bangla-first, code-switching support line.

    Deepgram's own defaults are `nova-3-general` + `Language.EN`, which return an EMPTY transcript
    for Bangla speech — the caller talks and nothing reaches the agent at all. Measured on real
    audio through this account:

      lang=en    Bangla -> (empty)          Banglish -> drops every Bangla word
      lang=multi Bangla -> Devanagari       (nova-3 'multi' has no Bengali; it lands on Hindi)
      lang=bn    Bangla -> accurate         Banglish -> accurate, English words transliterated
                 English -> understandable, rendered in Bengali script

    So `bn` is the only setting that serves all three, and Banglish — how customers actually speak
    — is where it is strongest. The cost is that pure-English callers come through transliterated
    into Bengali script; the LLM reads that fine, so it stays a cosmetic issue in the transcript.

    Override per deployment with STT_MODEL / STT_LANGUAGE if a client is English-only.
    """
    language_code = os.getenv("STT_LANGUAGE") or "bn"
    try:
        language = Language(language_code)
    except ValueError:
        logger.warning(f"STT_LANGUAGE '{language_code}' is not a known language; falling back to bn.")
        language = Language.BN

    return DeepgramSTTService.Settings(
        model=os.getenv("STT_MODEL") or "nova-3",
        language=language,
        # Punctuation and numeral formatting make the transcript readable for the console and give
        # the LLM cleaner input ("500" rather than "five hundred").
        smart_format=True,
        punctuate=True,
        numerals=True,
        interim_results=True,
    )


def build_tts(http_session: aiohttp.ClientSession):
    """Pick the text-to-speech service. Defaults to eleven_v3 — the only one that says Bangla right.

    Measured on real audio (synthesize a price quote, transcribe it back):

      turbo_v2_5       "মার্ডার 500 ... খাস 1500 টাকা"   <- says 'murder' for 'our', mangles the price
      flash_v2_5       "মাসিক ক্ষারে ফাইনান্স রোজগার টাকা"  <- price destroyed
      multilingual_v2  "ফাইনস ও এমবিP ... ফাইনস ওয়ান টাকা" <- price destroyed
      eleven_v3        exact, every word and both numbers

    No v2-family model supports Bengali, and Pipecat's own default is eleven_turbo_v2_5 — so the
    out-of-the-box configuration quotes wrong prices to customers. That is worse than being slow,
    hence v3 by default despite it being the slower option (~1.3s to first audio vs ~0.5s).

    v3 cannot use the websocket API, so it runs over ElevenLabsHttpTTSService. Set TTS_MODEL to a
    v2 model to get the faster websocket path back — appropriate only for English-only clients.
    """
    model = os.getenv("TTS_MODEL") or "eleven_v3"
    api_key = os.getenv("ELEVENLABS_API_KEY")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID")

    if model == "eleven_v3":
        return ElevenLabsHttpTTSService(
            api_key=api_key,
            voice_id=voice_id,
            model=model,
            aiohttp_session=http_session,
            sample_rate=24000,
        )

    logger.warning(f"TTS_MODEL={model}: no v2-family ElevenLabs model speaks Bengali correctly.")
    return ElevenLabsTTSService(api_key=api_key, voice_id=voice_id, model=model, sample_rate=24000)


def default_transport_params() -> TransportParams:
    """Audio-in/audio-out with VAD. Same shape for every WebRTC transport we use."""
    return TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        vad_analyzer=SileroVADAnalyzer(),  # endpointing + barge-in
    )


async def build_system_prompt(backend: BackendClient, client_id: Optional[str]) -> str:
    """Ground the agent on the tenant's real KB + voice config, or fall back to the local persona.

    Never raises: a backend hiccup degrades the agent to the generic persona rather than killing
    the call the visitor is already in.
    """
    if not (backend.enabled and client_id):
        return SYSTEM_PROMPT
    try:
        ctx_data = await backend.get_context(client_id)
        knowledge = await backend.get_knowledge(client_id)
        logger.info(f">>> grounded on {len(knowledge)} KB entries from backend (client {client_id})")
        return build_grounded_prompt(SYSTEM_PROMPT, ctx_data, knowledge)
    except Exception as exc:  # noqa: BLE001 - fall back to local persona on any backend error
        logger.warning(f"backend context fetch failed ({exc}); using local persona")
        return SYSTEM_PROMPT


async def run_voice_session(
    transport: BaseTransport,
    client_id: Optional[str] = None,
    language_posture: str = "web",
    max_duration_s: Optional[int] = None,
    backend: Optional[BackendClient] = None,
) -> None:
    """Run one call end to end on an already-connected transport.

    Args:
        transport: a built Pipecat transport (SmallWebRTC for both current runners).
        client_id: the tenant. For the widget this comes from the signed session token, never
            from anything the browser asserts.
        language_posture: recorded on the Call row; 'web' for widget calls.
        max_duration_s: hard cap. An anonymous visitor's call spends real STT/LLM/TTS money, so
            the session ends itself rather than trusting the browser to hang up.
        backend: injected for tests; defaults to one built from env.
    """
    owns_backend = backend is None
    backend = backend or BackendClient()
    # eleven_v3 speaks over HTTP, not the websocket API, so the pipeline owns an aiohttp session
    # for the life of the call.
    http_session = aiohttp.ClientSession()

    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"), settings=deepgram_settings())
    llm = OpenAILLMService(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku"),
    )
    tts = build_tts(http_session)

    system_prompt = await build_system_prompt(backend, client_id)

    # Pipecat 1.x: provider-agnostic universal context + aggregator pair.
    context = LLMContext(messages=[{"role": "system", "content": system_prompt}])
    context_aggregator = LLMContextAggregatorPair(context)

    # RTVI drives the client protocol (client-ready handshake, transcripts, events) that the
    # browser widget listens to.
    rtvi = RTVIProcessor()

    # Per-call state for backend persistence (best-effort; never blocks the call).
    session: dict = {"call_id": None, "turn": 0}

    async def on_turn(speaker: str, text: str) -> None:
        """Persist one finalized turn, and raise an escalation if the caller asked for a human."""
        if not (backend.enabled and client_id and session["call_id"]):
            return
        idx = session["turn"]
        session["turn"] += 1
        try:
            await backend.persist_turn(session["call_id"], client_id, idx, speaker, text)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"persist_turn failed: {exc}")
        if speaker == "caller" and any(k in text.lower() for k in ESCALATION_KEYWORDS):
            try:
                await backend.escalate(session["call_id"], client_id, "explicit_request")
                logger.info(">>> escalation raised (explicit human request)")
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"escalate failed: {exc}")

    transcript = TranscriptRecorder(on_turn)

    pipeline = Pipeline(
        [
            transport.input(),
            rtvi,
            stt,
            transcript,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )
    task = PipelineTask(
        pipeline,
        # Barge-in on. A support caller who cannot interrupt a long answer will talk over it and
        # conclude the agent is broken; VAD already detects them, this lets it act on that.
        params=PipelineParams(allow_interruptions=True),
        observers=[RTVIObserver(rtvi)],
    )

    timeout_handle: dict = {"task": None}

    async def enforce_max_duration() -> None:
        """End the call when it outruns its budget. Cancelled if the visitor hangs up first."""
        await asyncio.sleep(max_duration_s)
        logger.info(f">>> max duration {max_duration_s}s reached; ending call {session['call_id']}")
        await task.queue_frames([EndFrame()])

    @transport.event_handler("on_client_connected")
    async def on_client_connected(_transport, _client):
        logger.info(f">>> client connected (tenant {client_id}): starting the conversation")
        if backend.enabled and client_id:
            try:
                call = await backend.start_session(client_id, language_posture=language_posture)
                session["call_id"] = call.get("id")
                logger.info(f">>> backend call session opened: {session['call_id']}")
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"start_session failed ({exc}); persistence disabled for this call")
        if max_duration_s:
            timeout_handle["task"] = asyncio.create_task(enforce_max_duration())
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        pending = timeout_handle["task"]
        if pending is not None and not pending.done():
            pending.cancel()
        if backend.enabled and client_id and session["call_id"]:
            try:
                await backend.finalize_call(session["call_id"], client_id, "ended")
                await backend.score(session["call_id"], client_id)
                logger.info(f">>> call {session['call_id']} finalized + scored")
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"finalize/score failed: {exc}")
        await task.cancel()

    try:
        await PipelineRunner().run(task)
    finally:
        pending = timeout_handle["task"]
        if pending is not None and not pending.done():
            pending.cancel()
        await http_session.close()
        if owns_backend:
            await backend.aclose()
