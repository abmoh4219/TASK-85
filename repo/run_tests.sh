#!/bin/sh
# MeridianMed Test Suite — Docker only.
# Runs all four categories: backend unit, backend API, frontend unit, frontend e2e.
# Exit 0 = all pass; non-zero = at least one failed.
set -e

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install: https://docs.docker.com/get-docker/" >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon not running." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

DC="docker compose"
$DC version >/dev/null 2>&1 || DC="docker-compose"

echo "========================================"
echo "  MeridianMed Test Suite"
echo "========================================"

# Clean up any stale containers from previous runs
$DC --profile test down -v >/dev/null 2>&1 || true

# Build all test-profile images
echo ""
echo "--- Building images ---"
$DC --profile test build

# Start supporting services (postgres-test, backend-test, frontend-test)
echo ""
echo "--- Starting test services ---"
$DC --profile test up -d postgres-test backend-test frontend-test

FAILED=0

# 1+2) Backend tests (unit + API) — runs inside backend test target
echo ""
echo "=== [1-2/4] Backend Unit + API Tests ==="
$DC --profile test run --rm backend-tests || FAILED=1

# 3+4) Frontend tests (vitest unit + Playwright e2e) — runs inside frontend test target
echo ""
echo "=== [3-4/4] Frontend Unit + E2E Tests ==="
$DC --profile test run --rm frontend-tests || FAILED=1

# Cleanup
echo ""
echo "--- Stopping test services ---"
$DC --profile test down -v >/dev/null 2>&1 || true

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
