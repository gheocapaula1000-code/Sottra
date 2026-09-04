#!/usr/bin/env bash
# verify-secrets.sh — Fail if real .env files or leaked secrets exist in the repo
set -euo pipefail

EXIT=0

# 1. .env must never be tracked. A local untracked .env is allowed (developer machine).
echo "── Checking that .env is not tracked..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env >/dev/null 2>&1; then
    echo "❌ BLOCKED: .env is tracked in git — remove it from the index (keep .env.example only)"
    EXIT=1
  else
    echo "✅ .env is not tracked"
  fi
fi

echo "── Checking for real .env files..."
while IFS= read -r f; do
  base=$(basename "$f")
  case "$base" in
    .env.example) continue ;;
    .env)
      # Local working copy is fine if gitignored and untracked.
      if [ "$f" = "./.env" ] || [ "$f" = ".env" ]; then
        echo "⚠️  WARNING: $f present locally (must stay gitignored; never commit)"
      else
        echo "❌ BLOCKED: $f — real env file must not be in repo/package"
        EXIT=1
      fi
      ;;
    .env.local|.env.development|.env.production|.env.staging|.env.*.local|.env.development.local|.env.production.local|.env.test.local)
      echo "❌ BLOCKED: $f — dangerous env variant must not be in repo"
      EXIT=1
      ;;
    .env*)
      echo "❌ BLOCKED: $f — real env file must not be in repo/package"
      EXIT=1
      ;;
  esac
done < <(find . -maxdepth 2 -name '.env*' -not -path './node_modules/*' -not -path './dist/*' 2>/dev/null || true)

# 2. Scan source for ACTUAL leaked secret values (not env.get references)
echo "── Scanning source for hardcoded secrets..."
PATTERNS='sk_live_[a-zA-Z0-9]|sk_test_[a-zA-Z0-9]|-----BEGIN (RSA |EC )?PRIVATE KEY'
if grep -rE "$PATTERNS" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
   --exclude-dir=node_modules --exclude-dir=dist --exclude='package-lock.json' --exclude='bun.lock*' . 2>/dev/null; then
  echo "❌ Potential secret found in source"
  EXIT=1
else
  echo "✅ No hardcoded secrets detected"
fi

# 3. Verify .env.example has no real values
echo "── Checking .env.example for real values..."
if grep -E 'eyJ[a-zA-Z0-9]{20,}' .env.example 2>/dev/null; then
  echo "❌ .env.example contains what looks like a real JWT"
  EXIT=1
else
  echo "✅ .env.example is clean"
fi

if grep -E '^(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CORE_API_KEY|SUPABASE_SERVICE_ROLE_KEY)=' .env.example 2>/dev/null; then
  echo "❌ .env.example must not assign server-side secret keys (comments only)"
  EXIT=1
else
  echo "✅ .env.example has no server-side secret assignments"
fi

# 4. Verify no owner/admin emails are hardcoded in frontend source
#    Whitelist: legalEntity.ts contains legitimate business contact emails (PEC, info@, supporto@)
echo "── Checking for hardcoded owner/admin emails in src/..."
if grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' --include='*.ts' --include='*.tsx' \
   src/lib/ src/contexts/ src/components/ src/pages/ 2>/dev/null \
   | grep -ivE 'example\.com|test\.com|@types|email.*placeholder|\.test\.|esempio\.it' \
   | grep -v 'legalEntity\.ts' \
   | grep -q '@'; then
  echo "⚠️  WARNING: Potential email address found in frontend source (review manually)"
else
  echo "✅ No hardcoded emails in frontend source"
fi

if [ $EXIT -eq 0 ]; then
  echo "✅ All secret checks passed"
else
  echo "❌ Secret verification FAILED"
fi
exit $EXIT
