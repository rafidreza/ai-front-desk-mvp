"""Local dev runner — talk to the agent in the browser via Pipecat's development runner.

The runner serves the Pipecat Playground UI AND wires the WebRTC signaling itself, so the client
and server always agree (no hand-rolled /api/offer to get 404s). No phone, no telephony provider.

This is the DEVELOPER's runner: the tenant comes from CLIENT_ID in .env, and there is no session
token, so never expose it publicly. The production widget path is widget_server.py, which takes
the tenant from a signed token instead. Both share the pipeline in pipeline.py.

Run:
    python3 web.py
then open the URL it prints (use http://localhost:<port>, NOT 0.0.0.0 — WebRTC is blocked on
0.0.0.0), click Connect, allow the mic, and talk.
"""

import os

from dotenv import load_dotenv

from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport

from pipeline import default_transport_params, run_voice_session

load_dotenv()

# The runner picks the right transport for how it's launched. For local dev it's SmallWebRTC.
transport_params = {"webrtc": lambda: default_transport_params()}


async def run_bot(transport: BaseTransport):
    await run_voice_session(transport, client_id=os.getenv("CLIENT_ID"), language_posture="web")


async def bot(runner_args: RunnerArguments):
    """Entry point the Pipecat runner calls once a client connects."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
