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

export function shouldReturnDevCode(env: Env) {
  if (env.DEV_RETURN_AUTH_CODE !== 'true') return false;
  if (isProduction(env) && !isPreviewEnv(env)) {
    throw new Error('DEV_RETURN_AUTH_CODE must not be enabled in production.');
  }
  return true;
}
