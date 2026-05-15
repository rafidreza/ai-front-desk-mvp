import { NextRequest } from 'next/server';

export const clientSessionCookieName = 'afd_client_session';
const encoder = new TextEncoder();

export interface ClientSession {
  sub: 'client-console';
  clientId: string;
  exp: number;
}

function getSessionSecret() {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && (secret === undefined || secret.length < 32)) {
    throw new Error('CLIENT_SESSION_SECRET must be set to at least 32 characters in production.');
  }
  return secret ?? 'dev-client-session-only-for-local-work';
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

function decodePayload(payload: string) {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as Partial<ClientSession>;
}

export async function createClientSessionCookie(clientId: string) {
  return createSignedValue({
    sub: 'client-console',
    clientId,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });
}

export async function verifyClientSessionCookie(value?: string): Promise<ClientSession | null> {
  if (value === undefined) return null;
  const [payload, signature] = value.split('.');
  if (payload === undefined || signature === undefined) return null;
  if ((await sign(payload)) !== signature) return null;

  try {
    const parsed = decodePayload(payload);
    if (parsed.sub !== 'client-console' || typeof parsed.clientId !== 'string') return null;
    if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    return { sub: parsed.sub, clientId: parsed.clientId, exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function getClientSession(request: NextRequest) {
  return verifyClientSessionCookie(request.cookies.get(clientSessionCookieName)?.value);
}
