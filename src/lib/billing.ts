/**
 * Client-side billing readiness detection.
 *
 * Billing is considered "ready" when the check-subscription edge function
 * confirms an active Stripe configuration via the `billing_active` flag.
 *
 * Server-side, `billing_active` requires ALL three secrets:
 *   - STRIPE_SECRET_KEY        (Edge Functions secret)
 *   - STRIPE_WEBHOOK_SECRET    (Edge Functions secret)
 *   - ALLOWED_ORIGINS          (Edge Functions secret — comma-separated allowlist)
 *
 * Until the first successful check-subscription response, billing defaults
 * to NOT ready — no broken CTAs will ever appear.
 *
 * On transient errors (including first-boot failures), billing readiness
 * is set to false to avoid showing payment CTAs backed by a potentially
 * unavailable Stripe configuration. The SubscriptionContext handles this
 * by calling setBillingReady(false) in all error/failure branches, and
 * setting bootFailed=true on first-boot errors so the gate shows retry UI
 * instead of the paywall.
 */

/** Runtime billing-ready flag — set by SubscriptionContext after check-subscription responds. */
let _billingReady = false;

export function setBillingReady(ready: boolean): void {
  _billingReady = ready;
}

export function isBillingReady(): boolean {
  return _billingReady;
}
