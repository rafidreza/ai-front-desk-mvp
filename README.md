# AI Front Desk MVP

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
npm run dev:api
```

Health check:

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

## Environment Variables

Copy `.env.example` to `.env` when credentials are available.

- `PORT` defaults to `4000`.
- `DATABASE_URL` is required (Postgres / Neon). The API throws on startup if missing.
- `MESSENGER_VERIFY_TOKEN` is used for Meta webhook verification.
- `MESSENGER_PAGE_ACCESS_TOKEN` enables real Messenger sends.
- `MESSENGER_APP_SECRET` enables signed-webhook verification.
- `ENABLE_P1_WHATSAPP_PINGS=false` disables urgent-ticket WhatsApp alerts. By default, P1 alerts dry-run when WhatsApp credentials are missing.
- `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` enable real WhatsApp Cloud API P1 alerts to the client's `whatsappPoc` or `ownerPhone`.
- `ANTHROPIC_API_KEY` enables Claude responses.
- `INTERNAL_CONSOLE_PASSWORD` and `INTERNAL_CONSOLE_SESSION_SECRET` gate `/internal` and the backend proxy. In production the password must be at least 12 characters.
- `WEB_APP_URL` is the allowlisted origin for API CORS.

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
