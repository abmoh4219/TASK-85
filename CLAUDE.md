# CLAUDE.md — MeridianMed Supply & Lab Operations Platform
# Task ID: w2t85
# Read this file at the start of every single response. No exceptions.

## First: Read These Files Before Anything Else
1. SPEC.md — original business prompt and acceptance criteria (source of truth)
2. CLAUDE.md — this file (rules and constraints)
3. PLAN.md — current execution state and next task

## Project Identity

- Name: MeridianMed Supply & Lab Operations Platform
- Task ID: w2t85
- Type: Full-stack, on-premise, production-grade
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: NestJS + TypeScript
- Database: PostgreSQL 15
- ORM: TypeORM
- Auth: JWT (15min access tokens) + rotating refresh tokens (8hr, server-side store)
- Infrastructure: Docker + docker-compose (everything containerized)
- Code location: ALL generated code goes inside repo/ folder only

## Folder Structure (strict)

```
TASK-w2t85/                    ← project root (where Claude CLI runs)
├── SPEC.md                    ← created by Prompt A
├── CLAUDE.md                  ← this file
├── PLAN.md                    ← created by Prompt C
├── docs/                      ← design.md + api-spec.md (generated last)
├── sessions/                  ← trajectory files
├── metadata.json
└── repo/                      ← ALL code goes here
    ├── frontend/              ← React app
    │   ├── src/
    │   │   ├── features/      ← one folder per domain
    │   │   ├── components/    ← shared UI components
    │   │   ├── hooks/         ← shared hooks
    │   │   ├── lib/           ← api client, utils
    │   │   └── types/         ← shared TypeScript types
    │   ├── Dockerfile
    │   └── package.json
    ├── backend/               ← NestJS app
    │   ├── src/
    │   │   ├── modules/       ← one NestJS module per domain
    │   │   ├── common/        ← guards, decorators, filters, pipes
    │   │   ├── config/        ← config service, env validation
    │   │   └── database/      ← TypeORM entities, migrations
    │   ├── test/              ← e2e + integration tests (real DB)
    │   ├── Dockerfile
    │   └── package.json
    ├── docker-compose.yml
    ├── docker-compose.test.yml
    ├── nginx.conf
    ├── run_tests.sh           ← executable, called by Docker
    ├── .gitignore
    └── README.md
```

## Non-Negotiable Rules (Read Before Every Response)

1. **Read SPEC.md + CLAUDE.md + PLAN.md first.** Every single response. No shortcuts.
2. **One task at a time.** Do exactly what PLAN.md says is next. Nothing more.
3. **After finishing a task:** mark it [x] in PLAN.md, list files changed, show key decisions.
4. **All code goes inside repo/.** Never create source files outside repo/.
5. **Docker only — no local config.** QA runs only `docker compose up --build` and `docker compose run --build test`. No npm install, no local pg, no manual .env editing.
6. **Real data everywhere.** API tests hit real PostgreSQL + real NestJS. UI data comes from real API calls. Zero mocks, zero hardcoded display data.
7. **run_tests.sh is Docker-invoked.** It exists at repo/run_tests.sh, is chmod +x, and is the CMD of Dockerfile.test. Never run locally.
8. **RBAC enforced at service layer.** Role checks happen in NestJS guards AND service methods — never only at controller level.
9. **No mock data in tests.** Use real database transactions, real seeds via TypeORM migrations/seeders, real HTTP calls.
10. **JWT strictly as specified.** Access token: 15min expiry. Refresh token: 8hr expiry, stored server-side in DB, rotating on each use.
11. **Business rules are non-negotiable.** Every number in SPEC.md is a hard requirement: 30-day price lock, 45-day expiry warning, 40% consumption threshold, 14-day buffer default, 10 req/min rate limit, 5-min rollback, etc.
12. **UI must be modern SaaS quality.** Every page: loading state, empty state, error state. No plain HTML. Think Linear/Vercel/Notion aesthetics.
13. **Minimal README.** Only: Run / Test / Stop / Login. Nothing else.
14. **Pause after each phase.** Wait for user "proceed" before starting next phase.
15. **Fix before proceeding.** If a phase produces build errors or test failures, fix them before marking [x] and stopping.

## Tech Stack Details

### Backend (NestJS)
- NestJS with TypeScript strict mode
- TypeORM with PostgreSQL
- class-validator + class-transformer for all DTOs
- Passport.js + @nestjs/jwt for auth
- bcrypt for password hashing
- helmet + compression middleware
- winston for structured logging (JSON format, log levels: error/warn/info/debug)
- Rate limiting: @nestjs/throttler (10 sensitive actions/min/user)
- All endpoints return standard shape: { data, meta?, error? }
- All errors: { statusCode, message, error, timestamp, path }

### Frontend (React)
- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui component library
- React Router v6 (protected routes per role)
- TanStack Query (React Query) for server state
- React Hook Form + Zod for form validation
- Axios with interceptors (auto token refresh on 401)
- Every page has: <Suspense> loading, empty state component, error boundary

### Database (PostgreSQL)
- TypeORM entities with proper relations
- Migrations (never sync: true in production)
- Seeds via separate seeder script (called in docker-compose startup)
- AES-256 encryption for sensitive columns via TypeORM column transformer
- All timestamps: createdAt, updatedAt, deletedAt (soft deletes)

### Docker Architecture
```
docker-compose.yml services:
  postgres:    postgres:15-alpine, named volume for data persistence
  backend:     NestJS app, port 4000, depends_on postgres
  frontend:    Nginx serving React build, port 3000
  nginx:       Reverse proxy (optional, if needed)

docker-compose.test.yml services:
  postgres-test:  separate test DB on port 5433
  backend-test:   NestJS in test mode against postgres-test
  test-runner:    runs run_tests.sh
```

### run_tests.sh content (create exactly this):
```bash
#!/bin/sh
set -e

echo "========================================"
echo "  MeridianMed Test Suite"
echo "========================================"

FAILED=0

echo ""
echo "--- Backend Unit Tests ---"
cd /app/backend
npx jest --testPathPattern="\.spec\.ts$" --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "--- Backend Integration/E2E Tests (Real DB) ---"
npx jest --testPathPattern="\.e2e-spec\.ts$" --runInBand --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
```

### .gitignore content (create exactly this at repo/.gitignore):
```
node_modules/
dist/
.env
.env.*
*.log
postgres-data/
.DS_Store
Thumbs.db
.idea/
.vscode/
coverage/
*.tsbuildinfo
```

### Minimal README (create exactly this at repo/README.md):
```markdown
# MeridianMed Supply & Lab Operations Platform

## Run
```bash
docker compose up --build
```
Frontend: http://localhost:3000
Backend API: http://localhost:4000

## Test
```bash
docker compose -f docker-compose.test.yml run --build test
```

## Stop
```bash
docker compose down
```

## Login
| Role | Username | Password |
|---|---|---|
| Administrator | admin | meridian2024 |
| Supervisor | supervisor | meridian2024 |
| HR | hr | meridian2024 |
| Employee | employee | meridian2024 |
```

## NestJS Module Structure (one module per domain)

```
backend/src/modules/
├── auth/           ← JWT, refresh tokens, login, logout
├── users/          ← user management, RBAC
├── procurement/    ← requests, RFQ, PO, receiving, put-away, reconciliation
├── inventory/      ← items, stock levels, alerts, recommendations
├── lab/            ← test dictionaries, samples, results, reports
├── projects/       ← work tracking, tasks, milestones, deliverables
├── learning/       ← HR learning plans, goals, lifecycle
├── rules-engine/   ← versioned rules, rollout, rollback, impact assessment
├── notifications/  ← dashboard alerts, anomaly queue
└── admin/          ← catalogs, security config, export policies
```

## React Feature Structure (one folder per domain)

```
frontend/src/features/
├── auth/           ← login page, auth context, token management
├── dashboard/      ← role-based dashboard, smart alerts panel
├── procurement/    ← guided flow: request → RFQ → PO → receive → reconcile
├── inventory/      ← item catalog, stock levels, alert cards
├── lab/            ← sample management, result entry, report viewer
├── projects/       ← project board, task tracker, milestone view
├── learning/       ← learning plan management (HR), my learning (employee)
├── rules-engine/   ← rule editor, rollout controls (admin)
└── admin/          ← user management, catalog config, security settings
```

## Security Implementation Checklist

- [ ] bcrypt password hashing (rounds: 12)
- [ ] JWT access token: 15min, signed with RS256 or HS256
- [ ] Refresh token: 8hr, stored in DB (hashed), rotating on each use
- [ ] Refresh token revocation on logout (server-side)
- [ ] RBAC guard: checks role AND action on every protected endpoint
- [ ] Rate limiter: 10 sensitive actions/min/user (@nestjs/throttler)
- [ ] Nonce + timestamp validation on sensitive write operations
- [ ] AES-256 column encryption for sensitive fields
- [ ] Anomaly detection: burst detection → supervisor queue
- [ ] Sensitive identifiers: only last 4 chars shown in UI
- [ ] Helmet middleware (security headers)
- [ ] CORS restricted to frontend origin only
- [ ] Input sanitization (class-validator on all DTOs)
- [ ] SQL injection prevention (TypeORM parameterized queries only)
- [ ] Soft deletes only (no hard deletes on business records)

## Key Business Rules (all must be implemented — from SPEC.md)

| Rule | Implementation |
|---|---|
| Price lock 30 days | After PO approval, unit price immutable for 30 days |
| Expiry warning 45 days | Alert triggered when expiresAt <= now + 45 days |
| Abnormal consumption | 7-day usage > 8-week avg × 1.4 → flag |
| Replenishment buffer | Default 14 days configurable per item |
| JWT access expiry | Exactly 15 minutes |
| Refresh token expiry | Exactly 8 hours |
| Rate limit | 10 sensitive actions per minute per user |
| Rules rollback | Must complete within 5 minutes |
| Identifier masking | Only last 4 characters shown in UI |
| Study frequency | Enforced as stored rule e.g. "3 sessions/week" |

## Open Questions & Clarifications

[ ] TLS within LAN: use self-signed certs in docker-compose for dev, note production needs real certs
[ ] Face-related fields: implement the masking/template pattern but no actual biometric capture in this build — document the hook clearly
[ ] A-B rollout scope: implement within a single site (single docker-compose deployment)
[ ] Recommendation feedback: track impressions (shown) and clicks (accepted) per recommendation per user
[ ] Export permissions: admin can toggle which fields are exportable per role
