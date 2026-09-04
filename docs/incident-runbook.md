# Sottra — Incident Runbook

## Severity Levels

| Level | Description | Response Time |
|---|---|---|
| P1 | App completely unusable (blank screen, auth broken) | Immediate |
| P2 | Core feature broken (scan fails, report empty) | < 2 hours |
| P3 | Minor feature degraded (one report section missing) | < 24 hours |
| P4 | Cosmetic / non-blocking | Next release |

## Common Incidents

### 1. App Shows Blank Screen (P1)

**Symptoms**: Black/empty page on https://sottra.app, or white page after login

**Diagnosis**:
1. Check browser console for `supabaseUrl is required` — means `VITE_SUPABASE_URL` was empty at **build** time
2. Check live JS (`/assets/index-*.js`) for `https://<project-ref>.supabase.co` (must not be missing or `example.supabase.co`)
3. Check if `check-subscription` returns HTTP 200
4. Check if SubscriptionContext resolves

**Resolution**:
- If live JS lacks `vveunbxfcfhnkkhrqutf`: the publish did not include source fallbacks — merge the client.ts fallback PR and republish
- If `supabaseUrl is required`: old bundle with top-level `createClient(undefined)` — republish this hardening (env-or-fallback, never throw at import)
- After this hardening: empty Vite env uses the Sottra Cloud publishable (anon) fallback; missing config shows Italian ErrorBoundary / `main.tsx` fallback, never a blank page
- If auth error: verify Supabase project is online
- If subscription hang: check edge function logs for `check-subscription`
- If JS error: check latest deploy, consider rollback

### 2. Scan Returns No Data (P2)

**Symptoms**: Scan completes but report is empty

**Diagnosis**:
1. Check `/admin/diagnostics` for Core health
2. Check edge function logs for `core-proxy`
3. Verify `CORE_API_URL` and `AI_CORE_SECRET`

**Resolution**:
- If Core is down: wait for Central Core recovery
- If credentials wrong: update secrets in Lovable Cloud
- If timeout: Core may be overloaded, retry later

### 3. Trial Credits Not Decrementing (P3)

**Symptoms**: User scans but `scans_used` stays the same

**Diagnosis**:
1. Check `scan_events` for the scan_id
2. Check `record_scan` function logs
3. Verify unique constraint on `scan_events(user_id, scan_id)`

**Resolution**:
- If duplicate scan_id: expected behavior (idempotent)
- If function error: check `user_trials` row exists for user

### 4. Stripe Checkout Fails (P3)

**Symptoms**: "Upgrade" button does nothing or shows error

**Diagnosis**:
1. Check if `STRIPE_SECRET_KEY` is configured
2. Check `create-checkout` function logs
3. Verify Stripe account is active

**Resolution**:
- If key missing: app should degrade gracefully (show info, not crash)
- If Stripe API error: check Stripe dashboard for issues
- Frontend should show toast error, not crash

### 5. Offline Banner Stuck (P4)

**Symptoms**: "Sei offline" banner shows even with connection

**Diagnosis**:
1. Check `navigator.onLine` in browser console
2. May be browser-specific false negative

**Resolution**:
- Banner auto-clears on `online` event
- If stuck: reload the page

## Escalation

- Edge function issues → Check logs in Lovable Cloud
- Database issues → Check Lovable Cloud backend view
- Central Core issues → Contact Core team
- Stripe issues → Check Stripe dashboard
