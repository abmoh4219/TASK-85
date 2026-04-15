#!/bin/sh
# MeridianMed test runner.
#
# Same script serves two modes:
#   • HOST mode (outside Docker): requires only Docker. Spins up the test
#     profile from docker-compose.yml and re-invokes itself inside the
#     test-runner container.
#   • CONTAINER mode (inside Docker): runs jest (backend unit + API) and
#     vitest (frontend unit) directly against the live test database.
#
# Exit code: 0 = all suites passed; non-zero = at least one suite failed.
set -e

# ─────────────────────────────────────────────────────────────
# Detect mode: inside Docker if /.dockerenv exists OR $IN_CONTAINER=1.
# ─────────────────────────────────────────────────────────────
if [ -f /.dockerenv ] || [ "$IN_CONTAINER" = "1" ]; then
  MODE="container"
else
  MODE="host"
fi

# ═════════════════════════ HOST MODE ═════════════════════════
if [ "$MODE" = "host" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is required but not installed." >&2
    echo "Install Docker: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running or not accessible." >&2
    echo "Start Docker and try again. See https://docs.docker.com/get-docker/" >&2
    exit 1
  fi

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  cd "$SCRIPT_DIR"

  echo "========================================"
  echo "  MeridianMed Test Suite (Docker)"
  echo "========================================"

  if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
  else
    DC="docker-compose"
  fi

  $DC --profile test run --build --rm test
  EXIT=$?

  $DC --profile test down -v >/dev/null 2>&1 || true
  exit $EXIT
fi

# ═══════════════════════ CONTAINER MODE ══════════════════════
echo "========================================"
echo "  MeridianMed Test Suite"
echo "========================================"

FAILED=0

echo ""
echo "--- Backend Unit Tests (with coverage) ---"
cd /app/backend
./node_modules/.bin/jest \
  --testPathPattern="tests/unit_tests/.*\.spec\.ts$" \
  --coverage \
  --forceExit --ci 2>&1 || FAILED=1

echo ""
echo "--- Backend API/E2E Tests against real PostgreSQL (with coverage) ---"
./node_modules/.bin/jest \
  --config ./tests/api_tests/jest-e2e.json \
  --coverage \
  --runInBand --forceExit --ci 2>&1 || FAILED=1

echo ""
echo "--- Frontend Unit Tests (with coverage) ---"
cd /app/frontend
./node_modules/.bin/vitest run --coverage 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
