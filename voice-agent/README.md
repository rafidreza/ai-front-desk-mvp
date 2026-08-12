# DAEMION Voice Agent

The Python voice service that answers a call: **browser mic → WebRTC → Pipecat → Deepgram STT →
OpenRouter LLM → ElevenLabs TTS → back to the caller.** This is the one part of the product that
cannot run inside the TS backend (it needs a long-lived audio session, so it will not run on
Cloudflare Workers — see `../../docs/prd/00-project-overview.md` §8).

**There is no telephony provider in this path.** No carrier, no phone number, no SIP trunk, no
call-forwarding. A visitor clicks *Call* in the web widget and talks to the agent over WebRTC.

---

## Files

| File | Role |
|---|---|
| `pipeline.py` | The agent itself. Transport-agnostic; every runner shares it. |
| `widget_server.py` | **Production.** Token-gated WebRTC offer endpoint for the web widget. |
| `web.py` | **Local dev.** Pipecat Playground UI, tenant from `CLIENT_ID`. Never expose. |
| `widget_token.py` | Verifies the session tokens the TS API signs. |
| `backend_client.py` | HTTP client for the backend's `/voice/*` bridge. |
| `bot.py`, `server.py` | **PARKED** — Twilio phone path, fully commented out. |

## 1. One-time setup

```bash
cd ai-front-desk-mvp/voice-agent
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # then fill in your keys (step 2)
```

## 2. Fill in `.env`

- `OPENROUTER_API_KEY` — the brain (LLM). Reuses the backend's OpenRouter account; grab the real
  key from **Cloudflare Worker secrets**. Keep `OPENROUTER_MODEL` on a **fast** model
  (default `anthropic/claude-3.5-haiku`) — big models raise time-to-first-token and the call
  feels laggy.
- `DEEPGRAM_API_KEY` — streaming speech-to-text.
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` — text-to-speech. Give the key
  **Text to Speech + Voices(Read)** access.
- `WIDGET_VOICE_TOKEN_SECRET` — **must be byte-identical** to the same variable in the Hono API.
  The API signs session tokens with it; this runtime verifies them. A mismatch rejects every call
  with `401` and the widget shows "token is invalid or expired".
- `BACKEND_URL` + `INTERNAL_API_TOKEN` — optional. When set, the agent grounds on the tenant's
  real KB and persists transcripts. Leave `BACKEND_URL` blank to run standalone on the local
  persona.

## 3. Run it

### Local dev — talk to the agent in your browser

```bash
python3 web.py     # open the printed http://localhost:<port> URL, click Connect, allow mic, talk
```

Tenant comes from `CLIENT_ID` in `.env`. There is **no session token check**, so this runner is
for your machine only — never put it on a public host.

> Use `http://localhost:<port>`, **not** `0.0.0.0` — browsers block WebRTC on `0.0.0.0`.

### Production — serve the web widget

```bash
python3 widget_server.py     # listens on VOICE_RUNTIME_PORT (default 7860)
```

Then point the API at it: `VOICE_RUNTIME_URL=https://<this-host>` in the Hono API's env.

Full path:

```
browser (widget)
   │  POST /api/widget-voice/session      (Next proxy → Hono API)
   │  ← { sessionToken, voiceRuntimeUrl, iceServers, maxDurationS }
   │
   │  POST /api/offer  { sdp, request_data: { sessionToken } }
   ▼
widget_server.py ──verify token──► clientId
   │
   ├─ pipeline.py  (Deepgram → OpenRouter → ElevenLabs)
   └─ backend_client.py ──internal token──► Hono API /voice/*
```

The browser never holds `INTERNAL_API_TOKEN`. The signed token names the tenant, so a visitor
cannot open a call on someone else's client, extend their own expiry, or raise their duration cap.

Health check: `GET /health` → `{"status":"ok","activeCalls":N,"maxConcurrentCalls":N}`.

## 4. Before going live

- [ ] **TURN server.** Non-optional. Without it ~15-20% of visitors (symmetric NAT, corporate
      firewalls) silently fail to connect. See `../infra/coturn/turnserver.conf.example`, then set
      `WEBRTC_TURN_URL` / `_USERNAME` / `_PASSWORD` here and `WEBRTC_ICE_SERVERS` in the API.
      Verify with trickle-ICE: you must see a candidate of type **relay**.
- [ ] **HTTPS.** `getUserMedia` only works on a secure origin. Terminate TLS in front of this.
- [ ] **Real `WIDGET_VOICE_TOKEN_SECRET`** (≥32 chars) on both sides. The dev default is public.
- [ ] **Tune `VOICE_MAX_CONCURRENT_CALLS`** for the host. Each call holds an STT socket, an LLM
      stream and a TTS socket.
- [ ] **Bot-protection on the mint** (e.g. Turnstile in `routes/widget-voice.ts`) before opening
      the widget to untrusted traffic. Anonymous callers spend real STT/LLM/TTS money.
- [ ] **Mobile Safari pass.** Historically the flakiest WebRTC target; test it explicitly.

## Scaling note

`SmallWebRTCTransport` is peer-to-peer: one server process holds one call. That is fine for a
pilot and early customers. Past a few dozen concurrent calls, put an SFU in front (self-hosted
LiveKit keeps the no-vendor property; Daily or Cloudflare Realtime are the managed options).
Neither is a launch blocker.

## Telephony (parked)

`bot.py` and `server.py` hold the Twilio phone path, commented out on 2026-07-28. No provider was
available (Twilio rejected BD numbers) and the widget path needs none. The backend side is parked
in step with them — see the header of `../apps/hono-api/src/services/telephony.ts`. Nothing in
either file is coupled to a specific carrier, so reviving the phone path means restoring a
transport and routes, not a rewrite.
