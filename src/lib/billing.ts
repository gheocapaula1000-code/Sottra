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
 * Transient error handling:
 *   - First-boot errors (no prior state): billingReady is set to false,
 *     bootFailed=true → gate shows retry UI, never paywall.
 *   - Subsequent transient errors (prior valid state exists): billingReady
 *     is PRESERVED so portal CTAs remain visible for users with a known
 *     billing relationship (active, trialing, past_due). State is marked
 *     stale=true.
 *
 * Hard-disabled billing (billing_active=false from a successful response):
 *   - billingReady is set to false — CTAs are hidden because the backend
 *     confirmed Stripe is not configured.
 */

/** Runtime billing-ready flag — set by SubscriptionContext after check-subscription responds. */
let _billingReady = false;

export function setBillingReady(ready: boolean): void {
  _billingReady = ready;
}

export function isBillingReady(): boolean {
  return _billingReady;
}
