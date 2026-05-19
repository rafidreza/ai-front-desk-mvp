# AI Front Desk — TODO

**Last updated:** 2026-05-19
**Source of truth for scope:** [`/MVP_GUIDELINE.md`](../MVP_GUIDELINE.md) + [`/PRD/`](../PRD/)
**Companion doc:** [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md) (verified build artifacts)

---

## How to use this file

- Each task is a checkbox. Tick when shipped.
- Completed tasks stay in the list with a trailing **— DONE (YYYY-MM-DD)** marker so historical progress is visible.
- Tasks are grouped into Tiers by priority. Tier 1 = next-up. Tier 8 = launch-prep.
- Add new tasks at the bottom of the relevant tier with a note.

---

## Progress snapshot

| Tier | Done | Pending | Total |
|---|---|---|---|
| 0 — Foundations | 22 | 0 | 22 |
| 1 — Phase 0 kernel close | 2 | 6 | 8 |
| 2 — Phase 0 hardening | 5 | 1 | 6 |
| 3 — Phase 1 multi-tenant | 7 | 2 | 9 |
| 4 — Client-facing features | 7 | 0 | 7 |
| 5 — Channels | 3 | 0 | 3 |
| 6 — KB build pipeline | 3 | 3 | 6 |
| 7 — QA & improvement loop | 3 | 2 | 5 |
| 8 — Ops / launch readiness | 0 | 6 | 6 |
| 9 — Improvement backlog | 4 | 8 | 12 |
| **TOTAL** | **56** | **28** | **84** |

---

## Tier 0 — Foundations (completed)

### Repo & infra

- [x] Initialise monorepo with npm workspaces (`apps/*`, `packages/*`) — **DONE (2026-05-14)**
- [x] Pin Node 22+ and TypeScript across stack — **DONE (2026-05-14)**
- [x] Wire `.env` and `.env.example` files — **DONE (2026-05-14)**
- [x] Add root build / dev / test scripts — **DONE (2026-05-14)**
- [x] Add Vitest test runner — **DONE (2026-05-14)**

### API (NestJS) — `apps/api`

- [x] Bootstrap NestJS app (`main.ts`, `app.module.ts`) — **DONE (2026-05-14)**
- [x] Health endpoints `GET /health` and `GET /health/db` — **DONE (2026-05-14)**
- [x] Messenger webhook verify (`GET /webhooks/messenger`) — **DONE (2026-05-14)**
- [x] Messenger webhook receive (`POST /webhooks/messenger`) — **DONE (2026-05-14)**
- [x] Messenger `X-Hub-Signature-256` verification with unit test — **DONE (2026-05-14)**
- [x] Dry-run Messenger send mode when no `PAGE_ACCESS_TOKEN` set — **DONE (2026-05-14)**
- [x] Structured logging (`messenger.webhook.received`, `messenger.message.processed`, `ticket.created`) — **DONE (2026-05-14)**
- [x] Anthropic Claude integration with model env var — **DONE (2026-05-14)**
- [x] Local deterministic fallback when no API key — **DONE (2026-05-14)**
- [x] Conversation + message persistence to Neon Postgres via Prisma — **DONE (2026-05-14)**
- [x] Ticket creation on low confidence / escalation — **DONE (2026-05-14)**
- [x] Ticket status update endpoint (`PATCH /tickets/:id/status`) with event log — **DONE (2026-05-14)**
- [x] Ticket detail endpoint (`GET /tickets/:id`) with event timeline — **DONE (2026-05-14)**
- [x] Conversations list (`GET /conversations`) — **DONE (2026-05-14)**

### Data layer

- [x] Prisma schema: Client, KnowledgeEntry, Conversation, Message, Ticket, TicketEvent — **DONE (2026-05-14)**
- [x] Connect Neon Postgres (`sslmode=verify-full`) — **DONE (2026-05-14, hardened 2026-05-15)**
- [x] Seed script with pilot client + 4 KB entries — **DONE (2026-05-14)**

### Knowledge (v0)

- [x] Keyword-match retrieval with Bangla + English keywords — **DONE (2026-05-14)**
- [x] Confidence scoring + per-entry boost — **DONE (2026-05-14)**

### Web (Next.js) — `apps/web`

- [x] Internal console at `/internal` (sidebar nav, KPI strip, ticket list, case detail, status controls, responsive layout) — **DONE (2026-05-14)**
- [x] API client (`lib/api.ts`) — **DONE (2026-05-14)**

---

## Tier 1 — Phase 0 kernel close (next 1–3 weekends)

- [x] **T1** Lightweight internal auth gate on `/internal` (per `DEVELOPMENT_STATUS.md` next-step list) — **DONE (2026-05-15)**
- [ ] **T2** Replace pilot KB with alpha seller's real 30–50 Q&A entries — **BLOCKED (2026-05-15): needs alpha seller Q&A/source material**
- [ ] **T3** Set `ANTHROPIC_API_KEY` in `.env` (currently empty → fallback path only) — **BLOCKED (2026-05-15): needs Anthropic API key**
- [ ] **T4** Set `MESSENGER_PAGE_ACCESS_TOKEN` for alpha seller's Page (currently dry-run only) — **BLOCKED (2026-05-15): needs Page access token**
- [ ] **T5** Deploy API + Web to public HTTPS (Vercel for web, Fly.io / Railway for API) — **BLOCKED (2026-05-15): needs deployment account/project access**
- [ ] **T6** Create Meta App in dev mode; add alpha seller as test user — **BLOCKED (2026-05-15): needs Meta developer/business access**
- [ ] **T7** Wire alpha seller's Facebook Page → webhook → live customer traffic — **BLOCKED (2026-05-15): depends on T4/T5/T6**
- [x] **T8** Build manual grading view: last 100 conversations + thumbs up/down → containment + hallucination metrics — **DONE (2026-05-15)**

---

## Tier 2 — Phase 0 hardening

- [x] **T9** Replace Prisma `db push` with formal migration files — **DONE (2026-05-15)**
- [ ] **T10** Resolve npm audit advisories (Prisma → `@hono/node-server`, Next → nested `postcss`) — **BLOCKED (2026-05-15): available npm audit fixes downgrade Prisma/Next to unsafe breaking versions; CI now gates high/critical advisories while these moderate upstream chains remain**
- [x] **T11** Move Neon connection to `sslmode=verify-full` once compatible — **DONE (2026-05-15)**
- [x] **T12** Add ticket assignee field + owner filter on the internal console — **DONE (2026-05-15)**
- [x] **T13** Add ticket comments / notes for internal operators — **DONE (2026-05-15)**
- [x] **T14** Per-panel error states with retry on the internal console — **DONE (2026-05-15)**

---

## Tier 3 — Phase 1 multi-tenant readiness

- [x] **T15** Remove hardcoded `pilot-client`; route every request by `Client` row — **DONE (2026-05-15): DB-backed client lookup/signup is now the source for client profiles; pilot data remains only as seed/demo content**
- [x] **T16** Client sign-up page (`/signup`, per PRD 01) — **DONE (2026-05-15)**
- [ ] **T17** Meta OAuth flow for `pages_messaging` (replace manual token) — **BLOCKED (2026-05-15): needs Meta app/business access and OAuth decisions**
- [x] **T18** Magic-link + WhatsApp OTP auth (PRD 01 §8.4) — **DONE (2026-05-16): client session, OTP challenge table, request/verify endpoints, protected client pages, email/WhatsApp code delivery, dry-run mode, and provider-ready Postmark/WhatsApp Cloud API wiring shipped**
- [ ] **T19** Conversational onboarding bot via Messenger (PRD 03 §8.1) — **BLOCKED (2026-05-15): depends on Meta live channel access**
- [x] **T20** Internal KB editor UI (per-client tree + entry panel) — **DONE (2026-05-15): entry list, detail editor, draft creation, publish/archive actions, filters, and version panel shipped**
- [x] **T21** KB versioning (`draft` / `active` / `archived`) with rollback — **DONE (2026-05-15): history table, audit actions, baseline backfill, update/publish/archive snapshots, and rollback-as-new-draft shipped**
- [x] **T22** Vector embeddings via pgvector (replace keyword-only retrieval) — **DONE (2026-05-16): pgvector migration, deterministic embedding fallback, KB embedding writes, reindex endpoint, and hybrid keyword/vector retrieval shipped**
- [x] **T23** Prompt versioning per client (PRD 02) — **DONE (2026-05-15): prompt profiles, draft/active/archive states, version history, rollback, internal UI, and AI reply integration shipped**

---

## Tier 4 — Client-facing features

- [x] **T24** Client dashboard (read-only KPI cards, separate from `/internal`) — **DONE (2026-05-15)**
- [x] **T25** Client ticket delegation screen (mobile-first, 3-tap workflows) — **DONE (2026-05-15)**
- [x] **T26** Daily email digest (Postmark or SES + cron job, 21:00 local) — **DONE (2026-05-16): daily preview, Postmark/dry-run email delivery, and cron-callable send endpoint shipped**
- [x] **T27** Weekly digest email (richer report, sales-recovered narrative) — **DONE (2026-05-16): weekly preview, richer metric narrative, Postmark/dry-run email delivery, and cron-callable send endpoint shipped**
- [x] **T28** CSAT capture (thumbs reaction in Messenger / Web) — **DONE (2026-05-16): web/dashboard CSAT plus Messenger quick-reply/postback/text rating capture shipped**
- [x] **T29** P1 WhatsApp ping to POC on urgent ticket creation — **DONE (2026-05-16): urgent-ticket notification service, WhatsApp Cloud API send path, dry-run mode, ticket timeline event, and regression tests shipped**
- [x] **T30** "Sales recovered" estimate calculation per MVP §9 spec — **DONE (2026-05-15): new-ticket estimates plus migration backfill for existing tickets**

---

## Tier 5 — Channels

- [x] **T31** WhatsApp channel adapter (default Meta Cloud API per PRD 08 Q1) — **DONE (2026-05-16): WhatsApp webhook verify/receive adapter, signature verification, phone-number-id client lookup, conversation routing, CSAT capture, shared outbound sender, dry-run mode, and tests shipped**
- [x] **T32** Web chat widget (deferrable per Q16) — **DONE (2026-05-16): public web-chat API, iframe-friendly `/widget` UI, visitor-thread persistence, web-channel conversation routing, and tests shipped**
- [x] **T33** Generalised channel send abstraction (currently Messenger-specific) — **DONE (2026-05-16): shared channel sender for Messenger and WhatsApp text delivery, dry-run/sent/skipped result contract, provider tests, and existing Messenger/auth-code/P1 alert paths migrated**

---

## Tier 6 — KB build pipeline (PRD 03)

- [ ] **T34** Messenger chat-history importer (Meta Data Tools export → Q&A extraction)
- [ ] **T35** Facebook Page scraper (About, pinned post, album captions, post comments)
- [x] **T36** File ingestor (image / PDF / Excel → OCR via Google Cloud Vision) — **DONE (2026-05-16): text/CSV/Markdown/JSON, PDF, and Excel files import into draft KB entries; image OCR path is wired through Google Cloud Vision when `GOOGLE_CLOUD_VISION_API_KEY` is configured**
- [ ] **T37** Voice note ASR (vendor per PRD 08 Q10 benchmark)
- [x] **T38** Industry templates (start with clothing) — **DONE (2026-05-16): clothing template JSON with 20 draft FAQ entries (delivery, payment, returns, sizing, fabric, custom orders, order status); `IndustryTemplateService` lists/get/apply with idempotent `templateKey` stamping; routes `GET /industry-templates`, `GET /industry-templates/:key`, `POST /clients/:clientId/industry-templates/:key/apply`; new `templateKey` column + index on `KnowledgeEntry` (migration `20260516130000_knowledge_industry_template`); covered by `industry-template.service.spec.ts` (5 tests incl. idempotency)**
- [x] **T39** Live learning loop (closed ticket resolution → candidate KB entry) — **DONE (2026-05-16): `KnowledgeService.harvestFromResolvedTicket` creates a draft KB entry on ticket resolve, idempotent via new `sourceTicketId` column + index; `TicketService.updateStatus` invokes it on `status='resolved'`, prefers operator comment over suggested reply, swallows + logs failures; covered by `ticket.service.spec.ts` (4 tests) and KB no-prisma path tests**

---

## Tier 7 — QA & improvement loop (PRD 06)

- [x] **T40** Auto QA scoring on every conversation close (within 60 sec) — **DONE (2026-05-16): deterministic `AutoQaService` scores each processed AI reply, stores score/grade/reason/version on the conversation, and logs scoring events**
- [x] **T41** Defect tagging (hallucination, tone, escalation miss, etc.) — **DONE (2026-05-16): auto QA now stores defect tags including low confidence, no knowledge match, hallucination risk, escalation needed/miss, incomplete answer, and tone risk; internal QA view shows auto grade and tags**
- [x] **T42** Calibration sample queue for human review — **DONE (2026-05-16): backend calibration queue endpoint ranks unreviewed risky conversations by auto-QA grade/tags/confidence/escalation, internal QA view now filters needs review, failed, hallucination risk, escalation issues, ungraded, or all**
- [ ] **T43** Improvement-loop kanban board (Mon-Fri cadence per MVP §5.3)
- [ ] **T44** A/B framework for prompt versions

---

## Tier 8 — Ops / launch readiness

- [ ] **T45** Meta App Review submission (privacy policy URL, demo video, business verification)
- [ ] **T46** WhatsApp BSP onboarding (per PRD 08 Q1 decision)
- [ ] **T47** Domain + DKIM / SPF / DMARC for digest deliverability
- [ ] **T48** Sentry / observability beyond structured logs
- [ ] **T49** Billing integration (Stripe BD or local processor, per pricing tiers)
- [ ] **T50** Legal: DPA template + Bangladesh PDPA consent flow (PRD 08 Q4)

---

## Tier 9 — Improvement backlog

### Client KB contribution + internal approval workflow

- [x] **T51 — IMPROVEMENT** Define the client-editable KB scope and approval rules: which fields clients can suggest, which changes are auto-blocked, and which internal-only KB controls stay hidden. — **DONE (2026-05-19): added `docs/client-knowledge-approval-scope.md` with client-editable fields, internal-only controls, auto-block rules, approval outcomes, UX boundaries, publishing rules, and permission boundaries**
- [x] **T52 — IMPROVEMENT** Add a `KnowledgeChangeRequest` data model for client-submitted create/edit requests without writing directly to live `KnowledgeEntry` rows. — **DONE (2026-05-19): added Prisma and shared TypeScript model fields for client-submitted KB create/edit requests, review status, urgency, proposed content, reviewer/client notes, snapshots, timestamps, and live-entry linkage without mutating `KnowledgeEntry`**
- [x] **T53 — IMPROVEMENT** Add migration + Prisma access for KB change requests, including status, urgency, requester notes, reviewer notes, submitted/reviewed/published timestamps, and optional target `KnowledgeEntry`. — **DONE (2026-05-19): added migration `20260519130000_knowledge_change_requests`, generated Prisma Client, and added `KnowledgeChangeRequestService` for list/find/create/review-state updates with live-entry snapshots and review lifecycle timestamps**
- [x] **T54 — IMPROVEMENT** Build client API endpoints to list published KB entries, submit new KB requests, submit edits to existing entries, and view request status. — **DONE (2026-05-19): added client-safe KB endpoints for published entry listing, request listing/detail, add requests, and edit requests; added web API helpers and tightened the client backend proxy allowlist so client sessions cannot call internal KB mutation routes**
- [ ] **T55 — IMPROVEMENT** Add a client portal KB page for viewing approved knowledge, searching/filtering entries, and seeing pending/rejected/published request status.
- [ ] **T56 — IMPROVEMENT** Add client portal request forms for "add knowledge" and "suggest edit", with urgency, business note, and clear validation/error states.
- [ ] **T57 — IMPROVEMENT** Build internal review API endpoints for listing/filtering KB requests, viewing diffs, approving, editing-then-publishing, rejecting, and asking for clarification.
- [ ] **T58 — IMPROVEMENT** Add an internal KB review queue page with client/status/urgency filters, current-vs-proposed comparison, reviewer notes, and action buttons.
- [ ] **T59 — IMPROVEMENT** Implement publish behavior that updates or creates the live `KnowledgeEntry`, writes a version-history snapshot, marks the request as published, and triggers embedding reindexing.
- [ ] **T60 — IMPROVEMENT** Add audit trail events for every KB request transition so internal users can see who submitted, reviewed, edited, rejected, or published each change.
- [ ] **T61 — IMPROVEMENT** Surface internal feedback back to the client portal when a KB request is rejected or needs clarification.
- [ ] **T62 — IMPROVEMENT** Add tests for the KB request lifecycle: client submit, internal approve, edit-then-publish, reject with reason, permission boundaries, and reindex trigger.

---

## Recommended cadence

- **Weekly Friday review:** tick boxes, update progress snapshot table, push to repo.
- **Move a task off Tier 1 only when shipped** and verified working in production (or alpha for pre-Tier-3 work).
- **New tasks discovered mid-week:** drop them at bottom of the right tier; review during Friday cadence.
- **Blocked tasks:** add `🚫 BLOCKED — reason` inline so it's visible at a glance.
