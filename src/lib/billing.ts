/**
 * Client-side billing readiness detection.
 *
 * Billing is considered "ready" when the check-subscription edge function
 * confirms an active Stripe configuration (i.e. STRIPE_SECRET_KEY is set).
 *
 * Until the first successful check-subscription response, billing defaults
 * to NOT ready — no broken CTAs will ever appear.
 *
 * Required env / secrets for billing to be active:
 *   - STRIPE_SECRET_KEY        (Edge Functions secret)
 *   - STRIPE_WEBHOOK_SECRET    (Edge Functions secret)
 *   - ALLOWED_ORIGINS          (Edge Functions secret — comma-separated allowlist)
 */

/** Runtime billing-ready flag — set by SubscriptionContext after check-subscription responds. */
let _billingReady = false;

export function setBillingReady(ready: boolean): void {
  _billingReady = ready;
}

export function isBillingReady(): boolean {
  return _billingReady;
}
