# Quality Assurance Report — AI Front Desk MVP

**Date:** 2026-05-15 (revised after second fix pass)
**Reviewer:** Code-review pass (read every source file, ran build + tests + audit)
**Scope:** All built code in `ai-front-desk-mvp/` per `TODO.md` Tier 0–2
**Companion docs:** [`TODO.md`](TODO.md), [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md)

---

## Verdict in one line

Kernel is production-acceptable from a security standpoint and the biggest maintainability item (M3) is resolved. All actionable open items from the previous report round are now closed in code. The only remaining items are externally constrained (T10 upstream advisories) or environment-dependent (H4 distributed rate-limit when multi-instance deployment lands).

## Build / test / audit status

| Check | Result |
|---|---|
| `npm run build` (API, NestJS + tsc) | ✅ pass |
| `npm run build:web` (Next.js production build) | ✅ pass |
| `npm test` (Vitest) | ✅ 16 tests across 5 spec files pass |
| `npm run lint` (API + web, ESLint flat config) | ✅ pass |
| `npm audit --omit=dev --audit-level=high` | ✅ pass; 5 moderate upstream advisories remain blocked by unsafe/breaking fixes |
| Migrations | ✅ 6 migration files committed |
| `.github/workflows/` | ✅ CI configured |
| `LICENSE` | ✅ committed |

---

## Open findings (still to address)

### H4. No distributed rate limiting (deferred)

**Status:** in-memory rate limit lives on login and the API guard. Will not work correctly across multiple server instances (each instance keeps its own attempt map, so an attacker can spread brute-force across instances).

**Files:** [apps/web/src/app/api/internal-login/route.ts](apps/web/src/app/api/internal-login/route.ts) + API guard

**Action:** Move attempt tracking to Redis or Upstash before multi-instance deployment. Add `@nestjs/throttler` with a Redis store for the API side. Defer until the Tier 3 / multi-instance deployment decision is made.

### M4. Conversation.id randomised for new rows only (low risk)

**Status:** new conversations use random UUIDs with a unique `(clientId, channel, externalConversationId)` lookup index. Pre-fix rows from early dev still carry the predictable `channel:clientId:externalConversationId` id.

**Action (optional):** If pre-fix data does not need preserving, drop and reseed. Otherwise leave — enumeration risk is low because the API is authenticated and pre-fix rows are only test fixtures.

### T10. Moderate `npm audit` advisories remain (upstream blocked)

**Status:** `npm audit --omit=dev --audit-level=high` is clean and enforced by CI. 5 moderate advisories persist — primarily `postcss < 8.5.10` reached through Next.js. The available `npm audit fix --force` downgrades Next to a much older major (`9.3.3`), which is unacceptable.

**Action:** Watch upstream. Bump Next.js to a patch that ships `postcss ≥ 8.5.10` as soon as it lands. No action otherwise.

### Low-priority leftover

- **L1.** Bangla literals baked into fallback strings ([apps/api/src/ai/ai.service.ts](apps/api/src/ai/ai.service.ts)). Should come from client config / locale file. Defer until per-client tone work in Tier 3.
- **L3.** `apps/web/src/app/page.tsx` is the public landing fallback — content unverified. Will be replaced by the real landing during Tier 4.

---

## What went well in this pass

- **M3 closed.** The internal page dropped from 896 lines to 404 lines as an orchestrator. Sub-components live under [apps/web/src/app/internal/_components/](apps/web/src/app/internal/_components/) (`Sidebar`, `MetricCards`, `QaReview`, `TicketsPanel`, `ConversationsPanel`, `TicketDetailPanel`, `PanelError`). Shared helpers moved to [apps/web/src/app/internal/_lib/helpers.ts](apps/web/src/app/internal/_lib/helpers.ts).
- **L2 closed.** ESLint flat config on both `apps/api` and `apps/web`; root `npm run lint` runs both. `next lint` (deprecated in Next.js 16) replaced with `eslint .`.
- **L4 closed.** Proprietary [`LICENSE`](LICENSE) committed.
- **L5 closed.** README now documents `prisma migrate deploy` workflow and the no-`db push` rule for shared environments.
- **L6 closed.** Defensive `DEFAULT CURRENT_TIMESTAMP` added to `Message.createdAt`, `Ticket.createdAt`, `Ticket.updatedAt` via migration `20260515023000_default_timestamps`.
- **M7 improved.** Test count doubled from 7 to 16 across 5 spec files. New specs cover knowledge keyword match (incl. Bangla), AI fallback path (incl. escalation triggers), and Messenger send dry-run mode. Controller-level integration tests are still recommended before T7 live traffic but the foundation is in place.
- All 6 CRITICAL findings (C1–C6) and 5 of 6 HIGH findings (H1, H2, H3, H5, H6) from the initial review remain closed and verified.
- Schema uses Postgres enums (`TicketPriority`, `TicketStatus`) and an optimistic-locking `version` column.
- Shared DTOs live in `@ai-front-desk/shared`; both apps import from there.
- API CORS allowlisted; internal session signed; password compared with `timingSafeEqual`.
- Webhook handler is idempotent (`reply:${message.id}` deterministic outbound id + `messageExists` short-circuit).
- Graph API fetch has an 8-second timeout and structured failure logging.
- CI is wired up (install → Prisma generate → API build → web build → tests → high/critical audit gate).
- Build, lint, and test all green.

Solid foundation for T5 deploy and T7 live traffic. Open items are now externally blocked or deferred to later tiers.

---

## Recommended follow-up tasks (to add to TODO.md)

- [ ] **Q10b** Replace in-memory rate limit with Redis-backed store before multi-instance deploy (H4).
- [ ] **Q18b** Add controller + repository integration tests (NestJS testing module + ephemeral Postgres via Testcontainers); target ≥ 25 total tests before T7 (M7).
- [ ] **Q15c** Decide whether to reseed legacy conversation rows with random UUIDs or leave them (M4).
- [ ] **Qcleanup** Move Bangla fallback strings into a per-client locale file (L1).

Items already closed in this pass are listed under "What went well" above and crossed off in the TODO.md tier table.

---

## Resolved in this fix pass (2026-05-15 round 2)

| Item | Title | How |
|---|---|---|
| **M3** | Internal page too large | Split into orchestrator + 6 sub-components + helpers module; 896 → 404 lines |
| **L2** | No lint on `apps/api` | ESLint flat config on both apps; root `npm run lint` covers both |
| **L4** | No LICENSE | Proprietary license committed |
| **L5** | No migrate-deploy docs | README "Database Migrations" section added |
| **L6** | Non-default timestamps | Migration `20260515023000_default_timestamps` adds `DEFAULT CURRENT_TIMESTAMP` |
| **M7** | Test coverage thin | 7 → 16 tests; 2 → 5 spec files; KB / AI / Send services now covered |

---

## Resolved in earlier fix passes (audit trail)

All CRITICAL findings (C1–C6), 5 of 6 HIGH findings (H1, H2, H3, H5, H6), and Medium items M1, M2, M5, M6, M8, M9, M10, M11, M12 were resolved in the prior round. See git history of this file for the detailed narrative if needed.

---

## Drift findings (TODO.md vs reality, post-fix round 2)

| TODO item | Claim | Reality |
|---|---|---|
| T1 auth gate | Done | Signed session, fail-closed, rate-limited ✅ |
| T9 formal migrations | Done | ✅ now 6 migration files |
| T11 sslmode=verify-full | Done | ✅ |
| T12 assignee + filter | Done | ✅ assignees from `/internal/users` |
| T13 ticket comments | Done | ✅ |
| T14 panel error states | Done | ✅ |
| T8 grading view | Done | ✅ |

No misleading claims remain.

---

## Document control

| Field | Value |
|---|---|
| Version | 3.0 |
| Status | Revised after second fix pass |
| Last updated | 2026-05-15 |
| Author | Code-review pass |
| Next review | Before T5 production deploy and before starting Tier 4 |
