# Sottra — Subscription Failsafe

## Principle

Stripe is treated as an **optional enhancement**. The app must never crash, hang, or show broken UI if Stripe is not configured or unreachable.

## Defensive Architecture

### Edge Function: `check-subscription`

1. **Always returns HTTP 200** with a stable JSON envelope:
   ```json
   { "ok": true/false, "subscribed": false, "trial": {...}, "error": null, "code": "resolved" }
   ```
2. **Stripe is checked last** — after owner bypass, admin check, and trial lookup
3. **If `STRIPE_SECRET_KEY` is missing**: Stripe block is skipped entirely; trial-only access applies
4. **If Stripe API fails**: Error is logged, subscription defaults to `false`, trial still works

### Edge Function: `create-checkout`

- Returns clear error if Stripe is not configured
- Frontend handles error gracefully (toast, not crash)

### Edge Function: `customer-portal`

- Returns clear error if no Stripe customer found
- Frontend shows informative message

### Frontend: `SubscriptionContext`

1. **Never hangs on loading**: `applyDefaults(true)` resolves access even on errors
2. **`checked` flag**: Guards paywall display — never shows paywall from default/error state
3. **Periodic refresh**: Every 60s, with session expiry check
4. **Network failure tolerance**: `invoke()` errors are caught and logged, not thrown

### Trial Independence

- Trial is managed via `user_trials` table, independent of Stripe
- Auto-created on first subscription check if missing
- Provides scan access even when Stripe is completely absent

## Testing

- `stripe-missing-graceful.test.ts` verifies that check-subscription function shape remains stable regardless of Stripe availability
- SubscriptionContext always resolves `accessResolved: true` even on API failure

## Configuration States

| STRIPE_SECRET_KEY | Behavior |
|---|---|
| Set + valid | Full subscription checking |
| Set + invalid | Stripe errors logged, trial-only access |
| Not set | Stripe skipped entirely, trial-only access |
