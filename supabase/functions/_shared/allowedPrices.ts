/**
 * Server-side price validation.
 * Must mirror src/lib/plans.ts — single source of allowed Stripe price IDs.
 */
const ALLOWED_PRICE_IDS: ReadonlySet<string> = new Set([
  // Agente
  "price_1T8I2gGWMFww3yH4Vs2tABV7",
  // Agenzia
  "price_1T8I4iGWMFww3yH4om3bi9ru",
  // Enterprise
  "price_1T8I6OGWMFww3yH4RyBCJmXL",
  // Add annual price IDs here when created in Stripe
]);

export function isAllowedPriceId(priceId: string): boolean {
  return ALLOWED_PRICE_IDS.has(priceId);
}
