// Stripe product/price mapping for Sottra plans.
// Listino FLAT: il tetto scansioni è incluso, nessun extra a consumo.
// Esaurito il tetto la scansione si ferma fino al mese successivo (o si passa al piano sopra).
// Pi.Gi Service è in regime forfettario: IVA non applicabile.
// Nessun piano annuale: solo mensile.
export const PLANS = {
  agente: {
    product_id: "prod_VBorrDEC1yrQlH",
    price_id: "price_1UBRDoGhKJTTu87hDT1WGBdS",
    name: "Agente",
    price: 79,
    scans: 80,
    users: 1,
  },
  agenzia: {
    product_id: "prod_VBorvjfsoPt16x",
    price_id: "price_1UBRDpGhKJTTu87hNtUKeWJ3",
    name: "Agenzia",
    price: 249,
    scans: 600,
    users: -1,
  },
  rete: {
    product_id: "prod_VBornpnBumW1Ev",
    price_id: "price_1UBRDqGhKJTTu87h7Qj9n6Hd",
    name: "Rete",
    price: 690,
    scans: 2000,
    users: -1,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const PLAN_POPULAR: PlanKey = "agenzia";

/** Tetto scansioni incluso per piano — specchio server-side dell'entitlement. */
export const PLAN_SCAN_CAPS: Record<PlanKey, number> = {
  agente: 80,
  agenzia: 600,
  rete: 2000,
};

export const VAT_NOTICE = "IVA non applicabile (regime forfettario)";

export const PLAN_DESCRIPTIONS: Record<PlanKey, string> = {
  agente: "Per l'agente immobiliare indipendente. Un telefono, tetto incluso.",
  agenzia: "Per l'agenzia: telefoni illimitati, tutti gli agenti sullo stesso account.",
  rete: "Per reti e gruppi con più sedi: volume alto e telefoni illimitati.",
};

export const PLAN_FEATURES: Record<PlanKey, readonly string[]> = {
  agente: [
    "Foto dell'edificio + quotazione OMI ufficiale della microzona",
    "Quadro demografico ISTAT e indicatori di zona",
    "Invio del report al WhatsApp dell'agenzia in un tap",
    "Storico scansioni 6 mesi",
    "Tetto flat: nessun extra a consumo",
  ],
  agenzia: [
    "Tutto del piano Agente",
    "Telefoni illimitati sullo stesso abbonamento",
    "Dashboard agenzia multi-agente",
    "Storico scansioni illimitato",
    "Supporto prioritario via email",
  ],
  rete: [
    "Tutto del piano Agenzia",
    "Più sedi sullo stesso contratto",
    "Volume scansioni elevato",
    "Supporto prioritario",
  ],
};

export function planScansLabel(scans: number): string {
  return `${scans} scansioni/mese`;
}

export function planUsersLabel(users: number): string {
  if (users < 0) return "Telefoni illimitati";
  if (users === 1) return "1 telefono";
  return `${users} telefoni`;
}

/** All allowed Stripe price IDs — used for server-side validation */
export const ALLOWED_PRICE_IDS: readonly string[] = Object.values(PLANS).map((p) => p.price_id);

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}

export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.price_id === priceId) return key as PlanKey;
  }
  return null;
}
