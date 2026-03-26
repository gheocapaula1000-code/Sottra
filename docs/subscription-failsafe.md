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

## Defensive Architecture

### Edge Function: `check-subscription`

1. **Always returns HTTP 200** with a stable JSON envelope
2. **Bootstrap check runs first** — before owner, admin, trial, or Stripe
3. **Owner bypass** (table-based) — `is_owner: true`, `is_admin: false`, `subscribed: true`
4. **Admin bypass** (RBAC) — `is_admin: true`, `subscribed: true`
5. **DB subscription check** — source of truth from `subscriptions` table; valid statuses: `active`, `trialing`
6. **Stripe is checked last** — only as fallback if `isBillingActive()` returns `true` and DB has no useful record
7. **`billing_active` flag** — returned in response; true only when `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `ALLOWED_ORIGINS` are all set
8. **If Stripe fails**: Error logged, subscription defaults to `false`, trial still works

### Edge Functions: `create-checkout`, `customer-portal`

- Return clear error if Stripe is not configured
- `create-checkout` blocks duplicate subscriptions (409 if `active`/`trialing`/`past_due` exists)
- `create-checkout` directs `past_due` users to Customer Portal instead of creating new checkout
- Frontend handles errors gracefully (toast, not crash)

### Edge Function: `record-scan`

- Uses DB `subscriptions` table as primary source of truth (valid: `active`, `trialing`)
- Falls back to Stripe customer lookup via `stripe_customer_id` from DB
- Email lookup is a last-resort fallback only when `stripe_customer_id` is not available

### Frontend: `SubscriptionContext`

1. **Never sends paying users to paywall on transient errors**:
   - **Existing state available**: Keeps last-known state and sets `stale: true`
   - **First boot (no prior state)**: Sets `bootFailed: true` — gate shows retry UI, **never** `TrialExpiredScreen`
2. **`accessResolved` and `checked` remain `false` on first-boot transient errors** — this prevents `AppDashboardGate` from rendering paywall based on default (unsubscribed) state
3. **`bootFailed` flag**: Enables the gate to distinguish between "genuine no access" and "unknown due to error"
4. **First-boot retry**: `AppDashboardGate` shows a retry button when `bootFailed` is true
5. **`checked` flag**: Guards paywall display — set to `true` only on successful response or genuine logout/no-session
6. **Periodic refresh**: Every 60s, with session expiry check
7. **Network failure tolerance**: `invoke()` errors caught and logged
8. **`canScan`**: `true` only for `active`/`trialing` subscriptions or active trial
9. **`canManageBilling`**: Also includes `past_due` (so user can fix payment via portal)

### `isBillingActive()` / `isBillingReady()`

- **Server-side** (`_shared/billing.ts`): Returns `true` only when all three secrets are configured:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `ALLOWED_ORIGINS`
- **Client-side** (`src/lib/billing.ts`): Runtime flag set by `SubscriptionContext` from `billing_active` response field.
  - **Successful response with `billing_active=true`**: `billingReady` set to `true`
  - **Successful response with `billing_active=false`** (hard-disabled): `billingReady` set to `false` — CTAs hidden
  - **First-boot transient error** (no prior state): `billingReady` set to `false` — no CTAs shown
  - **Subsequent transient error** (prior valid state exists): `billingReady` **preserved** — portal CTAs remain visible so past_due users can still manage their subscription

### Trial Independence

- Trial managed via `user_trials` table, independent of Stripe
- Auto-created on first subscription check if missing
- Provides scan access even when Stripe is completely absent

### Boot Resilience

- `main.tsx` catches missing root element and render exceptions
- User-friendly Italian fallback with retry button
- `ErrorBoundary` wraps the entire app tree
- **First-boot check-subscription failures** show retry UI, never paywall

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

## Required Secrets for Billing

| Secret | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API authentication |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `ALLOWED_ORIGINS` | CORS allowlist and return URL resolution |
