#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  MeridianMed Test Suite"
echo "========================================"

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
