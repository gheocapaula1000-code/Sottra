# Sottra — Subscription Failsafe

## Principle

Stripe is treated as an **optional enhancement**. The app must never crash, hang, or show broken UI if Stripe is not configured or unreachable.

## Admin Bootstrap (ADMIN_BOOTSTRAP_EMAILS)

The `ADMIN_BOOTSTRAP_EMAILS` secret (comma-separated emails, server-side only) provides a **break-glass mechanism** for permanent owner/admin access:

1. On each `check-subscription` call, if the authenticated user's email matches the allowlist:
   - A record is upserted into `owner_access` (owner entitlements)
   - A record is upserted into `user_roles` with `role=admin` (RBAC admin)
   - Both operations are idempotent (ON CONFLICT DO NOTHING)
2. The response returns `is_owner: true`, `is_admin: true`, `subscribed: true`
3. These accounts bypass all trial limits, plan restrictions, and billing gates
4. **No client-side exposure** — the allowlist is never sent to the frontend

### Current bootstrap accounts
- `gheocapaula1000@gmail.com`
- `massimilianogalli75@gmail.com`

## Defensive Architecture

### Edge Function: `check-subscription`

1. **Always returns HTTP 200** with a stable JSON envelope
2. **Bootstrap check runs first** — before owner, admin, trial, or Stripe
3. **Owner bypass** (table-based) — `is_owner: true`, `is_admin: false`, `subscribed: true`
4. **Admin bypass** (RBAC) — `is_admin: true`, `subscribed: true`
5. **Stripe is checked last** — only if `STRIPE_SECRET_KEY` is set
6. **If Stripe fails**: Error logged, subscription defaults to `false`, trial still works

### Edge Functions: `create-checkout`, `customer-portal`

- Return clear error if Stripe is not configured
- Frontend handles error gracefully (toast, not crash)

### Frontend: `SubscriptionContext`

1. **Never hangs on loading**: `applyDefaults(true)` resolves access even on errors
2. **`checked` flag**: Guards paywall display — never shows paywall from default/error state
3. **Periodic refresh**: Every 60s, with session expiry check
4. **Network failure tolerance**: `invoke()` errors caught and logged

### Trial Independence

- Trial managed via `user_trials` table, independent of Stripe
- Auto-created on first subscription check if missing
- Provides scan access even when Stripe is completely absent

### Boot Resilience

- `main.tsx` catches missing root element and render exceptions
- User-friendly Italian fallback with retry button
- `ErrorBoundary` wraps the entire app tree

## Configuration States

| STRIPE_SECRET_KEY | Behavior |
|---|---|
| Set + valid | Full subscription checking |
| Set + invalid | Stripe errors logged, trial-only access |
| Not set | Stripe skipped entirely, trial-only access |

| ADMIN_BOOTSTRAP_EMAILS | Behavior |
|---|---|
| Set with emails | Matching users get permanent owner+admin access |
| Empty or not set | No bootstrap, normal access flow applies |
