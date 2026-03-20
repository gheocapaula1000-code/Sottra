# Sottra — Restore & Verification Procedures

## After Code Restore / Rollback

1. **Verify build**: `npm run build` must succeed
2. **Run tests**: `npm test` — all must pass
3. **Check config.toml**: Ensure edge function JWT settings are `verify_jwt = false`
4. **Check .env**: Only contains `VITE_SUPABASE_*` and `VITE_USE_MOCK=false`
5. **Verify secrets**: All required secrets exist in Lovable Cloud:
   - `CORE_API_URL`
   - `AI_CORE_SECRET` or `CORE_API_KEY`
   - `STRIPE_SECRET_KEY` (optional)
   - `SUPABASE_SERVICE_ROLE_KEY`

## After Database Schema Change

1. Verify `user_trials` table has columns: `user_id, scans_used, max_scans, trial_end, trial_start`
2. Verify `scan_events` table has unique constraint on `(user_id, scan_id)`
3. Verify `user_roles` table exists with `app_role` enum
4. Verify `has_role()` function exists (SECURITY DEFINER)
5. Verify `record_scan()` function exists (SECURITY DEFINER)
6. Verify `handle_new_user_trial()` trigger on `auth.users`

## Smoke Test Sequence

1. Open app → landing page loads
2. Login with test account
3. Dashboard loads without errors
4. Navigate to `/scan`
5. Take photo → identification starts
6. Report renders with real data sections
7. Save to history → appears in `/history`
8. Admin: access `/admin/diagnostics` → Core status visible

## Edge Function Health

```bash
# Check core-proxy
curl -X POST https://<project>.supabase.co/functions/v1/core-proxy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/health","method":"GET"}'

# Check diagnostics
curl https://<project>.supabase.co/functions/v1/diagnostics \
  -H "Authorization: Bearer <token>"
```

## Known Recovery Scenarios

| Issue | Resolution |
|---|---|
| Blank dashboard | Check SubscriptionContext — verify `check-subscription` returns HTTP 200 |
| Scan credits not counting | Verify `record_scan` function and `scan_events` unique constraint |
| Trial not created | Check `handle_new_user_trial` trigger on `auth.users` |
| Core proxy 503 | Verify `CORE_API_URL` and `AI_CORE_SECRET` secrets |
