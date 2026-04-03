
# SPEC.md — MeridianMed Supply & Lab Operations Platform
# Task ID: w2t85
# This is the single source of truth. All decisions trace back to this file.

## Original Business Prompt (Verbatim — Do Not Modify)

A MeridianMed Supply & Lab Operations platform capable of running entirely on-premise supports hospitals and outpatient clinics in managing medical supply procurement, lab testing documentation, and internal work execution with clear accountability. Users sign in on a React web interface using local username and password and are routed by role: Employees create purchase requests, submit lab sample intake details, and start tasks; Supervisors review exceptions and approve work; HR maintains learning plans tied to role readiness; Administrators configure catalogs, rules, and security. Procurement is presented as a guided flow from request to RFQ-style price comparison, purchase order issuance, receiving and inspection, put-away, and reconciliation, with side-by-side vendor quotes, locked unit pricing for 30 days after PO approval, and support for partial deliveries, backorders, and approved substitutes when the original item is unavailable. Smart alerts appear in the dashboard and item pages, including safety stock breaches, min/max violations, near-expiration warnings starting 45 days before expiration, and abnormal consumption flags when 7-day usage exceeds the prior 8-week average by 40% or more; users can accept system-generated replenishment recommendations and auto-draft a purchase request sized to cover lead time plus a configurable buffer (default 14 days). Lab staff manage test item dictionaries and reference ranges, move samples through submission and reporting statuses, enter results with automatic abnormal flags, and archive reports with a visible, traceable edit history. Operational work is tracked as projects and tasks across initiation, change, inspection, final acceptance, and archive, with milestone progress, deliverable submission, and acceptance scoring; HR-led learning plans model goals, priority, tags, and study frequency rules (for example, "3 sessions/week") with enforced lifecycle states from not started through archived.

The backend uses NestJS to expose decoupled REST-style APIs consumed by the React client over local network only, enforcing RBAC down to action level for employee/supervisor/HR/admin and issuing authenticated sessions using JWT with short-lived access tokens (15 minutes) and rotating refresh tokens (8 hours) stored server-side for offline control. PostgreSQL persists procurement documents, inventory movements, lab report versions, task/audit trails, learning plan lifecycles, and recommendation feedback (impressions and clicks) for an on-prem closed loop; all data at rest is encrypted using AES-256 with per-environment keys, and all traffic uses TLS even within the LAN. Face-related fields, if captured for internal identity checks, are minimized to non-reconstructable templates, masked by default in the UI (only last 4 characters of any identifier shown), and never exposed via export unless explicitly permitted by admin policy. Risk controls include nonce and timestamp validation to deter replay, rate limits such as 10 sensitive actions per minute per user, and anomaly rules that queue suspicious bursts for supervisor review. A built-in rules engine stores versioned business rules for procurement thresholds, cancellation/change/refund behaviors, parsing/cleaning rules for inbound files, and pricing constraints; each release supports conflict validation, staged gray rollout/A-B comparisons within a site, hot updates, rollback within 5 minutes, and automatic impact assessment that reports which workflows and thresholds will change before activation.

## Project Metadata

- Task ID: w2t85
- Project Type: fullstack
- Language: TypeScript (frontend + backend)
- Frontend: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: NestJS (Node.js + TypeScript)
- Database: PostgreSQL
- Infrastructure: Docker + docker-compose (everything runs in containers)
- Network: Local/on-premise only — no external internet dependencies at runtime

> PRIORITY RULE: The original business prompt above takes absolute priority over metadata.
> Metadata supports the prompt — it never overrides it.

## Roles (from prompt)

| Role | Key Responsibilities |
|---|---|
| Employee | Create purchase requests, submit lab sample intake, start tasks |
| Supervisor | Review exceptions, approve work, review anomaly queue |
| HR | Maintain learning plans tied to role readiness |
| Administrator | Configure catalogs, rules, security, export permissions |

## Core Modules (from prompt)

1. Authentication & RBAC — JWT (15min access + 8hr rotating refresh), server-side session control, RBAC to action level
2. Procurement — Request → RFQ/Quote comparison → PO issuance → Receiving/Inspection → Put-away → Reconciliation
3. Inventory & Alerts — Safety stock, min/max, near-expiration (45 days), abnormal consumption (7-day vs 8-week avg +40%), replenishment recommendations
4. Lab Operations — Test item dictionaries, reference ranges, sample lifecycle, result entry with abnormal flags, report versioning with edit history
5. Work & Project Tracking — Projects/tasks across initiation/change/inspection/final acceptance/archive, milestones, deliverables, acceptance scoring
6. Learning Plans (HR) — Goals, priority, tags, study frequency rules, lifecycle states (not started → archived)
7. Rules Engine — Versioned business rules, conflict validation, gray rollout/A-B, hot updates, rollback <5min, impact assessment
8. Security & Risk Controls — AES-256 at rest, TLS in transit, nonce/timestamp anti-replay, rate limiting (10 sensitive actions/min/user), anomaly queue
9. Recommendation Feedback — Impressions and clicks tracking for replenishment recommendations (closed-loop)

## Acceptance Criteria (QA Self-Test Standard)

The project must pass all of the following — these are the exact criteria used by the QA self-test:

### 1. Hard Gates
- Clear startup instructions (docker compose up --build only — no manual steps)
- Runs without modifying core code after git clone
- Runtime behavior matches documentation

### 2. Delivery Completeness
- All 9 core modules implemented end-to-end
- No mock/hardcoded data in place of real logic
- Complete project structure (not fragments)
- README present and accurate

### 3. Engineering & Architecture Quality
- Clear module separation (NestJS modules, React feature folders)
- No god files, no single-file stacking
- Maintainable and extensible structure

### 4. Engineering Details & Professionalism
- Reliable error handling (standard HTTP codes + JSON error bodies)
- Structured logging (no random console.log)
- Input validation on all endpoints (class-validator)
- Real product shape — not a demo

### 5. Prompt Fit
- Every business rule from the prompt implemented (pricing lock 30 days, 45-day expiry warning, 40% consumption flag, 14-day buffer default, 15min JWT, 8hr refresh, 5min rollback, etc.)
- No silent substitution or weakening of requirements

### 6. UI Aesthetics (full-stack)
- Modern SaaS quality (think Linear, Vercel, Notion)
- Consistent layout, spacing, typography
- Loading, empty, error states on every page
- Interaction feedback (hover, click, disabled states)

## Non-Negotiable Delivery Rules

- docker compose up --build → app runs at http://localhost:3000 (frontend) + http://localhost:4000 (backend)
- docker compose run --build test → all tests run, exit code 0 = pass
- run_tests.sh exists at repo/ root, is executable (chmod +x), called by Dockerfile.test — never run locally
- All API tests use REAL PostgreSQL database and REAL NestJS server — zero mocks
- All UI data comes from real backend API calls — zero hardcoded/seeded-only display data
- Minimal README: Run / Test / Stop / Login only
- .gitignore covers node_modules/, dist/, .env*, *.log, postgres-data/
- No .env manual setup required — all defaults work out of the box via docker-compose
