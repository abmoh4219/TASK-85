# MeridianMed Static Delivery Acceptance & Architecture Audit

## 1. Verdict
- **Overall conclusion: Partial Pass**
- The repository is substantial and maps to the requested business domains, but there are material requirement-fit and security/control gaps (notably rate-limit policy enforcement breadth, encryption-at-rest interpretation gap vs prompt wording, and hardcoded secrets in committed compose files).

## 2. Scope and Static Verification Boundary
- **Reviewed:** project docs/config (`README.md`, compose files, Dockerfiles), backend entry points/guards/services/entities/migrations/tests, frontend routing/auth/data-fetching/pages, and test configs.
- **Not reviewed in depth:** generated docs outside core acceptance path (`docs/*`) and every DTO/entity field exhaustively for non-critical style concerns.
- **Intentionally not executed:** app startup, Docker, tests, browser flows, network/TLS handshake verification, timing behavior under load.
- **Manual verification required for:** real TLS behavior across all hops, runtime rate-limit behavior for every sensitive endpoint, rollback timing under realistic DB load, and end-to-end UX behavior in browser.

## 3. Repository / Requirement Mapping Summary
- **Prompt core goal:** on-prem full-stack hospital operations platform with role-routed workflows across procurement, inventory/alerts, lab, projects, learning, and rules engine.
- **Mapped implementation areas:** NestJS modules and services (`backend/src/modules/*`), React feature pages/routes (`frontend/src/features/*`), TypeORM entities and encryption transformer, JWT/refresh auth, guards/middleware, e2e/unit tests, and Docker manifests.
- **Major constraints checked:** JWT 15m + refresh 8h, action-level RBAC, nonce/timestamp, rate limiting target, price lock/expiry/consumption/buffer rules, recommendation feedback, rule rollout/rollback semantics, TLS/documented startup.

## 4. Section-by-section Review

### 1. Hard Gates

#### 1.1 Documentation and static verifiability
- **Conclusion: Pass**
- **Rationale:** Startup/run/test instructions and container manifests are present and statically coherent enough to attempt manual verification.
- **Evidence:** `README.md:3`, `README.md:11`, `docker-compose.yml:3`, `docker-compose.test.yml:3`, `run_tests.sh:1`
- **Manual verification note:** Runtime success is not asserted (static-only boundary).

#### 1.2 Material deviation from Prompt
- **Conclusion: Partial Pass**
- **Rationale:** Core domains are implemented, but key constraints are weakened/partially met: broad 10/min sensitive-rate-limit requirement not uniformly enforced and encryption-at-rest requirement appears narrower than prompt wording.
- **Evidence:** `backend/src/app.module.ts:39`, `backend/src/modules/rules-engine/rules-engine.controller.ts:23`, `backend/src/modules/users/user.entity.ts:22`, `backend/src/modules/rules-engine/rule-version.entity.ts:23`

### 2. Delivery Completeness

#### 2.1 Core explicit requirements coverage
- **Conclusion: Partial Pass**
- **Rationale:** Major module coverage exists (procurement, inventory alerts, lab lifecycle/versioning, projects, learning lifecycle, rules engine, auth), but some cross-cutting non-functional requirements are incomplete/ambiguous vs prompt hard wording.
- **Evidence:** `backend/src/modules/procurement/procurement.service.ts:340`, `backend/src/modules/inventory/inventory.service.ts:208`, `backend/src/modules/lab/lab.service.ts:221`, `backend/src/modules/rules-engine/rules-engine.service.ts:266`, `backend/src/app.module.ts:39`

#### 2.2 0→1 end-to-end product shape
- **Conclusion: Pass**
- **Rationale:** Complete multi-folder full-stack structure with substantial backend/frontend implementations and non-trivial e2e suite; not a single-file demo.
- **Evidence:** `backend/src/app.module.ts:10`, `frontend/src/features/auth/AppRouter.tsx:96`, `backend/test/procurement.e2e-spec.ts:16`, `backend/test/security.e2e-spec.ts:11`

### 3. Engineering and Architecture Quality

#### 3.1 Structure and module decomposition
- **Conclusion: Pass**
- **Rationale:** Domain modules and feature folders are reasonably decomposed; guards/decorators/services/entities are separated.
- **Evidence:** `backend/src/app.module.ts:10`, `frontend/src/features/auth/AppRouter.tsx:7`, `backend/src/common/guards/action.guard.ts:72`

#### 3.2 Maintainability/extensibility
- **Conclusion: Partial Pass**
- **Rationale:** Overall maintainable, but several large service/controller files increase change risk and policy controls are partly hardcoded in ways that reduce configurability.
- **Evidence:** `backend/src/modules/procurement/procurement.service.ts:35`, `backend/src/modules/procurement/procurement.controller.ts:29`, `backend/src/app.module.ts:39`

### 4. Engineering Details and Professionalism

#### 4.1 Error handling / logging / validation / API design
- **Conclusion: Partial Pass**
- **Rationale:** Strong baseline exists (global exception filter, class-validator DTOs, Winston config, consistent `{ data }` wrappers), but sensitive controls are inconsistently applied (e.g., rate-limit policy breadth).
- **Evidence:** `backend/src/common/filters/all-exceptions.filter.ts:49`, `backend/src/modules/auth/dto/login.dto.ts:4`, `backend/src/config/winston.config.ts:6`, `backend/src/modules/auth/auth.controller.ts:25`, `backend/src/app.module.ts:39`

#### 4.2 Real product vs demo
- **Conclusion: Pass**
- **Rationale:** Multi-role routes/pages, persistence model breadth, and substantial e2e tests indicate product-like structure.
- **Evidence:** `frontend/src/features/auth/AppRouter.tsx:94`, `backend/test/lab.e2e-spec.ts:15`, `backend/test/learning-rules.e2e-spec.ts:15`

### 5. Prompt Understanding and Requirement Fit

#### 5.1 Business objective and implicit constraints fit
- **Conclusion: Partial Pass**
- **Rationale:** Business workflows are broadly understood and implemented, but some critical control semantics are softened (rate-limit coverage, encryption wording strictness, secret management hygiene).
- **Evidence:** `backend/src/modules/inventory/inventory.service.ts:20`, `backend/src/modules/procurement/procurement.service.ts:32`, `backend/src/modules/rules-engine/rules-engine.service.ts:13`, `docker-compose.yml:36`, `docker-compose.yml:39`

### 6. Aesthetics (frontend/full-stack)

#### 6.1 Visual/interaction quality
- **Conclusion: Pass**
- **Rationale:** UI uses consistent component system, role dashboards, states for loading/empty/error on key pages, and interaction affordances.
- **Evidence:** `frontend/src/features/dashboard/DashboardPage.tsx:77`, `frontend/src/features/procurement/ProcurementPage.tsx:170`, `frontend/src/features/lab/LabPage.tsx:100`, `frontend/src/components/shared/ErrorBoundary.tsx:1`, `frontend/src/components/shared/EmptyState.tsx:1`
- **Manual verification note:** final visual polish/responsiveness requires browser check.

## 5. Issues / Suggestions (Severity-Rated)

### High

1) **Severity: High**
- **Title:** 10/min sensitive action limit is not enforced consistently across sensitive endpoints
- **Conclusion:** Fail
- **Evidence:** `backend/src/app.module.ts:39`, `backend/src/modules/auth/auth.controller.ts:21`, `backend/src/modules/procurement/procurement.controller.ts:41`, `backend/src/modules/rules-engine/rules-engine.controller.ts:23`, `backend/src/modules/users/users.controller.ts:23`
- **Impact:** Prompt requires 10 sensitive actions/min/user; broad endpoint set appears to run at global 60/min unless individually decorated.
- **Minimum actionable fix:** Centralize sensitive endpoint throttling policy (guard/decorator matrix) and enforce 10/min uniformly for all sensitive writes/admin/security actions; avoid relying on sparse per-route decorators.

2) **Severity: High**
- **Title:** Encryption-at-rest implementation appears narrower than prompt’s “all data at rest” requirement
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/common/transformers/aes.transformer.ts:41`, `backend/src/modules/users/user.entity.ts:22`, `backend/src/modules/users/user.entity.ts:25`, `backend/src/modules/rules-engine/rule-version.entity.ts:23`
- **Impact:** Requirement fit risk for strict interpretation; critical persisted fields exist without AES transformer.
- **Minimum actionable fix:** Define explicit encryption policy aligned to prompt and apply field-level encryption (or DB-level encryption) comprehensively; document justified exceptions and how requirement is still met.

3) **Severity: High**
- **Title:** Hardcoded secrets/keys committed in compose manifests
- **Conclusion:** Fail
- **Evidence:** `docker-compose.yml:36`, `docker-compose.yml:39`, `docker-compose.test.yml:32`, `docker-compose.test.yml:35`
- **Impact:** Weak secret hygiene and mismatch with “per-environment keys” expectation; increases operational/security risk.
- **Minimum actionable fix:** Externalize secrets via environment injection/secret management for deployment; keep only non-sensitive placeholders in committed manifests.

### Medium

4) **Severity: Medium**
- **Title:** Rollback time-limit validation occurs after commit path
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/modules/rules-engine/rules-engine.service.ts:283`, `backend/src/modules/rules-engine/rules-engine.service.ts:303`, `backend/src/modules/rules-engine/rules-engine.service.ts:307`
- **Impact:** API may throw rollback time violation after transactional state already changed, causing operational ambiguity.
- **Minimum actionable fix:** Enforce duration guard inside transactional orchestration or mark/compensate explicitly without contradictory post-commit exception semantics.

5) **Severity: Medium**
- **Title:** Frontend automated test coverage is absent
- **Conclusion:** Partial Fail
- **Evidence:** `frontend/package.json:7`, `frontend/package.json:11`, `frontend/src/features/auth/AppRouter.tsx:82`
- **Impact:** UI auth/routing/data-fetch regressions may go undetected while backend tests pass.
- **Minimum actionable fix:** Add frontend unit/integration tests for route protection, auth refresh handling, and critical workflow pages.

6) **Severity: Medium (Suspected Risk)**
- **Title:** Nonce user-scoping relies on unverified JWT payload decoding in middleware
- **Conclusion:** Suspected Risk
- **Evidence:** `backend/src/common/middleware/nonce.middleware.ts:24`, `backend/src/common/middleware/nonce.middleware.ts:71`
- **Impact:** Potential spoofing/DoS characteristics in nonce namespace before full JWT verification.
- **Minimum actionable fix:** Scope nonce by verified principal after auth guard where feasible, or cryptographically bind nonce to validated token/session context.

### Low

7) **Severity: Low**
- **Title:** README test command diverges from stated acceptance command wording
- **Conclusion:** Partial Pass
- **Evidence:** `README.md:13`, `/home/abdelah/Documents/eaglepoint/TASK-w2t85/SPEC.md:86`
- **Impact:** Reviewer/operator confusion risk, though command may still be valid for this compose service naming.
- **Minimum actionable fix:** Align README test command with accepted convention or explicitly document service-name rationale.

## 6. Security Review Summary

- **Authentication entry points:** **Pass** — Login/refresh/logout/me endpoints implemented with JWT strategy and refresh token persistence/rotation patterns. Evidence: `backend/src/modules/auth/auth.controller.ts:19`, `backend/src/modules/auth/auth.service.ts:55`, `backend/src/common/strategies/jwt.strategy.ts:22`.
- **Route-level authorization:** **Partial Pass** — Global JWT + roles/action guard stack exists, but policy consistency for sensitive controls (throttle) is uneven. Evidence: `backend/src/app.module.ts:58`, `backend/src/common/guards/roles.guard.ts:18`, `backend/src/common/guards/action.guard.ts:82`.
- **Object-level authorization:** **Partial Pass** — Present in lab/projects/learning employee scoping; not universally relevant for all admin/supervisor-only resources. Evidence: `backend/src/modules/lab/lab.service.ts:143`, `backend/src/modules/projects/projects.service.ts:87`, `backend/src/modules/learning/learning.service.ts:79`.
- **Function-level authorization:** **Partial Pass** — `@RequireAction` map provides action RBAC, but not every protected mutation uses action tags. Evidence: `backend/src/common/guards/action.guard.ts:11`, `backend/src/modules/procurement/procurement.controller.ts:40`, `backend/src/modules/inventory/inventory.controller.ts:67`.
- **Tenant / user data isolation:** **Cannot Confirm Statistically** — No multi-tenant model in prompt/code; user-level isolation is partially implemented for employee-scoped data. Evidence: `backend/src/modules/procurement/procurement.service.ts:95`, `backend/src/modules/lab/lab.service.ts:127`.
- **Admin / internal / debug protection:** **Pass** — Admin/settings/rules endpoints require auth + roles; no obvious open debug endpoints beyond public health/auth. Evidence: `backend/src/modules/admin/admin.controller.ts:18`, `backend/src/modules/rules-engine/rules-engine.controller.ts:19`, `backend/src/app.controller.ts:6`.

## 7. Tests and Logging Review

- **Unit tests:** **Pass** (backend-only) — Unit suites exist for auth/procurement/inventory/lab/projects/learning/rules core logic. Evidence: `backend/src/modules/auth/__tests__/auth.service.spec.ts:35`, `backend/src/modules/inventory/__tests__/inventory.service.spec.ts:12`, `backend/src/modules/rules-engine/__tests__/rules-engine.service.spec.ts:3`.
- **API/integration tests:** **Pass** — Broad e2e coverage for auth/security/procurement/inventory/lab/projects/learning-rules. Evidence: `backend/test/auth.e2e-spec.ts:9`, `backend/test/security.e2e-spec.ts:11`, `backend/test/procurement.e2e-spec.ts:16`.
- **Logging categories/observability:** **Pass** — Winston configured; exception filter emits structured warn/error paths. Evidence: `backend/src/config/winston.config.ts:6`, `backend/src/common/filters/all-exceptions.filter.ts:57`.
- **Sensitive-data leakage risk in logs/responses:** **Partial Pass** — Password hash stripped from profile/user responses; 500-stack logging may still contain sensitive traces depending on thrown errors. Evidence: `backend/src/modules/auth/auth.service.ts:92`, `backend/src/modules/users/users.controller.ts:19`, `backend/src/common/filters/all-exceptions.filter.ts:60`.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist (Jest) under module `__tests__` for core service logic.
- API/e2e tests exist (Jest + supertest) under `backend/test/*.e2e-spec.ts`.
- Test entry points/scripts exist in backend scripts and `run_tests.sh`; README includes test command.
- Frontend tests are not present.
- **Evidence:** `backend/package.json:14`, `backend/package.json:17`, `backend/test/jest-e2e.json:5`, `run_tests.sh:13`, `run_tests.sh:17`, `README.md:13`, `frontend/package.json:7`

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| JWT login/refresh/logout/me | `backend/test/auth.e2e-spec.ts:53` | token issuance + refresh reuse rejection + `/auth/me` 401 (`backend/test/auth.e2e-spec.ts:109`) | sufficient | none major | add explicit JWT-expiry time-window assertion against token payload exp |
| Rotating refresh token security | `backend/test/security.e2e-spec.ts:355` | old token rejected after reuse (`backend/test/security.e2e-spec.ts:371`) | sufficient | missing concurrent refresh race test | add dual concurrent refresh request test |
| Procurement full flow + price lock | `backend/test/procurement.e2e-spec.ts:16` | lock date set and update price 400 (`backend/test/procurement.e2e-spec.ts:282`) | sufficient | lacks boundary exactly-at-30-days test | add boundary test at lock expiry timestamp |
| Partial delivery/backorder/reconcile | `backend/test/procurement.e2e-spec.ts:293` | partial receive status + discrepancy reconcile (`backend/test/procurement.e2e-spec.ts:389`) | sufficient | no concurrent receipts race coverage | add repeated receipt updates under same PO lines |
| Inventory 4 alert rules + rec feedback | `backend/test/inventory.e2e-spec.ts:158` | verifies all alert types and impression/click (`backend/test/inventory.e2e-spec.ts:287`) | sufficient | no idempotency test for click/impression duplicates | add duplicate-click/impression behavior tests |
| Lab lifecycle + abnormal flags + history | `backend/test/lab.e2e-spec.ts:15` | abnormal/critical assertions + version history (`backend/test/lab.e2e-spec.ts:165`) | sufficient | no malformed numeric/text mixed payload fuzz | add invalid payload matrix for result submission |
| Projects lifecycle + deliverables + scoring | `backend/test/projects.e2e-spec.ts:16` | transition validation and approval constraints (`backend/test/projects.e2e-spec.ts:174`) | basically covered | no heavy parallel status transition tests | add conflict/retry tests for simultaneous transitions |
| Learning lifecycle + study compliance | `backend/test/learning-rules.e2e-spec.ts:96` | frequency compliance and transition constraints (`backend/test/learning-rules.e2e-spec.ts:172`) | basically covered | no timezone/week-boundary compliance test | add week-boundary/timezone-sensitive compliance test |
| Rules engine conflict/impact/stage/activate/rollback | `backend/test/learning-rules.e2e-spec.ts:217` | rollback restoredVersion + duration <5min (`backend/test/learning-rules.e2e-spec.ts:306`) | basically covered | no test for post-commit violation semantics | add test that simulates long rollback and asserts consistent state/error contract |
| RBAC route denial matrix | `backend/test/security.e2e-spec.ts:298` | wrong role -> 403 assertions (`backend/test/security.e2e-spec.ts:313`) | basically covered | not exhaustive for every mutation endpoint | add generated endpoint-role matrix test |
| Nonce/timestamp anti-replay | `backend/test/security.e2e-spec.ts:171` | duplicate nonce and stale timestamp 400 (`backend/test/security.e2e-spec.ts:190`) | basically covered | no forged-token nonce namespace abuse case | add nonce spoofing/namespace collision tests |
| Rate limit policy | `backend/test/security.e2e-spec.ts:152` | 429 after burst on `/auth/me` (`backend/test/security.e2e-spec.ts:163`) | insufficient | does not validate 10/min across all sensitive actions | add policy-wide sensitive endpoint throttle suite |
| Frontend role routing/auth UX | none | none | missing | no frontend automated verification | add React Testing Library tests for `ProtectedRoute`, role routes, refresh redirect |

### 8.3 Security Coverage Audit
- **Authentication:** **sufficiently covered** by e2e for login/refresh/logout/me and token rotation; severe defects less likely to slip undetected.
- **Route authorization:** **basically covered** by targeted 403 tests, but not exhaustive across all endpoints.
- **Object-level authorization:** **basically covered** for lab/project/learning cross-user denial; still possible gaps in less-tested resource combinations.
- **Tenant/data isolation:** **cannot confirm** for tenant isolation (no tenant model); user-level isolation is partly covered.
- **Admin/internal protection:** **basically covered** with role-denial tests on admin/rules/anomalies endpoints.

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Major backend happy paths and many security checks are covered, but tests could still pass while severe defects remain in cross-endpoint rate-limit policy enforcement, rollback edge semantics, and all frontend auth/routing interaction paths.

## 9. Final Notes
- This assessment is static-only; no runtime success claims are made.
- Findings are consolidated as root-cause issues to avoid repetitive symptom reporting.
- Highest-priority remediation should target security control consistency (rate limiting + secret management) and strict requirement-fit clarifications (encryption-at-rest scope).
