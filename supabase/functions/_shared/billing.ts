/**
 * Shared billing feature flag for Edge Functions.
 * Returns true only if ALL required Stripe secrets are configured:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 *   - ALLOWED_ORIGINS
 */
export function isBillingActive(): boolean {
  return !!(
    Deno.env.get("STRIPE_SECRET_KEY") &&
    Deno.env.get("STRIPE_WEBHOOK_SECRET") &&
    Deno.env.get("ALLOWED_ORIGINS")
  );
}
