#!/usr/bin/env bash
# verify-secrets.sh — Fail if real .env files or leaked secrets exist in the repo
set -euo pipefail

EXIT=0

# 1. Check for real .env files (allow only .env.example)
echo "── Checking for real .env files..."
while IFS= read -r f; do
  case "$f" in
    .env.example) continue ;;
    *)
      echo "❌ BLOCKED: $f — real env file must not be in repo/package"
      EXIT=1
      ;;
  esac
done < <(find . -maxdepth 2 -name '.env*' -not -path './node_modules/*' -not -path './dist/*' 2>/dev/null || true)

# 2. Scan source for leaked secrets patterns
echo "── Scanning source for hardcoded secrets..."
PATTERNS='sk_live_|sk_test_|STRIPE_SECRET|Bearer eyJ|-----BEGIN (RSA |EC )?PRIVATE KEY'
if grep -rE "$PATTERNS" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
   --exclude-dir=node_modules --exclude-dir=dist --exclude='package-lock.json' --exclude='bun.lock*' . 2>/dev/null; then
  echo "❌ Potential secret found in source"
  EXIT=1
else
  echo "✅ No hardcoded secrets detected"
fi

# 3. Verify .env.example has no real values
echo "── Checking .env.example for real values..."
if grep -E 'eyJ[a-zA-Z0-9]' .env.example 2>/dev/null; then
  echo "❌ .env.example contains what looks like a real JWT"
  EXIT=1
else
  echo "✅ .env.example is clean"
fi

if [ $EXIT -eq 0 ]; then
  echo "✅ All secret checks passed"
else
  echo "❌ Secret verification FAILED"
fi
exit $EXIT
