# =============================================================================
# PARKED — Twilio / PSTN phone transport. NOT IN USE.
#
# Parked 2026-07-28 when the product moved to a web-widget WebRTC calling model.
# Reason: no telephony provider could be secured (Twilio rejected BD numbers), and
# the widget path needs no carrier, no number, and no SIP trunk at all.
#
# Everything below is commented out verbatim so the Twilio pipeline shape survives
# for the day a provider (Telnyx / SignalWire / a client SIP trunk) is signed. To
# revive: uncomment, then migrate to the Pipecat 1.5.0 API by mirroring
# voice-agent/pipeline.py (the live, working pipeline).
#
# The live web-widget path is: widget_server.py -> pipeline.py
# =============================================================================


# """⚠️ NOT MIGRATED / NOT RUNNABLE YET — the Twilio phone path.

# This file still uses the OLD Pipecat 0.0.x API and stale services. It is BLOCKED on two things:
#   1. Telephony provider decision (Twilio signup failed for BD numbers; Telnyx / SignalWire / the
#      pilot client's SIP are the open options).
#   2. Migration to Pipecat 1.5.0 — mirror web.py exactly (Deepgram STT, OpenRouter LLM, ElevenLabs
#      TTS, LLMContext + LLMContextAggregatorPair, RTVIProcessor/RTVIObserver, on_client_connected).
# When telephony is chosen, redo this transport against that provider's Pipecat example and reuse
# web.py's proven pipeline. Until then, use web.py (browser) — that is the working runner.

# Original notes below.

# The voice pipeline: Twilio audio <-> Google STT -> Claude -> ElevenLabs TTS.

# This is the M0 spike brain. The "knowledge base" is intentionally a tiny hardcoded block in
# the system prompt — the point is to prove the *pipeline* (latency, Banglish, barge-in), not to
# be the real product. Once M0 passes, this pipeline gets wired into the TS backend (tenant
# resolution, persistence, grounded KB, escalation) which already exists and is tested.

# Version note: class/import names track the Pipecat Twilio example. If your installed Pipecat
# differs, adjust imports — the pipeline shape (transport -> stt -> llm -> tts) is the contract.
# """

# import os

# from pipecat.audio.vad.silero import SileroVADAnalyzer
# from pipecat.pipeline.pipeline import Pipeline
# from pipecat.pipeline.runner import PipelineRunner
# from pipecat.pipeline.task import PipelineParams, PipelineTask
# from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
# from pipecat.serializers.twilio import TwilioFrameSerializer
# from pipecat.services.openai.llm import OpenAILLMService
# from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
# from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
# from pipecat.transports.network.fastapi_websocket import (
#     FastAPIWebsocketParams,
#     FastAPIWebsocketTransport,
# )

# # --- The tiny hardcoded "KB" for the spike. Edit these to match the call type you test. -------
# SYSTEM_PROMPT = """You are a phone support agent for ABC Telecom, a fiber internet provider.
# Answer ONLY from these facts. If asked something not here, say you are not sure and offer to
# connect a colleague — never invent details.

# FACTS:
# - Plans: 500 Mbps for 1500 taka/month; 1 Gbps for 2500 taka/month.
# - Installation is FREE this month.
# - Coverage: available in Dhaka and Chittagong city areas.
# - Support hours: 9am to 9pm, 7 days a week.

# Style: speak naturally for a phone call — short sentences, one idea at a time, no lists.
# Reply in the caller's language: Bangla, English, or a mix (Banglish)."""


# async def run_bot(websocket, stream_sid: str):
#     serializer = TwilioFrameSerializer(stream_sid=stream_sid)

#     transport = FastAPIWebsocketTransport(
#         websocket=websocket,
#         params=FastAPIWebsocketParams(
#             audio_in_enabled=True,
#             audio_out_enabled=True,
#             add_wav_header=False,
#             vad_analyzer=SileroVADAnalyzer(),  # endpointing + barge-in
#             serializer=serializer,
#         ),
#     )

#     # ElevenLabs Scribe for speech-to-text (same key as TTS). If live latency is too high on the
#     # M0 gate, swap this block for a streaming STT (Google/Deepgram) — nothing else changes.
#     stt = ElevenLabsSTTService(
#         api_key=os.getenv("ELEVENLABS_API_KEY"),
#         model="scribe_v1",
#         language=os.getenv("STT_LANGUAGE") or None,
#     )

#     # Brain via OpenRouter (OpenAI-compatible) — reuses the backend's OpenRouter account.
#     # Use a FAST model for voice: big models raise time-to-first-token and the call feels laggy.
#     # If latency fails the M0 gate, change OPENROUTER_MODEL (or point at direct Anthropic Haiku).
#     llm = OpenAILLMService(
#         api_key=os.getenv("OPENROUTER_API_KEY"),
#         base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
#         model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku"),
#     )

#     tts = ElevenLabsTTSService(
#         api_key=os.getenv("ELEVENLABS_API_KEY"),
#         voice_id=os.getenv("ELEVENLABS_VOICE_ID"),
#     )

#     context = OpenAILLMContext(
#         messages=[
#             {"role": "system", "content": SYSTEM_PROMPT},
#             {"role": "assistant", "content": "Assalamu alaikum, ABC Telecom e call korar jonno dhonnobad. Ki bhabe help korte pari?"},
#         ]
#     )
#     context_aggregator = llm.create_context_aggregator(context)

#     pipeline = Pipeline(
#         [
#             transport.input(),
#             stt,
#             context_aggregator.user(),
#             llm,
#             tts,
#             transport.output(),
#             context_aggregator.assistant(),
#         ]
#     )

#     task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

#     @transport.event_handler("on_client_disconnected")
#     async def on_disconnect(_transport, _client):
#         await task.cancel()

#     await PipelineRunner().run(task)
