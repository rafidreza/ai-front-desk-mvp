# =============================================================================
# PARKED — Twilio TwiML + media-stream WebSocket host. NOT IN USE.
#
# Parked 2026-07-28 alongside bot.py (which this imports) when the product moved
# to web-widget WebRTC calling. This file exists only to hand Twilio a <Connect>
# <Stream> TwiML document and host the resulting audio socket — pure carrier glue,
# useless without a telephony provider.
#
# The live web-widget path is: widget_server.py -> pipeline.py
# =============================================================================


# """FastAPI server: gives Twilio the TwiML to open a media stream, then hosts the WebSocket
# the audio flows over. Keep this thin — the actual voice logic is in bot.py."""

# import os

# from dotenv import load_dotenv
# from fastapi import FastAPI, WebSocket, Request
# from fastapi.responses import HTMLResponse
# import uvicorn

# from bot import run_bot

# load_dotenv()

# app = FastAPI()


# @app.post("/twiml")
# async def twiml(request: Request):
#     """Twilio hits this when a call comes in. We answer and connect the audio to our WebSocket."""
#     host = request.headers.get("host")
#     stream_url = f"wss://{host}/ws"
#     # <Connect><Stream> gives us the raw two-way audio (Twilio Media Streams).
#     xml = f"""<?xml version="1.0" encoding="UTF-8"?>
# <Response>
#   <Connect>
#     <Stream url="{stream_url}" />
#   </Connect>
# </Response>"""
#     return HTMLResponse(content=xml, media_type="application/xml")


# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     # Twilio sends two JSON frames first: 'connected', then 'start' (which carries streamSid).
#     await websocket.receive_text()  # 'connected'
#     start = await websocket.receive_json()  # 'start'
#     stream_sid = start["start"]["streamSid"]
#     await run_bot(websocket, stream_sid)


# if __name__ == "__main__":
#     uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
