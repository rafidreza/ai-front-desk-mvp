import { NextRequest } from 'next/server';

export const internalSessionCookieName = 'afd_internal_session';
const encoder = new TextEncoder();

export type InternalSessionRole = 'admin' | 'operator' | 'read-only';

export interface InternalSession {
  sub: 'internal-console';
  userId: string;
  label: string;
  email?: string;
  role: InternalSessionRole;
  exp: number;
}

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

export async function createInternalSessionCookie(input: {
  userId: string;
  label: string;
  email?: string;
  role: InternalSessionRole;
}) {
  return createSignedValue({
    sub: 'internal-console',
    userId: input.userId,
    label: input.label,
    email: input.email,
    role: input.role,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
}

export async function verifyInternalSessionCookie(value?: string) {
  if (value === undefined) return null;
  const [payload, signature] = value.split('.');
  if (payload === undefined || signature === undefined) return null;
  if ((await sign(payload)) !== signature) return null;

  try {
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Partial<InternalSession>;
    if (
      parsed.sub !== 'internal-console' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now() ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.label !== 'string' ||
      (parsed.role !== 'admin' && parsed.role !== 'operator' && parsed.role !== 'read-only')
    ) {
      return null;
    }
    return parsed as InternalSession;
  } catch {
    return null;
  }
}

export async function hasInternalSession(request: NextRequest) {
  return (await verifyInternalSessionCookie(request.cookies.get(internalSessionCookieName)?.value)) !== null;
}

export async function getInternalSession(request: NextRequest) {
  return verifyInternalSessionCookie(request.cookies.get(internalSessionCookieName)?.value);
}
