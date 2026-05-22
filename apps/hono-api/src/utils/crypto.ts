function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encode(input: string) {
  return new TextEncoder().encode(input);
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function randomId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix === undefined ? id : `${prefix}${id}`;
}

export function randomSixDigitCode(env: { NODE_ENV?: string; DEV_CLIENT_AUTH_CODE?: string }) {
  if (env.NODE_ENV !== 'production' && env.DEV_CLIENT_AUTH_CODE !== undefined && env.DEV_CLIENT_AUTH_CODE !== '') {
    if (!/^\d{6}$/.test(env.DEV_CLIENT_AUTH_CODE)) {
      throw new Error('DEV_CLIENT_AUTH_CODE must be exactly 6 digits.');
    }
    return env.DEV_CLIENT_AUTH_CODE;
  }

  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String((bytes[0] ?? 0) % 1_000_000).padStart(6, '0');
}

export function timingSafeStringEqual(left: string, right: string) {
  const leftBytes = encode(left);
  const rightBytes = encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, data: string | Uint8Array) {
  const keyBytes = encode(secret);
  const payloadBytes = typeof data === 'string' ? encode(data) : data;
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(payloadBytes));
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256HmacMatches(input: { secret: string; payload: string | Uint8Array; signature?: string }) {
  if (input.signature === undefined) return false;
  const expected = `sha256=${await hmacSha256Hex(input.secret, input.payload)}`;
  return timingSafeStringEqual(expected, input.signature);
}
