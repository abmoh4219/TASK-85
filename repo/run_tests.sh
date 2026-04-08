#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  MeridianMed Test Suite"
echo "========================================"

# ── Environment defaults (needed when running on host outside Docker) ──
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-dev-only-encryption-key-change-me-in-prod}"
export JWT_SECRET="${JWT_SECRET:-dev-only-jwt-secret-do-not-use-in-production}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5434}"
export DB_NAME="${DB_NAME:-meridianmed}"
export DB_USER="${DB_USER:-meridian}"
export DB_PASSWORD="${DB_PASSWORD:-dev-only-password-change-in-production}"
export NODE_ENV="${NODE_ENV:-test}"

FAILED=0

# ── Backend ──────────────────────────────────────────────
cd "$SCRIPT_DIR/backend"
[ -d node_modules ] || npm install --ignore-scripts 2>&1

echo ""
echo "--- Backend Unit Tests ---"
./node_modules/.bin/jest --testPathPattern="\.spec\.ts$" --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "--- Backend Integration/E2E Tests (Real DB) ---"
./node_modules/.bin/jest --config ./test/jest-e2e.json --testPathPattern="\.e2e-spec\.ts$" --runInBand --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

# ── Frontend ─────────────────────────────────────────────
cd "$SCRIPT_DIR/frontend"
[ -d node_modules ] || npm install --ignore-scripts 2>&1

echo ""
echo "--- Frontend Unit Tests ---"
./node_modules/.bin/vitest run --passWithNoTests 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
