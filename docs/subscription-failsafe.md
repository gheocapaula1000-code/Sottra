# Sottra — Subscription Failsafe

## Principle

Stripe is treated as an **optional enhancement**. The app must never crash, hang, or show broken UI if Stripe is not configured or unreachable.

## Access Matrix (Definitive)

Sottra implements a three-tier access model with strict separation between admin, bypass, and standard access:

| Account | Owner | Admin | Bypass Access | Admin/Diagnostica | Notes |
|---|---|---|---|---|---|
| `gheocapaula1000@gmail.com` | ✓ | ✓ | ✓ | ✓ | Unique owner/admin via `ADMIN_BOOTSTRAP_EMAILS` |
| `matteo.ippolito@gmail.com` | ✗ | ✗ | ✓ | ✗ | Commercial bypass via `COMMERCIAL_BYPASS_EMAILS` — unlimited free access, no admin |
| `massimilianogalli75@gmail.com` | ✗ | ✗ | ✗ | ✗ | Standard user — no special privileges |

**Key rules:**
- `ADMIN_BOOTSTRAP_EMAILS` and `COMMERCIAL_BYPASS_EMAILS` are **separate** env vars — never reused for both purposes
- Commercial bypass grants `subscribed: true` but **never** `is_admin` or `is_owner`
- Email normalization (`trim().toLowerCase()`) is applied consistently everywhere

## Admin Bootstrap (ADMIN_BOOTSTRAP_EMAILS)

The `ADMIN_BOOTSTRAP_EMAILS` secret (comma-separated emails, server-side only) provides a **break-glass mechanism** for permanent owner/admin access:

1. On each `check-subscription` call, if the authenticated user's email matches the allowlist:
   - A record is upserted into `owner_access` (owner entitlements)
   - A record is upserted into `user_roles` with `role=admin` (RBAC admin)
   - Both operations are idempotent (ON CONFLICT DO NOTHING)
   - **Email is normalized** (trim + lowercase) before matching
2. The response returns `is_owner: true`, `is_admin: true`, `subscribed: true`
3. These accounts bypass all trial limits, plan restrictions, and billing gates
4. **No client-side exposure** — the allowlist is never sent to the frontend

## Commercial Bypass (COMMERCIAL_BYPASS_EMAILS)

The `COMMERCIAL_BYPASS_EMAILS` secret grants full user-facing access without admin privileges:

1. Matching users get `subscribed: true`, `is_admin: false`, `is_owner: false`
2. They bypass trial, paywall, and subscription gates
3. They **cannot** access admin panels or diagnostics
4. Email normalization is applied identically

### Current accounts
- Owner/Admin: `gheocapaula1000@gmail.com`
- Commercial Bypass: `matteo.ippolito@gmail.com`

## Error Classification

### Auth errors (NOT transient)

When `check-subscription` returns one of these codes, the local session is invalid and the user must re-authenticate:
- `auth_missing` — No Authorization header
- `auth_empty` — Empty token
- `auth_invalid` — Token verification failed
- `auth_exception` — Token verification threw an exception

**Behavior**: `SubscriptionContext` calls `supabase.auth.signOut({ scope: "local" })`, resets state, shows toast "Sessione scaduta o non valida, accedi di nuovo." The user is redirected to `/login` because the session becomes null.

**`bootFailed` is NOT set** — these errors are definitive, not retryable.

### Transient errors

Network failures, CORS issues, 5xx errors, or function unavailability. These are genuinely retryable.

**Behavior**: If prior valid state exists, it's preserved and marked `stale: true`. If it's the first boot attempt, `bootFailed: true` is set and the gate shows retry UI with diagnostic code.

### Server-side diagnostic codes (from check-subscription)

When `bootFailed` is true, the retry UI shows a machine-readable code with a human description:
- `NETWORK_ERROR` — Connection failure
- `INVOKE_ERROR` — Edge function invocation error
- `CORS_ORIGIN_BLOCKED` — Fetch failed with CORS/opaque/blocked signals
- `FUNCTION_ERROR` — Function returned an error body
- `MALFORMED_RESPONSE` — Response couldn't be parsed
- `UNEXPECTED_ERROR` — Unexpected exception
- `UNKNOWN_BOOT_FAILURE` — No specific code could be determined
- `fatal` — Server-side fatal error
- `init_error` — Server configuration error

### Client-side fallback diagnostics

When the backend is completely unreachable (CORS block, network down, function not deployed), the UI **still** shows:
1. The bootstrap error code (always non-empty — defaults to `UNKNOWN_BOOT_FAILURE`)
2. If the user clicks "Verifica accesso" and the self-test also fails, a local fallback panel appears showing:
   - `SELF_TEST_UNAVAILABLE` code
   - Current browser origin (`window.location.origin`)
   - Last bootstrap error code
   - "Backend raggiungibile: ✗ no"

This ensures the user and support always have diagnostic information, even when no server response is available.

No secrets, tokens, or email addresses are exposed in these codes.

## Self-Test Diagnostic

The retry UI includes a "Verifica accesso" button that calls the `diagnostics` edge function with `action: "self-test"`. It returns safe information:
- `session_present` — Whether a valid session exists
- `user_email` — Masked email (e.g., `gh***@gmail.com`)
- `origin_allowed` — Whether the request origin is in `ALLOWED_ORIGINS`
- `billing_configured` — Whether all Stripe secrets are set
- `owner_match` — Whether the email matches `ADMIN_BOOTSTRAP_EMAILS`
- `admin_match` — Whether the user has admin role
- `bypass_match` — Whether the email matches `COMMERCIAL_BYPASS_EMAILS`
- `check_reachable` — Whether the function is reachable
- `check_code` — The diagnostic code from the check

If the self-test call itself fails, a **client-side fallback** panel is shown instead (see above).

**The user does not need access to secrets or dashboards** — all diagnosis is possible from the UI.

## Defensive Architecture

### Edge Function: `check-subscription`

1. **Always returns HTTP 200** with a stable JSON envelope including `code` field
2. **Bootstrap check runs first** — before owner, admin, trial, or Stripe
3. **Email normalization** — `trim().toLowerCase()` on all email comparisons
4. **Owner bypass** (table-based) — `is_owner: true`, `is_admin: false`, `subscribed: true`
5. **Admin bypass** (RBAC) — `is_admin: true`, `subscribed: true`
6. **DB subscription check** — source of truth from `subscriptions` table; valid statuses: `active`, `trialing`
7. **Stripe is checked last** — only as fallback if `isBillingActive()` returns `true` and DB has no useful record
8. **`billing_active` flag** — returned in response; true only when `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `ALLOWED_ORIGINS` are all set
9. **If Stripe fails**: Error logged, subscription defaults to `false`, trial still works

### Edge Functions: `create-checkout`, `customer-portal`

- Return clear error if Stripe is not configured
- `create-checkout` blocks duplicate subscriptions (409 if `active`/`trialing`/`past_due` exists)
- `create-checkout` directs `past_due` users to Customer Portal instead of creating new checkout
- Frontend handles errors gracefully (toast, not crash)
- The app free trial (`user_trials`, 3 days, no card) is **not** a Stripe `trialing` subscription — trial users may call `create-checkout`

### Selling path (UI)

Checkout is started by `src/lib/checkout.ts` → `create-checkout` with `PLANS[plan].price_id`. Entry points:

- Marketing `/prezzi` (and homepage `PricingSection`): **Abbonati — {piano}** starts Checkout when logged in, or `/signup?plan=` then Checkout after login. **Inizia la prova gratuita** stays card-free.
- `/app` during trial: **Abbonati** → `/abbonamento` plan picker.
- After trial: `TrialExpiredScreen` still shows the three plans when `billingReady`.
- `/abbonamento` (aliases `/upgrade`, `/subscription`, `/account`, `/impostazioni`) is the in-app subscribe page.

### Edge Function: `record-scan`

- Uses DB `subscriptions` table as primary source of truth (valid: `active`, `trialing`)
- Falls back to Stripe customer lookup via `stripe_customer_id` from DB
- Email lookup is a last-resort fallback only when `stripe_customer_id` is not available

### Frontend: `SubscriptionContext`

1. **Auth errors are NOT treated as transient**:
   - If `check-subscription` returns `code` in `auth_missing`, `auth_empty`, `auth_invalid`, `auth_exception`:
     - Local session is invalidated via `supabase.auth.signOut({ scope: "local" })`
     - Subscription state is reset to defaults
     - A toast notifies the user ("Sessione scaduta o non valida, accedi di nuovo.")
     - `AppDashboardGate` redirects to `/login` (because `session` becomes null)
     - `bootFailed` is NOT set — these are definitive, not retryable
2. **Never sends paying users to paywall on transient errors**:
   - **Existing state available**: Keeps last-known state and sets `stale: true`
   - **First boot (no prior state)**: Sets `bootFailed: true` — gate shows retry UI with diagnostic code, **never** `TrialExpiredScreen`
3. **`accessResolved` and `checked` remain `false` on first-boot transient errors** — this prevents `AppDashboardGate` from rendering paywall based on default (unsubscribed) state
4. **`bootFailed` flag**: Enables the gate to distinguish between "genuine no access" and "unknown due to error"
5. **`lastErrorCode`**: Machine-readable diagnostic code displayed in retry UI
6. **First-boot retry**: `AppDashboardGate` shows retry button, self-test button, AND "Esci e rientra" when `bootFailed` is true
7. **`checked` flag**: Guards paywall display — set to `true` only on successful response or genuine logout/no-session
8. **Periodic refresh**: Every 60s, with session expiry check
9. **Network failure tolerance**: `invoke()` errors caught and logged
10. **`canScan`**: `true` only for `active`/`trialing` subscriptions or active trial
11. **`canManageBilling`**: Also includes `past_due` (so user can fix payment via portal)

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
- **First-boot check-subscription failures** show retry UI with diagnostic code, never paywall
- **Auth errors** trigger signout + redirect, never retry UI

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

## Diagnosis Without Secret Access

Users do not need access to secrets or server dashboards. All diagnosis is possible via:
1. **Diagnostic codes** in the retry UI (e.g., `NETWORK_ERROR`, `FUNCTION_ERROR`)
2. **Self-test button** ("Verifica accesso") that returns masked, safe diagnostic info
3. **Console logs** prefixed with `[Subscription]` for developer debugging
