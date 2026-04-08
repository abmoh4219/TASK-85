# Recheck Report — Previously Flagged 6 Issues (Static-Only)

Date: 2026-04-08

Scope: Rechecked only the six issues you listed. No runtime execution, no tests run, no Docker.

## Overall
- Fixed: 3
- Partially fixed: 2
- Not fixed: 1

## 1) High — 10/min sensitive action limit consistency
- **Status:** Partially Fixed
- **What is fixed:**
  - Named throttler profiles now exist with `sensitive = 10/min`: `backend/src/app.module.ts:43`
  - Central guard logic applies sensitive throttling to authenticated write methods: `backend/src/common/guards/anomaly-throttler.guard.ts:39`
- **What remains:**
  - Sensitive throttling is skipped when request is not authenticated: `backend/src/common/guards/anomaly-throttler.guard.ts:41`
  - Auth write endpoints do not have explicit 10/min override decorators: `backend/src/modules/auth/auth.controller.ts:17`
- **Conclusion:** much better centralized control, but still not fully uniform for all write-sensitive paths.

## 2) High — Encryption-at-rest scope vs strict prompt wording
- **Status:** Not Fixed
- **Evidence:**
  - Transformer still states selective scope with explicit exclusions: `backend/src/common/transformers/aes.transformer.ts:41`
  - Example non-AES transformed persisted fields remain:
    - `users.username`: `backend/src/modules/users/user.entity.ts:22`
    - `users.password_hash` (hashed only): `backend/src/modules/users/user.entity.ts:25`
    - `rule_versions.definition` JSONB: `backend/src/modules/rules-engine/rule-version.entity.ts:23`
- **Conclusion:** still a requirement-fit gap if interpreted strictly as “all persisted data AES-256 encrypted at rest”.

## 3) High — Hardcoded secrets/keys in compose manifests
- **Status:** Partially Fixed
- **What is fixed:**
  - Main compose now uses env interpolation with defaults rather than fixed literals for key app secrets: `docker-compose.yml:36`, `docker-compose.yml:39`
- **What remains:**
  - Test compose still contains inline secret literals: `docker-compose.test.yml:32`, `docker-compose.test.yml:35`
- **Conclusion:** production-facing manifest improved; not fully externalized across all manifests.

## 4) Medium — Rollback time-limit validation after commit path
- **Status:** Fixed
- **Evidence:**
  - Timeout validation is now inside transaction before commit: `backend/src/modules/rules-engine/rules-engine.service.ts:305`
  - Transaction rollback intent is explicit in comments and flow: `backend/src/modules/rules-engine/rules-engine.service.ts:283`

## 5) Medium — Frontend automated test coverage absent
- **Status:** Fixed (baseline)
- **Evidence:**
  - Frontend test script exists: `frontend/package.json:12`
  - Testing stack added: `frontend/package.json:63`, `frontend/package.json:64`, `frontend/package.json:66`
  - At least one frontend test suite exists: `frontend/src/features/auth/ProtectedRoute.test.tsx:31`
- **Note:** coverage now exists but is still narrow (primarily route guard behavior).

## 6) Medium (Suspected Risk) — Nonce user-scoping from unverified JWT decode
- **Status:** Fixed
- **Evidence:**
  - Nonce enforcement moved to a guard that runs after JWT auth and uses verified `req.user`: `backend/src/common/guards/nonce.guard.ts:22`, `backend/src/common/guards/nonce.guard.ts:69`
  - Guard registered globally after `JwtAuthGuard`: `backend/src/app.module.ts:64`, `backend/src/app.module.ts:65`
  - Legacy middleware remains in repo but not wired from bootstrap/module path: `backend/src/common/middleware/nonce.middleware.ts:36`, `backend/src/main.ts:30`

## Final Recheck Verdict
- You fixed important parts (especially issues #4, #5, #6).
- Remaining blockers from this list are still:
  1. **Issue #2** (not fixed)
  2. **Issue #1** (partially fixed)
  3. **Issue #3** (partially fixed)
