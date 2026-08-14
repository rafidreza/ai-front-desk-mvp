export interface Env {
  PORT?: string;
  NODE_ENV?: string;
  WEB_APP_URL?: string;
  API_BASE_URL?: string;
  INTERNAL_API_TOKEN?: string;
  DATABASE_URL?: string;
  MESSENGER_VERIFY_TOKEN?: string;
  ENABLE_MESSENGER?: string;
  MESSENGER_GRAPH_VERSION?: string;
  MESSENGER_APP_SECRET?: string;
  MESSENGER_PAGE_ACCESS_TOKEN?: string;
  MESSENGER_PAGE_TOKEN_EXPIRES_AT?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_OAUTH_REDIRECT_URI?: string;
  META_OAUTH_SCOPES?: string;
  ENABLE_P1_WHATSAPP_PINGS?: string;
  ENABLE_WHATSAPP?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  EMAIL_FROM_ADDRESS?: string;
  DIGEST_FROM_EMAIL?: string;
  POSTMARK_SERVER_TOKEN?: string;
  POSTMARK_MESSAGE_STREAM?: string;
  GOOGLE_CLOUD_VISION_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ASR_OPENAI_API_KEY?: string;
  ASR_TRANSCRIPTION_MODEL?: string;
  ASR_TRANSCRIPTION_PROMPT?: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  INTERNAL_CONSOLE_PASSWORD?: string;
  INTERNAL_CONSOLE_SESSION_SECRET?: string;
  ENABLE_DEV_INTERNAL_USERS?: string;
  CLIENT_AUTH_CODE_SECRET?: string;
  DEV_RETURN_AUTH_CODE?: string;
  DEV_CLIENT_AUTH_CODE?: string;
  CLIENT_SESSION_SECRET?: string;
  TENANT_SECRET_ENCRYPTION_KEY?: string;
  // Web-widget voice calling (browser WebRTC -> Pipecat runtime).
  WIDGET_VOICE_TOKEN_SECRET?: string;
  VOICE_RUNTIME_URL?: string;
  WIDGET_VOICE_MAX_DURATION_S?: string;
  WIDGET_VOICE_TOKEN_TTL_S?: string;
  WEBRTC_ICE_SERVERS?: string;
  ENABLE_WIDGET_VOICE?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  APP_VERSION?: string;
  DAEMION_ENV?: string;
}

export function envString(env: Env, key: keyof Env, fallback?: string) {
  const value = env[key];
  return value === undefined || value === '' ? fallback : value;
}

export function nodeEnv(env: Env) {
  return envString(env, 'NODE_ENV', 'development') ?? 'development';
}

export function isProduction(env: Env) {
  return nodeEnv(env) === 'production';
}

// A preview deployment (e.g. dev.daemion.io) runs with NODE_ENV=production so the
// secret-length guards stay enforced, but is NOT the real production environment.
// Dev-only conveniences (returning the login code in the API response, fixed dev
// codes) are allowed on preview but never on real production.
export function isPreviewEnv(env: Env) {
  return envString(env, 'DAEMION_ENV') === 'preview';
}

export function allowedOrigins(env: Env) {
  return (envString(env, 'WEB_APP_URL', 'http://localhost:3002') ?? 'http://localhost:3002')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function internalApiToken(env: Env) {
  const token = envString(env, 'INTERNAL_API_TOKEN');
  if (isProduction(env) && (token === undefined || token.length < 32)) {
    throw new Error('INTERNAL_API_TOKEN must be set to at least 32 characters in production.');
  }
  return token ?? 'dev-internal-api-token-only-for-local-work';
}

export function authCodeSecret(env: Env) {
  const secret = envString(env, 'CLIENT_AUTH_CODE_SECRET');
  if (isProduction(env) && (secret === undefined || secret.length < 32)) {
    throw new Error('CLIENT_AUTH_CODE_SECRET must be set to at least 32 characters in production.');
  }
  return secret ?? 'dev-client-auth-code-secret-only-for-local-work';
}

// Key used to encrypt per-tenant secrets (connector/SIP credentials) at rest — see T26.
// Fail closed in real production: a weak/missing key must never silently protect tenant data.
export function tenantSecretEncryptionKey(env: Env) {
  const key = envString(env, 'TENANT_SECRET_ENCRYPTION_KEY');
  if (isProduction(env) && !isPreviewEnv(env) && (key === undefined || key.length < 32)) {
    throw new Error('TENANT_SECRET_ENCRYPTION_KEY must be set to at least 32 characters in production.');
  }
  return key ?? 'dev-tenant-secret-encryption-key-only-for-local-work';
}

// Shared secret between this API (mints widget voice session tokens) and the Pipecat voice
// runtime (verifies them). The visitor's browser carries the token but can never forge one, so
// this must be a real secret in production — a weak key lets anyone open a call on any tenant.
export function widgetVoiceTokenSecret(env: Env) {
  const secret = envString(env, 'WIDGET_VOICE_TOKEN_SECRET');
  if (isProduction(env) && (secret === undefined || secret.length < 32)) {
    throw new Error('WIDGET_VOICE_TOKEN_SECRET must be set to at least 32 characters in production.');
  }
  return secret ?? 'dev-widget-voice-token-secret-only-for-local-work';
}

/** Where the browser sends its WebRTC offer — the Pipecat runtime, not this Worker. */
export function voiceRuntimeUrl(env: Env) {
  return envString(env, 'VOICE_RUNTIME_URL', 'http://localhost:7860') ?? 'http://localhost:7860';
}

/** Hard cap on a single widget call. Bounds LLM/TTS spend per anonymous visitor. */
export function widgetVoiceMaxDurationS(env: Env) {
  const parsed = Number(envString(env, 'WIDGET_VOICE_MAX_DURATION_S', '300'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 300;
}

/** How long a minted session token stays usable. Short: it only has to survive one connect. */
export function widgetVoiceTokenTtlS(env: Env) {
  const parsed = Number(envString(env, 'WIDGET_VOICE_TOKEN_TTL_S', '120'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 120;
}

export function widgetVoiceEnabled(env: Env) {
  return envString(env, 'ENABLE_WIDGET_VOICE', isProduction(env) ? 'false' : 'true') === 'true';
}

/**
 * ICE servers handed to the browser, as JSON. STUN alone fails for the ~15-20% of visitors behind
 * symmetric NAT or a corporate firewall — set a TURN entry here in production (self-hosted coturn
 * or a rented relay), otherwise those calls silently never connect.
 */
export function webrtcIceServers(env: Env): Array<{ urls: string | string[]; username?: string; credential?: string }> {
  const raw = envString(env, 'WEBRTC_ICE_SERVERS');
  if (raw === undefined) return [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [{ urls: 'stun:stun.l.google.com:19302' }];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

export function shouldReturnDevCode(env: Env) {
  if (env.DEV_RETURN_AUTH_CODE !== 'true') return false;
  if (isProduction(env) && !isPreviewEnv(env)) {
    throw new Error('DEV_RETURN_AUTH_CODE must not be enabled in production.');
  }
  return true;
}
