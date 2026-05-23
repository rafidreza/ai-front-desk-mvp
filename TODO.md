# AI Front Desk — TODO

**Last updated:** 2026-05-23
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
| 9 — Improvement backlog | 18 | 0 | 18 |
| 10 — UX Audit P0 | 8 | 1 | 9 |
| 11 — UX Audit P1 | 2 | 8 | 10 |
| 12 — Use case backlog | 0 | 38 | 38 |
| **TOTAL** | **80** | **67** | **147** |

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
- [x] **T55 — IMPROVEMENT** Add a client portal KB page for viewing approved knowledge, searching/filtering entries, and seeing pending/rejected/published request status. — **DONE (2026-05-19): added `/client/knowledge` with published KB search/category filters, request status filters, request feedback display, dashboard navigation, and responsive client-portal styling**
- [x] **T56 — IMPROVEMENT** Add client portal request forms for "add knowledge" and "suggest edit", with urgency, business note, and clear validation/error states. — **DONE (2026-05-19): added add/edit request form to `/client/knowledge`, prefilled suggested edits from published entries, keyword parsing, urgency/category/note fields, validation messages, submit loading state, and success feedback**
- [x] **T57 — IMPROVEMENT** Build internal review API endpoints for listing/filtering KB requests, viewing diffs, approving, editing-then-publishing, rejecting, and asking for clarification. — **DONE (2026-05-19): added internal KB request review controller, review detail/diff contract, list/detail endpoints, review action endpoints, and web API helpers for the upcoming internal queue UI**
- [x] **T58 — IMPROVEMENT** Add an internal KB review queue page with client/status/urgency filters, current-vs-proposed comparison, reviewer notes, and action buttons. — **DONE (2026-05-19): added `/internal/kb-review`, sidebar navigation, queue filters, current/proposed diff panel, final edit fields, reviewer/client/internal notes, and review action buttons wired to the internal review APIs**
- [x] **T59 — IMPROVEMENT** Implement publish behavior that updates or creates the live `KnowledgeEntry`, writes a version-history snapshot, marks the request as published, and triggers embedding reindexing. — **DONE (2026-05-19): internal approve/edit-then-publish now creates or updates `KnowledgeEntry` through `KnowledgeService`, publishes it active, writes KB version history, refreshes embeddings, stores final decision snapshot, and marks the request published with timestamps**
- [x] **T60 — IMPROVEMENT** Add audit trail events for every KB request transition so internal users can see who submitted, reviewed, edited, rejected, or published each change. — **DONE (2026-05-19): added `KnowledgeChangeRequestEvent` migration/model, backfilled submission events, records new submit/review/publish events, returns audit events in review detail, and shows the audit trail in `/internal/kb-review`**
- [x] **T61 — IMPROVEMENT** Surface internal feedback back to the client portal when a KB request is rejected or needs clarification. — **DONE (2026-05-19): client KB request rows now show reviewer/client-visible feedback in a dedicated feedback block, making clarification or rejection notes visible from the client portal request history**
- [x] **T62 — IMPROVEMENT** Add tests for the KB request lifecycle: client submit, internal approve, edit-then-publish, reject with reason, permission boundaries, and reindex trigger. — **DONE (2026-05-19): added focused `KnowledgeChangeRequestService` lifecycle tests for client submission, client-boundary enforcement on edits, rejection feedback/audit events, approve-and-publish create flow, edit-then-publish flow, and the active publish call that drives embedding reindexing**

### Google Sheet product/order data source

- [x] **T63 — IMPROVEMENT** Define the Google Sheet data-source contract/template: supported tabs, required columns, permissions, freshness rules, client setup copy, and safe fallback behavior. — **DONE (2026-05-23): added `docs/google-sheet-data-source-contract.md` with the MVP Sheet access decision, product/order tab templates, freshness rules, customer reply rules, client setup copy, validation rules, and first-version exclusions**
- [x] **T64 — IMPROVEMENT** Add data models/migrations for client external data sources, sync runs, product records, and order records derived from Google Sheets. — **DONE (2026-05-23): added Prisma and Drizzle models plus a migration for `ExternalDataSource`, `ExternalDataSyncRun`, `ProductRecord`, and `OrderRecord`; shared TypeScript contracts now cover Sheet source state, sync runs, product availability, order status, and payment status**
- [x] **T65 — IMPROVEMENT** Build Google Sheet fetch/parse/sync service with public CSV/export support, validation, stale-data handling, and manual sync endpoint. — **DONE (2026-05-23): added `ExternalDataService` for Google Sheet source setup, public CSV/export fetching, product/order CSV parsing, row-level validation warnings, cached product/order replacement on successful sync, stale cache preservation on failed sync, and client-scoped list/sync endpoints**
- [x] **T66 — IMPROVEMENT** Add internal/client UI to attach a Google Sheet link, run "Sync now", see last sync status/errors, and map columns if needed. — **DONE (2026-05-23): added `/client/data-sources` and `/internal/data-sources` for Sheet setup, tab naming, save/sync actions, last sync status/errors, validation warning display, and synced product/order previews; client portal navigation and backend proxy allowlist now include data sources**
- [x] **T67 — IMPROVEMENT** Add product availability/order-status lookup path in the message pipeline before AI response, with safe fallback when data is stale or missing. — **DONE (2026-05-23): conversation handling now checks synced Sheet records before the general AI/KB path for product availability and order-status intents, answers from fresh cached product/order rows, asks clarifying or verification questions when needed, and escalates when Sheet data is stale or missing**
- [x] **T68 — IMPROVEMENT** Add tests and QA fixtures for Sheet parsing, sync failures, product availability answers, and order-status privacy boundaries. — **DONE (2026-05-23): added focused `ExternalDataService` tests for quoted CSV parsing, failed sync cache preservation, fresh product availability answers, and order-status privacy verification before exposing status**

---

## Tier 10 — UX Audit P0 (front door + trust)

Source: `/UX_AUDIT_FINDINGS.md` (uxaudit run 2026-05-23, 10 fails, 8 unverifiable).

- [x] **T69 — UX** Make `/internal/login` "Unlock console" CTA solid brand-green (`#1f6e54`, white text, no border, darker hover); remove ghost outline style. — **DONE (2026-05-23, commit `03248dc`): introduced `--brand` / `--brand-hover` / `--brand-on` / `--brand-soft` tokens + reusable `.btn-primary` component; applied to login CTA.**
- [x] **T70 — UX** Add inline loading/error/success states to passcode submit: reserve fixed-height feedback slot, disable button + swap label to "Unlocking…" + spinner on submit, render "Incorrect passcode" inline without layout jump. — **DONE (2026-05-23, commit `03248dc`): aria-live `.login-feedback` slot (38px reserved) with info/error/success tones; inline `.btn-spinner` keyframe; input disabled during submit.**
- [x] **T71 — UX** Split root route: serve public landing at `/` (product explainer + screenshot of tickets queue + customer-chat-widget demo); move passcode gate to `/internal/login` with "Internal access" link from landing footer. — **DONE (2026-05-24, commit `0953ea8`): public landing at `/` with hero + live `/widget` iframe demo + 3-pillar value row + tickets-queue mock; `apps/web/src/app/internal/layout.tsx` preserves internal subtree title; root layout switched to product-neutral metadata + `'%s · AI Front Desk'` template.**
- [x] **T72 — UX** Replace HTML5 `:invalid` browser tooltip on `/internal/agent-config` "Create draft" form with inline required-field markers + app-level error summary listing missing fields above the CTA. — **DONE (2026-05-24, commit `c8eef70`): new reusable `useFormErrors` + `<FormField>` + `<FormErrorSummary>` primitives at `_components/form-validation.tsx`; agent-config Create form switched to `noValidate` with asterisk + red border + red bg + inline text per field + summary banner above CTA with clickable field links. (T72b backlog: sweep remaining forms — edit form, team-management, signup, KB editor.)**
- [x] **T73 — UX** Pre-populate new prompt-profile draft from currently active profile so operator only edits the delta (not from blank form). — **DONE (2026-05-24, commit `c8eef70`): `activeProfile` memo + every Create-form field receives `defaultValue` from active profile + green dashed `.form-prefill-hint` banner; form key includes `activeProfile?.id` + `createResetToken` so remount stays clean.**
- [x] **T74 — UX** Show inline banner on `/client/dashboard?clientId=…` when unauthenticated ("Please verify your access code to continue") instead of silently re-rendering request-code form; preserve `clientId` in restored verification state. — **DONE (2026-05-24, commit `0e2c64b`): middleware already preserves `?next=…` (verified); `/client/login` now derives a human label from the `next` param and renders a blue `.auth-redirect-banner` ("You were sent here from your <label>. Verify your access code to continue.") above the request form; banner hidden on direct visits; verify-success already bounces back via `nextPath`.**
- [x] **T75 — UX** Establish typography scale tokens (body 16px, h2 24px / 1.5×, h1 32–40px / 2–2.5×); apply across internal console + client portal. — **DONE (2026-05-24): main page titles, command headings, login copy, client portal headings, metrics, and dense body copy now use shared `--text-*`, `--lh-*`, and `--fw-*` tokens across internal console + client portal. Compact labels remain intentionally small for scan density.**
- [ ] **T76 — UX** Audit copy for marketing buzzwords flagged by uxaudit; replace each with concrete claim (delete-test: if sentence works without word, drop word). — **NOTE: only flagged buzzword was "unlock" on login CTA — literal usage, not marketing. Defer until additional surfaces (landing copy, dashboard headers) get a sweep.**
- [x] **T77 — UX** Add signature delight animation to `/internal/login`: 200ms cubic-bezier lock-icon-opening on successful passcode; rewrite subcopy with voice (vs flat "Enter the internal passcode to continue."). — **DONE (2026-05-24): successful passcode now swaps to an open-lock icon with a 200ms cubic-bezier motion before redirect; subcopy now uses professional internal-ops language.**

---

## Tier 11 — UX Audit P1 (daily-use friction)

- [x] **T78 — UX** Add Pending / Approved / Rejected / Needs-info filter tabs to `/internal/kb-review` queue. — **DONE (2026-05-24): queue now has operator-friendly tabs with counts; Pending groups `submitted` + `in_review`, Approved groups `approved` + `edited_then_published` + `published`, Rejected shows `rejected`, Needs-info shows `needs_clarification`.**
- [ ] **T79 — UX** Standardize client picker: replace inconsistent custom dropdowns with shadcn `Select` component everywhere clients are selected (KB import, manage-clients, agent-config).
- [ ] **T80 — UX** Replace native `<select>` on `/internal/team` role field with shadcn `Select` component.
- [ ] **T81 — UX** Add inline Good / Bad / Hallucination action buttons per row on `/internal/qa` (keep drill-down as secondary).
- [ ] **T82 — UX** Add sticky-bottom save bar to `/internal/clients/[id]` with disabled-until-dirty state.
- [ ] **T83 — UX** Add top-of-page degradation banner: detect Anthropic API failure rate > threshold, show "AI is slow right now — using fallback replies" with link to internal status.
- [x] **T84 — UX** Add loading skeletons to tickets list, KB list, clients list, QA list, conversations list. — **DONE (2026-05-24): reusable `ListSkeleton` now covers internal tickets, conversations, QA calibration queue, knowledge entries, and client directory lists without hiding existing data during refreshes.**
- [ ] **T85 — UX** Empty state guidance on every list page (tickets, KB, clients, QA): icon + 1-line explainer + primary action (e.g. "No tickets yet. Connect a Facebook Page to start receiving messages → ").
- [ ] **T86 — UX** Replace generic "something went wrong" errors with actionable messages naming the cause + the fix link (e.g. "Page token expired. Reconnect Meta integration → "). — **PARTIAL (2026-05-24, commit `0e2c64b`): client login (request code + verify code) and client dashboard fallback strings rewritten with named cause + recovery step. Remaining surfaces (internal console, signup, KB) still pending.**
- [ ] **T87 — UX** Mobile-responsive sweep of `/internal/*` console (sidebar collapses, KPI strip stacks, ticket detail fits 390px).

---

## Tier 12 — Use Case Backlog (domain gaps surfaced by audit)

Grouped by domain. Pick into Tier 1 / 4 as priorities shift.

### Channel + messaging

- [ ] **T88 — USECASE** Bangla / Banglish UI strings (i18n via next-intl); switch internal + client portal + digest emails.
- [ ] **T89 — USECASE** Multi-FB-Page-per-seller: relax "1 client = 1 page" assumption; data model + UI for `ClientChannel[]`.
- [ ] **T90 — USECASE** WhatsApp template approval status UI: list templates with `pending` / `approved` / `rejected` state from Meta; block send if not approved.
- [ ] **T91 — USECASE** Channel health dashboard: Meta page token TTL countdown, WhatsApp number status, webhook deliverability stats.
- [ ] **T92 — USECASE** Holiday / off-hours auto-reply calendar (Eid, Puja, custom dates) with per-client override.
- [ ] **T93 — USECASE** Voice note ingest UI in chat (operator can play customer voice + see transcribed text inline).
- [ ] **T94 — USECASE** Image OCR ingest UI in chat (customer photos product → operator sees extracted text + matched product candidates).
- [ ] **T95 — USECASE** Unified customer history view across pages (same phone number → one timeline).

### Ticket operations

- [ ] **T96 — USECASE** Bulk ticket actions (multi-select rows → close / assign / tag in one click).
- [ ] **T97 — USECASE** SLA timer + overdue flag on ticket list ("waiting 4h 12m" badge with color escalation).
- [ ] **T98 — USECASE** AI confidence + reason chips on tickets (why AI escalated: low confidence / sensitive intent / unknown product).
- [ ] **T99 — USECASE** Re-open closed ticket flow when customer messages back.
- [ ] **T100 — USECASE** Internal private-note panel on ticket for operator-to-operator handoff.
- [ ] **T101 — USECASE** Search across all conversations (text + filter by date / customer / intent).
- [ ] **T102 — USECASE** Customer block / spam button with block list per client.
- [ ] **T103 — USECASE** "Mark as test customer" toggle to exclude from QA scores + daily digests.
- [ ] **T104 — USECASE** Tag / label system for tickets (`VIP`, `complaint`, `high-value`).
- [ ] **T105 — USECASE** In-app P1 alert (toast + sound) in addition to WhatsApp ping.

### Knowledge Base

- [ ] **T106 — USECASE** KB version diff + 1-click rollback UI (highlight what changed between versions).
- [ ] **T107 — USECASE** KB freshness alerts: surface entries not updated in 90 days, prompt operator to re-verify.
- [ ] **T108 — USECASE** Seller-facing read-only KB view (client portal) so seller sees what AI knows. Trust signal.
- [ ] **T109 — USECASE** Suggest new KB entries from unresolved tickets (auto-draft from ticket text → operator approves).

### Billing + auth + RBAC

- [ ] **T110 — USECASE** Billing surface: plan picker, invoice list, payment method (SSLCOMMERZ + bKash UI).
- [ ] **T111 — USECASE** Trial countdown ("12 days left") + monthly quota meter ("8,400 / 10,000 msgs").
- [ ] **T112 — USECASE** Internal per-client LLM cost dashboard (USD spend per client per day, alert > threshold).
- [ ] **T113 — USECASE** RBAC: admin / operator / read-only roles (replace single shared `INTERNAL_CONSOLE_PASSWORD`).
- [ ] **T114 — USECASE** Audit log: who deleted KB entry, who changed prompt profile, who closed ticket (compliance + DPA).
- [ ] **T115 — USECASE** Magic-link expiry + clear re-request CTA on failure page.
- [ ] **T116 — USECASE** WhatsApp OTP fallback when SMS fails (voice call / alt-channel option).
- [ ] **T117 — USECASE** Session idle-timeout + warning modal on internal console (security on shared laptops).

### Onboarding + lifecycle (internal)

- [ ] **T118 — USECASE** Internal onboarding pipeline screen: per-seller card showing stage (call scheduled / Meta connected / KB v1 building / shadow / live).
- [ ] **T119 — USECASE** Shadow-mode QA dashboard: side-by-side AI reply vs operator-edited reply before go-live.
- [ ] **T120 — USECASE** Onboarding bot Q&A review screen: see + edit collected answers before generating KB v1.0.
- [ ] **T121 — USECASE** Pilot → paid conversion checklist (per-client gating UI).

### Compliance + Bangladesh-specific

- [ ] **T122 — USECASE** DPA signing flow: send template → seller signs → store countersigned PDF per client.
- [ ] **T123 — USECASE** Per-client data retention controls ("delete chats older than 90 days").
- [ ] **T124 — USECASE** Bangla number formatting (১২,৩৪৫) + BDT currency (৳) on all numeric surfaces.
- [ ] **T125 — USECASE** PDPA consent banner on embeddable customer chat widget (collects phone / address PII).

---

## Recommended cadence

- **Weekly Friday review:** tick boxes, update progress snapshot table, push to repo.
- **Move a task off Tier 1 only when shipped** and verified working in production (or alpha for pre-Tier-3 work).
- **New tasks discovered mid-week:** drop them at bottom of the right tier; review during Friday cadence.
- **Blocked tasks:** add `🚫 BLOCKED — reason` inline so it's visible at a glance.
