/**
 * Server-side price validation.
 * Must mirror src/lib/plans.ts — single source of allowed Stripe price IDs.
 * Listino flat mensile: Agente 79 € / Agenzia 249 € / Rete 690 €. Nessun piano annuale.
 */
const ALLOWED_PRICE_IDS: ReadonlySet<string> = new Set([
  // Agente — 79 €/mese, 80 scansioni, 1 telefono
  "price_1UAu3nGWMFww3yH4xKmNLJfP",
  // Agenzia — 249 €/mese, 600 scansioni, telefoni illimitati
  "price_1UAu3qGWMFww3yH424NM6o8d",
  // Rete — 690 €/mese, 2000 scansioni, telefoni illimitati, più sedi
  "price_1UAu3uGWMFww3yH43u6K1Ect",
]);

/** Tetto scansioni incluso per price ID — flat, nessun extra a consumo. */
export const SCAN_CAP_BY_PRICE_ID: Readonly<Record<string, number>> = {
  "price_1UAu3nGWMFww3yH4xKmNLJfP": 80,
  "price_1UAu3qGWMFww3yH424NM6o8d": 600,
  "price_1UAu3uGWMFww3yH43u6K1Ect": 2000,
};

export function isAllowedPriceId(priceId: string): boolean {
  if (!priceId) return false;
  return ALLOWED_PRICE_IDS.has(priceId);
}
