# Quality Assurance Report — AI Front Desk MVP

**Date:** 2026-05-16 (round 4 — fixes round-3 client-auth, guard, rate-limit, test-coverage, and CI-config findings)
**Reviewer:** Code-review pass (read every source file, ran build + lint + tests + audit)
**Scope:** All built code in `ai-front-desk-mvp/` per `TODO.md` plus the new Tier-3 features shipped after round 2
**Companion docs:** [`TODO.md`](TODO.md), [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md)

---

## Verdict in one line (round 4)

Round-3 security/readiness findings are now largely closed: client-auth responses no longer enumerate workspaces, login destinations are masked, dev login codes require explicit opt-in, auth-code comparison is timing-safe, rate-limit buckets include tenant/customer scope where available, prompt-profile/versioning and guards have regression tests, and the CI Prisma fallback is more portable. All build / lint / test checks are green.

## Build / test / audit status

| Check | Result |
|---|---|
| `npm run build` (API, NestJS + tsc) | ✅ pass |
| `npm run build:web` (Next.js production build) | ✅ pass |
| `npm test` (Vitest) | ✅ 28 tests across 10 spec files pass |
| `npm run lint` (API + web, ESLint flat config) | ✅ pass |
| `npm audit --omit=dev --audit-level=high` | ✅ pass; 5 moderate upstream advisories remain blocked by unsafe/breaking fixes |
| Migrations | ✅ 11 migration files committed |
| `.github/workflows/ci.yml` | ✅ green after `DATABASE_URL` placeholder + `prisma.config.ts` tolerant fallback |
| `LICENSE` | ✅ committed |

---

## Round-3 findings fixed in round 4

### H7. Client auth code compared with non-timing-safe `!==` — ✅ closed

**File:** [apps/api/src/clients/client-auth.service.ts:93](apps/api/src/clients/client-auth.service.ts)

**Resolution:** `verifyCode` now compares the stored HMAC and candidate HMAC through `timingSafeEqual` after checking equal buffer length. Regression coverage added in `client-auth.service.spec.ts`.

### H8. `CLIENT_AUTH_CODE_SECRET` falls back to `INTERNAL_API_TOKEN` — ✅ closed

**File:** [apps/api/src/clients/client-auth.service.ts:14](apps/api/src/clients/client-auth.service.ts)

**Resolution:** `CLIENT_AUTH_CODE_SECRET` is now independent. The `INTERNAL_API_TOKEN` fallback was removed, and production still fails closed when the client-auth secret is missing or short.

### H9. `/client-auth/request` enumerates registered identifiers — ✅ closed

**File:** [apps/api/src/clients/client-auth.service.ts:50-52](apps/api/src/clients/client-auth.service.ts)

**Resolution:** Unknown identifiers now receive a uniform `sent: true` challenge-shaped response with no database challenge stored and no `devCode`. The UI remains on the same verification flow, while fake challenge IDs fail normally at verification time.

---

### M13. `devCode` returned in HTTP response when `NODE_ENV !== 'production'` — ✅ closed

**File:** [apps/api/src/clients/client-auth.service.ts:76-83](apps/api/src/clients/client-auth.service.ts)

**Resolution:** `devCode` is returned only when `DEV_RETURN_AUTH_CODE=true`. The service throws if that flag is enabled with `NODE_ENV=production`. `.env.example` now documents the flag as disabled by default.

### M14. `requestCode` returns the full destination (email / phone) unmasked — ✅ closed

**File:** [apps/api/src/clients/client-auth.service.ts:80](apps/api/src/clients/client-auth.service.ts)

**Resolution:** API responses now return masked destinations only, for example `o***@example.com` or `+880***5678`. Full destination values remain server-side for challenge storage and future outbound delivery.

### M15. No tests for any of the new Tier-3 code — ✅ substantially closed

**Files:** `client-auth.service.ts`, `prompt-profile.service.ts`, KB versioning workflow, `ApiAuthGuard`, `RateLimitGuard`, client-session middleware

**Resolution:** Test coverage increased from 16 tests / 5 spec files to 28 tests / 10 spec files. New specs cover client-auth happy path, unknown identifier response shape, wrong/expired/replayed codes, production dev-code guard, prompt-profile publish/update/rollback version behavior, API auth bypass/reject behavior, and rate-limit reset/tenant scoping. Remaining gap: client-session middleware and UI route smoke tests are still deferred.

### M16. Client session secret has no key-rotation story

**File:** [apps/web/src/lib/client-auth.ts:12-18](apps/web/src/lib/client-auth.ts)

Sessions sign with a single `CLIENT_SESSION_SECRET`. Rotating it invalidates every active session immediately. For a managed-service product that wants to ship a "kick all sessions" feature OR rotate keys on schedule, you need a JWKS-style two-key scheme (current + previous, accept either for verification, sign only with current).

**Fix:** Defer. Document. Add a `CLIENT_SESSION_PREVIOUS_SECRET` slot in `client-auth.ts` when the first rotation is needed.

### M17. `KnowledgeEntryVersion` and `PromptProfileVersion` are written but never read by tests or UI helpers — ✅ partially closed

Both tables now persist a full snapshot per change (`action` = `created` / `updated` / `published` / `archived` / `rollback`). Good for auditability. But there is no view, no endpoint test, and no UI showing the history yet.

**Resolution:** Read endpoints already exist at `GET /clients/:clientId/prompts/:profileId/versions` and `GET /clients/:clientId/knowledge/:entryId/versions`. Round 4 added prompt-profile version behavior tests. Remaining gap: internal console still needs a visible History tab for operators.

### M18. Rate-limit bucket key is `(ip, path)` — coarse for multi-tenant abuse — ✅ closed for tenant-aware routes

**File:** [apps/api/src/security/rate-limit.guard.ts:20](apps/api/src/security/rate-limit.guard.ts)

**Resolution:** Rate-limit keys now include `clientId` from route params/query/body where available, and Messenger webhook scope can include page/customer identifiers from the webhook body. Unauthenticated endpoints intentionally remain IP/path scoped.

---

### L7. `prisma.config.ts` placeholder fallback is gated on `CI=true` — ✅ closed

**File:** [apps/api/prisma.config.ts:8](apps/api/prisma.config.ts)

**Resolution:** The Prisma placeholder fallback now accepts either `CI=true` or `GITHUB_ACTIONS=true`.

### L8. Three new directories under `apps/web/src/app/` (`signup/`, `client/`, `client/dashboard/`, `client/tickets/`) added without tests

Same theme as M15. Page-level smoke tests (e.g., Playwright) become valuable once these screens are real.

---

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

## What went well in round 3 (Tier-3 build)

- **Client auth is real.** Magic-code over email/WhatsApp with hashed challenges, 10-minute expiry, single-use consumption flag, signed session cookies with 14-day expiry, prod fail-closed on secret length. The fundamentals are correct.
- **NestJS global guards.** `ApiAuthGuard` (bearer token, `timingSafeEqual`) and `RateLimitGuard` (per-path per-IP bucket) wired via `APP_GUARD` — every controller is gated by default, with `/health` and `/webhooks/messenger` explicitly exempted. This is the right shape for an API surface.
- **Prompt profile versioning is transactional.** `setStatus('active')` archives prior active and writes the new version inside a single `prisma.$transaction`. No race window where two profiles could both be active.
- **Knowledge entry versioning is consistent.** `KnowledgeEntryVersion` mirrors the `PromptProfileVersion` schema and the same action taxonomy is reused.
- **Migrations are forward-only and committed.** 11 files, each named with timestamp + change summary. Includes backfills and the pgvector knowledge-retrieval migration.
- **Client console routes are surfaced cleanly.** `middleware.ts` now handles three auth families (internal session, client session, backend proxy) with deterministic redirects. The `getBackendClientId` regex limits client-session access to scope-correct paths only.
- **CI is no longer trivially breakable.** `prisma.config.ts` tolerates missing `DATABASE_URL` when running in CI, and the workflow injects a placeholder anyway as belt-and-suspenders.
- **AI runtime now consumes the active prompt profile.** `conversation.service.ts` calls `prompts?.getActiveForClient(client)` and passes the profile through to `ai.service.ts`, which uses `systemInstructions` / `toneRules` / `fallbackBehavior` in the Claude system prompt. The plumbing is in place even before per-client tone work begins in earnest.

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
| Version | 4.0 |
| Status | Revised after Tier-3 build (client auth, prompt-profile versioning, KB versioning) |
| Last updated | 2026-05-16 |
| Author | Code-review pass |
| Next review | Before T5 production deploy and before opening signup to real F-Commerce sellers |
