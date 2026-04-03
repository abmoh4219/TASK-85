# PLAN.md — MeridianMed Execution Plan
# Task ID: w2t85
# Status: [ ] = pending, [x] = complete
# Claude: Read this file before every response. Update task status after completing each task.
# Rule: Complete ONE task per response. Fix all errors before marking [x]. Pause after each phase.

---

## PHASE 0 — Project Foundation
> Goal: Docker infrastructure, folder structure, shared configs, .gitignore, README
> Pause after this phase and wait for "proceed"

- [x] 0.1 Create repo/ folder structure exactly as defined in CLAUDE.md
- [x] 0.2 Create repo/.gitignore with content from CLAUDE.md
- [x] 0.3 Create repo/README.md (minimal, from CLAUDE.md template)
- [x] 0.4 Create repo/docker-compose.yml with services: postgres, backend, frontend
- [x] 0.5 Create repo/docker-compose.test.yml with services: postgres-test, backend-test, test-runner
- [x] 0.6 Create repo/backend/Dockerfile (node:20-alpine, multi-stage)
- [x] 0.7 Create repo/frontend/Dockerfile (node:20-alpine build + nginx:alpine serve)
- [x] 0.8 Create repo/nginx.conf (SPA routing: try_files $uri $uri/ /index.html)
- [x] 0.9 Create repo/run_tests.sh with content from CLAUDE.md, chmod +x
- [x] 0.10 Create repo/backend/package.json with all NestJS dependencies
- [x] 0.11 Create repo/frontend/package.json with all React/Vite/Tailwind/shadcn dependencies
- [x] 0.12 Scaffold NestJS app (main.ts, app.module.ts, app.controller.ts) with helmet, compression, global validation pipe, global exception filter
- [x] 0.13 Scaffold React app (main.tsx, App.tsx, index.html, vite.config.ts, tailwind.config.ts, tsconfig.json)
- [x] 0.14 Configure shadcn/ui (components.json, base CSS variables for MeridianMed theme)
- [x] 0.15 Verify: docker compose up --build completes with no errors, frontend loads at :3000, backend health check passes at :4000/health

**Phase 0 checkpoint: docker compose up --build → both services healthy. Fix all errors before marking complete.**

---

## PHASE 1 — Database Schema & TypeORM Setup
> Goal: All entities, migrations, seeder — real data foundation
> Pause after this phase and wait for "proceed"

- [x] 1.1 Configure TypeORM in backend (database.module.ts, ormconfig, connection to postgres service)
- [x] 1.2 Create entity: User (id, username, passwordHash, role, isActive, lastLoginAt, createdAt, updatedAt, deletedAt)
- [x] 1.3 Create entity: RefreshToken (id, userId, tokenHash, expiresAt, revokedAt, createdAt)
- [x] 1.4 Create entity: AuditLog (id, userId, action, entityType, entityId, before, after, ip, timestamp)
- [x] 1.5 Create entities: Vendor, Item, ItemCategory (procurement catalog)
- [x] 1.6 Create entities: PurchaseRequest, PurchaseRequestItem, RFQ, RFQLine, VendorQuote
- [x] 1.7 Create entities: PurchaseOrder, POLine, POReceipt, POReceiptLine, PutAway, Reconciliation
- [x] 1.8 Create entities: InventoryLevel, StockMovement, Alert, ReplenishmentRecommendation, RecommendationFeedback
- [x] 1.9 Create entities: LabTestDictionary, ReferenceRange, LabSample, LabResult, LabReport, LabReportVersion
- [x] 1.10 Create entities: Project, Task, Milestone, Deliverable, AcceptanceScore
- [x] 1.11 Create entities: LearningPlan, LearningGoal, StudySession, LearningPlanLifecycle
- [x] 1.12 Create entities: BusinessRule, RuleVersion, RuleRollout, RolloutFeedback
- [x] 1.13 Create entities: Notification, AnomalyEvent
- [x] 1.14 Generate initial migration (npm run migration:generate) — verify SQL is correct
- [x] 1.15 Create seeder: 4 users (admin/supervisor/hr/employee), sample vendors, sample items, sample lab test dictionary entries
- [x] 1.16 Wire seeder to run automatically on backend startup (if DB is empty)
- [x] 1.17 Verify: docker compose up --build → migrations run, seed data present, all 4 users can be found in DB

**Phase 1 checkpoint: psql into postgres container → all tables exist, seed users present.**

---

## PHASE 2 — Authentication & RBAC
> Goal: Login, JWT, refresh tokens, logout, role guards, rate limiting
> Pause after this phase and wait for "proceed"

- [x] 2.1 Create AuthModule with AuthService, AuthController
- [x] 2.2 Implement POST /auth/login: validate credentials, issue JWT (15min) + refresh token (8hr, stored hashed in DB)
- [x] 2.3 Implement POST /auth/refresh: validate refresh token from DB, rotate (revoke old, issue new), return new access token
- [x] 2.4 Implement POST /auth/logout: revoke refresh token in DB, clear client token
- [x] 2.5 Create JwtStrategy (Passport): validate JWT, attach user to request
- [x] 2.6 Create RolesGuard: reads @Roles() decorator, checks req.user.role — applied globally, skipped with @Public()
- [x] 2.7 Create ActionGuard: reads @RequireAction() decorator for fine-grained action-level RBAC
- [x] 2.8 Implement rate limiter: @nestjs/throttler, 10 requests/min for sensitive endpoints
- [x] 2.9 Implement nonce + timestamp validation middleware for sensitive write operations
- [x] 2.10 Create GET /auth/me: return current user profile (no password hash)
- [x] 2.11 Frontend: create login page (username + password, no role selector, no defaults shown)
- [x] 2.12 Frontend: create AuthContext (store access token in memory, refresh token in httpOnly cookie or localStorage)
- [x] 2.13 Frontend: create Axios interceptor (auto-call /auth/refresh on 401, retry original request)
- [x] 2.14 Frontend: create ProtectedRoute component (redirects to /login if not authenticated)
- [x] 2.15 Frontend: create RoleRoute component (redirects to /unauthorized if wrong role)
- [x] 2.16 Frontend: create app router (React Router v6) with role-based route protection
- [x] 2.17 Write backend unit tests: AuthService.login (valid credentials, wrong password, inactive user)
- [x] 2.18 Write backend e2e tests (real DB): POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me with expired token
- [x] 2.19 Verify: docker compose run test → auth tests pass

**Phase 2 checkpoint: login works for all 4 roles, expired token auto-refreshes, wrong role → 403.**

---

## PHASE 3 — Procurement Module (Backend)
> Goal: Full procurement flow from request to reconciliation — backend only
> Pause after this phase and wait for "proceed"

- [x] 3.1 Create ProcurementModule with PurchaseRequestService, PurchaseRequestController
- [x] 3.2 Implement CRUD: POST /procurement/requests (Employee+), GET /procurement/requests (filtered by role)
- [x] 3.3 Implement RFQ flow: POST /procurement/rfq (create RFQ from request), POST /procurement/rfq/:id/quotes (add vendor quotes)
- [x] 3.4 Implement side-by-side quote comparison endpoint: GET /procurement/rfq/:id/comparison
- [x] 3.5 Implement PO issuance: POST /procurement/orders (from approved RFQ, locks unit price for 30 days)
- [x] 3.6 Implement price lock enforcement: any attempt to modify PO line price within 30 days of approval → 400 error
- [x] 3.7 Implement receiving: POST /procurement/orders/:id/receipts (partial delivery support, backorder tracking)
- [x] 3.8 Implement inspection: PATCH /procurement/receipts/:id/inspect (pass/fail per line)
- [x] 3.9 Implement put-away: POST /procurement/receipts/:id/putaway (assign location, update inventory level)
- [x] 3.10 Implement substitute approval: POST /procurement/requests/:id/substitute (admin approves alternate item)
- [x] 3.11 Implement reconciliation: POST /procurement/orders/:id/reconcile (match received vs ordered, flag discrepancies)
- [x] 3.12 Implement all status transitions with audit log entries on every state change
- [x] 3.13 Write unit tests: price lock validation, partial delivery logic, substitute approval
- [x] 3.14 Write e2e tests (real DB): full procurement flow from request to reconciliation in one test suite

**Phase 3 checkpoint: full procurement flow works via API, price lock enforced, audit log populated.**

---

## PHASE 4 — Inventory & Smart Alerts (Backend)
> Goal: Stock tracking, all 4 alert types, replenishment recommendations
> Pause after this phase and wait for "proceed"

- [x] 4.1 Create InventoryModule with InventoryService, InventoryController
- [x] 4.2 Implement GET /inventory/items (with stock levels, alert badges)
- [x] 4.3 Implement stock movement recording: every put-away, issue, adjustment creates a StockMovement record
- [x] 4.4 Implement safety stock alert: query items where currentStock < safetyStockLevel → create Alert
- [x] 4.5 Implement min/max alert: query items where currentStock < minLevel or > maxLevel → create Alert
- [x] 4.6 Implement near-expiration alert: query items where expiresAt <= now + 45 days → create Alert
- [x] 4.7 Implement abnormal consumption: calculate 7-day usage, compare to 8-week rolling average, flag if > 40% above → create Alert
- [x] 4.8 Create AlertsService: run all 4 checks on a schedule (every hour via @nestjs/schedule cron job)
- [x] 4.9 Implement replenishment recommendation: POST /inventory/recommendations/generate — calculate qty = (leadTimeDays + bufferDays) × avgDailyUsage, default buffer = 14 days
- [x] 4.10 Implement recommendation acceptance: POST /inventory/recommendations/:id/accept → auto-draft PurchaseRequest
- [x] 4.11 Implement recommendation feedback: record impression (recommendation shown) and click (recommendation accepted) per user
- [x] 4.12 Write unit tests: each of the 4 alert calculation functions, replenishment qty formula
- [x] 4.13 Write e2e tests (real DB): create items with breach conditions → GET /inventory/alerts returns correct alert types

**Phase 4 checkpoint: all 4 alert types trigger correctly with real data, replenishment auto-drafts PR.**

---

## PHASE 5 — Lab Operations (Backend)
> Goal: Test dictionary, sample lifecycle, result entry, report versioning
> Pause after this phase and wait for "proceed"

- [x] 5.1 Create LabModule with LabService, LabController
- [x] 5.2 Implement test item dictionary CRUD: GET/POST/PATCH /lab/tests (with reference ranges per test)
- [x] 5.3 Implement sample intake: POST /lab/samples (employee submits, status=submitted)
- [x] 5.4 Implement sample status transitions: submitted → in-progress → reported → archived
- [x] 5.5 Implement result entry: POST /lab/samples/:id/results (with automatic abnormal flag if value outside reference range)
- [x] 5.6 Implement abnormal flag logic: compare entered value against ReferenceRange min/max, set isAbnormal automatically
- [x] 5.7 Implement report creation: POST /lab/samples/:id/report (generates LabReport from results)
- [x] 5.8 Implement report versioning: every edit to a report creates a new LabReportVersion (immutable audit trail)
- [x] 5.9 Implement report edit history: GET /lab/reports/:id/history (returns all versions with diff)
- [x] 5.10 Implement report archive: PATCH /lab/reports/:id/archive
- [x] 5.11 Write unit tests: abnormal flag logic for numeric and range-based reference values
- [x] 5.12 Write e2e tests (real DB): full sample lifecycle from intake to archived report with version history

**Phase 5 checkpoint: sample moves through all statuses, abnormal flags auto-set, report versions tracked.**

---

## PHASE 6 — Projects & Work Tracking (Backend)
> Goal: Projects, tasks, milestones, deliverables, acceptance scoring
> Pause after this phase and wait for "proceed"

- [x] 6.1 Create ProjectsModule with ProjectService, ProjectController
- [x] 6.2 Implement project CRUD: POST/GET/PATCH /projects (with status: initiation/change/inspection/final-acceptance/archive)
- [x] 6.3 Implement project status transitions with validation (e.g., cannot skip to archive from initiation)
- [x] 6.4 Implement task CRUD: POST/GET/PATCH /projects/:id/tasks (employee creates, supervisor approves)
- [x] 6.5 Implement milestone tracking: POST/GET/PATCH /projects/:id/milestones (with progress %)
- [x] 6.6 Implement deliverable submission: POST /projects/:projectId/tasks/:taskId/deliverables
- [x] 6.7 Implement acceptance scoring: POST /projects/:id/acceptance-score (supervisor scores deliverables)
- [x] 6.8 Write audit log entry on every project/task state change
- [x] 6.9 Write e2e tests (real DB): full project lifecycle from initiation to archive with tasks and milestones

**Phase 6 checkpoint: project moves through all 5 statuses with tasks, milestones, and acceptance scoring.**

---

## PHASE 7 — Learning Plans & Rules Engine (Backend)
> Goal: HR learning plans with lifecycle, rules engine with versioning and rollback
> Pause after this phase and wait for "proceed"

- [ ] 7.1 Create LearningModule with LearningService, LearningController
- [ ] 7.2 Implement learning plan CRUD: POST/GET/PATCH /learning/plans (HR only)
- [ ] 7.3 Implement learning plan lifecycle: not-started → active → paused → completed → archived (enforce valid transitions)
- [ ] 7.4 Implement learning goals: POST /learning/plans/:id/goals (with priority, tags, studyFrequency rule e.g. "3 sessions/week")
- [ ] 7.5 Implement study frequency enforcement: validate sessions against frequency rule, flag if below target
- [ ] 7.6 Create RulesEngineModule with RulesService, RulesController
- [ ] 7.7 Implement business rule CRUD: POST/GET /rules (admin only, with versioning — each update creates new version)
- [ ] 7.8 Implement conflict validation: POST /rules/validate — check new rule against existing active rules for conflicts
- [ ] 7.9 Implement impact assessment: POST /rules/:id/impact — report which workflows/thresholds change before activation
- [ ] 7.10 Implement staged rollout: PATCH /rules/:id/rollout — status: draft/staged/active, with A-B flag for subset rollout
- [ ] 7.11 Implement hot update: PATCH /rules/:id/activate — applies rule change without restart
- [ ] 7.12 Implement rollback: POST /rules/:id/rollback — reverts to previous version, must complete in <5min (implement with DB transaction, record rollbackAt timestamp, assert duration)
- [ ] 7.13 Write unit tests: lifecycle transition validation (learning plans), rule conflict detection, rollback timing
- [ ] 7.14 Write e2e tests (real DB): create rule → activate → rollback → verify previous version restored

**Phase 7 checkpoint: learning plan lifecycle enforced, rule rollback completes and restores previous version.**

---

## PHASE 8 — Frontend Core (Dashboard, Layout, Shared Components)
> Goal: App shell, role-based dashboard with real data, shared components
> Pause after this phase and wait for "proceed"

- [ ] 8.1 Create shared layout: Sidebar (role-based nav), TopBar (user info, notifications bell, logout), MainContent area
- [ ] 8.2 Sidebar navigation per role:
       Admin: Dashboard, Procurement, Inventory, Lab, Projects, Learning, Rules Engine, Users, Settings
       Supervisor: Dashboard, Procurement (approve), Inventory, Lab, Projects (review), Anomaly Queue
       HR: Dashboard, Learning Plans, Users (view)
       Employee: Dashboard, Procurement (my requests), Lab (my samples), My Tasks, My Learning
- [ ] 8.3 Create shared components: DataTable (sortable, paginated), StatusBadge, AlertCard, ConfirmDialog, LoadingSpinner, EmptyState, ErrorBoundary
- [ ] 8.4 Create API client (axios instance with baseURL=backend, interceptors for token refresh)
- [ ] 8.5 Create TanStack Query setup (QueryClient, QueryClientProvider, default stale time)
- [ ] 8.6 Implement role-based dashboard: fetch real data from backend for each role's relevant metrics
       Admin dashboard: total users, open POs, active alerts count, pending rules
       Supervisor dashboard: pending approvals, open anomalies, project status summary
       HR dashboard: active learning plans, completion rates
       Employee dashboard: my open requests, my tasks, my alerts
- [ ] 8.7 Implement Smart Alerts panel: fetch GET /inventory/alerts, display as grouped alert cards (safety stock / min-max / expiry / consumption) with severity color coding
- [ ] 8.8 Implement notification bell: fetch unread notifications, badge count, dropdown list
- [ ] 8.9 Implement anomaly queue page (Supervisor): list suspicious activity events, mark reviewed
- [ ] 8.10 Verify: all dashboard data comes from real API calls, no hardcoded values anywhere

**Phase 8 checkpoint: dashboard loads real data for all 4 roles, alerts display correctly.**

---

## PHASE 9 — Frontend Features (Procurement, Inventory, Lab)
> Goal: Guided procurement flow, inventory management, lab operations UI
> Pause after this phase and wait for "proceed"

- [ ] 9.1 Procurement: Purchase Request form (guided, multi-step: item selection → quantities → justification → submit)
- [ ] 9.2 Procurement: RFQ management page (list RFQs, add vendor quotes)
- [ ] 9.3 Procurement: Side-by-side quote comparison table (highlight lowest price, recommended vendor)
- [ ] 9.4 Procurement: PO issuance form (from approved RFQ, shows locked pricing with 30-day countdown)
- [ ] 9.5 Procurement: Receiving & inspection page (line-by-line receipt entry, pass/fail inspection per line)
- [ ] 9.6 Procurement: Put-away and reconciliation pages
- [ ] 9.7 Inventory: Item catalog page (table with stock levels, alert badges inline)
- [ ] 9.8 Inventory: Item detail page (stock history chart, all active alerts, replenishment recommendations)
- [ ] 9.9 Inventory: Replenishment recommendation card (accept button → auto-drafts PR, tracks impression+click)
- [ ] 9.10 Lab: Sample intake form (employee submits sample details)
- [ ] 9.11 Lab: Sample management board (kanban or table view by status)
- [ ] 9.12 Lab: Result entry form (field per test with reference range shown, abnormal flag highlights automatically)
- [ ] 9.13 Lab: Report viewer (with version history sidebar showing all edits, diff view)
- [ ] 9.14 Verify: all pages fetch from real backend, no mocked data, loading/empty/error states on every page

**Phase 9 checkpoint: full procurement flow completable via UI end-to-end, lab sample through archived report.**

---

## PHASE 10 — Frontend Features (Projects, Learning, Rules Engine, Admin)
> Goal: Work tracking, HR learning plans, rules engine admin UI
> Pause after this phase and wait for "proceed"

- [ ] 10.1 Projects: Project list page with status filter and create button
- [ ] 10.2 Projects: Project detail page (milestones progress bar, tasks list, deliverables section)
- [ ] 10.3 Projects: Task detail (submit deliverable, acceptance scoring form for supervisors)
- [ ] 10.4 Learning: Learning plan list page (HR view: all plans; Employee view: my plans)
- [ ] 10.5 Learning: Learning plan detail (goals list, study frequency rule display, session log)
- [ ] 10.6 Learning: Learning plan lifecycle controls (HR can move through states with confirmation)
- [ ] 10.7 Rules Engine: Rule list page (admin only, shows version, status, rollout %)
- [ ] 10.8 Rules Engine: Rule editor (create/edit rule with conflict validation feedback before save)
- [ ] 10.9 Rules Engine: Impact assessment modal (shows affected workflows before activation)
- [ ] 10.10 Rules Engine: Rollout controls (staged rollout slider, A-B toggle, activate, rollback button)
- [ ] 10.11 Admin: User management (create/edit/deactivate users, assign roles)
- [ ] 10.12 Admin: Catalog configuration (item categories, vendors, reference ranges)
- [ ] 10.13 Admin: Security settings (export permissions per role, rate limit config display)
- [ ] 10.14 Verify: all pages load real data, no 404 routes, no broken navigation

**Phase 10 checkpoint: all 8 feature areas navigable, rules engine rollback triggerable from UI.**

---

## PHASE 11 — Security Hardening & Risk Controls
> Goal: Complete all security requirements from SPEC.md
> Pause after this phase and wait for "proceed"

- [ ] 11.1 Verify AES-256 column encryption working on sensitive fields (test encrypt/decrypt roundtrip)
- [ ] 11.2 Verify rate limiter triggers correctly: write test that sends 11 requests in 1 minute → 11th returns 429
- [ ] 11.3 Verify nonce+timestamp: replay the same request with same nonce → 400 error
- [ ] 11.4 Verify identifier masking: any field marked as sensitive shows only last 4 chars in all API responses
- [ ] 11.5 Verify anomaly detection: burst 15 requests rapidly → AnomalyEvent created → visible in supervisor queue
- [ ] 11.6 Verify RBAC: write test matrix — every endpoint tested with wrong role → 403
- [ ] 11.7 Verify refresh token rotation: use refresh token once → get new tokens; use original refresh token again → 401 (revoked)
- [ ] 11.8 Verify soft deletes: DELETE on any business entity → record has deletedAt set, not removed from DB
- [ ] 11.9 Add Helmet headers verification test: GET /health → response has X-Content-Type-Options, X-Frame-Options headers
- [ ] 11.10 Verify CORS: request from non-frontend origin → rejected

**Phase 11 checkpoint: all security tests pass in docker compose run test.**

---

## PHASE 12 — Complete Test Suite & Docker Verification
> Goal: All tests pass in Docker, clean build, final checks
> Pause after this phase and wait for "proceed"

- [ ] 12.1 Audit all test files — ensure every module has unit tests and e2e tests
- [ ] 12.2 Ensure all e2e tests use real PostgreSQL (no mocks, no in-memory DB) — use docker-compose.test.yml postgres-test service
- [ ] 12.3 Ensure run_tests.sh is executable and called by Dockerfile.test CMD
- [ ] 12.4 Run: docker compose -f docker-compose.test.yml run --build test → fix ALL failures
- [ ] 12.5 Run: docker compose up --build → verify app loads, all 4 logins work
- [ ] 12.6 Verify no console.log in backend source (only winston logger calls)
       grep -r "console.log" repo/backend/src --include="*.ts" | grep -v ".spec.ts" → zero results
- [ ] 12.7 Verify no hardcoded data in frontend (no static arrays used as page data)
       All page data must come from useQuery() or equivalent API call
- [ ] 12.8 Verify clean TypeScript build: cd repo/backend && npx tsc --noEmit → zero errors
       cd repo/frontend && npx tsc --noEmit → zero errors
- [ ] 12.9 Verify .gitignore is complete (node_modules, dist, .env, postgres-data not tracked)
- [ ] 12.10 Final README check: only Run/Test/Stop/Login sections, all commands correct

**Phase 12 checkpoint: docker compose -f docker-compose.test.yml run test exits with code 0.**

---

## PHASE 13 — Docs Generation
> Goal: Generate design.md and api-spec.md from actual code
> This is the final phase — no pause needed

- [ ] 13.1 Generate docs/design.md from actual implemented code:
       - ASCII architecture diagram (browser → nginx → React → NestJS → PostgreSQL)
       - Docker service map
       - All database entities and relations
       - Security architecture (JWT flow, encryption, RBAC matrix)
       - Business rules implemented (all from SPEC.md with code references)
       - Module dependency graph
- [ ] 13.2 Generate docs/api-spec.md from actual implemented code:
       - Every endpoint: method, path, auth required, role required, request body, response shape, error codes
       - All DTOs with field descriptions
       - Auth flow diagrams (login, refresh, logout)
       - Rate limiting rules
       - WebSocket events (if any)

---

## Execution Notes for Claude

- Complete tasks in exact order — do not skip or reorder
- After finishing a task: mark it [x] in PLAN.md and immediately continue to the next task — do NOT pause or report between tasks
- If a task produces an error: fix the error as part of that same task before marking [x] and before moving on — do NOT ask the user
- If a phase reveals a missing task: add it as N.X and complete it before moving to N+1
- Only pause at phase boundaries — after ALL tasks in a phase are [x] AND the checkpoint passes
- At a phase pause: show a brief summary (files created, checkpoint result) then wait for "proceed"
- Never start the next phase without explicit "proceed" from the user
- Real data rule: if you are tempted to hardcode any data in the frontend, stop and create the API endpoint instead
