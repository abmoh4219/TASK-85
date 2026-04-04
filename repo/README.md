# MeridianMed Supply & Lab Operations Platform

## Run
```bash
docker compose up --build
```
Frontend: http://localhost:3000
Backend API: http://localhost:4000

## Test
```bash
docker compose -f docker-compose.test.yml run --build test-runner
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
