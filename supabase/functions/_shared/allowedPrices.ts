/**
 * Server-side price validation.
 * Must mirror src/lib/plans.ts — single source of allowed Stripe price IDs.
 */
const ALLOWED_PRICE_IDS: ReadonlySet<string> = new Set([
  // Agente monthly
  "price_1T8I2gGWMFww3yH4Vs2tABV7",
  // Agente annual — TODO: replace with real Stripe price ID
  "price_agente_annual_TODO",
  // Agenzia monthly
  "price_1T8I4iGWMFww3yH4om3bi9ru",
  // Agenzia annual — TODO: replace with real Stripe price ID
  "price_agenzia_annual_TODO",
  // Enterprise monthly
  "price_1T8I6OGWMFww3yH4RyBCJmXL",
  // Enterprise annual — TODO: replace with real Stripe price ID
  "price_enterprise_annual_TODO",
]);

export function isAllowedPriceId(priceId: string): boolean {
  return ALLOWED_PRICE_IDS.has(priceId);
}
