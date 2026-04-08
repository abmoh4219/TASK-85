# MeridianMed Delivery Acceptance & Architecture Audit (Static-Only)

## 1. Verdict
- Overall conclusion: **Fail**
- Primary reason: core prompt-fit and security gaps are materially present in code (not runtime-only uncertainty), including PO issuance not enforced from approved RFQ flow and object-level authorization gaps in task/session operations.

## 2. Scope and Static Verification Boundary
- Reviewed: repository structure, startup/test docs, compose files, backend modules/controllers/services/entities/guards/middleware, frontend routing/features, unit/e2e test suites, logging and error-handling implementation.
- Not reviewed: runtime behavior under Docker, browser rendering behavior, performance under load, real TLS certificate trust behavior, actual cron/scheduler execution timing.
- Intentionally not executed: project startup, Docker, tests, migrations.
- Manual verification required for runtime-dependent claims (examples): TLS termination and internal hop behavior in deployed containers (`repo/nginx.conf:27`, `repo/backend/src/main.ts:18`), scheduled alert execution cadence (`repo/backend/src/modules/inventory/alerts.service.ts:11`), and real-world rollback timing at scale (`repo/backend/src/modules/rules-engine/rules-engine.service.ts:269`).

## 3. Repository / Requirement Mapping Summary
- Prompt core mapped: role-based on-prem operations across procurement, inventory alerts/recommendations, lab lifecycle/report versioning, projects/tasks, learning lifecycle, rules engine rollout/rollback, and security controls.
- Implementation areas mapped: NestJS modules under `backend/src/modules/*`, React features under `frontend/src/features/*`, auth/RBAC guards and middleware, TypeORM entities/migrations/seeding, and e2e suites under `backend/test/*`.
- Major constraints checked statically: 30-day price lock, 45-day expiry alerts, 40% abnormal consumption, default 14-day buffer, JWT/refresh expiries, nonce/timestamp, throttling, anomaly queue, masking, and rollback path.

## 4. Section-by-section Review

### 4.1 Hard Gates

#### 4.1.1 Documentation and static verifiability
- Conclusion: **Partial Pass**
- Rationale: startup/test/stop/login docs exist and are concise; compose/test scripts are present. However docs and architecture statements conflict with some expected endpoints/ports and do not prove runtime behavior.
- Evidence: `repo/README.md:3`, `repo/README.md:7`, `repo/docker-compose.yml:22`, `repo/docker-compose.test.yml:19`, `repo/run_tests.sh:1`
- Manual verification: required for actual container startup health and endpoint reachability.

#### 4.1.2 Material deviation from prompt
- Conclusion: **Fail**
- Rationale: PO creation is not enforced as “from approved RFQ/quote flow”; `rfqId` is optional and no approved-RFQ validation is done in service. This weakens a core procurement flow requirement.
- Evidence: `repo/backend/src/modules/procurement/dto/create-purchase-order.dto.ts:25`, `repo/backend/src/modules/procurement/procurement.service.ts:271`, `repo/backend/src/modules/procurement/procurement.service.ts:275`

### 4.2 Delivery Completeness

#### 4.2.1 Core requirement coverage
- Conclusion: **Partial Pass**
- Rationale: all major modules exist, and many core flows are implemented; however, key prompt semantics are partial/missing (approved RFQ gating for PO, comprehensive identifier masking/export-control implementation path, and full-at-rest encryption evidence).
- Evidence: `repo/backend/src/app.module.ts:45`, `repo/frontend/src/features/auth/AppRouter.tsx:94`, `repo/backend/src/modules/procurement/procurement.service.ts:271`, `repo/backend/src/modules/admin/admin.service.ts:76`, `repo/backend/src/modules/lab/lab.service.ts:42`
- Manual verification: needed to confirm whether infrastructure-level encryption outside app code exists.

#### 4.2.2 End-to-end 0→1 deliverable shape
- Conclusion: **Pass**
- Rationale: repository has coherent full-stack structure, docker/test orchestration artifacts, backend and frontend moduleized implementation, and substantial e2e flows.
- Evidence: `repo/backend/src/modules`, `repo/frontend/src/features`, `repo/docker-compose.yml:3`, `repo/backend/test/procurement.e2e-spec.ts:16`

### 4.3 Engineering and Architecture Quality

#### 4.3.1 Structure and module decomposition
- Conclusion: **Pass**
- Rationale: domain modules and feature folders are separated and non-trivial responsibilities are distributed.
- Evidence: `repo/backend/src/app.module.ts:45`, `repo/frontend/src/features/auth/AppRouter.tsx:97`

#### 4.3.2 Maintainability and extensibility
- Conclusion: **Partial Pass**
- Rationale: architecture is generally maintainable, but critical security/business guarantees depend heavily on controller-level restrictions and contain object-level gaps in service methods.
- Evidence: `repo/backend/src/modules/projects/projects.service.ts:169`, `repo/backend/src/modules/projects/projects.service.ts:257`, `repo/backend/src/modules/learning/learning.service.ts:166`

### 4.4 Engineering Details and Professionalism

#### 4.4.1 Error handling, logging, validation, API design
- Conclusion: **Partial Pass**
- Rationale: global validation and exception filter are present; DTO validation coverage is broad. Logging exists via Winston, but a mix of Nest `Logger` and file transports may not match strict structured-JSON intent uniformly.
- Evidence: `repo/backend/src/main.ts:43`, `repo/backend/src/common/filters/all-exceptions.filter.ts:49`, `repo/backend/src/config/winston.config.ts:6`, `repo/backend/src/modules/inventory/alerts.service.ts:7`

#### 4.4.2 Product-grade shape vs demo
- Conclusion: **Pass**
- Rationale: breadth of modules, e2e suites, persistence entities, and UI feature set exceeds demo-level scaffolding.
- Evidence: `repo/backend/test/security.e2e-spec.ts:11`, `repo/backend/test/procurement.e2e-spec.ts:16`, `repo/frontend/src/features`

### 4.5 Prompt Understanding and Requirement Fit

#### 4.5.1 Business objective and implicit constraints fit
- Conclusion: **Fail**
- Rationale: several prompt-critical constraints are only partially met in code: PO issuance semantics weakened, per-user throttling implementation likely broken by guard ordering, and object-level authorization not consistently enforced.
- Evidence: `repo/backend/src/modules/procurement/procurement.service.ts:271`, `repo/backend/src/app.module.ts:58`, `repo/backend/src/common/guards/anomaly-throttler.guard.ts:15`, `repo/backend/src/modules/projects/projects.service.ts:169`

### 4.6 Aesthetics (frontend)

#### 4.6.1 Visual/interaction quality
- Conclusion: **Partial Pass**
- Rationale: componentized UI with loading/empty/error states exists across major pages. Static review cannot prove final visual consistency or responsive behavior in runtime.
- Evidence: `repo/frontend/src/features/dashboard/DashboardPage.tsx:299`, `repo/frontend/src/features/procurement/ProcurementPage.tsx:169`, `repo/frontend/src/features/admin/SettingsPage.tsx:78`
- Manual verification: browser-based responsive/layout audit required.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker
1. **PO issuance flow not enforced from approved RFQ**
   - Severity: **Blocker**
   - Conclusion: core procurement semantics are weakened.
   - Evidence: `repo/backend/src/modules/procurement/dto/create-purchase-order.dto.ts:25`, `repo/backend/src/modules/procurement/procurement.service.ts:271`
   - Impact: users can create POs without approved RFQ/quote lineage, violating accountable guided flow.
   - Minimum actionable fix: require non-null `rfqId`, load RFQ + status, verify approved state and selected quote lines before PO creation; reject otherwise.

### High
2. **Likely per-user rate-limit defect due guard order**
   - Severity: **High**
   - Conclusion: rate tracker may use IP/anonymous instead of authenticated user.
   - Evidence: `repo/backend/src/app.module.ts:58`, `repo/backend/src/app.module.ts:59`, `repo/backend/src/common/guards/anomaly-throttler.guard.ts:15`
   - Impact: violates “per user” throttle intent; false positives/negatives in anomaly queue.
   - Minimum actionable fix: run JWT auth before throttling for protected routes or implement user extraction independent of guard order.

3. **Object-level authorization gaps in service layer**
   - Severity: **High**
   - Conclusion: employees can mutate tasks/sessions they do not own/are not assigned to.
   - Evidence: `repo/backend/src/modules/projects/projects.service.ts:169`, `repo/backend/src/modules/projects/projects.service.ts:257`, `repo/backend/src/modules/learning/learning.service.ts:166`
   - Impact: horizontal privilege escalation and cross-user data manipulation.
   - Minimum actionable fix: enforce ownership/assignment checks in `advanceTaskStatus`, `submitDeliverable`, and `logStudySession` before mutation.

4. **Nonce replay protection is process-local and collision-prone**
   - Severity: **High**
   - Conclusion: anti-replay state is in-memory and not user-scoped.
   - Evidence: `repo/backend/src/common/middleware/nonce.middleware.ts:16`, `repo/backend/src/common/middleware/nonce.middleware.ts:49`
   - Impact: ineffective across replicas/restarts; possible cross-user false replay rejection.
   - Minimum actionable fix: persist nonce keys in shared store (Redis/DB) with TTL, scope by user/session, and include request hash.

5. **At-rest encryption requirement only partially evidenced**
   - Severity: **High**
   - Conclusion: only selected columns use AES transformer; no static evidence of comprehensive “all data at rest” encryption.
   - Evidence: `repo/backend/src/modules/lab/lab-sample.entity.ts:26`, `repo/backend/src/modules/lab/lab-result.entity.ts:31`, `repo/backend/src/modules/procurement/vendor.entity.ts:15`
   - Impact: prompt-level encryption claim may be overstated; sensitive records may remain plaintext at rest.
   - Minimum actionable fix: document and enforce full encryption strategy (DB/TDE/disk-level + column policy), and apply transformer/policy to all sensitive classes explicitly.

### Medium
6. **Client refresh token stored in localStorage**
   - Severity: **Medium**
   - Conclusion: token persistence increases XSS blast radius.
   - Evidence: `repo/frontend/src/lib/api-client.ts:27`, `repo/frontend/src/lib/api-client.ts:33`
   - Impact: stolen JS context can exfiltrate refresh credentials.
   - Minimum actionable fix: migrate to httpOnly secure cookie + CSRF mitigation for refresh.

7. **Insufficient enforcement that quote belongs to RFQ in add-quote flow**
   - Severity: **Medium**
   - Conclusion: `rfqId` path param is not validated against provided `rfqLineId` ownership.
   - Evidence: `repo/backend/src/modules/procurement/procurement.service.ts:205`, `repo/backend/src/modules/procurement/procurement.service.ts:213`
   - Impact: potential cross-RFQ data integrity corruption.
   - Minimum actionable fix: fetch line by `id` and assert `line.rfqId === rfqId` before insert.

8. **Soft-delete test does not validate application delete behavior**
   - Severity: **Medium**
   - Conclusion: test manually updates `deleted_at` instead of exercising API/service deletion path.
   - Evidence: `repo/backend/test/security.e2e-spec.ts:422`
   - Impact: severe regressions in delete behavior could pass tests unnoticed.
   - Minimum actionable fix: add endpoint-level soft-delete e2e tests for representative business entities.

### Low
9. **README endpoint/port framing differs from common backend direct access expectation**
   - Severity: **Low**
   - Conclusion: docs route backend via nginx only; direct backend port exists in compose.
   - Evidence: `repo/README.md:8`, `repo/docker-compose.yml:44`
   - Impact: minor reviewer/operator confusion.
   - Minimum actionable fix: explicitly document both proxied API and direct backend health URL.

## 6. Security Review Summary
- **Authentication entry points**: **Pass** — login/refresh/logout/me implemented with JWT strategy and refresh-token hashing/rotation (`repo/backend/src/modules/auth/auth.controller.ts:19`, `repo/backend/src/modules/auth/auth.service.ts:56`, `repo/backend/src/common/strategies/jwt.strategy.ts:22`).
- **Route-level authorization**: **Partial Pass** — global JWT/Roles/Action guards exist, but coverage is uneven for some operations and depends on metadata discipline (`repo/backend/src/app.module.ts:59`, `repo/backend/src/common/guards/action.guard.ts:82`).
- **Object-level authorization**: **Fail** — not consistently enforced for task/session mutations (`repo/backend/src/modules/projects/projects.service.ts:169`, `repo/backend/src/modules/learning/learning.service.ts:166`).
- **Function-level authorization**: **Partial Pass** — some service checks exist (e.g., owner checks in procurement sample flow), but not systematic across modules (`repo/backend/src/modules/procurement/procurement.service.ts:601`).
- **Tenant/user data isolation**: **Partial Pass** — per-user filtering exists in several reads, but no tenant model and write-path cross-user checks are incomplete (`repo/backend/src/modules/lab/lab.service.ts:125`, `repo/backend/src/modules/projects/projects.service.ts:67`).
- **Admin/internal/debug protection**: **Pass** for visible admin endpoints (roles/actions enforced) (`repo/backend/src/modules/admin/admin.controller.ts:17`, `repo/backend/src/modules/users/users.controller.ts:24`); no explicit debug controller found.

## 7. Tests and Logging Review
- **Unit tests**: **Partial Pass** — pure business-rule calculations are covered, but some tests are shallow and do not exercise actual service paths (example partial-delivery unit test logic checks constants rather than behavior path).
  - Evidence: `repo/backend/src/modules/inventory/__tests__/inventory.service.spec.ts:12`, `repo/backend/src/modules/procurement/__tests__/procurement.service.spec.ts:130`
- **API/integration tests**: **Pass** breadth-wise — substantial e2e coverage for auth/procurement/inventory/lab/projects/learning/rules/security with real DB wiring.
  - Evidence: `repo/backend/test/auth.e2e-spec.ts:9`, `repo/backend/test/procurement.e2e-spec.ts:16`, `repo/backend/test/security.e2e-spec.ts:11`
- **Logging categories/observability**: **Partial Pass** — global exception logging and Winston configured, but mixed logger styles and local file transports may reduce consistency in containerized deployment.
  - Evidence: `repo/backend/src/common/filters/all-exceptions.filter.ts:58`, `repo/backend/src/config/winston.config.ts:16`, `repo/backend/src/modules/inventory/alerts.service.ts:7`
- **Sensitive-data leakage risk in logs/responses**: **Partial Pass** — password hash omitted in user/me responses; patient ID masking is implemented in lab APIs, but identifier-masking policy is not universally enforced across all identifiers.
  - Evidence: `repo/backend/src/modules/auth/auth.service.ts:92`, `repo/backend/src/modules/lab/lab.service.ts:42`, `repo/frontend/src/features/procurement/ProcurementPage.tsx:73`

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist in module-local `__tests__` for auth/procurement/inventory/lab/projects/learning/rules (`repo/backend/src/modules/auth/__tests__/auth.service.spec.ts:35`).
- API/integration tests exist under `backend/test/*.e2e-spec.ts` using Nest app + DB (`repo/backend/test/procurement.e2e-spec.ts:16`).
- Framework: Jest + ts-jest (`repo/backend/package.json:75`, `repo/backend/test/jest-e2e.json:5`).
- Test entry documented and scripted via Docker test-runner (`repo/README.md:12`, `repo/run_tests.sh:17`).

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| JWT login/refresh/logout/me | `repo/backend/test/auth.e2e-spec.ts:53` | token issuance/rotation/revocation assertions (`repo/backend/test/auth.e2e-spec.ts:107`) | sufficient | none material | keep regression tests for token theft/reuse race |
| 30-day PO price lock | `repo/backend/test/procurement.e2e-spec.ts:265` | price update blocked with 400 (`repo/backend/test/procurement.e2e-spec.ts:282`) | basically covered | does not validate post-30-day unlock path e2e | add time-shifted unlock scenario |
| PO must derive from approved RFQ | none explicit | createPO accepts arbitrary lines (`repo/backend/src/modules/procurement/procurement.service.ts:271`) | missing | core prompt semantic untested | add e2e: reject PO without approved RFQ |
| Near-expiry 45-day alerts | `repo/backend/test/inventory.e2e-spec.ts:201` | near-expiration alert asserted (`repo/backend/test/inventory.e2e-spec.ts:209`) | sufficient | boundary-day exact test absent | add 45-day boundary and 46-day negative tests |
| Abnormal consumption +40% rule | `repo/backend/test/inventory.e2e-spec.ts:217` | synthetic baseline/spike fixture (`repo/backend/test/inventory.e2e-spec.ts:103`) | sufficient | no noisy-data edge cases | add low-volume/zero-baseline edge e2e |
| Replenishment formula + default 14 buffer | `repo/backend/src/modules/inventory/__tests__/inventory.service.spec.ts:109`, `repo/backend/test/inventory.e2e-spec.ts:267` | formula checks + generated recommendation assertions | basically covered | lacks rounding/precision policy validation | add deterministic rounding expectation |
| Lab abnormal flags + report history | `repo/backend/test/lab.e2e-spec.ts:153` | critical/abnormal assertions and version history checks (`repo/backend/test/lab.e2e-spec.ts:230`) | sufficient | no concurrent edit/version conflict case | add parallel edit conflict test |
| Rules rollback within 5 min | `repo/backend/test/learning-rules.e2e-spec.ts:306` | `completedWithinLimit` + duration assertions | basically covered | measures local test runtime only | add simulated heavy transaction timing test |
| Nonce replay protection | `repo/backend/test/security.e2e-spec.ts:172` | duplicate nonce and stale timestamp rejection | sufficient | no multi-instance shared-state coverage | add integration test with shared nonce store |
| Object-level authorization | `repo/backend/test/security.e2e-spec.ts:542` | lab sample cross-user 403 | insufficient | does not cover project task/session write paths | add e2e for task/status/deliverable/session cross-user mutation denial |

### 8.3 Security Coverage Audit
- **Authentication**: **Well covered** by auth e2e + security e2e (`repo/backend/test/auth.e2e-spec.ts:53`).
- **Route authorization**: **Basically covered** for representative endpoints (`repo/backend/test/security.e2e-spec.ts:298`), but not full endpoint/action matrix.
- **Object-level authorization**: **Insufficiently covered**; only lab sample read path is tested (`repo/backend/test/security.e2e-spec.ts:543`) while project/learning write paths remain untested.
- **Tenant/data isolation**: **Cannot Confirm Statistically** for tenant dimension (no tenant model observed), and only partial per-user isolation tests exist.
- **Admin/internal protection**: **Basically covered** for key admin endpoints (`repo/backend/test/security.e2e-spec.ts:299`).

### 8.4 Final Coverage Judgment
**Partial Pass**

Major authentication and many core business paths are tested, but uncovered object-level mutation risks and missing enforcement tests for approved-RFQ PO issuance mean severe defects could still pass the current suite.

## 9. Final Notes
- This report is static-only and evidence-bound; runtime success is not claimed.
- Highest-priority remediation: enforce RFQ-to-PO business invariants and close service-layer object-authorization gaps before acceptance.
