# MeridianMed Delivery Acceptance & Architecture Audit (Static-Only)

## 1. Verdict
- **Overall conclusion: Fail**
- Primary reasons: explicit prompt constraints are materially unmet in security and requirement fit (at-rest encryption scope, identifier masking rule in UI, and role-route mismatch for HR user access), with additional high-risk implementation gaps.

## 2. Scope and Static Verification Boundary
- **Reviewed:** repository structure, README/config/manifests, backend modules/controllers/services/entities/migrations, frontend routing/pages/API client, and backend unit/e2e tests.
- **Not reviewed/executed:** runtime behavior, container startup health, DB migration execution results, browser rendering behavior, performance, and network/TLS handshakes.
- **Intentionally not executed:** project startup, Docker, tests, external services (per audit constraint).
- **Manual verification required for:** runtime TLS chain validity, end-to-end LAN traffic encryption behavior, production deployment posture, and real browser interaction correctness.

## 3. Repository / Requirement Mapping Summary
- **Prompt core goal mapped:** on-prem full-stack platform for procurement, inventory alerts/recommendations, lab lifecycle/report versioning, projects/tasks, learning lifecycle, rules engine, and role-based operations.
- **Core constraints mapped:** JWT 15m + rotating 8h refresh, RBAC/action-level checks, nonce/timestamp replay control, rate limiting, 30-day price lock, 45-day expiry warning, 40% abnormal consumption threshold, 14-day default buffer, 5-minute rollback target, identifier masking in UI.
- **Main implementation areas inspected:** `backend/src/modules/**`, `backend/src/common/**`, `backend/test/**`, `frontend/src/features/**`, `frontend/src/components/**`, `docker-compose*.yml`, `README.md`, `run_tests.sh`.

## 4. Section-by-section Review

### 1. Hard Gates

#### 1.1 Documentation and static verifiability
- **Conclusion: Partial Pass**
- **Rationale:** startup/test instructions and entrypoints exist and are mostly consistent; however, critical security/requirement mismatches reduce confidence for acceptance.
- **Evidence:** `README.md:3`, `README.md:10`, `docker-compose.yml:22`, `docker-compose.test.yml:19`, `run_tests.sh:11`.
- **Manual verification note:** runtime start/test health cannot be proven statically.

#### 1.2 Material deviation from Prompt
- **Conclusion: Fail**
- **Rationale:** prompt-level security constraints are not fully implemented (global at-rest encryption scope and identifier masking rule in UI are not met).
- **Evidence:** `backend/src/common/transformers/aes.transformer.ts:34`, `backend/src/modules/inventory/item.entity.ts:19`, `frontend/src/features/procurement/ProcurementPage.tsx:73`, `frontend/src/features/procurement/OrdersPage.tsx:40`.

### 2. Delivery Completeness

#### 2.1 Core requirements coverage
- **Conclusion: Partial Pass**
- **Rationale:** most domain flows exist (procurement/inventory/lab/projects/learning/rules/auth), but notable requirement gaps remain (UI masking rule, export-permission operational controls, encryption scope).
- **Evidence:** `backend/src/modules/procurement/procurement.service.ts:355`, `backend/src/modules/inventory/inventory.service.ts:166`, `backend/src/modules/lab/lab.service.ts:327`, `frontend/src/features/admin/SettingsPage.tsx:69`.

#### 2.2 End-to-end deliverable shape
- **Conclusion: Partial Pass**
- **Rationale:** full-stack structure exists with substantial backend/frontend modules and tests; still includes partial/demo-like frontend pages with basic fallback text and missing robust error-state handling in multiple pages.
- **Evidence:** `frontend/src/features/procurement/RequestDetailPage.tsx:17`, `frontend/src/features/rules-engine/RuleDetailPage.tsx:18`, `frontend/src/features/inventory/ItemDetailPage.tsx:73`.

### 3. Engineering and Architecture Quality

#### 3.1 Module decomposition and structure
- **Conclusion: Pass**
- **Rationale:** backend domain modules and frontend feature folders are clearly separated; no single-file monolith pattern detected.
- **Evidence:** `backend/src/app.module.ts:45`, `frontend/src/features/auth/AppRouter.tsx:7`, `frontend/src/features/procurement/ProcurementPage.tsx:119`.

#### 3.2 Maintainability/extensibility
- **Conclusion: Partial Pass**
- **Rationale:** architecture is generally extensible, but key maintainability/security concerns exist (function-level auth reliance on controllers, nonce scoping implementation flaw, route duplication conflict).
- **Evidence:** `backend/src/modules/users/users.service.ts:21`, `backend/src/common/middleware/nonce.middleware.ts:51`, `frontend/src/features/auth/AppRouter.tsx:133`.

### 4. Engineering Details and Professionalism

#### 4.1 Error handling, logging, validation, API design
- **Conclusion: Partial Pass**
- **Rationale:** global validation and exception format are present; logging is structured for file transports but console transport is non-JSON, and some frontend pages use minimal text fallbacks instead of consistent product-level error states.
- **Evidence:** `backend/src/main.ts:43`, `backend/src/common/filters/all-exceptions.filter.ts:49`, `backend/src/config/winston.config.ts:10`, `frontend/src/features/procurement/RequestDetailPage.tsx:23`.

#### 4.2 Product vs demo shape
- **Conclusion: Partial Pass**
- **Rationale:** substantial product-like breadth is present; however, some role-flow and policy features are incomplete/weakly wired (HR routing conflict, settings mostly read-only).
- **Evidence:** `frontend/src/components/layout/Sidebar.tsx:48`, `frontend/src/features/auth/AppRouter.tsx:133`, `frontend/src/features/admin/SettingsPage.tsx:70`.

### 5. Prompt Understanding and Requirement Fit

#### 5.1 Business goal and constraint fit
- **Conclusion: Fail**
- **Rationale:** explicit prompt constraints are violated or only partially met: identifier masking rule in UI is inconsistent, encryption-at-rest is not applied across persisted business data, and export-permission control is not clearly operationalized.
- **Evidence:** `frontend/src/features/procurement/RFQPage.tsx:43`, `frontend/src/features/procurement/RequestDetailPage.tsx:67`, `backend/src/modules/procurement/purchase-order.entity.ts:49`, `frontend/src/features/admin/SettingsPage.tsx:1`.

### 6. Aesthetics (Frontend)

#### 6.1 Visual/interaction quality
- **Conclusion: Partial Pass**
- **Rationale:** many pages use consistent card/table system, status badges, and loading/empty patterns; still inconsistent across several detail pages that fall back to plain text error/loading and miss richer interaction feedback.
- **Evidence:** `frontend/src/features/procurement/ProcurementPage.tsx:167`, `frontend/src/features/rules-engine/RuleDetailPage.tsx:19`, `frontend/src/features/procurement/RequestDetailPage.tsx:17`.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker / High

1) **Severity: Blocker**
- **Title:** Prompt-level at-rest encryption requirement is not met across persisted business data
- **Conclusion:** Fail
- **Evidence:** `backend/src/common/transformers/aes.transformer.ts:34`, `backend/src/modules/inventory/item.entity.ts:19`, `backend/src/modules/procurement/purchase-order.entity.ts:49`, `backend/src/config/app.config.ts:17`
- **Impact:** Sensitive/non-sensitive business records are persisted in plaintext columns; prompt requires AES-256 at rest with per-environment keys.
- **Minimum actionable fix:** enforce encryption strategy for all required persisted data classes (or DB-level transparent encryption with clear policy scope), remove insecure default fallback keys, and document key management per environment.

2) **Severity: High**
- **Title:** Identifier masking rule (“last 4 chars only”) is inconsistently implemented in UI
- **Conclusion:** Fail
- **Evidence:** `frontend/src/features/procurement/ProcurementPage.tsx:73`, `frontend/src/features/procurement/RFQPage.tsx:43`, `frontend/src/features/procurement/RequestDetailPage.tsx:67`, `frontend/src/features/procurement/OrdersPage.tsx:40`
- **Impact:** Violates explicit prompt/business rule for identifier masking and increases exposure risk.
- **Minimum actionable fix:** centralize identifier formatting helper and enforce last-4 masking in all UI identifier render paths.

3) **Severity: High**
- **Title:** HR route access to `/admin/users` is likely shadowed by admin-only route
- **Conclusion:** Fail
- **Evidence:** `frontend/src/features/auth/AppRouter.tsx:133`, `frontend/src/features/auth/AppRouter.tsx:143`, `frontend/src/features/auth/ProtectedRoute.tsx:23`, `frontend/src/components/layout/Sidebar.tsx:51`
- **Impact:** HR navigation advertises Users access but route matching likely redirects HR to unauthorized due duplicate path and first guard.
- **Minimum actionable fix:** remove duplicate route conflict; define single `/admin/users` route with explicit allowed roles and role-aware page behavior.

4) **Severity: High**
- **Title:** Nonce middleware attempts user-scoped replay protection before auth context exists
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/common/middleware/nonce.middleware.ts:51`, `backend/src/app.module.ts:65`, `backend/src/common/guards/jwt-auth.guard.ts:12`
- **Impact:** `req.user` is unavailable in middleware phase, so nonce scoping may collapse to anonymous scope; replay model may not behave as designed for authenticated users.
- **Minimum actionable fix:** move nonce validation to guard/interceptor after JWT auth or derive user from token directly in middleware.

5) **Severity: High**
- **Title:** Recommendation impression recording is triggered in render path
- **Conclusion:** Fail
- **Evidence:** `frontend/src/features/inventory/ItemDetailPage.tsx:79`, `frontend/src/features/inventory/ItemDetailPage.tsx:81`, `backend/src/modules/inventory/recommendation-feedback.entity.ts:27`
- **Impact:** Re-renders can generate duplicate impression writes, skewing closed-loop analytics and recommendation feedback integrity.
- **Minimum actionable fix:** move impression tracking to guarded `useEffect` with idempotency key/client-side de-dup + server-side uniqueness constraint (e.g., per recommendation/user/view session).

### Medium

6) **Severity: Medium**
- **Title:** Admin settings page does not provide clear operational controls for export policy toggles
- **Conclusion:** Partial Fail
- **Evidence:** `frontend/src/features/admin/SettingsPage.tsx:1`, `frontend/src/features/admin/SettingsPage.tsx:70`, `backend/src/modules/admin/admin.controller.ts:33`
- **Impact:** Prompt expects admin-configurable export/security controls; UI currently reads settings but does not expose robust update flows.
- **Minimum actionable fix:** add controlled update forms and policy patch actions with validation and audit entries.

7) **Severity: Medium**
- **Title:** Function-level authorization is uneven in service layer
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/modules/users/users.service.ts:21`, `backend/src/modules/procurement/procurement.service.ts:120`, `backend/src/modules/rules-engine/rules-engine.service.ts:27`
- **Impact:** Security depends heavily on controller guards; internal service invocation paths could bypass role intent if reused incorrectly.
- **Minimum actionable fix:** enforce critical role/action checks in service methods for sensitive mutations.

8) **Severity: Medium**
- **Title:** Console logger transport is not JSON-formatted
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/config/winston.config.ts:10`, `backend/src/config/winston.config.ts:21`
- **Impact:** Inconsistent observability format may reduce operational troubleshooting quality versus required structured logging.
- **Minimum actionable fix:** make all transports (including console) emit JSON in production, keep pretty formatting only in explicit local dev mode.

9) **Severity: Medium**
- **Title:** Unit coverage includes weak assertions for procurement partial-delivery behavior
- **Conclusion:** Partial Fail
- **Evidence:** `backend/src/modules/procurement/__tests__/procurement.service.spec.ts:136`, `backend/src/modules/procurement/__tests__/procurement.service.spec.ts:143`
- **Impact:** Test can pass without exercising real service state transition logic, leaving regression risk in critical procurement flow.
- **Minimum actionable fix:** call `receiveOrder` with controlled repository mocks and assert repository updates and resulting PO status transitions.

### Low

10) **Severity: Low**
- **Title:** Some frontend pages rely on plain text loading/error placeholders
- **Conclusion:** Partial Fail
- **Evidence:** `frontend/src/features/procurement/RequestDetailPage.tsx:17`, `frontend/src/features/rules-engine/RuleDetailPage.tsx:19`
- **Impact:** Inconsistent UX quality against modern SaaS requirement.
- **Minimum actionable fix:** standardize all pages on shared loading/empty/error components.

## 6. Security Review Summary

- **Authentication entry points:** **Pass** — login/refresh/logout/me are implemented with JWT + server-side refresh storage and rotation logic. Evidence: `backend/src/modules/auth/auth.controller.ts:19`, `backend/src/modules/auth/auth.service.ts:55`, `backend/src/modules/auth/auth.module.ts:21`.
- **Route-level authorization:** **Pass** — global JWT/Roles/Action guards are wired; role/action decorators are extensively used. Evidence: `backend/src/app.module.ts:58`, `backend/src/common/guards/roles.guard.ts:18`, `backend/src/common/guards/action.guard.ts:82`.
- **Object-level authorization:** **Partial Pass** — implemented in key domains (lab/projects/learning), but not uniformly demonstrated for all object reads/writes. Evidence: `backend/src/modules/lab/lab.service.ts:143`, `backend/src/modules/projects/projects.service.ts:87`, `backend/src/modules/learning/learning.service.ts:79`.
- **Function-level authorization:** **Partial Pass** — many service methods trust controller guards and lack internal role assertions. Evidence: `backend/src/modules/users/users.service.ts:21`, `backend/src/modules/procurement/procurement.service.ts:120`.
- **Tenant / user data isolation:** **Partial Pass** — employee scoping exists in multiple services; no multi-tenant model (single-site scope). Evidence: `backend/src/modules/procurement/procurement.service.ts:96`, `backend/src/modules/lab/lab.service.ts:127`, `backend/src/modules/learning/learning.service.ts:69`.
- **Admin / internal / debug protection:** **Pass** — admin/rules endpoints are guarded; no obvious unguarded debug endpoints found. Evidence: `backend/src/modules/admin/admin.controller.ts:17`, `backend/src/modules/rules-engine/rules-engine.controller.ts:18`.

## 7. Tests and Logging Review

- **Unit tests:** **Partial Pass** — unit suites exist for auth/inventory/lab/projects/learning/rules, but some tests are shallow and do not fully exercise critical methods. Evidence: `backend/src/modules/auth/__tests__/auth.service.spec.ts:67`, `backend/src/modules/procurement/__tests__/procurement.service.spec.ts:136`.
- **API/integration tests:** **Pass (static evidence)** — broad e2e suites exist across auth/security/procurement/inventory/lab/projects/learning-rules with real DB intent. Evidence: `backend/test/auth.e2e-spec.ts:53`, `backend/test/security.e2e-spec.ts:97`, `backend/test/procurement.e2e-spec.ts:142`.
- **Logging categories/observability:** **Partial Pass** — exception filter and service logs present, but mixed formatter strategy (non-JSON console) reduces consistency. Evidence: `backend/src/common/filters/all-exceptions.filter.ts:57`, `backend/src/modules/inventory/alerts.service.ts:13`, `backend/src/config/winston.config.ts:10`.
- **Sensitive-data leakage risk in logs/responses:** **Partial Pass** — password hash omitted in `/auth/me`; patient identifier masking exists in lab flows, but broader identifier masking rule is inconsistent in UI and some IDs are shown in expanded form. Evidence: `backend/src/modules/auth/auth.service.ts:92`, `backend/src/modules/lab/lab.service.ts:43`, `frontend/src/features/procurement/RequestDetailPage.tsx:67`.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests and e2e tests exist in backend (`*.spec.ts`, `*.e2e-spec.ts`) using Jest + Supertest.
- Test entry points are documented and scripted (`run_tests.sh`, compose test service).
- No frontend automated tests found.
- Evidence: `backend/package.json:14`, `backend/test/jest-e2e.json:5`, `run_tests.sh:13`, `run_tests.sh:17`, `frontend/src` (no `*.spec|*.test*` files).

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| JWT login + invalid creds | `backend/test/auth.e2e-spec.ts:54` | 200 with tokens, 401 invalid creds | sufficient | none major | keep regression tests around lockout/throttle interactions |
| Refresh rotation (8h model behavior) | `backend/test/auth.e2e-spec.ts:101`, `backend/test/security.e2e-spec.ts:355` | old token reuse returns 401 | sufficient | expiry boundary not explicitly tested | add explicit simulated expiry test |
| Route RBAC 401/403 | `backend/test/security.e2e-spec.ts:298` | wrong-role endpoints return 403 | basically covered | matrix not exhaustive for all endpoints | add generated endpoint-role matrix test |
| Object-level auth (sample/task/learning) | `backend/test/security.e2e-spec.ts:542`, `backend/test/security.e2e-spec.ts:683`, `backend/test/security.e2e-spec.ts:738` | cross-user access blocked with 403 | basically covered | procurement object-level cases limited | add cross-user procurement request detail/update tests |
| Procurement price lock 30 days | `backend/test/procurement.e2e-spec.ts:265`, `backend/test/procurement.e2e-spec.ts:282` | update price during lock returns 400 | sufficient | no exactly-at-30-day boundary | add boundary timestamp test |
| Inventory 45-day expiry and 40% consumption alerts | `backend/test/inventory.e2e-spec.ts:201`, `backend/test/inventory.e2e-spec.ts:217` | specific alert types generated | sufficient | edge windows (exact boundary days) partial | add boundary-value integration tests |
| Replenishment recommendation + feedback | `backend/test/inventory.e2e-spec.ts:255`, `backend/test/inventory.e2e-spec.ts:278`, `backend/test/inventory.e2e-spec.ts:297` | recommendation generated, impression/click records created | basically covered | duplicate impression overcount risk untested | add idempotency/duplicate-event tests |
| Lab abnormal flags + report version history | `backend/test/lab.e2e-spec.ts:153`, `backend/test/lab.e2e-spec.ts:224` | abnormal/critical flags + version ordering | sufficient | diff-level history validation absent | add content diff assertion across versions |
| Rules rollback under 5 minutes | `backend/test/learning-rules.e2e-spec.ts:306` | `completedWithinLimit` true and duration check | basically covered | failure-path behavior beyond limit not tested | add injected delayed rollback test |
| CORS + nonce + rate limits + anomaly queue | `backend/test/security.e2e-spec.ts:152`, `backend/test/security.e2e-spec.ts:171`, `backend/test/security.e2e-spec.ts:465` | 429 expectation, duplicate nonce 400, CORS headers | basically covered | nonce user-scoping flaw not asserted | add test asserting nonce keyed by authenticated user |
| Frontend role routes and UX security | none | none | missing | no frontend tests | add route-guard/unit tests (HR `/admin/users`, unauthorized redirects) |

### 8.3 Security Coverage Audit
- **Authentication:** **Basically covered** by auth e2e and service unit tests.
- **Route authorization:** **Basically covered** for representative endpoints; not exhaustive for all route/action combos.
- **Object-level authorization:** **Basically covered** for lab/projects/learning cross-user checks.
- **Tenant/data isolation:** **Insufficient** for full-system coverage (single-tenant assumptions; no broad isolation matrix).
- **Admin/internal protection:** **Basically covered** for key admin/rules/anomaly endpoints.
- **Residual risk:** severe defects could still survive due missing frontend security tests, incomplete function-level authorization tests, and no nonce user-scope validation test.

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Major business and security flows have meaningful tests, but uncovered areas (frontend auth/routing behavior, nonce user scoping, some boundary conditions, and weak unit assertions in critical logic) mean severe defects could still remain undetected while tests pass.

## 9. Final Notes
- This audit is strictly static and evidence-based; no runtime success claim is made.
- The codebase is substantial and close to product shape, but blocker/high issues in security/requirement fit must be addressed before delivery acceptance.
