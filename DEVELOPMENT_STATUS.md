# Development Status

**Last updated:** 2026-05-16

## Current Milestone

Phase 0 Messenger spike has started.

The first working slice is intentionally thin:

- NestJS API scaffold inside `apps/api`
- Hardcoded pilot client
- Hardcoded pilot knowledge base
- Messenger webhook verification endpoint
- Messenger webhook POST handler
- Messenger `X-Hub-Signature-256` verification when `MESSENGER_APP_SECRET` is configured
- Database health endpoint
- Structured operational logs for webhook receipt, message processing, and ticket creation
- Ticket status update endpoint with ticket-event persistence
- Ticket detail endpoint with event timeline
- Claude integration path when `ANTHROPIC_API_KEY` exists
- Local deterministic fallback when no API key exists
- Neon/PostgreSQL persistence via Prisma
- Persisted conversation log
- Persisted ticket creation for low-confidence or escalation cases
- Seed script for pilot client and pilot knowledge base
- Dry-run Messenger send mode when `MESSENGER_PAGE_ACCESS_TOKEN` is missing
- Unit tests for KB answer and low-confidence ticket behavior
- Next.js internal operations console inside `apps/web`
- Refined internal console visual design with sidebar navigation, KPI strip, triage workbench, denser ticket rows, clearer case detail, and improved responsive behavior
- Lightweight internal auth gate on `/internal` with passcode login, HTTP-only session cookie, middleware redirect, and sign-out action
- Formal Prisma migration baseline for the previously pushed schema
- Prisma migration for ticket assignees, ticket comments, and manual QA grading fields
- Internal console assignee filter and assignee update control
- Internal ticket notes/comments
- Manual QA Review view for the last 100 conversations with thumbs up/down grading, hallucination flagging, containment metric, and hallucination metric
- Neon connection moved from `sslmode=require` to `sslmode=verify-full`
- QA report hardening pass: signed internal sessions, same-origin API proxy, protected API bearer guard, CORS allowlist, rate limits, stricter Messenger secret handling, Graph API timeout, duplicate-webhook idempotency, shared DTO package, internal users endpoint, random conversation ids for new conversations, ticket enums, ticket versioning, optimistic update conflicts, and CI workflow
- Phase 1 client foundation started:
  - client signup API and `/signup` page;
  - DB-backed client profile metadata;
  - client dashboard API and `/client/dashboard` page;
  - client ticket delegation API and `/client/tickets` page;
  - client auth foundation with OTP challenge persistence, signed client sessions, `/client/login`, protected client pages, client-scoped API proxy access, and email/WhatsApp code delivery in dry-run/provider-ready modes;
  - web CSAT capture API and score buttons, plus Messenger quick-reply/postback/text rating capture;
  - daily/weekly digest preview API plus Postmark/dry-run email delivery and cron-callable send endpoint;
  - internal per-client KB workspace at `/internal/knowledge` with entry list, detail editor, draft creation, publish/archive actions, version history, and rollback;
  - KB status/version/history fields with audit rows for baseline, create, update, publish, archive, and rollback actions;
  - pgvector-backed KB embeddings with deterministic local embedding fallback, reindex endpoint, and hybrid keyword/vector retrieval;
  - internal prompt profile workspace at `/internal/agent-config` with prompt draft/edit/publish/archive/version/rollback;
  - active client prompt profiles are now loaded into AI reply generation with fallback to the client's legacy tone when no stored profile exists;
  - sales recovered estimate calculation and backfill;
  - P1 urgent-ticket WhatsApp ping to the client's configured POC, with dry-run mode when WhatsApp Cloud API credentials are missing and ticket timeline events for ping outcomes.

## Verified

Commands run successfully:

```bash
npm run build
npm run build:web
npm test
npm run db:generate -w @ai-front-desk/api
npm run db:push -w @ai-front-desk/api
npm run db:seed -w @ai-front-desk/api
npm run db:migrate -w @ai-front-desk/api
npm audit --omit=dev --audit-level=high
npm run lint
```

Manual HTTP checks passed:

- `GET /health`
- `GET /health/db`
- `POST /webhooks/messenger` with a known delivery-charge question
- `POST /webhooks/messenger` with an unknown product-detail question
- `POST /webhooks/messenger` with a valid signed payload
- `POST /webhooks/messenger` with an invalid signed payload, returning `401`
- `PATCH /tickets/:id/status`
- `GET /tickets/:id`
- `GET /conversations`
- `GET /tickets`
- `GET /internal` in the web app
- `/internal` after UI redesign
- Unauthenticated `GET /internal` redirects to `/internal/login?next=%2Finternal`
- Invalid internal login passcode returns `401`
- Valid internal login passcode sets the `afd_internal_session` HTTP-only cookie
- Authenticated `GET /internal` returns `200`
- Internal logout clears the session cookie and subsequent `GET /internal` redirects again
- `PATCH /tickets/:id/assignee`
- Stale-version `PATCH /tickets/:id/status` returns `409`
- `POST /tickets/:id/comments`
- `PATCH /conversations/:id/grade`
- Anonymous `GET /tickets` returns `401`
- Authenticated same-origin web proxy `GET /api/backend/tickets` returns `200`
- `GET /tickets/:id` returns comments and expanded event history
- API restart, then `GET /conversations` and `GET /tickets` again to confirm persistence
- `GET /clients`
- `GET /clients/pilot-client/dashboard`
- `GET /clients/pilot-client/knowledge`
- `GET /clients/pilot-client/digests/daily/preview`
- `GET /signup` in the web app
- `GET /client/login`
- Unauthenticated `GET /client/dashboard?clientId=pilot-client` redirects to `/client/login`
- `POST /api/client-auth/request` returns a masked challenge response; development login code is returned only when `DEV_RETURN_AUTH_CODE=true`
- `POST /api/client-auth/verify` sets the signed client session cookie
- `POST /clients/pilot-client/digests/daily/send` can produce a dry-run or Postmark delivery result
- `POST /clients/pilot-client/digests/weekly/send` can produce a dry-run or Postmark delivery result
- Messenger CSAT quick-reply/postback payloads such as `CSAT_5` update the existing conversation rating
- Authenticated `GET /client/dashboard?clientId=pilot-client` returns `200`
- Authenticated client proxy `GET /api/backend/clients/pilot-client/dashboard` returns `200`
- Authenticated client proxy `GET /api/backend/tickets` returns `401`
- `POST /clients/pilot-client/knowledge`
- `PATCH /clients/pilot-client/knowledge/:entryId`
- `PATCH /clients/pilot-client/knowledge/:entryId/status`
- `GET /clients/pilot-client/knowledge/:entryId/versions`
- `POST /clients/pilot-client/knowledge/:entryId/rollback`
- `POST /clients/pilot-client/knowledge/reindex`
- Messenger-style delivery-cost question after reindex returned the delivery-charge KB answer through hybrid retrieval.
- `GET /clients/pilot-client/prompts`
- `POST /clients/pilot-client/prompts`
- `PATCH /clients/pilot-client/prompts/:profileId`
- `PATCH /clients/pilot-client/prompts/:profileId/status`
- `GET /clients/pilot-client/prompts/:profileId/versions`
- `POST /clients/pilot-client/prompts/:profileId/rollback`
- P1 refund-style escalation creates an urgent ticket and records a `ticket.p1_whatsapp_ping` timeline event in dry-run mode when WhatsApp credentials are absent.

Database verification:

- Neon schema pushed successfully.
- Existing Neon database baselined for Prisma migrations.
- Ops hardening migration applied successfully.
- Pilot client and knowledge base seeded successfully.
- Known Messenger-style message persisted as a conversation.
- Unknown product-detail message persisted as a P2 ticket.
- Ticket assignee update persisted to Neon.
- Ticket internal note persisted to Neon.
- Conversation QA grade persisted to Neon.
- Client profile metadata columns migrated successfully.
- Knowledge entry status/version columns migrated successfully.
- Knowledge entry version history table migrated and existing entries backfilled successfully.
- `pgvector` extension enabled successfully in Neon.
- Knowledge entry embedding columns and ivfflat index migrated successfully.
- Existing pilot KB entries were reindexed successfully.
- Prompt profile table migrated successfully.
- Existing clients received a default active prompt profile during migration.
- Prompt profile version history table migrated and existing default profiles were backfilled successfully.
- Conversation CSAT columns migrated successfully.
- Ticket sales recovered estimate column migrated and backfilled successfully.
- Client auth challenge table migrated successfully.
- Data remained available after API restart.

Audit note:

- `npm audit --omit=dev` currently reports a moderate advisory through Prisma's `@prisma/dev -> @hono/node-server` dependency.
- `npm audit --omit=dev` also reports a moderate PostCSS advisory through Next's nested dependency.
- The suggested automatic fixes currently point to breaking or invalid framework changes, so they have not been applied.
- `npm audit --omit=dev --audit-level=high` passes, and CI uses that gate until Prisma/Next publish safe patched dependency chains or a deliberate dependency migration is scheduled.

Operational hardening verification:

- `GET /health/db` returned `ok` against Neon.
- Unsigned local webhook requests are allowed only when `MESSENGER_APP_SECRET` is not configured.
- Signed webhook request with a valid `X-Hub-Signature-256` was accepted.
- Signed webhook request with an invalid `X-Hub-Signature-256` returned `401 Unauthorized`.
- Structured logs now include `messenger.webhook.received`, `messenger.message.processed`, and `ticket.created`.
- Ticket status updates persist to Neon and create ticket events.
- Ticket detail API returns ticket events in chronological order.
- Internal console loads conversations, tickets, health status, ticket detail, suggested reply, and status controls.
- Internal console shows ticket timeline and scoped update feedback.
- Internal console has panel-level loading, error, and retry states for database health, tickets, conversations, and active ticket detail.
- Internal console is protected by a lightweight passcode gate for local/alpha use.
- Internal console supports assignee filtering, assignee updates, ticket notes, and manual QA grading.
- Internal console now reaches the API through a same-origin Next.js proxy; direct API data/mutation endpoints require an internal bearer token.
- `sslmode=verify-full` was tested successfully against Neon and applied locally.
- Redesigned internal console production build completed successfully and local route returned HTTP 200 after dev-server restart.

## Current Limitations

- No real Messenger send unless `MESSENGER_PAGE_ACCESS_TOKEN` is configured.
- Real alpha seller KB is still missing; the app still uses the pilot seed data.
- `ANTHROPIC_API_KEY` is still missing, so the fallback answer path is still active.
- Public HTTPS deployment is still pending account/project access.
- Meta App setup and live Page traffic are still pending Meta credentials/access.
- Client-facing dashboard and delegation screens are protected by signed client sessions. Production auth delivery now has provider-ready email/WhatsApp paths, but real sends still require Postmark/WhatsApp credentials.
- No WhatsApp adapter yet.
- No real KB import pipeline yet.
- Internal KB editor now supports rich entry editing, version history, and rollback. It still needs real seller content/import pipelines before alpha use.
- KB retrieval now uses hybrid keyword/vector scoring, but the current embedding provider is deterministic/local. A production embedding provider can replace it later without changing the retrieval contract.
- Prompt profile versioning is now available, but prompt quality still needs real seller QA review and production Anthropic testing once `ANTHROPIC_API_KEY` is configured.
- Daily/weekly digest delivery has Postmark/dry-run wiring and cron-callable send endpoints, but production scheduling and domain DNS are still deployment tasks.
- Moderate npm audit advisories remain unresolved because the available automatic fixes are not safe for this stack.

## Local URLs

Latest verified run used:

- API: `http://localhost:4000` and `http://localhost:4002` both responded during smoke checks
- Web: `http://localhost:3002/internal`
- Internal login: `http://localhost:3002/internal/login`
- Client signup: `http://localhost:3002/signup`
- Client login: `http://localhost:3002/client/login`
- Client dashboard: `http://localhost:3002/client/dashboard?clientId=pilot-client`
- Client tickets: `http://localhost:3002/client/tickets?clientId=pilot-client`
- Internal KB editor: `http://localhost:3002/internal/knowledge`
- Internal agent config: `http://localhost:3002/internal/agent-config`

## Recommended Next Build Step

Close the Phase 0 kernel:

1. Provide alpha seller Q&A/source material so `TODO.md` T2 can be completed.
2. Provide `ANTHROPIC_API_KEY` and `MESSENGER_PAGE_ACCESS_TOKEN` so `TODO.md` T3/T4 can be completed.
3. Provide deployment and Meta developer/business access for `TODO.md` T5/T6/T7.
4. Continue non-blocked foundation work while external access is pending:
   - generalise channel send abstraction;
   - start the KB import pipeline;
   - add production observability;
   - provide real alpha seller Q&A/source content.
