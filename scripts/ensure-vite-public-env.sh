#!/usr/bin/env bash
# Non-secret Vite placeholders when public env is unset (CI checkout has no .env).
# Does not override variables already in the environment (including a local Lovable .env).
# Never sets Stripe/Core secrets. Do not delete a local .env — just never commit it.
set -euo pipefail

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
