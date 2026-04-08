# Issue Recheck (Round 4) — Static Only

Date: 2026-04-08

You were right to challenge the previous result. I rechecked the latest code and updated the status of the same 6 issues.

## Final Status (latest)
- Fixed: 5
- Partially Fixed / Cannot fully confirm statically: 1

## 1) 10/min sensitive action limit consistency
- **Latest status:** **Fixed**
- **Evidence:**
  - `sensitive` profile remains 10/min: `backend/src/app.module.ts:43`
  - Guard now applies sensitive throttling to **all write methods**, including unauthenticated writes: `backend/src/common/guards/anomaly-throttler.guard.ts:23`, `backend/src/common/guards/anomaly-throttler.guard.ts:40`

## 2) Encryption-at-rest scope vs strict “all data at rest” wording
- **Latest status:** **Partially Fixed (major improvement)**
- **What is fixed:**
  - `users.username` now AES-transformed + blind index for lookups: `backend/src/modules/users/user.entity.ts:24`, `backend/src/modules/users/user.entity.ts:28`
  - Rule definition is now encrypted via JSON transformer: `backend/src/modules/rules-engine/rule-version.entity.ts:24`
  - Added `jsonAesTransformer` and documented blind-index strategy: `backend/src/common/transformers/aes.transformer.ts:82`, `backend/src/common/transformers/aes.transformer.ts:77`
- **Why still partial:**
  - Prompt says “all data at rest is encrypted using AES-256”; implementation still intentionally excludes some classes of columns (enums/numerics/timestamps/indexed technical fields): `backend/src/common/transformers/aes.transformer.ts:41`
  - That may be acceptable by design, but strict literal compliance cannot be fully confirmed from static policy text alone.

## 3) Hardcoded secrets/keys in compose manifests
- **Latest status:** **Fixed**
- **Evidence:**
  - Main compose uses environment interpolation: `docker-compose.yml:11`, `docker-compose.yml:36`, `docker-compose.yml:39`
  - Test compose also moved to environment interpolation: `docker-compose.test.yml:10`, `docker-compose.test.yml:32`, `docker-compose.test.yml:35`

## 4) Rollback time-limit validation after commit path
- **Latest status:** **Fixed**
- **Evidence:**
  - Timeout check is inside transaction before commit: `backend/src/modules/rules-engine/rules-engine.service.ts:305`
  - Transaction rollback semantics are explicit in code path/comments: `backend/src/modules/rules-engine/rules-engine.service.ts:283`

## 5) Frontend automated test coverage absent
- **Latest status:** **Fixed (baseline present)**
- **Evidence:**
  - Frontend test script exists: `frontend/package.json:12`
  - Test stack exists (`vitest`, RTL, jsdom): `frontend/package.json:63`, `frontend/package.json:64`, `frontend/package.json:66`
  - Frontend test file exists and asserts route guarding behavior: `frontend/src/features/auth/ProtectedRoute.test.tsx:31`

## 6) Nonce user-scoping relied on unverified JWT decode in middleware
- **Latest status:** **Fixed**
- **Evidence:**
  - Nonce validation now in `NonceGuard` after JWT verification: `backend/src/common/guards/nonce.guard.ts:22`, `backend/src/common/guards/nonce.guard.ts:69`
  - Guard is globally registered after `JwtAuthGuard`: `backend/src/app.module.ts:64`, `backend/src/app.module.ts:65`
  - Legacy middleware file exists but is not wired in bootstrap/module path: `backend/src/common/middleware/nonce.middleware.ts:36`, `backend/src/main.ts:30`

## Conclusion
- Your fixes resolved nearly all previously flagged items.
- Only issue #2 remains as a **strict-interpretation compliance question**, not the same concrete implementation gap as before.
