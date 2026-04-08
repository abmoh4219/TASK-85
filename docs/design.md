# MeridianMed Supply & Lab Operations Platform — Design Document
# Task ID: w2t85
# Generated from: actual implemented code (Phase 13)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Firefox)                                      │
│  React 18 + TypeScript + TailwindCSS + shadcn/ui                │
│  HTTPS :3000 (self-signed cert)                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/JSON (REST)
                         │ axios + TanStack Query
                         │ auto-refresh on 401
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Nginx (Alpine) — TLS termination + API reverse proxy           │
│  - Serves React build from /usr/share/nginx/html                │
│  - SPA routing: try_files $uri $uri/ /index.html               │
│  - /api/* → proxied to backend via HTTPS                        │
│  - HTTP :80 redirects to HTTPS :443                             │
│  Port :443 (mapped to host :3000)                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS proxy → backend:4000
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  NestJS (node:20-alpine) — HTTPS with self-signed cert          │
│  - Helmet security headers                                       │
│  - CORS restricted to CORS_ORIGIN env var                       │
│  - JWT access token (15 min, HS256)                             │
│  - Rate limiting: 10 req/min/user (AnomalyThrottlerGuard)      │
│  - Nonce + timestamp replay prevention (DB-backed, user-scoped) │
│  - Global validation pipe (class-validator)                     │
│  - Winston structured JSON logging (JSON in production)         │
│  Port :4000 (HTTPS)                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ TypeORM (pg driver)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL 15 (Alpine)                                          │
│  Database: meridianmed                                           │
│  User: meridian                                                  │
│  Named volume: postgres-data                                     │
│  Port :5432 (mapped to host :5434)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Docker Service Map

### Production (`docker-compose.yml`)

| Service    | Image              | Port           | Role                          |
|------------|--------------------|----------------|-------------------------------|
| postgres   | postgres:15-alpine | 5432→5434      | Primary database              |
| backend    | repo-backend       | 4000→4000      | NestJS API server (HTTPS)     |
| frontend   | repo-frontend      | 443→3000, 80→3080 | React SPA + API proxy (HTTPS) |

Startup order: `postgres` (healthy) → `backend` → `frontend`

Backend health check: `wget -qO- http://localhost:4000/health`
Postgres health check: `pg_isready -U meridian -d meridianmed`

### Test (`docker-compose.test.yml`)

| Service       | Image              | Port           | Role                          |
|---------------|--------------------|----------------|-------------------------------|
| postgres-test | postgres:15-alpine | 5432→5433      | Isolated test database        |
| test-runner   | repo-test-runner   | —              | Jest unit + e2e test runner   |

Test DB: `meridianmed_test` | Throttle limit in test: 100/min (avoids interference)

---

## 3. Database Entities & Relations

### Auth / Users

```
users
  id            uuid PK
  username      varchar(100) UNIQUE NOT NULL
  password_hash varchar(255) NOT NULL          -- bcrypt rounds:12
  role          enum(admin|supervisor|hr|employee)
  is_active     boolean DEFAULT true
  last_login_at timestamptz
  created_at    timestamptz
  updated_at    timestamptz
  deleted_at    timestamptz                    -- soft delete

refresh_tokens
  id         uuid PK
  user_id    uuid FK→users
  token_hash varchar(255) NOT NULL             -- SHA-256 hashed
  expires_at timestamptz NOT NULL             -- 8 hours
  revoked_at timestamptz                      -- set on use/logout
  created_at timestamptz

audit_logs
  id          uuid PK
  user_id     uuid FK→users (nullable)
  action      varchar(100) NOT NULL
  entity_type varchar(100)
  entity_id   uuid
  before      jsonb
  after       jsonb
  ip          varchar(45)
  timestamp   timestamptz DEFAULT now()
```

### Procurement

```
vendors
  id, name, email, phone, address, contactName, isActive

item_categories
  id, name, description

items
  id, name, sku(UNIQUE), description, unitOfMeasure
  categoryId→item_categories
  safetyStockLevel, minLevel, maxLevel, reorderPoint
  leadTimeDays, bufferDays(DEFAULT 14), isTracked

purchase_requests
  id, requestNumber(UNIQUE), requestedById→users
  status  enum(draft|submitted|approved|rejected|fulfilled)
  justification, estimatedTotal, submittedAt, approvedAt
  approvedById→users, rejectedAt, rejectedById→users
  ip, createdAt, updatedAt, deletedAt

purchase_request_items
  id, requestId→purchase_requests
  itemId→items, substitutedItemId→items(nullable)
  quantity, unitOfMeasure, estimatedUnitPrice
  substituteApprovedBy→users(nullable)

rfqs
  id, rfqNumber(UNIQUE), requestId→purchase_requests
  status  enum(open|closed|awarded)
  awardedVendorId→vendors(nullable)
  closedAt, createdById→users, createdAt, updatedAt

rfq_lines
  id, rfqId→rfqs, itemId→items
  quantity, unitOfMeasure, description

vendor_quotes
  id, rfqId→rfqs, vendorId→vendors
  rfqLineId→rfq_lines, unitPrice, leadTimeDays
  notes, submittedAt

purchase_orders
  id, poNumber(UNIQUE), rfqId→rfqs(nullable)
  vendorId→vendors, status  enum(draft|approved|received|reconciled)
  totalAmount, approvedAt, priceLockUntil      -- 30-day lock
  approvedById→users, createdById→users
  createdAt, updatedAt, deletedAt

po_lines
  id, poId→purchase_orders, itemId→items
  quantity, unitOfMeasure, unitPrice
  priceLockUntil                               -- per-line lock date

po_receipts
  id, poId→purchase_orders, receivedById→users
  status  enum(pending|inspected|put_away)
  notes, receivedAt, createdAt, updatedAt

po_receipt_lines
  id, receiptId→po_receipts, poLineId→po_lines, itemId→items
  quantityReceived, lotNumber(nullable), expiresAt(nullable)
  inspectionStatus  enum(pending|pass|fail|partial)
  inspectionNotes

put_aways
  id, receiptLineId→po_receipt_lines
  location, quantityStored, putAwayById→users, putAwayAt

reconciliations
  id, poId→purchase_orders, reconciledById→users
  status  enum(matched|discrepancy)
  discrepancies jsonb, reconciledAt
```

### Inventory

```
inventory_levels
  id, itemId→items(UNIQUE), currentStock
  lastMovementAt, updatedAt

stock_movements
  id, itemId→items, movementType  enum(in|out|adjustment)
  quantity, referenceType, referenceId
  notes, createdById→users, createdAt

alerts
  id, itemId→items, alertType  enum(safety_stock|min_max|near_expiry|abnormal_consumption)
  severity  enum(critical|high|medium|low)
  status  enum(active|acknowledged|resolved)
  message, metadata jsonb
  acknowledgedById→users(nullable), acknowledgedAt
  createdAt, updatedAt

replenishment_recommendations
  id, itemId→items
  status  enum(pending|accepted|dismissed)
  recommendedQty, reasoning, estimatedCost
  leadTimeDays, bufferDays, avgDailyUsage
  generatedAt, acceptedAt, dismissedAt
  acceptedById→users(nullable)

recommendation_feedback
  id, recommendationId→replenishment_recommendations
  userId→users
  eventType  enum(impression|accept|dismiss)
  createdAt
```

### Lab

```
lab_test_dictionaries
  id, name, testCode(UNIQUE), description
  sampleType, unit, isActive

reference_ranges
  id, testId→lab_test_dictionaries
  population, minValue, maxValue, criticalLow, criticalHigh
  unit, notes

lab_samples
  id, sampleNumber(UNIQUE), submittedById→users
  patientIdentifier varchar(512) AES-256 encrypted  -- last 4 shown in API
  sampleType, collectionDate
  status  enum(submitted|in_progress|reported|archived)
  notes, createdAt, updatedAt, deletedAt

lab_results
  id, sampleId→lab_samples, testId→lab_test_dictionaries
  value(varchar), numericValue(decimal nullable)
  isAbnormal boolean, isCritical boolean           -- auto-computed
  abnormalFlag(varchar nullable), notes
  enteredById→users, createdAt, updatedAt

lab_reports
  id, sampleId→lab_samples(UNIQUE), createdById→users
  status  enum(draft|final|archived)
  content text, version integer DEFAULT 1
  finalizedAt, archivedAt, createdAt, updatedAt

lab_report_versions
  id, reportId→lab_reports, version integer
  content text, editedById→users
  changeNotes, createdAt
```

### Projects

```
projects
  id, name, description, status
  enum(initiation|change|inspection|final_acceptance|archive)
  createdById→users, assignedToId→users(nullable)
  startDate, targetEndDate, actualEndDate
  createdAt, updatedAt, deletedAt

project_tasks
  id, projectId→projects, title, description
  status  enum(todo|in_progress|review|done)
  priority  enum(low|medium|high|critical)
  assignedToId→users(nullable), createdById→users
  dueDate, completedAt, createdAt, updatedAt, deletedAt

milestones
  id, projectId→projects, name, description
  targetDate, completedDate(nullable)
  progressPercentage(0-100), notes
  createdById→users, createdAt, updatedAt

deliverables
  id, taskId→project_tasks, title, description
  fileUrl(nullable), submittedById→users
  submittedAt, createdAt, updatedAt

acceptance_scores
  id, projectId→projects, scoredById→users
  score(0-100), notes, criteria jsonb
  createdAt, updatedAt
```

### Learning

```
learning_plans
  id, title, description, assignedToId→users
  createdById→users, targetRole, targetCompletionDate
  status  enum(not_started|active|paused|completed|archived)
  createdAt, updatedAt, deletedAt

learning_goals
  id, planId→learning_plans, title, description
  priority  enum(low|medium|high)
  tags varchar[], studyFrequency(varchar)    -- e.g. "3 sessions/week"
  targetSessions integer, completedSessions integer
  dueDate(nullable), completedAt(nullable)
  createdAt, updatedAt

study_sessions
  id, goalId→learning_goals, userId→users
  durationMinutes integer, notes, sessionDate
  createdAt

learning_plan_lifecycles
  id, planId→learning_plans, fromStatus, toStatus
  changedById→users, reason(nullable), changedAt
```

### Rules Engine

```
business_rules
  id, name, description, category
  enum(custom|procurement_threshold|cancellation|pricing|inventory|parsing)
  status  enum(draft|staged|active|inactive|deprecated)
  currentVersion integer, isAbTest boolean
  rolloutPercentage(1-100)
  createdById→users, createdAt, updatedAt, deletedAt

rule_versions
  id, ruleId→business_rules, version integer
  definition jsonb, createdById→users
  activatedAt(nullable), rollbackAt(nullable), createdAt

rule_rollouts
  id, ruleId→business_rules, ruleVersionId→rule_versions
  rolloutPercentage, startedById→users
  startedAt, completedAt, status

rollout_feedbacks
  id, ruleId→business_rules, userId→users
  variantGroup varchar, outcome varchar, metadata jsonb, createdAt
```

### Notifications

```
notifications
  id, userId→users, type varchar(100)
  title, message, isRead boolean DEFAULT false
  readAt(nullable), metadata jsonb, createdAt, updatedAt

anomaly_events
  id, userId→users(nullable)
  type  enum(rate_limit_exceeded|unusual_access_pattern|
             repeated_failed_login|privilege_escalation_attempt|
             bulk_data_export|after_hours_access|suspicious_query)
  status  enum(pending|reviewed|dismissed|escalated)
  description text, ipAddress, requestPath, metadata jsonb
  reviewedById→users(nullable), reviewedAt, reviewNotes
  createdAt, updatedAt
```

---

## 4. Security Architecture

### JWT Flow

```
Client                          Backend
  │                               │
  ├──POST /auth/login ──────────► │  bcrypt.compare(pw, hash)
  │                               │  Issue: accessToken (15min, HS256)
  │                               │  Issue: refreshToken (8hr, stored hashed)
  │◄── { accessToken, refreshToken, userId, expiresIn:900 } ──┤
  │                               │
  │──GET /protected ────────────► │  JwtAuthGuard validates JWT
  │◄── 200 data ─────────────────┤
  │                               │
  │──GET /protected (expired) ──► │  401 Unauthorized
  │◄── 401 ──────────────────────┤
  │──POST /auth/refresh ────────► │  lookup tokenHash in DB
  │  { userId, refreshToken }     │  revoke old token
  │                               │  issue new accessToken + refreshToken
  │◄── { accessToken, refreshToken } ───────────────────────┤
  │──GET /protected (retry) ────► │  200 OK
  │                               │
  │──POST /auth/logout ─────────► │  revoke refreshToken in DB
  │◄── 200 ──────────────────────┤
```

### Guard Execution Order (global APP_GUARD chain)

1. **AnomalyThrottlerGuard** — 10 req/min per user (tracked by user ID). On breach: creates `AnomalyEvent(type=rate_limit_exceeded)` asynchronously, returns HTTP 429.
2. **JwtAuthGuard** — validates Bearer token, attaches `req.user`. `@Public()` skips this guard.
3. **RolesGuard** — checks `req.user.role` against `@Roles()` decorator. Missing decorator = any authenticated role allowed.

### Nonce + Timestamp Middleware

Applied globally to all routes. For POST/PATCH/DELETE requests that include both `X-Nonce` and `X-Timestamp` headers:
- Timestamp must be within ±5 minutes of server time (prevents replay of stale requests)
- Nonce must not have been seen before within the 5-minute window (prevents replay of recent requests)
- On violation: HTTP 400 Bad Request

### AES-256 Column Encryption

Sensitive columns are encrypted at rest using AES-256-CBC with a random 16-byte IV per encryption:
- **`lab_samples.patient_identifier`** — stored as `ivHex:ciphertextHex` (up to 512 chars)
- Key derived from `ENCRYPTION_KEY` env var via SHA-256
- Transparent to application code via TypeORM column transformer
- API responses always mask `patientIdentifier` to `****XXXX` (last 4 chars only)

### RBAC Matrix

| Endpoint Group              | admin | supervisor | hr  | employee |
|-----------------------------|-------|------------|-----|----------|
| POST /auth/login            | ✓     | ✓          | ✓   | ✓        |
| GET /auth/me                | ✓     | ✓          | ✓   | ✓        |
| GET /health                 | ✓     | ✓          | ✓   | ✓ (public)|
| POST /procurement/requests  | ✓     | ✓          | —   | ✓        |
| PATCH /requests/:id/approve | ✓     | ✓          | —   | —        |
| POST /rfq, GET /rfq         | ✓     | ✓          | —   | —        |
| POST /orders, GET /orders   | ✓     | ✓          | —   | —        |
| GET /inventory/items        | ✓     | ✓          | —   | —        |
| GET /inventory/alerts       | ✓     | ✓          | —   | —        |
| GET /inventory/recommendations | ✓  | ✓          | —   | —        |
| POST /lab/samples           | ✓     | ✓          | —   | ✓        |
| GET /lab/samples            | ✓     | ✓          | —   | ✓ (own)  |
| POST /lab/tests             | ✓     | ✓          | —   | —        |
| GET /lab/tests              | ✓     | ✓          | —   | ✓        |
| GET /projects               | ✓     | ✓          | —   | ✓        |
| POST /projects              | ✓     | ✓          | —   | —        |
| GET /learning/plans         | ✓     | —          | ✓   | ✓ (own)  |
| POST /learning/plans        | ✓     | —          | ✓   | —        |
| GET /rules                  | ✓     | —          | —   | —        |
| POST /rules                 | ✓     | —          | —   | —        |
| GET /anomalies              | ✓     | ✓          | —   | —        |
| GET /notifications          | ✓     | ✓          | ✓   | ✓        |
| GET /admin/users            | ✓     | —          | —   | —        |
| POST /admin/users           | ✓     | —          | —   | —        |

### Password & Token Hashing

| Secret Type     | Algorithm          | Parameters              |
|-----------------|--------------------|-------------------------|
| User passwords  | bcrypt             | rounds: 12              |
| Refresh tokens  | SHA-256 (hex)      | stored as 64-char hex   |

---

## 5. Business Rules Implemented

All values are hard-coded per SPEC.md — not configurable at runtime.

| Rule                    | Value         | Implementation Location              |
|-------------------------|---------------|--------------------------------------|
| Price lock duration     | 30 days       | `procurement.service.ts:createPO()` — sets `priceLockUntil = approvedAt + 30d`; `updatePOLinePrice()` blocks if within lock window |
| Expiry warning window   | 45 days       | `alerts.service.ts:checkNearExpiry()` — `WHERE expiresAt <= now() + interval '45 days'` |
| Abnormal consumption    | 7-day usage > 8-week avg × 1.4 | `alerts.service.ts:checkAbnormalConsumption()` |
| Replenishment buffer    | 14 days default | `inventory.service.ts:generateRecommendations()` — `qty = (leadTimeDays + bufferDays) × avgDailyUsage` |
| JWT access expiry       | 15 minutes    | `app.module.ts` ThrottlerModule + `auth.module.ts` JwtModule `expiresIn: '15m'` |
| Refresh token expiry    | 8 hours       | `auth.service.ts:login()` — `expiresAt = now() + 8h` |
| Rate limit              | 10 req/min/user | `anomaly-throttler.guard.ts` — tracker by `req.user.id` |
| Rules rollback timeout  | 5 minutes     | `rules-engine.service.ts:rollbackRule()` — `MAX_ROLLBACK_MS = 300_000` |
| Identifier masking      | Last 4 chars  | `lab.service.ts:maskSample()` — `'****' + id.slice(-4)` |
| Study frequency         | Enforced as string rule | `learning.service.ts:checkFrequencyCompliance()` — parses `"N sessions/week"` |

---

## 6. Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── WinstonModule (global logger)
├── ThrottlerModule → AnomalyThrottlerGuard [APP_GUARD #1]
├── ScheduleModule (cron jobs)
├── TypeOrmModule.forFeature([AnomalyEvent]) → AnomalyThrottlerGuard
├── DatabaseModule → TypeOrmModule.forRoot (postgres connection)
├── AuthModule
│   ├── JwtModule (access token signing)
│   ├── TypeOrmModule.forFeature([User, RefreshToken])
│   └── exports: JwtStrategy
├── ProcurementModule
│   ├── TypeOrmModule.forFeature([PurchaseRequest, PurchaseRequestItem,
│   │   RFQ, RFQLine, VendorQuote, PurchaseOrder, POLine,
│   │   POReceipt, POReceiptLine, PutAway, Reconciliation,
│   │   Item, Vendor, AuditLog])
│   └── AuditLogService
├── InventoryModule
│   ├── TypeOrmModule.forFeature([Item, InventoryLevel, StockMovement,
│   │   Alert, ReplenishmentRecommendation, RecommendationFeedback,
│   │   PurchaseRequest, PurchaseRequestItem])
│   ├── InventoryService
│   └── AlertsService (cron: every hour)
├── LabModule
│   ├── TypeOrmModule.forFeature([LabTestDictionary, ReferenceRange,
│   │   LabSample, LabResult, LabReport, LabReportVersion, AuditLog])
│   └── AuditLogService
├── ProjectsModule
│   ├── TypeOrmModule.forFeature([Project, Task, Milestone,
│   │   Deliverable, AcceptanceScore, AuditLog])
│   └── AuditLogService
├── LearningModule
│   ├── TypeOrmModule.forFeature([LearningPlan, LearningGoal,
│   │   StudySession, LearningPlanLifecycle, AuditLog])
│   └── AuditLogService
├── RulesEngineModule
│   ├── TypeOrmModule.forFeature([BusinessRule, RuleVersion,
│   │   RuleRollout, RolloutFeedback, AuditLog])
│   └── AuditLogService
├── NotificationsModule
│   ├── TypeOrmModule.forFeature([Notification, AnomalyEvent])
│   └── exports: NotificationsService
└── UsersModule
    ├── TypeOrmModule.forFeature([User])
    └── exports: UsersService

Global APP_GUARDs (applied in order):
  1. AnomalyThrottlerGuard (rate limiting + anomaly logging)
  2. JwtAuthGuard (JWT validation)
  3. RolesGuard (role-based access)

Global Middleware:
  NonceMiddleware → all routes (POST/PATCH/DELETE with X-Nonce/X-Timestamp headers)
```

---

## 7. Frontend Architecture

```
frontend/src/
├── features/              # One folder per domain
│   ├── auth/              # LoginPage, AuthContext, ProtectedRoute, AppRouter
│   ├── dashboard/         # Role-based DashboardPage, AnomalyQueuePage, AlertsPanel
│   ├── procurement/       # ProcurementPage, CreateRequestPage, RFQPage, OrdersPage
│   ├── inventory/         # InventoryPage, ItemDetailPage
│   ├── lab/               # LabPage, CreateSamplePage, SampleDetailPage
│   ├── projects/          # ProjectsPage, ProjectDetailPage
│   ├── learning/          # LearningPage, LearningPlanDetailPage
│   ├── rules-engine/      # RulesEnginePage
│   └── admin/             # UsersPage, SettingsPage
├── components/
│   ├── layout/            # Sidebar (role-based nav), TopBar, AppLayout
│   ├── shared/            # DataTable, StatusBadge, AlertCard, ConfirmDialog,
│   │                      # LoadingSpinner/PageLoader, EmptyState, ErrorBoundary
│   └── ui/                # shadcn/ui components (Button, Input, Badge, etc.)
├── lib/
│   ├── api-client.ts      # Axios instance + 401 interceptor (auto-refresh)
│   └── utils.ts           # cn() (clsx + tailwind-merge)
└── types/
    └── index.ts           # Shared TypeScript interfaces for all domain entities
```

### State Management

| Concern            | Solution                                      |
|--------------------|-----------------------------------------------|
| Server state       | TanStack Query (useQuery, useMutation)        |
| Auth state         | React Context (AuthContext) + localStorage token |
| Form state         | React Hook Form + Zod validation             |
| UI state           | useState (local component state only)         |

### Token Storage & Refresh Flow

- `accessToken` stored in memory (AuthContext state)
- `refreshToken` stored in `localStorage` (no HttpOnly cookie — SPA constraint)
- Axios request interceptor attaches `Authorization: Bearer <accessToken>`
- Axios response interceptor: on 401, calls `POST /auth/refresh`, retries original request
- On refresh failure: redirects to `/login`

---

## 8. Scheduled Jobs

| Job                | Schedule    | Service                        | Action                                        |
|--------------------|-------------|--------------------------------|-----------------------------------------------|
| Alert checks       | Every hour  | `AlertsService.runAlertChecks()` | Runs all 4 alert types (safety stock, min/max, near expiry, abnormal consumption) |

Alert checks can also be triggered manually via `POST /inventory/alerts/run-checks` (admin only).
