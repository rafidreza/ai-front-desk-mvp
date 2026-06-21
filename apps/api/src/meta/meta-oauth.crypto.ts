import { createHmac, randomUUID, timingSafeEqual, webcrypto } from 'crypto';

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(input: string) {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

async function encryptionKey(secret: string) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return webcrypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function randomMetaOAuthId() {
  return `meta-oauth-${randomUUID()}`;
}

export function signState(secret: string, stateId: string) {
  return createHmac('sha256', secret).update(stateId).digest('hex');
}

export function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function encryptSecret(secret: string, plaintext: string) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(secret: string, encrypted: string) {
  const [version, iv, ciphertext] = encrypted.split('.');
  if (version !== 'v1' || iv === undefined || ciphertext === undefined) {
    throw new Error('Unsupported encrypted secret format.');
  }
  const key = await encryptionKey(secret);
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    key,
    fromBase64Url(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
