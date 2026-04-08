# MeridianMed Supply & Lab Operations Platform

## Run
```bash
docker compose up --build
```
Frontend: https://localhost:3000 (self-signed cert — accept browser warning)
Backend API: https://localhost:4000 (direct, self-signed cert)
Backend Health: https://localhost:4000/health

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
