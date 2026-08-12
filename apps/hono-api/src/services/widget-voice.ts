import { hmacSha256Hex, randomId, timingSafeStringEqual } from '../utils/crypto';

/**
 * Web-widget voice calling: the session-token mint.
 *
 * Why this exists. The widget runs in an anonymous visitor's browser, so it can never hold the
 * INTERNAL_API_TOKEN that gates /voice/*. Instead the visitor asks this (public, rate-limited)
 * service for a short-lived, HMAC-signed token that names exactly one tenant. The browser hands
 * that token to the Pipecat voice runtime with its WebRTC offer; the runtime verifies the
 * signature with the same shared secret and learns the clientId from the token — never from
 * anything the browser claims. The runtime then talks to /voice/* server-side with the real
 * internal token.
 *
 * The token is deliberately NOT a bearer credential for the API. It authorises one thing: "open
 * one voice session for this clientId, before this expiry". Everything else stays server-side.
 */

/** Token format version — bump if the payload layout changes, so old tokens fail closed. */
const TOKEN_VERSION = 'v1';

export type WidgetVoiceTokenPayload = {
  /** Tenant the call belongs to. The runtime trusts this field and nothing else. */
  clientId: string;
  /** Widget-generated visitor id — for abuse accounting and thread continuity, not identity. */
  visitorId: string;
  /** Unix seconds. */
  issuedAt: number;
  /** Unix seconds. After this the runtime must refuse the offer. */
  expiresAt: number;
  /** Hard cap the runtime enforces on call length. */
  maxDurationS: number;
  /** Random, so two tokens for the same visitor never collide. */
  nonce: string;
};

export class WidgetVoiceDisabledError extends Error {
  constructor() {
    super('Voice calling is not enabled.');
    this.name = 'WidgetVoiceDisabledError';
  }
}

export class WidgetVoiceConsentError extends Error {
  constructor() {
    super('Consent is required before starting a voice call.');
    this.name = 'WidgetVoiceConsentError';
  }
}

/**
 * base64url without padding. Used for both halves of the token so it survives being put in a
 * header, a query string, or a JSON body untouched.
 */
function base64UrlEncode(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Sign a payload into `<version>.<base64url(json)>.<hmac-hex>`.
 * The version travels outside the signed body on purpose: a verifier can reject an unknown
 * version before it spends time on crypto.
 */
export async function signWidgetVoiceToken(secret: string, payload: WidgetVoiceTokenPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256Hex(secret, `${TOKEN_VERSION}.${body}`);
  return `${TOKEN_VERSION}.${body}.${signature}`;
}

/**
 * Verify and decode a token. Returns null for anything wrong — bad shape, bad version, bad
 * signature, or expired. Callers must treat null as "reject the call", never as "try harder".
 */
export async function verifyWidgetVoiceToken(
  secret: string,
  token: string,
  atSeconds = nowSeconds(),
): Promise<WidgetVoiceTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [version, body, signature] = parts as [string, string, string];
  if (version !== TOKEN_VERSION) return null;

  const expected = await hmacSha256Hex(secret, `${version}.${body}`);
  if (!timingSafeStringEqual(expected, signature)) return null;

  let payload: WidgetVoiceTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as WidgetVoiceTokenPayload;
  } catch {
    return null;
  }
  if (typeof payload.clientId !== 'string' || payload.clientId === '') return null;
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= atSeconds) return null;
  return payload;
}

export type WidgetVoiceSessionRequest = {
  clientId: string;
  visitorId: string;
  consent: boolean;
};

export type WidgetVoiceSessionGrant = {
  sessionToken: string;
  voiceRuntimeUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  expiresAt: number;
  maxDurationS: number;
};

export type WidgetVoiceConfig = {
  enabled: boolean;
  secret: string;
  runtimeUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  tokenTtlS: number;
  maxDurationS: number;
};

/** Minimal view of the client lookup this service needs — keeps it testable without a db. */
export type ClientLookup = {
  get(clientId: string): Promise<{ id: string } | null | undefined>;
};

/**
 * Mints voice session grants for the widget.
 *
 * Abuse posture: an anonymous visitor opening a call spends real STT/LLM/TTS money, so the mint
 * is gated three ways — the tenant must exist, consent must be explicit, and the token carries a
 * hard duration cap the runtime enforces. Per-IP request throttling is handled upstream by
 * rateLimitMiddleware; this service is the second line, not the first.
 */
export class WidgetVoiceService {
  constructor(
    private readonly config: WidgetVoiceConfig,
    private readonly clients: ClientLookup,
  ) {}

  /**
   * Issue a session grant, or throw. Returns null when the tenant does not exist — the caller
   * maps that to 404 so an attacker cannot enumerate clientIds by timing or message.
   */
  async createSession(input: WidgetVoiceSessionRequest): Promise<WidgetVoiceSessionGrant | null> {
    if (!this.config.enabled) throw new WidgetVoiceDisabledError();
    if (!input.consent) throw new WidgetVoiceConsentError();

    const client = await this.clients.get(input.clientId);
    if (client === null || client === undefined) return null;

    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + this.config.tokenTtlS;
    const sessionToken = await signWidgetVoiceToken(this.config.secret, {
      clientId: client.id,
      visitorId: input.visitorId,
      issuedAt,
      expiresAt,
      maxDurationS: this.config.maxDurationS,
      nonce: randomId(),
    });

    return {
      sessionToken,
      voiceRuntimeUrl: this.config.runtimeUrl,
      iceServers: this.config.iceServers,
      expiresAt,
      maxDurationS: this.config.maxDurationS,
    };
  }
}
