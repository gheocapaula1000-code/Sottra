/**
 * Server-side price validation.
 * Must mirror src/lib/plans.ts — single source of allowed Stripe price IDs.
 * Listino flat mensile: Agente 79 € / Agenzia 249 € / Rete 690 €. Nessun piano annuale.
 */
const ALLOWED_PRICE_IDS: ReadonlySet<string> = new Set([
  // Agente — 79 €/mese, 80 scansioni, 1 telefono
  "price_1UBRDoGhKJTTu87hDT1WGBdS",
  // Agenzia — 249 €/mese, 600 scansioni, telefoni illimitati
  "price_1UBRDpGhKJTTu87hNtUKeWJ3",
  // Rete — 690 €/mese, 2000 scansioni, telefoni illimitati, più sedi
  "price_1UBRDqGhKJTTu87h7Qj9n6Hd",
]);

/** Tetto scansioni incluso per price ID — flat, nessun extra a consumo. */
export const SCAN_CAP_BY_PRICE_ID: Readonly<Record<string, number>> = {
  "price_1UBRDoGhKJTTu87hDT1WGBdS": 80,
  "price_1UBRDpGhKJTTu87hNtUKeWJ3": 600,
  "price_1UBRDqGhKJTTu87h7Qj9n6Hd": 2000,
};

export function isAllowedPriceId(priceId: string): boolean {
  if (!priceId) return false;
  return ALLOWED_PRICE_IDS.has(priceId);
}
