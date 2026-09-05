# Sottra — Restore & Verification Procedures

## Verification Status Definitions

- **✅ Verified** — Automated test or script confirms the condition.
- **🔍 Manual** — Requires human verification (smoke test, visual check).
- **❌ Not Verified** — No automated check exists; must be added or performed manually.

---

## After Code Restore / Rollback

| Check | Method | Status |
|-------|--------|--------|
| Build succeeds | `npm run build` | ✅ Automated (CI) |
| All tests pass | `npm test` | ✅ Automated (CI) |
| Type safety | `npm run typecheck` | ✅ Automated (CI) |
| config.toml JWT settings | `verify_jwt = false` for all functions | ✅ Verified in repo |
| .env contains only `VITE_SUPABASE_*` | Lovable-managed, not editable | ✅ Platform-managed |
| No secrets in source | `verify:secrets` script | ✅ Automated (CI) |
| No secrets in dist/ | `verify:package` script | ✅ Automated (CI) |
| Required secrets present | Manual check in Lovable Cloud | 🔍 Manual |

### Required Secrets (verify in Lovable Cloud)

| Secret | Required | Purpose |
|--------|----------|---------|
| `CORE_API_URL` | Yes | Central Core endpoint |
| `CORE_API_KEY` (or `AI_CORE_SECRET_SOTTRA` / `AI_CORE_SECRET`) | Yes | Central Core auth. Rotate if the historical `VITE_CORE_API_KEY` leak is still live — [`docs/core-secret-rotation.md`](./core-secret-rotation.md) |
| `ADMIN_BOOTSTRAP_EMAILS` | Yes | Owner/admin bootstrap |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin DB operations |
| `COMMERCIAL_BYPASS_EMAILS` | Yes | Commercial access bypass |
| `STRIPE_SECRET_KEY` | Optional | Billing (UI auto-detects) |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook signature |
| `ALLOWED_ORIGINS` | Optional | CORS allowlist + Stripe return URLs |

## After Database Schema Change

| Check | Verification |
|-------|-------------|
| `user_trials` has required columns | `psql` or Lovable Cloud backend view |
| `scan_events` unique constraint on `(user_id, scan_id)` | Check via `\d scan_events` |
| `user_roles` table with `app_role` enum | Check via `\d user_roles` |
| `has_role()` SECURITY DEFINER function | `\df has_role` |
| `record_scan()` SECURITY DEFINER function | `\df record_scan` |
| `is_owner()` SECURITY DEFINER function | `\df is_owner` |
| `handle_new_user_trial()` trigger on `auth.users` | Check trigger list |

## Smoke Test Sequence (🔍 Manual)

1. Open app → landing page loads without JS errors
2. Login with bootstrap account → dashboard loads
3. Check admin panel access → `/admin/diagnostics` reachable
4. Navigate to `/scan` → camera/photo works
5. Complete scan → report renders with real data
6. Verify primary zone basis ≠ comunale when zone data exists
7. Save to history → appears in `/history`
8. Logout → redirect to login

## Edge Function Health Verification

```bash
# Requires valid Bearer token
# Check core-proxy
curl -s -X POST https://<project>.supabase.co/functions/v1/core-proxy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/health","method":"GET"}' | jq .

# Check diagnostics (admin only)
curl -s https://<project>.supabase.co/functions/v1/diagnostics \
  -H "Authorization: Bearer <token>" | jq .

# Check subscription
curl -s https://<project>.supabase.co/functions/v1/check-subscription \
  -H "Authorization: Bearer <token>" | jq .ok
```

## Known Recovery Scenarios

| Issue | Diagnosis | Resolution | Verified |
|-------|-----------|------------|----------|
| Blank dashboard | `check-subscription` not returning HTTP 200 | Check edge function logs | ✅ SubscriptionContext has fallback |
| Scan credits not counting | `record_scan` function error | Verify `scan_events` unique constraint | ✅ Idempotent by design |
| Trial not created | `handle_new_user_trial` trigger missing | Check trigger; `check-subscription` auto-creates | ✅ Resilience fallback |
| Core proxy 503 | `CORE_API_URL` or `CORE_API_KEY` missing | Update secrets in Lovable Cloud | ✅ Graceful 503 response |
| Owner bypass not working | `isOwnerEmail()` used instead of `isOwnerById()` | Fixed: all functions now use table-based check | ✅ Fixed |
| Stripe checkout fails | `STRIPE_SECRET_KEY` missing | `isBillingActive()` returns false, CTA hidden | ✅ Graceful degradation |
| Chunk load error after deploy | Stale SW cache | `recoverFromChunkError()` clears cache + reloads | ✅ Automated recovery |
