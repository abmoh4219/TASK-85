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
npx jest --config ./test/jest-e2e.json --testPathPattern="\.e2e-spec\.ts$" --runInBand --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "--- Frontend Unit Tests ---"
cd /app/frontend
npx vitest run --passWithNoTests 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
