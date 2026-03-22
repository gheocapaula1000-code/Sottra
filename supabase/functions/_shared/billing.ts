/**
 * Shared billing feature flag for Edge Functions.
 * Returns true only if STRIPE_SECRET_KEY is configured.
 */
export function isBillingActive(): boolean {
  return !!(Deno.env.get("STRIPE_SECRET_KEY"));
}
