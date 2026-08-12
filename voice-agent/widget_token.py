"""Verifier for web-widget voice session tokens.

The mint lives in the TS API (apps/hono-api/src/services/widget-voice.ts); this is the other half.
Both sides share WIDGET_VOICE_TOKEN_SECRET and the same wire format:

    <version>.<base64url(json payload)>.<hmac_sha256_hex(version + "." + body)>

The runtime takes the tenant from the verified payload and NEVER from anything the browser sends
alongside it. A visitor can read their own token — they just cannot forge one for another tenant,
extend its expiry, or raise its duration cap.

Keep this file in lockstep with the TS signer. If the payload layout changes, bump TOKEN_VERSION
on both sides so old tokens fail closed instead of being misread.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from typing import Optional

TOKEN_VERSION = "v1"


class InvalidSessionToken(Exception):
    """Raised for any bad token: wrong shape, wrong version, bad signature, or expired."""


@dataclass(frozen=True)
class WidgetVoiceSession:
    client_id: str
    visitor_id: str
    issued_at: int
    expires_at: int
    max_duration_s: int
    nonce: str


def _b64url_decode(segment: str) -> bytes:
    """base64url without padding — restore the padding the signer stripped."""
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def widget_voice_secret() -> str:
    """The shared secret. Falls back to the dev value the TS side uses, so local work needs no setup."""
    return os.getenv("WIDGET_VOICE_TOKEN_SECRET") or "dev-widget-voice-token-secret-only-for-local-work"


def verify_session_token(token: str, secret: Optional[str] = None, now: Optional[int] = None) -> WidgetVoiceSession:
    """Verify a token and return its payload, or raise InvalidSessionToken.

    Callers must treat the exception as "refuse the call" — there is no partial trust here.
    """
    secret = secret or widget_voice_secret()
    now = int(time.time()) if now is None else now

    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidSessionToken("Malformed token.")
    version, body, signature = parts
    if version != TOKEN_VERSION:
        raise InvalidSessionToken(f"Unsupported token version: {version}")

    expected = hmac.new(secret.encode("utf-8"), f"{version}.{body}".encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise InvalidSessionToken("Bad signature.")

    try:
        payload = json.loads(_b64url_decode(body))
    except Exception as exc:  # noqa: BLE001
        raise InvalidSessionToken("Undecodable payload.") from exc

    client_id = payload.get("clientId")
    expires_at = payload.get("expiresAt")
    if not isinstance(client_id, str) or client_id == "":
        raise InvalidSessionToken("Token carries no tenant.")
    if not isinstance(expires_at, int) or expires_at <= now:
        raise InvalidSessionToken("Token expired.")

    return WidgetVoiceSession(
        client_id=client_id,
        visitor_id=str(payload.get("visitorId") or ""),
        issued_at=int(payload.get("issuedAt") or 0),
        expires_at=expires_at,
        max_duration_s=int(payload.get("maxDurationS") or 0),
        nonce=str(payload.get("nonce") or ""),
    )
