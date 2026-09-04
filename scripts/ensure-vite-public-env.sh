#!/usr/bin/env bash
# Non-secret Vite placeholders when public env is unset (CI checkout has no .env).
# For tests / local vitest only. NEVER source this during production packaging
# (`npm run verify:package` / Lovable publish) — placeholders would hide a missing
# VITE_SUPABASE_URL and ship a dead bundle (black screen on sottra.app).
# Does not override variables already in the environment (including a local Lovable .env).
# Never sets Stripe/Core secrets. Do not delete a local .env — just never commit it.
set -euo pipefail

if [ "${VERIFY_PRODUCTION_SUPABASE:-}" = "1" ]; then
  echo "ensure-vite-public-env.sh: refusing to inject placeholders (VERIFY_PRODUCTION_SUPABASE=1)" >&2
  return 0 2>/dev/null || exit 0
fi

if [ -z "${VITE_SUPABASE_URL:-}" ]; then
  export VITE_SUPABASE_URL="https://example.supabase.co"
fi
if [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  export VITE_SUPABASE_PUBLISHABLE_KEY="test-publishable-key"
fi
if [ -z "${VITE_SUPABASE_PROJECT_ID:-}" ]; then
  export VITE_SUPABASE_PROJECT_ID="test-project-id"
fi
if [ -z "${VITE_USE_MOCK:-}" ]; then
  export VITE_USE_MOCK="false"
fi
