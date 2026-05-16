# Quality Assurance Report — AI Front Desk MVP

**Date:** 2026-05-16 (round 5 — channel tier verified after WhatsApp + web chat)
**Reviewer:** Code-review pass (read every source file, ran build + lint + tests + audit)
**Scope:** All built code in `ai-front-desk-mvp/` per `TODO.md` through Tier 5 channel work
**Companion docs:** [`TODO.md`](TODO.md), [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md)

---

## Verdict in one line (round 5)

The channel layer is now MVP-complete: Messenger, WhatsApp, and web chat all route through the same conversation engine, with shared outbound sending for Messenger/WhatsApp and an iframe-friendly web widget. Prior round-3 security findings remain closed. Remaining risks are deployment/operations work: multi-instance rate limits, real credentials, production observability, UI smoke tests, and upstream moderate advisories.

## Build / test / audit status

| Check | Result |
|---|---|
| `npm run build` (API, NestJS + tsc) | ✅ pass |
| `npm run build:web` (Next.js production build) | ✅ pass |
| `npm test` (Vitest) | ✅ **47 tests across 17 spec files** pass |
| `npm run lint` (API + web, ESLint flat config) | ✅ pass |
| `npm audit --omit=dev --audit-level=high` | ✅ pass; 5 moderate upstream advisories remain blocked by unsafe/breaking fixes |
| Migrations | ✅ 11 migration files committed |
| `.github/workflows/ci.yml` | ✅ green |
| `LICENSE` | ✅ committed |

---

## Open findings (still to address)

### H4. No distributed rate limiting (deferred until multi-instance deploy)

In-memory rate limit lives on login, the API guard, and the NestJS `RateLimitGuard`. Will not work correctly across multiple server instances — each instance keeps its own bucket map.

**Files:** [apps/web/src/app/api/internal-login/route.ts](apps/web/src/app/api/internal-login/route.ts), [apps/api/src/security/rate-limit.guard.ts](apps/api/src/security/rate-limit.guard.ts)

**Action:** Move attempt tracking to Redis or Upstash before the first multi-instance deployment.

### M4. Conversation.id randomised for new rows only (low risk, optional)

New conversations use random UUIDs with a unique `(clientId, channel, externalConversationId)` index. Pre-fix dev rows still carry the predictable `channel:clientId:externalConversationId` id.

**Action:** Drop and reseed if pre-fix data does not need preserving. Otherwise leave — enumeration risk is low because the API is authenticated.

### M16. Client session secret has no key-rotation story (deferred)

Sessions sign with a single `CLIENT_SESSION_SECRET`. Rotating it invalidates every active session immediately.

**File:** [apps/web/src/lib/client-auth.ts:12-18](apps/web/src/lib/client-auth.ts)

**Action:** Add a `CLIENT_SESSION_PREVIOUS_SECRET` slot when the first rotation is needed. Two-key verify, single-key sign.

### M17. Version history not surfaced in the internal console (partial)

`KnowledgeEntryVersion` and `PromptProfileVersion` are written on every change. Read endpoints exist (`GET /clients/:clientId/prompts/:profileId/versions` and `GET /clients/:clientId/knowledge/:entryId/versions`) and prompt-profile version behaviour is tested. UI does not yet expose a History tab.

**Action:** Add a "History" panel on the prompt-profile editor and knowledge entry editor inside the internal console.

### T10. Moderate `npm audit` advisories remain (upstream blocked)

`npm audit --omit=dev --audit-level=high` is clean and enforced by CI. 5 moderate advisories persist — primarily `postcss < 8.5.10` reached through Next.js. The available `npm audit fix --force` downgrades Next to a much older major (`9.3.3`), which is unacceptable.

**Action:** Watch upstream. Bump Next.js to a patch that ships `postcss ≥ 8.5.10` as soon as it lands.

### L1. Bangla literals in fallback strings

`apps/api/src/ai/ai.service.ts` — should come from client config / locale file. Defer until per-client tone polish.

### L3. `apps/web/src/app/page.tsx` is the public landing fallback

Content unverified. Will be replaced by the real landing during the Tier-4 client-facing build.

### L8. UI smoke tests for `/signup`, `/client/*`, `/internal/*`, `/widget` pages

Page-level Playwright smoke tests not yet added. Becomes valuable as the client console grows.

---

## Resolved in round 4 (2026-05-16) — verified in code + tests

| Item | Title | Verification |
|---|---|---|
| **H7** | Auth code compared with non-timing-safe `!==` | `hashesMatch()` in `client-auth.service.ts:35-39` uses `timingSafeEqual` over equal-length buffers; covered by `client-auth.service.spec.ts` |
| **H8** | `CLIENT_AUTH_CODE_SECRET` fell back to `INTERNAL_API_TOKEN` | Fallback removed (`client-auth.service.ts:20-26`); independent secret with production fail-closed at ≥ 32 chars |
| **H9** | `/client-auth/request` enumerated identifiers | Unknown identifiers return uniform `{ sent: true, challengeId: ... }` with no DB write and masked echo of the requested identifier (`client-auth.service.ts:85-97`) |
| **M13** | `devCode` auto-enabled in non-prod | Now gated on `DEV_RETURN_AUTH_CODE=true`; throws if set together with `NODE_ENV=production` (`client-auth.service.ts:13-19`) |
| **M14** | Destination returned unmasked | `maskEmail` / `maskPhone` / `maskDestination` helpers used in every response path (`client-auth.service.ts:41-62`) |
| **M15** | No tests for Tier-3 code | Test count 16 → **32**; new spec files for `client-auth`, `prompt-profile`, `api-auth.guard`, `rate-limit.guard`, `urgent-ticket-notification`, `embedding`; 11 total spec files |
| **M18** | Rate-limit bucket coarse | `getTenantScope()` derives `clientId` from params/query/body, and webhook scope from `entry[0].id` + sender; key becomes `ip:path:client:<id>` when scope exists (`rate-limit.guard.ts:33-60`) |
| **L7** | Prisma CI fallback gated on `CI=true` only | Now accepts `CI=true` or `GITHUB_ACTIONS=true` (`prisma.config.ts:8`) |

Tests verifying these fixes run on every CI build.

---

## Resolved in earlier rounds (audit trail)

- **Round 1 (initial scan).** Raised C1–C6, H1–H6, M1–M12, L1–L6.
- **Round 2 (first fix pass).** Closed all CRITICAL (C1–C6), 5 of 6 HIGH (H1, H2, H3, H5, H6), and Medium items M1, M2, M5, M6, M8, M9, M10, M11, M12.
- **Round 2.5 (second fix pass).** Closed M3 (internal page split 896 → 404 lines + 6 sub-components), L2 (ESLint flat config on both apps), L4 (proprietary LICENSE), L5 (migration docs in README), L6 (default timestamps migration), M7 (test count 7 → 16).
- **Round 3 (Tier-3 build review).** Raised H7, H8, H9, M13–M18, L7, L8.
- **Round 4 (this round).** Closed H7, H8, H9, M13, M14, M15, M18, L7. M17 partially closed (read endpoints + tests in place; UI history view pending).
- **Round 5 (channel tier).** Added shared channel sender, WhatsApp webhook adapter, web chat API/widget, and channel tests. Channel tier T31/T32/T33 is now complete in `TODO.md`.

See git history of this file for the detailed narrative of any closed item.

---

## What went well in the current build

- **Channel tier closed.** T31/T32/T33 are done: WhatsApp adapter, web chat widget, and shared channel send abstraction.
- **Unified conversation engine.** Messenger, WhatsApp, and web chat all enter through `ConversationService`, reducing channel-specific business logic.
- **Provider-safe delivery behavior.** Messenger and WhatsApp sends support dry-run modes when credentials are absent; real sends use the same `ChannelSendService`.
- **Webhook security shape is consistent.** Messenger and WhatsApp both support signature verification, with local/dev skip behavior and production/credential-driven enforcement.
- **Web widget is iframe-friendly.** `/widget?clientId=...` gives a lightweight customer-facing web channel without requiring a new frontend app.
- **Regression coverage expanded.** Tests now cover WhatsApp webhook routing, WhatsApp signature verification, shared channel send behavior, web chat routing, client auth, digest delivery, prompt/KB behavior, guards, rate limiting, AI fallback, and embeddings.

## Tier-3 Context

- **Client auth fundamentals are correct.** Magic-code over email/WhatsApp with HMAC-hashed challenges, 10-minute expiry, single-use consumption flag, signed session cookies with 14-day expiry, production fail-closed on secret length.
- **NestJS global guards.** `ApiAuthGuard` (bearer token, `timingSafeEqual`) and `RateLimitGuard` (tenant-aware bucket) wired via `APP_GUARD` — every controller is gated by default, with `/health` and `/webhooks/messenger` explicitly exempted.
- **Prompt profile versioning is transactional.** `setStatus('active')` archives prior active and writes the new version inside a single `prisma.$transaction`. No race window.
- **Knowledge entry versioning is consistent.** `KnowledgeEntryVersion` mirrors `PromptProfileVersion` and reuses the same action taxonomy.
- **Migrations are forward-only and committed.** 11 files including pgvector knowledge retrieval and various backfills.
- **Middleware handles three auth families.** Internal session, client session, backend proxy — with deterministic redirects.
- **AI runtime consumes the active prompt profile.** `conversation.service.ts` calls `prompts?.getActiveForClient(client)` and passes the profile into the Claude system prompt.

---

## Recommended follow-up tasks (to add to TODO.md)

- [ ] **Q10b** Replace in-memory rate limit with Redis-backed store before multi-instance deploy (H4).
- [ ] **Q15c** Decide whether to reseed legacy conversation rows with random UUIDs or leave them (M4).
- [ ] **Q14b** Add a History tab on prompt-profile and knowledge-entry editors inside the internal console (M17).
- [ ] **Q18b** Add Playwright smoke tests for `/signup`, `/client/*`, `/internal/*`, `/widget` (L8).
- [ ] **Q-rotation** Add `CLIENT_SESSION_PREVIOUS_SECRET` slot for graceful session-secret rotation (M16).
- [ ] **Qcleanup** Move Bangla fallback strings into a per-client locale file (L1).

---

## Document control

| Field | Value |
|---|---|
| Version | 6.0 |
| Status | Revised after Tier-5 channel completion |
| Last updated | 2026-05-16 |
| Author | Code-review pass |
| Next review | Before T5 production deploy and before opening signup to real F-Commerce sellers |
