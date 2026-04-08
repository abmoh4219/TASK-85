# Revalidation of Previously Reported Issues (Static-Only)

Date: 2026-04-08

Scope: Rechecked only the 6 issues you listed, using static code/config inspection. No runtime execution.

## Summary
- Fixed: 3
- Partially Fixed: 2
- Not Fixed: 1

## 1) High — 10/min sensitive action limit not consistently enforced
- **Previous finding:** global/default limit allowed non-uniform enforcement unless per-endpoint decorators were added.
- **Current status:** **Partially Fixed**
- **What changed:**
  - Added named throttler profiles with `sensitive` limit 10/min: `backend/src/app.module.ts:43`
  - Added guard logic to enforce `sensitive` throttling on authenticated write methods: `backend/src/common/guards/anomaly-throttler.guard.ts:39`
- **Remaining gap:**
  - `sensitive` throttling is explicitly skipped for unauthenticated writes (`!isAuthenticated`): `backend/src/common/guards/anomaly-throttler.guard.ts:41`
  - Auth endpoints (`/auth/login`, `/auth/refresh`) now have no explicit `@Throttle(10/min)` overrides: `backend/src/modules/auth/auth.controller.ts:17`
  - So enforcement is stronger and more centralized than before, but still not uniformly 10/min for all potentially sensitive write paths.

## 2) High — Encryption-at-rest scope narrower than strict “all data at rest” wording
- **Current status:** **Not Fixed**
- **Evidence unchanged:**
  - Transformer still documents selective encryption scope (text/varchar-focused with explicit exclusions): `backend/src/common/transformers/aes.transformer.ts:41`
  - Critical persisted fields remain unencrypted at column-transformer level (examples):
    - `users.username`: `backend/src/modules/users/user.entity.ts:22`
    - `users.password_hash` (hashed, not AES-encrypted): `backend/src/modules/users/user.entity.ts:25`
    - `rule_versions.definition` JSONB: `backend/src/modules/rules-engine/rule-version.entity.ts:23`
- **Conclusion:** still a requirement-fit risk under strict interpretation of prompt wording.

## 3) High — Hardcoded secrets/keys in compose manifests
- **Current status:** **Partially Fixed**
- **What changed (improved):**
  - Production compose now uses env interpolation with non-secret dev defaults (instead of hardcoded production-like literals):
    - `docker-compose.yml:36`
    - `docker-compose.yml:39`
    - `docker-compose.yml:11`
- **Remaining gap:**
  - Test compose still contains inline test credentials/secrets literals: `docker-compose.test.yml:10`, `docker-compose.test.yml:32`, `docker-compose.test.yml:35`
- **Conclusion:** materially improved for primary runtime manifest, but not fully externalized across all manifests.

## 4) Medium — Rollback time-limit validation after commit path
- **Current status:** **Fixed**
- **What changed:**
  - Timing check moved inside transaction before commit path, with explicit rollback-on-timeout behavior:
    - transaction note: `backend/src/modules/rules-engine/rules-engine.service.ts:283`
    - in-transaction timeout check: `backend/src/modules/rules-engine/rules-engine.service.ts:306`
  - Removed prior post-commit violation throw pattern.

## 5) Medium — Frontend automated test coverage absent
- **Current status:** **Fixed (baseline), with limited breadth**
- **What changed:**
  - Frontend test script added: `frontend/package.json:12`
  - Frontend test tooling added (`vitest`, `@testing-library/react`, `jsdom`): `frontend/package.json:63`, `frontend/package.json:64`, `frontend/package.json:66`
  - At least one auth-route test suite exists: `frontend/src/features/auth/ProtectedRoute.test.tsx:31`
- **Note:** Coverage is no longer absent, but still narrow (mostly route-guard behavior).

## 6) Medium (Suspected Risk) — Nonce user-scoping used unverified JWT decode in middleware
- **Current status:** **Fixed**
- **What changed:**
  - Added `NonceGuard` that runs after `JwtAuthGuard` and uses verified `req.user`: `backend/src/common/guards/nonce.guard.ts:22`, `backend/src/common/guards/nonce.guard.ts:69`
  - Registered globally in guard chain after JWT guard: `backend/src/app.module.ts:64`, `backend/src/app.module.ts:65`
  - Legacy middleware still exists but is not referenced anywhere else: `backend/src/common/middleware/nonce.middleware.ts:36`

## Final Revalidation Verdict
- The previously reported set has been **materially improved**.
- Remaining material items are:
  1. **Issue #2 (Not Fixed):** encryption-at-rest scope vs strict prompt interpretation.
  2. **Issue #1 (Partially Fixed):** 10/min sensitive throttling still not uniform for unauthenticated sensitive writes.
  3. **Issue #3 (Partially Fixed):** secret externalization improved but not complete across all manifests.
