# MeridianMed Supply & Lab Operations Platform

## Run
```bash
docker compose up --build
```
Frontend: https://localhost:3000 (self-signed cert — accept browser warning)
Backend API: https://localhost:3000/api (proxied through nginx)

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
