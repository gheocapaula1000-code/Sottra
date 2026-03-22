/**
 * Client-side billing feature flag.
 *
 * Billing is only considered active when SubscriptionContext reports
 * a real Stripe subscription (`subscribed === true`).
 * Until Stripe is fully wired, all billing CTAs are hidden.
 *
 * This flag is checked at runtime, not build time, so no env var needed.
 */

/** Set to true when Stripe is fully configured and tested in production. */
export const BILLING_ENABLED = false;
