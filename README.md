# Daemion MVP

This folder contains the new MVP implementation for the managed F-Commerce support product.

It is intentionally separate from the legacy `frontend/` prototype, which was built for the older self-serve SaaS direction.

## Phase 0 Goal

Prove the first real loop:

1. Receive a Messenger-style webhook message.
2. Match it against one hardcoded pilot knowledge base.
3. Generate a reply through Claude when credentials exist, or a deterministic local fallback during development.
4. Log the conversation.
5. Create a ticket when confidence is too low or escalation language is detected.

## Run Locally

```bash
npm install
npm run db:generate -w @ai-front-desk/api
npm run dev:api
npm run dev:web
```

Local app:

```text
http://localhost:3002
```

API health check:

```bash
curl http://localhost:4000/health
```

Simulate a Messenger webhook:

```bash
curl -X POST http://localhost:4000/webhooks/messenger \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [
      {
        "id": "pilot-page",
        "messaging": [
          {
            "sender": { "id": "customer-1" },
            "recipient": { "id": "pilot-page" },
            "timestamp": 1710000000000,
            "message": { "mid": "m-1", "text": "delivery charge koto?" }
          }
        ]
      }
    ]
  }'
```

Web chat widget:

```html
<iframe
  src="https://your-web-domain.example/widget?clientId=pilot-client"
  title="Daemion chat"
  style="width: 360px; height: 560px; border: 0;"
></iframe>
```

Import seller knowledge files:

```bash
curl -X POST http://localhost:4000/clients/pilot-client/knowledge/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-internal-api-token-only-for-local-work" \
  -d '{
    "files": [
      {
        "fileName": "faq.txt",
        "contentType": "text/plain",
        "base64": "UTogRGVsaXZlcnkgY2hhcmdlPwpBOiBEaGFrYSBkZWxpdmVyeSBjaGFyZ2UgaXMgODAgdGFrYS4="
      }
    ]
  }'
```

## Environment Variables

Copy `.env.example` to `.env` when credentials are available.

- `PORT` defaults to `4000`.
- `DATABASE_URL` is required (Postgres / Neon). The API throws on startup if missing.
- `MESSENGER_VERIFY_TOKEN` is used for Meta webhook verification.
- `MESSENGER_PAGE_ACCESS_TOKEN` enables real Messenger sends.
- `MESSENGER_GRAPH_VERSION` optionally pins the Messenger Graph API version; defaults to `v20.0`.
- `MESSENGER_APP_SECRET` enables signed-webhook verification.
- `META_APP_ID`, `META_OAUTH_REDIRECT_URI`, and `META_OAUTH_SCOPES` configure the customer Facebook Page OAuth connection flow. Dev uses `https://dev.daemion.io/api/meta/callback`.
- `META_APP_SECRET` must be set as a secret, never committed. It signs OAuth state, exchanges callback codes, and encrypts saved Page access tokens.
- `ENABLE_P1_WHATSAPP_PINGS=false` disables urgent-ticket WhatsApp alerts. By default, P1 alerts dry-run when WhatsApp credentials are missing.
- `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` enable real WhatsApp Cloud API P1 alerts to the client's `whatsappPoc` or `ownerPhone`.
- `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` secure the `/webhooks/whatsapp` adapter. During migration-free alpha setup, set a client's `pageId` to the WhatsApp `phone_number_id` so inbound webhook events route to the right workspace.
- `EMAIL_FROM_ADDRESS`, `POSTMARK_SERVER_TOKEN`, and `POSTMARK_MESSAGE_STREAM` enable Postmark delivery for client auth codes and daily/weekly digests. Without Postmark credentials, delivery endpoints return dry-run mode.
- `GOOGLE_CLOUD_VISION_API_KEY` enables OCR for image uploads in the KB importer. Text, CSV, Markdown, JSON, PDF, and Excel extraction work without it.
- `OPENAI_API_KEY`, `ASR_TRANSCRIPTION_MODEL`, and `ASR_TRANSCRIPTION_PROMPT` enable optional voice-note transcription before AI reply generation. When unset, voice notes remain visible to operators as "transcript pending".
- `ANTHROPIC_API_KEY` enables Claude responses.
- `INTERNAL_CONSOLE_PASSWORD` and `INTERNAL_CONSOLE_SESSION_SECRET` gate `/internal` and the backend proxy. In production the password must be at least 12 characters.
- `WEB_APP_URL` is the allowlisted origin for API CORS.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable shared rate
  limits across Cloudflare Workers / server instances. When unset, local
  in-memory rate limits are used.
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, and `APP_VERSION` enable backend error
  reporting for unexpected 500-level failures. When `SENTRY_DSN` is empty,
  reporting is disabled and structured logs remain the only signal.

## Database Migrations

Migrations live under `apps/api/prisma/migrations/`. They are the source of truth — never run `prisma db push` against shared environments.

Local development:

```bash
# When the schema changes, generate a new migration against your dev DB:
npx prisma migrate dev --name <change_summary> --schema apps/api/prisma/schema.prisma

# Apply pending migrations to a clean dev DB:
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Staging / production:

```bash
npm run db:migrate
```

This runs `prisma migrate deploy` only — it never auto-creates tables or rewrites history. A clean deploy verification means applying all committed migrations against an empty Postgres and ending in a state that matches `schema.prisma`.

## Lint, Build, Test

```bash
npm run lint        # ESLint across api + web
npm run build       # API build (tsc)
npm run build:web   # Web build (Next.js)
npm test            # Vitest
```

CI runs all four on every push (see `.github/workflows/ci.yml`).

## Cloudflare Staging

The Cloudflare staging path uses two Workers:

- `ai-front-desk-hono-api-staging` for the Hono backend.
- `ai-front-desk-web-staging` for the vinext web app.

Authenticate Wrangler once before publishing:

```bash
npx wrangler login
```

Build and dry-run the Worker bundles locally:

```bash
npm run build:hono
npm run build:web:vinext
npm run test:hono
npm run deploy:dry-run:staging -w @ai-front-desk/hono-api
npm run deploy:vinext:dry-run:staging -w @ai-front-desk/web
```

Set staging secrets before the first real deploy. The API Worker needs at least
`DATABASE_URL`, `INTERNAL_API_TOKEN`, and `CLIENT_AUTH_CODE_SECRET` for database
and authenticated route checks. Add `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` before multi-instance or public traffic so rate-limit
counters are shared. Add Meta, Postmark, Vision, and Anthropic keys when those
integrations should run in staging.
Add `OPENAI_API_KEY` and optional `ASR_TRANSCRIPTION_MODEL` /
`ASR_TRANSCRIPTION_PROMPT` when voice notes should be automatically
transcribed. Add `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, and `APP_VERSION` when backend errors
should be reported to Sentry.

The web Worker needs `API_BASE_URL`, the same `INTERNAL_API_TOKEN`, and the web
session secrets: `INTERNAL_CONSOLE_PASSWORD`,
`INTERNAL_CONSOLE_SESSION_SECRET`, and `CLIENT_SESSION_SECRET`. Set the same
Upstash rate-limit secrets on the web Worker so internal login attempts use the
shared counter too.

Before enabling real Postmark email, complete the domain authentication steps in
[`docs/email-deliverability-launch-checklist.md`](docs/email-deliverability-launch-checklist.md)
so SPF, DKIM, and DMARC are ready for `support@daemion.io`.

For a non-technical view of what still blocks public launch, see
[`docs/public-launch-checklist.md`](docs/public-launch-checklist.md).

Set each secret per Worker environment from its app directory:

```bash
cd apps/hono-api
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret put INTERNAL_API_TOKEN --env staging
npx wrangler secret put CLIENT_AUTH_CODE_SECRET --env staging
npx wrangler secret put WEB_APP_URL --env staging
npx wrangler secret put META_APP_SECRET --env staging
npx wrangler secret put UPSTASH_REDIS_REST_URL --env staging
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --env staging
npx wrangler secret put OPENAI_API_KEY --env staging
npx wrangler secret put ASR_TRANSCRIPTION_MODEL --env staging
npx wrangler secret put ASR_TRANSCRIPTION_PROMPT --env staging
npx wrangler secret put SENTRY_DSN --env staging
npx wrangler secret put SENTRY_ENVIRONMENT --env staging
npx wrangler secret put APP_VERSION --env staging

cd ../web
npx wrangler secret put API_BASE_URL --env staging
npx wrangler secret put INTERNAL_API_TOKEN --env staging
npx wrangler secret put INTERNAL_CONSOLE_PASSWORD --env staging
npx wrangler secret put INTERNAL_CONSOLE_SESSION_SECRET --env staging
npx wrangler secret put CLIENT_SESSION_SECRET --env staging
npx wrangler secret put UPSTASH_REDIS_REST_URL --env staging
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --env staging
```

After the staging web URL is known, set the API Worker's `WEB_APP_URL` to that
origin for direct browser CORS requests. Deploy the API first, use its Worker URL
for the web Worker's `API_BASE_URL`, then publish the web Worker:

```bash
npm run deploy:staging:hono
npm run deploy:staging:web
```
