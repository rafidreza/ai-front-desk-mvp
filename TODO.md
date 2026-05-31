# Daemion — TODO

**Last updated:** 2026-05-31
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
| 7 — QA & improvement loop | 4 | 1 | 5 |
| 8 — Ops / launch readiness | 1 | 5 | 6 |
| 9 — Improvement backlog | 18 | 0 | 18 |
| 10 — UX Audit P0 | 9 | 0 | 9 |
| 11 — UX Audit P1 | 10 | 0 | 10 |
| 12 — Use case backlog | 35 | 3 | 38 |
| 13 — UX Audit follow-up | 15 | 2 | 17 |
| **TOTAL** | **141** | **23** | **164** |

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
- [x] **T43** Improvement-loop kanban board (Mon-Fri cadence per MVP §5.3) — **DONE (2026-05-31): added `/internal/improvement`, a weekly Mon-Fri improvement board that composes existing tickets, QA calibration queue, client list, and KB-review requests into operator lanes for risky replies, knowledge fixes, reply retests, urgent handoffs, and Friday reporting.**
- [ ] **T44** A/B framework for prompt versions

---

## Tier 8 — Ops / launch readiness

- [ ] **T45** Meta App Review submission (privacy policy URL, demo video, business verification)
- [ ] **T46** WhatsApp BSP onboarding (per PRD 08 Q1 decision)
- [ ] **T47** Domain + DKIM / SPF / DMARC for digest deliverability
- [x] **T48** Sentry / observability beyond structured logs — **DONE (2026-05-31): added optional Sentry-compatible backend error reporting for Nest and Hono 500-level failures, with environment/release tags, private stack capture, generic public 500 responses, env documentation, and regression tests.**
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
- [x] **T71 — UX** Split root route: serve public landing at `/` (product explainer + screenshot of tickets queue + customer-chat-widget demo); move passcode gate to `/internal/login` with "Internal access" link from landing footer. — **DONE (2026-05-24, commit `0953ea8`): public landing at `/` with hero + live `/widget` iframe demo + 3-pillar value row + tickets-queue mock; `apps/web/src/app/internal/layout.tsx` preserves internal subtree title; root layout switched to product-neutral metadata + `'%s · Daemion'` template.**
- [x] **T72 — UX** Replace HTML5 `:invalid` browser tooltip on `/internal/agent-config` "Create draft" form with inline required-field markers + app-level error summary listing missing fields above the CTA. — **DONE (2026-05-24, commit `c8eef70`): new reusable `useFormErrors` + `<FormField>` + `<FormErrorSummary>` primitives at `_components/form-validation.tsx`; agent-config Create form switched to `noValidate` with asterisk + red border + red bg + inline text per field + summary banner above CTA with clickable field links. (T72b backlog: sweep remaining forms — edit form, team-management, signup, KB editor.)**
- [x] **T73 — UX** Pre-populate new prompt-profile draft from currently active profile so operator only edits the delta (not from blank form). — **DONE (2026-05-24, commit `c8eef70`): `activeProfile` memo + every Create-form field receives `defaultValue` from active profile + green dashed `.form-prefill-hint` banner; form key includes `activeProfile?.id` + `createResetToken` so remount stays clean.**
- [x] **T74 — UX** Show inline banner on `/client/dashboard?clientId=…` when unauthenticated ("Please verify your access code to continue") instead of silently re-rendering request-code form; preserve `clientId` in restored verification state. — **DONE (2026-05-24, commit `0e2c64b`): middleware already preserves `?next=…` (verified); `/client/login` now derives a human label from the `next` param and renders a blue `.auth-redirect-banner` ("You were sent here from your <label>. Verify your access code to continue.") above the request form; banner hidden on direct visits; verify-success already bounces back via `nextPath`.**
- [x] **T75 — UX** Establish typography scale tokens (body 16px, h2 24px / 1.5×, h1 32–40px / 2–2.5×); apply across internal console + client portal. — **DONE (2026-05-24): main page titles, command headings, login copy, client portal headings, metrics, and dense body copy now use shared `--text-*`, `--lh-*`, and `--fw-*` tokens across internal console + client portal. Compact labels remain intentionally small for scan density.**
- [x] **T76 — UX** Audit copy for marketing buzzwords flagged by uxaudit; replace each with concrete claim (delete-test: if sentence works without word, drop word). — **DONE (2026-05-24): visible login CTA/feedback now uses concrete access language ("Open console", "Access confirmed") instead of the flagged "unlock" phrasing; broader copy sweep found no high-risk marketing buzzwords in internal/client surfaces.**
- [x] **T77 — UX** Add signature delight animation to `/internal/login`: 200ms cubic-bezier lock-icon-opening on successful passcode; rewrite subcopy with voice (vs flat "Enter the internal passcode to continue."). — **DONE (2026-05-24): successful passcode now swaps to an open-lock icon with a 200ms cubic-bezier motion before redirect; subcopy now uses professional internal-ops language.**

---

## Tier 11 — UX Audit P1 (daily-use friction)

- [x] **T78 — UX** Add Pending / Approved / Rejected / Needs-info filter tabs to `/internal/kb-review` queue. — **DONE (2026-05-24): queue now has operator-friendly tabs with counts; Pending groups `submitted` + `in_review`, Approved groups `approved` + `edited_then_published` + `published`, Rejected shows `rejected`, Needs-info shows `needs_clarification`.**
- [x] **T79 — UX** Standardize client picker: replace inconsistent custom dropdowns with shadcn `Select` component everywhere clients are selected (KB import, manage-clients, agent-config). — **DONE (2026-05-24): per agreed local-style direction, client selection now uses the reusable `UiSelect` in knowledge/data-source client switches, manage-clients jump-to-client, and agent-config. Agent-config also gained an explicit client picker and client summary strip.**
- [x] **T80 — UX** Replace native `<select>` on `/internal/team` role field with shadcn `Select` component. — **DONE (2026-05-24): per agreed local-style direction, added reusable `UiSelect` wrapper with consistent trigger styling and used it for the team role field without introducing shadcn/Radix dependencies.**
- [x] **T81 — UX** Add inline Good / Bad / Hallucination action buttons per row on `/internal/qa` (keep drill-down as secondary). — **DONE (verified 2026-05-24): `QaReview` rows already expose inline Good, Bad, and Hallucination actions per conversation; the queue/filter context remains available as the secondary review surface.**
- [x] **T82 — UX** Add sticky-bottom save bar to `/internal/clients/[id]` with disabled-until-dirty state. — **DONE (2026-05-24): implemented on the current `/internal/clients` detail form per product decision; save/discard bar sticks to the bottom, stays disabled until fields are dirty, and row clicks now enter edit mode consistently.**
- [x] **T83 — UX** Add top-of-page degradation banner: detect Anthropic API failure rate > threshold, show "AI is slow right now — using fallback replies" with link to internal status. — **DONE (2026-05-24): Anthropic failures are tracked in a 5-minute in-memory window; 3 failures triggers degraded mode, local fallback replies, `/health/ai`, and an internal top-of-page banner with an Internal status link.**
- [x] **T84 — UX** Add loading skeletons to tickets list, KB list, clients list, QA list, conversations list. — **DONE (2026-05-24): reusable `ListSkeleton` now covers internal tickets, conversations, QA calibration queue, knowledge entries, and client directory lists without hiding existing data during refreshes.**
- [x] **T85 — UX** Empty state guidance on every list page (tickets, KB, clients, QA): icon + 1-line explainer + primary action (e.g. "No tickets yet. Connect a Facebook Page to start receiving messages → "). — **DONE (2026-05-24): reusable `EmptyState` with icon, explainer, and action now covers tickets, knowledge entries, client directory, and QA calibration queue.**
- [x] **T86 — UX** Replace generic "something went wrong" errors with actionable messages naming the cause + the fix link (e.g. "Page token expired. Reconnect Meta integration → "). — **DONE (2026-05-24): client auth/dashboard were already partial; internal console ticket/conversation/QA errors, signup verification errors, knowledge library errors, and KB review errors now name what failed and include concrete recovery steps while preserving useful backend detail.**
- [x] **T87 — UX** Mobile-responsive sweep of `/internal/*` console (sidebar collapses, KPI strip stacks, ticket detail fits 390px). — **DONE (2026-05-24): added narrow-width rules for internal console sidebar/header, page actions, KPI cards, ticket/conversation rows, detail panels, threads, QA rows, and alert banners so core operations fit 390px-style screens.**

---

## Tier 12 — Use Case Backlog (domain gaps surfaced by audit)

Grouped by domain. Pick into Tier 1 / 4 as priorities shift.

### Channel + messaging

- [x] **T88 — USECASE** Bangla / Banglish UI strings (i18n via next-intl); switch internal + client portal + digest emails. — **DONE (2026-05-24): added next-intl provider foundation, localized high-value client portal dashboard/ticket/nav copy from `defaultLanguage`, localized client channel labels/details, and switched digest subjects, narrative, metrics, fallback CSAT, and CTA copy across English, Bangla, and Banglish.**
- [x] **T89 — USECASE** Multi-FB-Page-per-seller: relax "1 client = 1 page" assumption; data model + UI for `ClientChannel[]`. — **DONE (2026-05-24): added `ClientChannel` persistence with legacy `pageId` primary-page compatibility, routed Messenger/WhatsApp lookup through channel records, seeded existing page IDs as primary channels, and added internal client UI to list, add, remove, and mark primary Facebook pages.**
- [x] **T90 — USECASE** WhatsApp template approval status UI: list templates with `pending` / `approved` / `rejected` state from Meta; block send if not approved. — **DONE (2026-05-24): added manual WhatsApp template registry per client, internal Channels UI for approval status/rejection reason, and an approved-template send path that skips outbound WhatsApp template sends when the template is missing, pending, or rejected.**
- [x] **T91 — USECASE** Channel health dashboard: Meta page token TTL countdown, WhatsApp number status, webhook deliverability stats. — **DONE (2026-05-24): added internal channel health checks for Messenger page-token configuration/TTL, WhatsApp access-token and number-ID readiness, last webhook activity, 24h traffic counts, and WhatsApp template approval counts on the Channels dashboard.**
- [x] **T92 — USECASE** Holiday / off-hours auto-reply calendar (Eid, Puja, custom dates) with per-client override. — **DONE (2026-05-24): added per-client auto-reply rules with disabled editable Bangladesh holiday suggestions and daily after-hours template, internal Channels UI to edit/enable/delete rules, and inbound conversation short-circuiting so active holiday/off-hours windows send the configured reply before the AI path.**
- [x] **T93 — USECASE** Voice note ingest UI in chat (operator can play customer voice + see transcribed text inline). — **DONE (2026-05-24): added voice attachment metadata and transcript storage on messages, Messenger/WhatsApp voice-note ingestion fallbacks, an internal transcript edit endpoint, conversation playback/transcript editing UI, and read-only voice context inside ticket details.**
- [x] **T94 — USECASE** Image OCR ingest UI in chat (customer photos product → operator sees extracted text + matched product candidates). — **DONE (2026-05-24): added image attachment metadata, OCR text/status storage, Google Vision OCR attempt for reachable image URLs, matched Google Sheet product candidate snapshots, Messenger/WhatsApp image ingestion, and internal conversation/ticket UI for product photos, OCR status, and candidate products.**
- [x] **T95 — USECASE** Unified customer history view across pages (same phone number → one timeline). — **DONE (2026-05-24): added a conservative customer-history endpoint that merges WhatsApp/order records by normalized verified phone or email, keeps unverified sender IDs isolated, and renders the shared customer timeline on internal Conversations and Tickets detail views.**

### Ticket operations

- [x] **T96 — USECASE** Bulk ticket actions (multi-select rows → close / assign / tag in one click). — **DONE (2026-05-24, commit `55211f1`): selection checkboxes + select-all on TicketsPanel; brand-green `BulkActionBar` with Mark resolved, Assign to…, Apply tag (gated to single-client selection); shared `TagPicker` (with inline create) reused here and ready for per-ticket detail use. Backend `POST /clients/:id/tags/bulk-apply` does the multi-insert with skipDuplicates. Followup T96b: per-ticket tag picker on detail panel.**
- [x] **T97 — USECASE** SLA timer + overdue flag on ticket list ("waiting 4h 12m" badge with color escalation). — **DONE (2026-05-24, commit `6889e2d`): `computeSla()` derives an SLA window from priority (P1 60m / P2 240m / P3 1440m) and yields on_track / due_soon / overdue / paused state; `SlaBadge` renders coloured pill on row + detail header with a sla-pulse keyframe on overdue.**
- [x] **T98 — USECASE** AI confidence + reason chips on tickets (why AI escalated: low confidence / sensitive intent / unknown product). — **DONE (2026-05-24, commit `7e10059`): `Ticket.confidence` populated from `Conversation.lastConfidence`; `summarizeEscalation()` classifies `ticket.reason` into low_confidence / sensitive_intent / unknown_product / escalation_keyword / manual_takeover / other (Bangla + English pattern set); `EscalationChips` renders reason + confidence pill, six colour variants reusing existing tokens.**
- [x] **T99 — USECASE** Re-open closed ticket flow when customer messages back. — **DONE (2026-05-24, commit `5cb5bd1`): new `reopened` value on `TicketStatus` enum + migration; `TicketService.reopenIfResolved()` transitions a resolved ticket back via a `ticket.reopened` event; `ConversationService.handleIncomingMessage` calls it for every inbound on a conversation with a linked ticket; "Reopen" button surfaces in the detail panel when the ticket is currently resolved.**
- [x] **T100 — USECASE** Internal private-note panel on ticket for operator-to-operator handoff. — **DONE (2026-05-24, commit `fd69555`): hardened the existing TicketComment panel — slate "PRIVATE" lock badge in the header, helper line ("These notes stay between operators. Customers never see them."), inline `@mention` dropdown of internal users that inserts `@Name` into the textarea, `.btn-primary` Add note CTA with Saving… state, comment list resolves `authorId` to a readable label via new `operatorLabel()` helper.**
- [x] **T101 — USECASE** Search across all conversations (text + filter by date / customer / intent). — **DONE (2026-05-24, commit `176bc84`): Postgres generated `tsvector` column on `Message.text` + GIN index (`Message_tsv_idx`), 'simple' config so Bangla / Banglish / English all tokenize; `ConversationService.searchConversations()` runs `plainto_tsquery` with limit clamp; `GET /conversations/search?q=&limit=` returns `ConversationSearchResult[]`; search bar above conversations grid with 300ms debounce, scrollable result list, click jumps to thread. Followup T101b: filter by date / customer / intent.**
- [x] **T102 — USECASE** Customer block / spam button with block list per client. — **DONE (2026-05-24, commit `f2de81b`): new `BlockedSender` table with unique(clientId, channel, externalSenderId); `BlockedSenderService` + `GET/POST/DELETE /clients/:id/blocked-senders`; `ConversationService.handleIncomingMessage` short-circuits when `isBlocked()` returns true (logs `conversation.inbound.blocked`, no AI call, no escalation); conversation detail header gets Block sender / Unblock sender toggle + coral "BLOCKED" pill on the customer line. Followup T102b: per-client admin page + bulk unblock.**
- [x] **T103 — USECASE** "Mark as test customer" toggle to exclude from QA scores + daily digests. — **DONE (2026-05-24, commit `e3c0c68`): new `TestCustomer` table (same shape as BlockedSender); `TestCustomerService` + `GET/POST/DELETE /clients/:id/test-customers`; `ConversationService.handleIncomingMessage` skips the AutoQa scoring path when `isTestCustomer()` is true and logs `conversation.auto_qa_skipped_test_customer`; conversation detail gets a Mark as test / Unmark test button + violet "TEST" pill on the customer line. Followup T103b: filter test customers out of digest + dashboard aggregates.**
- [x] **T104 — USECASE** Tag / label system for tickets (`VIP`, `complaint`, `high-value`). — **DONE (2026-05-24, commit `822efa3` for backend + `55211f1` for UI): `Tag` and `TicketTag` tables with per-client unique-name + 6-colour palette (coral / amber / green / blue / violet / slate); CRUD + add/remove/bulk-apply endpoints; `TagChip` + `TagPicker` (with inline create) components; ticket rows render tag chips; backend list/detail include the joined tags.**
- [x] **T105 — USECASE** In-app P1 alert (toast + sound) in addition to WhatsApp ping. — **DONE (2026-05-24, commit `fb17915`): `P1AlertCenter` polls `GET /tickets` every 30s, filters open/assigned P1s the tab has not seen (localStorage `afd:p1-seen-ticket-ids`, first-run suppressed so the initial load does not blast); stacks up to 5 fixed-top-right coral toasts with 220ms slide-in keyframe + "Open ticket →" deep-link; uses browser `Notification` API when permission is granted, with a bottom-right Enable nudge when permission is default. Sound deferred (no asset pipeline yet). Followup T105b: replace polling with SSE when API adds a stream.

### Knowledge Base

- [x] **T106 — USECASE** KB version diff + 1-click rollback UI (highlight what changed between versions). — **DONE (2026-05-24, commit `63a3955`): new `KbDiffModal` opens from a "Compare" button on every version row; side-by-side current vs selected version across Title / Answer / Keywords / Category / Confidence boost with coral data-changed highlighting; modal "Restore as new draft" reuses the existing `rollbackKnowledgeEntry` API (T21's draft-then-publish contract preserved). Backlog T106b: word-level inline diff, restore-and-publish atomic action.**
- [x] **T107 — USECASE** KB freshness alerts: surface entries not updated in 90 days, prompt operator to re-verify. — **DONE (2026-05-24, commit `b0f52da`): new `markReviewed` API + `POST /clients/:id/knowledge/:entryId/review` endpoint that bumps `updatedAt` without a version snapshot; `KnowledgeEntry.updatedAt` now in shared types; UI `isStale()` flags active entries older than 90 days; amber page banner with count + "Show stale only" toggle, inline `STALE Nd` badge + amber left border per row, "Mark reviewed" CTA on the detail editor for active entries. Backlog T107b: per-client stale-summary email + configurable threshold.**
- [x] **T108 — USECASE** Seller-facing read-only KB view (client portal) so seller sees what AI knows. Trust signal. — **DONE (2026-05-19, covered by T55): `/client/knowledge` already lists every published KB entry with title + answer + keywords + category, plus a search bar + category filter; client-safe endpoints (T54) prevent any mutation from a client session. No additional work needed for the read-only trust path; backlog T108b: per-entry "preview AI sample reply" affordance + dashboard tile showing "AI knows N entries about your business".**
- [x] **T109 — USECASE** Suggest new KB entries from unresolved tickets (auto-draft from ticket text → operator approves). — **DONE (2026-05-24, commit `6e2bdae`): new `sourceTicketId` column on `KnowledgeChangeRequest` + partial unique index for idempotency; `KnowledgeChangeRequestService.suggestFromTicket()` auto-builds a `requestType=create` request (title = first sentence of customer message, answer = AI suggested reply, keywords = top non-stopword tokens, `submittedBy='ai-suggestion'`); hooked into `TicketService.createFromEscalation` best-effort; existing `/internal/kb-review` queue (T58) renders a brand-soft "AI suggestion" pill on these rows so operators can triage AI-vs-client suggestions at a glance. Backlog T109b: similarity-cluster recurring messages before suggesting; surface source-ticket link in review detail.**

### Billing + auth + RBAC

- [ ] **T110 — USECASE** Billing surface: plan picker, invoice list, payment method (SSLCOMMERZ + bKash UI). — **DEFERRED (2026-05-24): user requested skipping billing/payment-related work for now.**
- [ ] **T111 — USECASE** Trial countdown ("12 days left") + monthly quota meter ("8,400 / 10,000 msgs"). — **DEFERRED (2026-05-24): user considers trial/quota tied to billing; skip billing/payment-related work for now.**
- [ ] **T112 — USECASE** Internal per-client LLM cost dashboard (USD spend per client per day, alert > threshold). — **DEFERRED (2026-05-24): user requested skipping billing/payment/cost-related work for now.**
- [x] **T113 — USECASE** RBAC: admin / operator / read-only roles (replace single shared `INTERNAL_CONSOLE_PASSWORD`). — **DONE (2026-05-24): replaced passcode-only internal login with email/id + password authentication backed by internal user password hashes, seeded local admin/operator/read-only users, role-bearing internal sessions, proxy-side mutation enforcement, and updated team/login UI for the three-role model.**
- [x] **T114 — USECASE** Audit log: who deleted KB entry, who changed prompt profile, who closed ticket (compliance + DPA). — **DONE (2026-05-24): added `AuditLog` persistence, filtered internal audit API, proxy-level successful mutation capture for internal and client-portal actors, summaries for ticket/KB/prompt/channel/template/tag/client/data-source changes, and an internal Audit Log screen with client/actor/entity/action filters.**
- [x] **T115 — USECASE** Magic-link expiry + clear re-request CTA on failure page. — **DONE (2026-05-24): client login now preserves the last identifier/channel, detects expired codes from `expiresAt`, disables expired-code submission, shows clear expired/used/invalid guidance, and offers a one-click "Send a new code" CTA from the verify step.**
- [x] **T116 — USECASE** WhatsApp OTP fallback when SMS fails (voice call / alt-channel option). — **DONE (2026-05-24): client login now preserves failed OTP requests, offers "Try WhatsApp instead" / "Try email instead" fallback CTAs after request or verification failures, and surfaces skipped delivery mode guidance so sellers can switch channels without restarting the login flow.**
- [x] **T117 — USECASE** Session idle-timeout + warning modal on internal console (security on shared laptops). — **DONE (2026-05-24): internal console now tracks inactivity from mouse/keyboard/scroll/touch events, warns after 25 minutes, offers "Stay signed in" or "Sign out now", and automatically clears the internal session after 30 minutes of inactivity.**

### Onboarding + lifecycle (internal)

- [x] **T118 — USECASE** Internal onboarding pipeline screen: per-seller card showing stage (call scheduled / Meta connected / KB v1 building / shadow / live). — **DONE (2026-05-24, commit `fe6a8f7`): new `Client.lifecycleStage` field with vocab `lead | onboarding | kb_building | shadow | live | paid | churned` (separate from existing `onboardingStatus`); migration backfills from prior status; PATCH `/clients/:id/lifecycle-stage` + service mutator; `/internal/pipeline` 7-col kanban with "Move to next stage" CTA per card; "Pipeline" sidebar entry. Backlog T118b: drag-and-drop, time-in-stage metrics, per-stage filter on clients directory.**
- [x] **T119 — USECASE** Shadow-mode QA dashboard: side-by-side AI reply vs operator-edited reply before go-live. — **DONE (2026-05-24, commit `edafafb`): read-only `/internal/shadow` page shows every conversation for clients in the `shadow` lifecycle stage; customer bubble (blue) + AI reply (brand) + first ticket-comment operator note (amber) in a three-column compare; client filter, ticket deep-link, lazy comment fetch with cache. Reached from pipeline card "Shadow QA" button. Backlog T119b: real shadow infrastructure (route AI replies to a queue instead of customer, operator approves before send), correction edits stored as `ShadowReply` audits.**
- [x] **T120 — USECASE** Onboarding bot Q&A review screen: see + edit collected answers before generating KB v1.0. — **DONE (2026-05-24, commit `ef3add1`): `/internal/onboarding` review screen for the existing structured signup answers (businessCategory, pageId, whatsappPoc, focus channels, websiteUrl, facebookPageUrl, whatsappSetup, facebookSetup) via the existing PATCH `/clients/:id/onboarding` endpoint; sticky client picker + read-only metadata strip + focus-channel multi-pill + brand-primary Save. Reached from pipeline card "Onboarding" button. Backlog T120b: Q&A list rendering once Messenger onboarding bot (T19) produces OnboardingAnswer records.**
- [x] **T121 — USECASE** Pilot → paid conversion checklist (per-client gating UI). — **DONE (2026-05-24, commit `6287fcd`): new `ConversionChecklistService.compute(clientId)` builds a 10-item hybrid list (5 auto checks derived from ClientChannel / KnowledgeEntry / WhatsAppTemplate counts + onboarding status + days-in-stage; 5 manual ticks persisted in `Client.conversionChecklist` JSON shipped with T118); GET `/clients/:id/conversion-checklist` returns the merged set; `/internal/conversion` UI groups auto vs manual, optimistic toggle on manual items with rollback, header meter flips amber when any auto check is still failing. Reached from pipeline card "Checklist" button. Backlog T121b: per-stage default checklist, auto-derive first_digest_delivered from digest send log, CSV export for sales standup.**

### Compliance + Bangladesh-specific

- [x] **T122 — USECASE** DPA signing flow: send template → seller signs → store countersigned PDF per client. — **DONE (2026-05-24): added a per-client compliance profile with DPA status, signer, sent/signed/countersigned dates, template URL, countersigned PDF URL, and notes; exposed PATCH `/clients/:id/compliance/dpa`; internal Clients UI now has a DPA signing panel for manual ops tracking. Also restored red CI build paths by adding missing lifecycle-stage fixtures and aligning Hono's ticket status enum with `reopened`.**
- [x] **T123 — USECASE** Per-client data retention controls ("delete chats older than 90 days"). — **DONE (2026-05-24): added per-client retention policy under compliance profile (`disabled` or `redact`, 30-3650 days), preview endpoint for old chat-message count, manual redaction endpoint that preserves conversation/ticket records while replacing message text and clearing transcript/OCR/attachment URL fields, and internal Clients UI to save policy, preview, and run cleanup with last-run details.**
- [x] **T124 — USECASE** Bangla number formatting (১২,৩৪৫) + BDT currency (৳) on all numeric surfaces. — **DONE (2026-05-24): added shared client-side localized number/date/currency helpers and applied them to client portal dashboard metrics, channel counts, ticket protected-sale values, CSAT buttons, knowledge counts/version numbers, and Google Sheet sync/product/order counts. Bangla clients now see Bangla digits and `৳`; mixed/English keep English digits while still using the BDT symbol. IDs, phone numbers, and order identifiers stay unchanged.**
- [x] **T125 — USECASE** PDPA consent banner on embeddable customer chat widget (collects phone / address PII). — **DONE (2026-05-24): widget now shows a per-client consent banner before chat, stores consent in localStorage with version `pdpa-widget-v1`, disables the message box until accepted, and sends consent metadata with each web-chat message. Nest and Hono public web-chat endpoints now reject messages missing PDPA consent, with regression tests covering the guard.**

## Tier 13 — UX Audit Follow-up (2026-05-24 re-audit)

- [x] **T126 — UXAUDIT** Fix public landing accessibility: resolve P1 badge contrast, repair heading hierarchy (`h1` → `h2` → `h3`), and replace vague "Get started" CTAs with action-specific labels. — **DONE (2026-05-24): landing CTA labels now identify the signup action, pillar headings follow the `h1` → `h2` hierarchy, and low-contrast mock ticket metadata now meets axe contrast checks. Verified with web lint/build and focused uxaudit accessibility/usability checks on desktop and mobile.**
- [x] **T127 — UXAUDIT** Improve internal API failure recovery: replace generic `API request failed: 500` banners on Clients, Data Sources, and KB Review with route-specific guidance, retry actions, and safe diagnostic context. — **DONE (2026-05-24): added a reusable internal load-error notice with retry actions and safe HTTP diagnostics, then wired it to Clients, Data Sources, and KB Review so generic backend failures now explain the affected route group and next step. Verified with web lint/build.**
- [x] **T128 — UXAUDIT** Clean up internal ticket row density: reduce overlapping/crowded chips, prioritize customer issue text, and move secondary SLA/confidence/reason details into a scannable metadata row. — **DONE (2026-05-24): internal ticket rows now keep the customer message as the primary line, group priority/status in compact headline pills, and move SLA/escalation/confidence details into a wrapping metadata row below the owner. Verified with web lint/build.**
- [x] **T129 — UXAUDIT** Refine widget PDPA consent UX: hide or de-emphasize the disabled input before consent and reposition the "Live demo" tag so it does not overlap the widget header on mobile/desktop. — **DONE (2026-05-24): the widget now hides the message input until PDPA consent is accepted, the live demo label sits above the iframe instead of over the widget header, and the demo iframe loads eagerly so accessibility checks inspect the real widget document. Verified with web lint/build and focused uxaudit accessibility/usability checks on desktop and mobile.**
- [ ] **T130 — UXAUDIT** Clarify deferred billing/payment surfaces: keep payment work deferred per user direction, and rename/hide billing-adjacent internal labels like pricing/MRR so they read as non-billing estimates only. — **DEFERRED (2026-05-24): user instructed us to skip anything billing/payment related for now. No billing/payment UI or copy changes have been implemented.**
- [x] **T131 — UXAUDIT** Improve client login failure recovery: distinguish unknown identifier, unconfigured delivery, and backend failure; include examples for client ID, email, and WhatsApp fallback. — **DONE (2026-05-24): client login now gives clearer recovery copy for unmatched/unusable identifiers, unconfigured email/WhatsApp delivery, inactive clients, backend/service outages, and invalid/expired codes, with examples for client ID, owner email, and WhatsApp number. Verified with web lint/build and focused uxaudit checks on `/client/login` with no failures.**
- [x] **T132 — UXAUDIT** Finish client portal localization coverage: apply the client portal copy/localized formatting system to Data Sources, Knowledge, and Onboarding pages, not just dashboard/tickets. — **DONE (2026-05-24): extended the shared client portal copy system with Data Sources, Knowledge, and Onboarding sections for Bangla, English, and mixed language clients, then wired those pages to localized nav/action labels, headings, empty states, form labels, notices, and number/date formatting. Verified with web lint/build.**

### Internal ticket + client-management UX fixes (2026-05-25 review)

- [x] **T133 — UXAUDIT** Repair internal ticket row layout: prevent checkbox/priority/status/SLA chips from crowding or clipping the customer message, especially in the narrow left pane. — **DONE (2026-05-25): fixed the ticket row grid so the clickable row body spans the full row when no bulk-selection checkbox is present, and occupies the content column when bulk selection is enabled instead of collapsing into the checkbox column.**
- [x] **T134 — UXAUDIT** Simplify ticket row metadata: keep priority/status/SLA visible in the row and move lower-priority confidence/escalation details to the detail panel so the queue stays scannable. — **DONE (2026-05-25): removed escalation reason and confidence chips from the ticket queue rows while preserving priority/status pills and SLA visibility; the detail panel continues to show escalation/confidence context.**
- [x] **T135 — UXAUDIT** Replace absolute-positioned ticket selection checkboxes with a stable grid/flex layout that works with keyboard focus, hover, selected, and checked states. — **DONE (2026-05-25): ticket selection checkboxes now participate in the row grid as their own stable column instead of floating over the row, with aligned spacing for hover/selected/checked states.**
- [x] **T136 — UXAUDIT** Add a compact ticket "current state" summary to the detail panel: status, assignee, SLA, confidence, and raised/escalation reason in one predictable block. — **DONE (2026-05-25): the ticket detail panel now groups status, assignee, SLA, AI confidence, raised reason, and updated time into one compact responsive state summary.**
- [x] **T137 — UXAUDIT** Fix the P1 browser-alert nudge so it never overlaps ticket/client content on desktop or mobile; make the placement feel intentional and recoverable. — **DONE (2026-05-25): moved the browser-alert permission nudge into the workspace flow below the page header, added a dismiss action, and kept urgent P1 alerts as toasts only when real P1 events arrive.**
- [x] **T138 — UXAUDIT** Normalize the new internal Clients DPA, data-retention, and Facebook Page controls to match the existing styled form inputs/selects instead of raw browser controls. — **DONE (2026-05-25): added shared Clients-section form styling for labels, inputs, selects, textareas, focus states, and textarea sizing across DPA, retention, and Facebook Page controls.**
- [x] **T139 — UXAUDIT** Reorder the internal Clients detail page so core client information/editing appears before operational add-ons like DPA, retention, and channel management. — **DONE (2026-05-25): moved the editable client information form ahead of DPA, retention, and Facebook Page management in the visual flow without changing the deferred billing/pricing content.**
- [x] **T140 — UXAUDIT** Improve mobile layout for Clients DPA/retention/Facebook fields: every label/control should stack cleanly, fill the available width, and avoid inline squeezing. — **DONE (2026-05-25): tightened mobile rules for Clients add-on panels so labels/controls/buttons fill the available width, controls cannot overflow, and empty channel states use less vertical space.**
- [ ] **T141 — UXAUDIT** Defer or relabel billing-adjacent Clients pricing/MRR surfaces so they are clearly non-billing estimates only. — **DEFERRED (2026-05-25): user instructed us to skip billing/payment-related work for now; do not implement until billing/payment work is explicitly reopened.**
- [x] **T142 — UXAUDIT** Reuse shared form primitives (`UiSelect`, styled inputs, form actions, section spacing) across the new Clients sections so the page reads as one coherent internal tool. — **DONE (2026-05-25): DPA and retention policy selects now use the shared `UiSelect` primitive, with Clients-section CSS keeping width, focus, and padding aligned with the styled inputs.**

---

## Recommended cadence

- **Weekly Friday review:** tick boxes, update progress snapshot table, push to repo.
- **Move a task off Tier 1 only when shipped** and verified working in production (or alpha for pre-Tier-3 work).
- **New tasks discovered mid-week:** drop them at bottom of the right tier; review during Friday cadence.
- **Blocked tasks:** add `🚫 BLOCKED — reason` inline so it's visible at a glance.
