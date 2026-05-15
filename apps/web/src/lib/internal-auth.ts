import { NextRequest } from 'next/server';

export const internalSessionCookieName = 'afd_internal_session';
const encoder = new TextEncoder();

function getSessionSecret() {
  const secret = process.env.INTERNAL_CONSOLE_SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && (secret === undefined || secret.length < 32)) {
    throw new Error('INTERNAL_CONSOLE_SESSION_SECRET must be set to at least 32 characters in production.');
  }
  return secret ?? 'dev-internal-session-only-for-local-work';
}

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

async function createSignedValue(payload: Record<string, unknown>) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function createInternalSessionCookie() {
  return createSignedValue({
    sub: 'internal-console',
    nonce: crypto.randomUUID(),
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
}

export async function verifyInternalSessionCookie(value?: string) {
  if (value === undefined) return false;
  const [payload, signature] = value.split('.');
  if (payload === undefined || signature === undefined) return false;
  if ((await sign(payload)) !== signature) return false;

  try {
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number; sub?: string };
    return parsed.sub === 'internal-console' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function hasInternalSession(request: NextRequest) {
  return verifyInternalSessionCookie(request.cookies.get(internalSessionCookieName)?.value);
}
