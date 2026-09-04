#!/usr/bin/env bash
# Non-secret Vite placeholders when public env is unset (CI / audit without .env).
# Does not override variables already in the environment. Never sets Stripe/Core secrets.
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
