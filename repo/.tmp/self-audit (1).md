# MeridianMed Delivery Acceptance & Architecture Audit (Static-Only)

## 1. Verdict
- **Overall conclusion:** **Fail**
- **Why:** Multiple Blocker/High gaps against prompt-critical requirements (TLS-in-LAN, action/object-level RBAC, incomplete at-rest encryption scope, replay protection enforcement, missing admin security/export controls, and cross-record access risks).

## 2. Scope and Static Verification Boundary
- **Reviewed:** repository structure, manifests, backend modules/entities/controllers/services, frontend routes/pages, and all existing test files.
- **Not reviewed/executed:** runtime behavior, container startup, network bindings, browser rendering, DB migration execution, test execution.
- **Intentionally not executed:** Docker, project startup, tests (per static-only constraints).
- **Manual verification required for:** runtime TLS termination correctness, live RBAC behavior under concurrent users, rollout/rollback timing under load, and UI rendering fidelity across devices.

## 3. Repository / Requirement Mapping Summary
- **Prompt core goal mapped:** on-prem hospital/clinic operations platform covering procurement, inventory alerts/recommendations, lab workflow/versioning, projects/tasks, learning lifecycle, rules engine, and strong security controls.
- **Mapped implementation areas:** NestJS modules (`auth`, `procurement`, `inventory`, `lab`, `projects`, `learning`, `rules-engine`, `notifications`, `users`), React feature routes/pages, TypeORM schema/migration, seeders, and e2e/unit tests.
- **Primary risk concentration found:** security boundary enforcement and requirement-completeness around encryption, TLS, RBAC granularity, and admin security/export policy controls.

## 4. Section-by-section Review

### 1. Hard Gates
- **1.1 Documentation and static verifiability — Conclusion: Partial Pass**
  - **Rationale:** Run/test/stop/login docs exist and are internally consistent with compose service names; project has clear structure and entry points.
  - **Evidence:** `README.md:3`, `README.md:10`, `docker-compose.yml:3`, `docker-compose.test.yml:19`, `backend/src/main.ts:11`.
  - **Manual note:** Runtime validity of commands cannot be confirmed statically.

- **1.2 Material deviation from prompt — Conclusion: Fail**
  - **Rationale:** Several prompt-critical controls are missing or weakened (TLS-in-LAN, action-level RBAC, broad data-at-rest encryption scope, export policy enforcement).
  - **Evidence:** `nginx.conf:2`, `docker-compose.yml:59`, `app.module.ts:55`, `common/decorators/require-action.decorator.ts:3`, `modules/lab/lab-sample.entity.ts:26`, `frontend/src/features/admin/SettingsPage.tsx:40`.

### 2. Delivery Completeness
- **2.1 Core requirements coverage — Conclusion: Fail**
  - **Rationale:** Major explicit requirements are incomplete: no HTTPS/TLS transport, no implemented action-level guard, replay nonce not enforced on sensitive writes, no implemented admin export policy backend, and incomplete security settings configurability.
  - **Evidence:** `nginx.conf:2`, `docker-compose.yml:59`, `app.module.ts:55`, `common/middleware/nonce.middleware.ts:19`, `common/middleware/nonce.middleware.ts:20`, `backend/src/modules/admin` (directory contains only `audit-log.entity.ts`), `frontend/src/features/admin/SettingsPage.tsx:40`.

- **2.2 End-to-end 0→1 deliverable shape — Conclusion: Partial Pass**
  - **Rationale:** Full-stack structure and many domain flows exist; however, key flows include static-only admin settings and broken frontend route targets.
  - **Evidence:** `backend/src/modules`, `frontend/src/features`, `frontend/src/features/rules-engine/RulesEnginePage.tsx:250`, `frontend/src/features/procurement/ProcurementPage.tsx:110`, `frontend/src/features/auth/AppRouter.tsx:86`.

### 3. Engineering and Architecture Quality
- **3.1 Structure/module decomposition — Conclusion: Partial Pass**
  - **Rationale:** Modules are generally separated by domain and not stacked into a single file; but admin/security configuration surface is under-implemented despite prompt scope.
  - **Evidence:** `backend/src/app.module.ts:10`, `backend/src/app.module.ts:18`, `backend/src/modules/admin`.

- **3.2 Maintainability/extensibility — Conclusion: Partial Pass**
  - **Rationale:** Overall layering exists, but critical guard path is incomplete (`RequireAction` decorator exists without enforcement guard), and key authorization helper is stubbed.
  - **Evidence:** `common/decorators/require-action.decorator.ts:3`, `app.module.ts:55`, `modules/procurement/procurement.service.ts:580`.

### 4. Engineering Details and Professionalism
- **4.1 Error handling/logging/validation/API design — Conclusion: Partial Pass**
  - **Rationale:** Global exception filter and validation pipe exist; but validation gaps exist for user-admin endpoints (interfaces, not DTO classes), and error schema deviates from specified shape.
  - **Evidence:** `backend/src/main.ts:33`, `backend/src/common/filters/all-exceptions.filter.ts:35`, `backend/src/modules/users/users.controller.ts:22`, `backend/src/modules/users/users.service.ts:9`.
  - **Manual note:** End-to-end error body consistency across all endpoints requires runtime sampling.

- **4.2 Real product vs demo shape — Conclusion: Partial Pass**
  - **Rationale:** Product-like breadth exists, but some security/admin behavior is display-only and not operationally backed by APIs/policies.
  - **Evidence:** `frontend/src/features/admin/SettingsPage.tsx:9`, `frontend/src/features/admin/SettingsPage.tsx:40`, `backend/src/modules/admin`.

### 5. Prompt Understanding and Requirement Fit
- **5.1 Business goal + constraints fit — Conclusion: Fail**
  - **Rationale:** Many domain capabilities are present, but high-priority constraints are not fully met (TLS, robust RBAC granularity/object access isolation, stronger encryption scope, enforceable replay protection).
  - **Evidence:** `nginx.conf:2`, `common/middleware/nonce.middleware.ts:20`, `modules/projects/projects.service.ts:80`, `modules/learning/learning.service.ts:73`, `modules/lab/lab.service.ts:136`, `modules/lab/lab-sample.entity.ts:26`.

### 6. Aesthetics (frontend)
- **6.1 Visual/interaction quality — Conclusion: Partial Pass**
  - **Rationale:** UI has structured layout, loading/empty patterns on many pages, and interaction affordances; however, broken route targets and static-only security settings reduce product UX integrity.
  - **Evidence:** `frontend/src/components/layout/Sidebar.tsx:28`, `frontend/src/features/dashboard/DashboardPage.tsx:77`, `frontend/src/features/rules-engine/RulesEnginePage.tsx:250`, `frontend/src/features/procurement/ProcurementPage.tsx:110`.
  - **Manual note:** Responsive behavior and final visual polish need manual browser verification.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker
1. **TLS not implemented for LAN traffic**
   - **Conclusion:** Fail
   - **Evidence:** `nginx.conf:2` (listen 80), `docker-compose.yml:59` (`VITE_API_URL: http://localhost:4000`), `frontend/src/lib/api-client.ts:3` (HTTP base URL)
   - **Impact:** Violates explicit prompt requirement for encrypted transport on internal LAN; exposes credentials/tokens/data in transit.
   - **Minimum actionable fix:** Terminate HTTPS at reverse proxy (self-signed/dev cert path), enforce HTTPS backend/frontend URLs, and document cert setup.

2. **Action-level RBAC not enforced**
   - **Conclusion:** Fail
   - **Evidence:** `common/decorators/require-action.decorator.ts:3` exists; no `RequireAction` usage found; global guards list lacks ActionGuard (`app.module.ts:55`-`app.module.ts:58`).
   - **Impact:** Prompt-required action-level authorization is not implemented; privilege boundaries are weaker than required.
   - **Minimum actionable fix:** Implement `ActionGuard`, register globally, annotate sensitive actions with `@RequireAction(...)`, and enforce in service layer.

3. **Replay protection (nonce/timestamp) is optional bypass**
   - **Conclusion:** Fail
   - **Evidence:** `common/middleware/nonce.middleware.ts:19`-`common/middleware/nonce.middleware.ts:21` returns `next()` when headers are absent.
   - **Impact:** Sensitive write endpoints can be called without anti-replay controls.
   - **Minimum actionable fix:** Enforce nonce/timestamp on sensitive routes by policy (guard/decorator route map) and reject missing headers.

### High
4. **Object-level authorization/data isolation gaps in service layer**
   - **Conclusion:** Fail
   - **Evidence:** empty ownership check `modules/procurement/procurement.service.ts:580`; unrestricted getters by id in `modules/lab/lab.service.ts:136`, `modules/projects/projects.service.ts:80`, `modules/learning/learning.service.ts:73`.
   - **Impact:** Authenticated users may access records outside ownership/scope if IDs are known.
   - **Minimum actionable fix:** Add per-record ownership/role checks in service methods for all id-based reads/writes.

5. **At-rest encryption requirement only partially implemented**
   - **Conclusion:** Fail
   - **Evidence:** AES transformer applied to one field `modules/lab/lab-sample.entity.ts:26`; migration stores most sensitive business fields unencrypted/plain columns (e.g., `database/migrations/1700000000000-InitialSchema.ts:444` onward).
   - **Impact:** Prompt requirement “all data at rest encrypted using AES-256” is not met.
   - **Minimum actionable fix:** Define sensitive-column inventory and apply encryption strategy consistently (DB-level encryption or column transformers + key mgmt).

6. **Admin security/export permissions are largely static UI, not backend-enforced**
   - **Conclusion:** Fail
   - **Evidence:** `frontend/src/features/admin/SettingsPage.tsx:40` uses hardcoded display values; backend admin module not implemented (`backend/src/modules/admin` only contains `audit-log.entity.ts`).
   - **Impact:** Required admin-configurable export/security policy cannot be enforced reliably.
   - **Minimum actionable fix:** Add admin policy entities + APIs + enforcement in export/response layers; wire UI to real API state.

7. **Rules rollback 5-minute rule is measured but not enforced**
   - **Conclusion:** Fail
   - **Evidence:** rollback computes `completedWithinLimit` and still returns success (`modules/rules-engine/rules-engine.service.ts:270`-`modules/rules-engine/rules-engine.service.ts:300`).
   - **Impact:** System can violate a hard business constraint while appearing successful.
   - **Minimum actionable fix:** enforce hard failure/compensation when duration exceeds threshold and add explicit alert/audit severity.

### Medium
8. **Broken frontend navigation targets (non-registered routes)**
   - **Conclusion:** Partial Fail
   - **Evidence:** navigates to `/rules-engine/:id` (`frontend/src/features/rules-engine/RulesEnginePage.tsx:250`) and `/procurement/requests/:id` (`frontend/src/features/procurement/ProcurementPage.tsx:110`), but routes are absent in `frontend/src/features/auth/AppRouter.tsx:86`-`frontend/src/features/auth/AppRouter.tsx:146`.
   - **Impact:** Dead-end/redirect UX for legitimate user actions; breaks acceptance around complete navigable feature surface.
   - **Minimum actionable fix:** implement missing detail routes/components or remove links.

9. **Validation gap on admin user endpoints**
   - **Conclusion:** Partial Fail
   - **Evidence:** controller consumes interface-typed payloads (`backend/src/modules/users/users.controller.ts:22`), but interfaces in `backend/src/modules/users/users.service.ts:9` are not class-validator DTO classes.
   - **Impact:** Global `ValidationPipe` cannot enforce field-level constraints here.
   - **Minimum actionable fix:** introduce DTO classes with `class-validator` decorators for create/update user operations.

10. **Rules-engine A/B behavior is declarative-only; execution path not evident**
   - **Conclusion:** Cannot Confirm Statistically (likely insufficient)
   - **Evidence:** `isAbTest`/`rolloutPercentage` are stored and reported (`rules-engine.service.ts:34`, `rules-engine.service.ts:164`) but no downstream request-path branching is visible in domain services.
   - **Impact:** A/B comparisons may not actually affect workflow behavior despite UI/state support.
   - **Minimum actionable fix:** implement deterministic assignment + dual-path evaluation + metrics capture and tests proving branching effects.

## 6. Security Review Summary
- **Authentication entry points — Pass (with caveats)**
  - Evidence: `modules/auth/auth.controller.ts:18`, `modules/auth/auth.service.ts:31`, `modules/auth/auth.service.ts:55`.
  - Notes: login/refresh/logout/me exist; rotation logic present.

- **Route-level authorization — Partial Pass**
  - Evidence: global guards in `app.module.ts:55`-`app.module.ts:58`; role decorators used in many controllers (e.g., `modules/rules-engine/rules-engine.controller.ts:17`).
  - Gap: missing action-level guard/decorator usage.

- **Object-level authorization — Fail**
  - Evidence: no ownership checks on key id lookups (`modules/lab/lab.service.ts:136`, `modules/projects/projects.service.ts:80`, `modules/learning/learning.service.ts:73`), empty helper `modules/procurement/procurement.service.ts:580`.

- **Function-level authorization — Partial Pass**
  - Evidence: some function-level checks exist (`projects.service.ts:157`), but inconsistent coverage across services.

- **Tenant/user data isolation — Fail (user-scope) / Cannot Confirm Statistically (tenant-scope)**
  - Evidence: user-scope leaks possible via unrestricted id endpoints above; no tenant/site model found in schema (`database/migrations/1700000000000-InitialSchema.ts:40` onward).

- **Admin/internal/debug protection — Partial Pass**
  - Evidence: admin routes guarded by role (`modules/users/users.controller.ts:9`); health route intentionally public (`app.controller.ts:6`).
  - Gap: admin security/export controls not implemented as enforceable backend policies.

## 7. Tests and Logging Review
- **Unit tests — Conclusion: Partial Pass**
  - Core pure-logic coverage exists (inventory calculations, lab abnormal flags, project transitions, rules conflict/timing, auth login branch).
  - Evidence: `backend/src/modules/inventory/__tests__/inventory.service.spec.ts:12`, `backend/src/modules/lab/__tests__/lab.service.spec.ts:9`, `backend/src/modules/auth/__tests__/auth.service.spec.ts:66`.

- **API/integration tests — Conclusion: Partial Pass**
  - Broad e2e suites exist and hit real DB patterns with seeded rows.
  - Evidence: `backend/test/auth.e2e-spec.ts:13`, `backend/test/procurement.e2e-spec.ts:15`, `backend/test/security.e2e-spec.ts:10`.
  - Gap: limited object-level authorization/record-ownership negative tests.

- **Logging categories/observability — Conclusion: Partial Pass**
  - Winston configured and exception filter logs warning/error; module logs exist.
  - Evidence: `backend/src/config/winston.config.ts:4`, `backend/src/common/filters/all-exceptions.filter.ts:46`, `backend/src/modules/inventory/alerts.service.ts:7`.
  - Gap: console transport is nest-like prettified, not consistently JSON in all environments.

- **Sensitive-data leakage risk in logs/responses — Conclusion: Partial Pass**
  - Positive: password hash removed in profile and user endpoints (`auth.service.ts:92`, `users.controller.ts:17`).
  - Risk: exception filter returns raw exception response object under `error` (`all-exceptions.filter.ts:30`-`all-exceptions.filter.ts:44`), which may leak implementation detail depending on thrown payload.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist under module test folders; e2e tests exist under `backend/test`.
- Framework: Jest + Supertest (`backend/package.json:14`, `backend/test/jest-e2e.json:5`).
- Entrypoints documented and scripted (`run_tests.sh:13`, `run_tests.sh:17`, `README.md:12`).

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| JWT login + refresh rotation | `backend/test/auth.e2e-spec.ts:52`, `backend/test/auth.e2e-spec.ts:100` | `expiresIn=900`, old refresh token reuse -> `401` (`auth.e2e-spec.ts:129`) | sufficient | No explicit 8h expiry boundary test | Add time-travel/expiry test for refresh TTL |
| Procurement 30-day price lock | `backend/test/procurement.e2e-spec.ts:258`, `backend/test/procurement.e2e-spec.ts:274`; unit `procurement.service.spec.ts:65` | price update during lock returns `400` | basically covered | No test for post-lock successful update e2e | Add e2e with adjusted lock date and successful patch |
| Inventory 45-day expiry + 40% abnormal consumption + 14-day buffer | `backend/test/inventory.e2e-spec.ts:199`, `backend/test/inventory.e2e-spec.ts:215`, `backend/src/modules/inventory/__tests__/inventory.service.spec.ts:62` | alert type/severity checks, formula constants | sufficient | No pagination/filter edge tests | Add alert filtering/status permutation tests |
| Lab abnormal flag + version history | `backend/test/lab.e2e-spec.ts:150`, `backend/test/lab.e2e-spec.ts:218`; unit `lab.service.spec.ts:15` | abnormal/critical toggles, version increments/history order | sufficient | No cross-user access denial tests | Add employee-B cannot fetch employee-A sample/report |
| Learning lifecycle + study frequency compliance | `backend/test/learning-rules.e2e-spec.ts:137`, `backend/test/learning-rules.e2e-spec.ts:165` | transition valid/invalid + compliance percent | basically covered | No ownership/access control tests | Add unauthorized plan detail retrieval tests |
| Rules rollback timing requirement | `backend/test/learning-rules.e2e-spec.ts:291`; unit `rules-engine.service.spec.ts:59` | `durationMs < 5m` asserted | insufficient | Service does not enforce failure when >5m | Add test expecting rollback to fail/alert when duration limit exceeded |
| Security: nonce/timestamp + rate limit + anomaly queue | `backend/test/security.e2e-spec.ts:150`, `backend/test/security.e2e-spec.ts:169`, `backend/test/security.e2e-spec.ts:257` | 429 behavior, duplicate nonce, anomaly persisted | basically covered | Missing test that headers are mandatory on sensitive writes | Add test: sensitive write without nonce/timestamp -> expected rejection |
| Route RBAC (wrong role) | `backend/test/security.e2e-spec.ts:294` | 403 checks for selected endpoints | basically covered | Matrix is not exhaustive; no action-level RBAC tests | Add endpoint-action matrix and action guard tests |
| Object-level authorization / user isolation | (No direct tests found) | N/A | missing | Severe defects could pass current suites | Add cross-user read/update attempts on procurement/lab/projects/learning |
| TLS in transport | (No static test) | N/A | missing | Prompt-critical requirement untested and currently not configured | Add integration check for HTTPS-only endpoints/proxy config |

### 8.3 Security Coverage Audit
- **Authentication:** **Pass** for basic flows; covered by `auth.e2e-spec.ts`.
- **Route authorization:** **Partial Pass**; some wrong-role checks exist (`security.e2e-spec.ts:294`) but not exhaustive.
- **Object-level authorization:** **Fail (coverage missing)**; no cross-user object access tests.
- **Tenant/data isolation:** **Fail/Insufficient**; no tenant model tests and no user-isolation matrix tests.
- **Admin/internal protection:** **Partial Pass**; selected admin endpoints checked, but policy-level admin security/export controls not tested because not implemented.

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Major happy-path and several security controls are covered, but uncovered object-level authorization and transport-security gaps mean tests could still pass while severe defects remain.

## 9. Final Notes
- This audit is static-only and evidence-based; no runtime claims are made.
- The most urgent acceptance blockers are TLS-in-LAN, action/object-level RBAC enforcement, and enforceable security policy controls (nonce requirements, export policy backend, broader at-rest encryption).
