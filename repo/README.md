# MeridianMed Supply & Lab Operations Platform

On-premise platform for hospitals and outpatient clinics that manages medical
supply procurement, lab testing documentation, inventory alerts, project/task
execution, HR learning plans, and a versioned business rules engine. Users
sign in with a local account and are routed to role-specific workflows for
Employees, Supervisors, HR, and Administrators.

## Architecture & Tech Stack

* **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + TanStack Query + React Router v6 + React Hook Form + Zod
* **Backend:** NestJS 10 (Node.js 20 + TypeScript) with TypeORM, Passport JWT, class-validator, Helmet, @nestjs/throttler, @nestjs/schedule, Winston structured logging
* **Database:** PostgreSQL 15 (TypeORM migrations + seeder, AES-256 column encryption for sensitive fields, soft deletes)
* **Containerization:** Docker & Docker Compose (Required)

## Project Structure

```
repo/
├── backend/                         NestJS API
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── common/                  guards, decorators, filters, transformers
│   │   ├── config/
│   │   ├── database/                data-source, migrations, seeder
│   │   └── modules/
│   │       ├── auth/                login, JWT, refresh tokens
│   │       ├── users/
│   │       ├── procurement/         request → RFQ → PO → receive → reconcile
│   │       ├── inventory/           items, stock, alerts, recommendations
│   │       ├── lab/                 test dictionary, samples, results, reports
│   │       ├── projects/            projects, tasks, milestones, deliverables
│   │       ├── learning/            HR learning plans & lifecycle
│   │       ├── rules-engine/        versioned rules, rollout, rollback
│   │       ├── notifications/
│   │       └── admin/
│   ├── tests/
│   │   ├── unit_tests/              isolated service-layer unit tests
│   │   └── api_tests/               HTTP endpoint tests against real PostgreSQL
│   ├── Dockerfile
│   └── Dockerfile.test
├── frontend/                        React SPA
│   ├── src/
│   │   ├── features/                auth, dashboard, procurement, inventory,
│   │   │                            lab, projects, learning, rules-engine, admin
│   │   ├── components/              shared UI (shadcn/ui)
│   │   ├── hooks/
│   │   ├── lib/                     api client, utils, id masking
│   │   └── types/
│   ├── tests/
│   │   └── unit_tests/              vitest unit tests
│   └── Dockerfile
├── docker-compose.yml               all services (runtime + `test` profile)
├── nginx.conf
├── run_tests.sh                     Docker-only test entrypoint
└── README.md
```

## Prerequisites

* Docker
* Docker Compose

## Running the Application

1. **Build and start the containers:**

   ```bash
   docker compose up --build
   ```

   The Docker setup service automatically provisions the database, runs
   TypeORM migrations, and seeds the four default users on first run.
   No manual `.env` configuration is required. If you want to override
   defaults manually:

   ```bash
   cp .env.example .env
   ```

2. **Access the app:**

   * Frontend (React SPA): [http://localhost:3000](http://localhost:3000)
   * Backend API:          [http://localhost:4000](http://localhost:4000)
   * Backend health check: [http://localhost:4000/health](http://localhost:4000/health)

3. **Stop the application:**

   ```bash
   docker compose down -v
   ```

## Testing

All tests run inside Docker via a single script. No local Node, Postgres, or
other runtime is required on the host — the only requirement is Docker.

Make the script executable and run it:

```bash
chmod +x run_tests.sh
./run_tests.sh
```

The script spins up an isolated PostgreSQL instance and a test-runner
container, then executes:

* **Backend unit tests** — `backend/tests/unit_tests/` (service-layer, mocked dependencies, with coverage)
* **Backend API tests**  — `backend/tests/api_tests/` (real HTTP + real PostgreSQL, with coverage)
* **Frontend unit tests** — `frontend/tests/unit_tests/` (pure functions, hooks, component logic via Vitest)

Exit code `0` means all tests passed; non-zero means one or more suites
failed. The script is CI/CD friendly.

## Seeded Credentials

The seeder creates four users (one per role) on first startup. All four share
the same password.

| Role          | Username     | Password       | Notes                                                                                   |
|---------------|--------------|----------------|-----------------------------------------------------------------------------------------|
| Administrator | `admin`      | `meridian2024` | Configures catalogs, business rules, users, security, and export policies.             |
| Supervisor    | `supervisor` | `meridian2024` | Reviews exceptions, approves purchase requests and work, handles the anomaly queue.    |
| HR            | `hr`         | `meridian2024` | Owns learning plans, goals, study-frequency rules, and lifecycle transitions.          |
| Employee      | `employee`   | `meridian2024` | Creates purchase requests, submits lab samples, and works tasks / deliverables.        |
