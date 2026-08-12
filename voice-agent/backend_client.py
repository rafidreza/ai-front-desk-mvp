"""HTTP client for the TS backend's voice bridge (apps/hono-api/src/routes/voice.ts).

Both runners use this to plug the voice pipeline into the tenant-safe backend: resolve the tenant
from the dialled number, open/close the Call record, persist transcript turns, fetch the client's
KB/context for grounding, and raise escalations. All calls send the internal bearer token.

Requires env: BACKEND_URL (e.g. https://api.dev.daemion.io), INTERNAL_API_TOKEN.
If BACKEND_URL is unset, callers should fall back to local behaviour (the hardcoded persona) so the
browser spike still runs without a backend.
"""

import os
from typing import Any, Optional

import httpx


class BackendClient:
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = (base_url or os.getenv("BACKEND_URL") or "").rstrip("/")
        self.token = token or os.getenv("INTERNAL_API_TOKEN") or ""
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def enabled(self) -> bool:
        return bool(self.base_url and self.token)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    async def _post(self, path: str, body: dict) -> Any:
        resp = await self._client.post(f"{self.base_url}{path}", json=body, headers=self._headers())
        resp.raise_for_status()
        return resp.json()

    async def _get(self, path: str) -> Any:
        resp = await self._client.get(f"{self.base_url}{path}", headers=self._headers())
        resp.raise_for_status()
        return resp.json()

    # --- Tenant + call lifecycle (T1/T4) ---------------------------------------------------------
    # PARKED (2026-07-28): `resolve` and `start_call` target /voice/resolve and /voice/calls, the
    # dialled-number ingress routes, which are commented out in the API while there is no
    # telephony provider. Restore them together. The live entry point is `start_session` below.
    #
    # async def resolve(self, dialled_number: str) -> Optional[dict]:
    #     try:
    #         return await self._post("/voice/resolve", {"dialledNumber": dialled_number})
    #     except httpx.HTTPStatusError as e:
    #         if e.response.status_code == 404:
    #             return None  # no client mapped — caller must reject (no fallback tenant)
    #         raise
    #
    # async def start_call(self, dialled_number: str, caller_id_masked: Optional[str] = None,
    #                      language_posture: Optional[str] = None) -> dict:
    #     body: dict = {"dialledNumber": dialled_number}
    #     if caller_id_masked:
    #         body["callerIdMasked"] = caller_id_masked
    #     if language_posture:
    #         body["languagePosture"] = language_posture
    #     return (await self._post("/voice/calls", body))["call"]

    async def start_session(self, client_id: str, language_posture: Optional[str] = None,
                            caller_id_masked: Optional[str] = None) -> dict:
        """Start a call for an already-known client (browser/web-mic; no dialled number)."""
        body: dict = {"clientId": client_id}
        if language_posture:
            body["languagePosture"] = language_posture
        if caller_id_masked:
            body["callerIdMasked"] = caller_id_masked
        return (await self._post("/voice/sessions", body))["call"]

    async def persist_turn(self, call_id: str, client_id: str, turn_index: int, speaker: str,
                           text: str, language: Optional[str] = None, latency_ms: Optional[int] = None) -> dict:
        body: dict = {"clientId": client_id, "turnIndex": turn_index, "speaker": speaker, "text": text}
        if language:
            body["language"] = language
        if latency_ms is not None:
            body["latencyMs"] = latency_ms
        return (await self._post(f"/voice/calls/{call_id}/turns", body))["segment"]

    async def finalize_call(self, call_id: str, client_id: str, status: str,
                            end_reason: Optional[str] = None, recording_url: Optional[str] = None,
                            outcome: Optional[str] = None) -> Optional[dict]:
        body: dict = {"clientId": client_id, "status": status}
        for k, v in (("endReason", end_reason), ("recordingUrl", recording_url), ("outcome", outcome)):
            if v:
                body[k] = v
        return (await self._post(f"/voice/calls/{call_id}/finalize", body)).get("call")

    # --- Grounding context (T5/T12) --------------------------------------------------------------
    async def get_context(self, client_id: str) -> dict:
        return await self._get(f"/voice/clients/{client_id}/context")

    async def get_knowledge(self, client_id: str) -> list:
        return (await self._get(f"/voice/clients/{client_id}/knowledge")).get("entries", [])

    # --- Thread state / qualification / escalation (T3/T7/T8) ------------------------------------
    async def resolve_thread(self, client_id: str, identity: str) -> dict:
        return (await self._post("/voice/threads/resolve", {"clientId": client_id, "identity": identity}))["thread"]

    async def update_thread_state(self, thread_id: str, client_id: str, state: dict) -> dict:
        return (await self._post(f"/voice/threads/{thread_id}/state", {"clientId": client_id, "state": state}))["fields"]

    async def qualify(self, call_id: str, client_id: str, thread_id: str, fields: dict) -> dict:
        body = {"clientId": client_id, "threadId": thread_id, "fields": fields}
        return (await self._post(f"/voice/calls/{call_id}/qualify", body))["verdict"]

    async def escalate(self, call_id: str, client_id: str, reason: str, thread_id: Optional[str] = None,
                       mode: Optional[str] = None, payload: Optional[dict] = None) -> dict:
        body: dict = {"clientId": client_id, "reason": reason}
        for k, v in (("threadId", thread_id), ("mode", mode), ("payload", payload)):
            if v:
                body[k] = v
        return (await self._post(f"/voice/calls/{call_id}/escalate", body))["escalation"]

    async def score(self, call_id: str, client_id: str) -> dict:
        return (await self._post(f"/voice/calls/{call_id}/score", {"clientId": client_id}))["score"]

    async def aclose(self):
        await self._client.aclose()


def build_grounded_prompt(base_persona: str, context: dict, knowledge: list) -> str:
    """Compose the agent's system prompt from the client's real KB + voice config.

    Falls back to just the base persona if no KB is available. Keeps the strict grounding rule.
    """
    lines = [base_persona.strip(), ""]
    voice_config = (context or {}).get("voiceConfig") or {}
    greeting = voice_config.get("greeting")
    if greeting:
        lines.append(f"Open the call with this greeting: {greeting}")
    if knowledge:
        lines.append("")
        lines.append("KNOWLEDGE BASE — answer ONLY from these facts; if it's not here, say you're not sure:")
        for entry in knowledge:
            title = entry.get("title", "")
            answer = entry.get("answer", "")
            lines.append(f"- {title}: {answer}")
    return "\n".join(lines)
