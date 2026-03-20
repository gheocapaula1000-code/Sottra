#!/usr/bin/env bash
# verify-package.sh — Verify dist/ is clean for delivery
set -euo pipefail

EXIT=0

echo "── Checking dist/ exists..."
if [ ! -d dist ]; then
  echo "❌ dist/ missing — run build first"
  exit 1
fi

echo "── Checking dist/ for .env leaks..."
if find dist -name '.env*' 2>/dev/null | grep -q .; then
  echo "❌ .env file found in dist/"
  EXIT=1
else
  echo "✅ No .env in dist/"
fi

echo "── Checking dist/ for source maps with secrets..."
if grep -rl 'sk_live_\|sk_test_\|STRIPE_SECRET' dist/ 2>/dev/null; then
  echo "❌ Secret pattern found in dist/"
  EXIT=1
else
  echo "✅ dist/ is clean"
fi

echo "── Verifying build artifacts..."
test -f dist/index.html || { echo "❌ index.html missing"; EXIT=1; }
echo "✅ Build artifacts present"

if [ $EXIT -eq 0 ]; then
  echo "✅ Package verification passed"
else
  echo "❌ Package verification FAILED"
fi
exit $EXIT
