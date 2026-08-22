// Stripe product/price mapping for Sottra plans
// Rule: annual price = monthly × 10 (customer saves 2 months)
export const PLANS = {
  agente: {
    product_id: "prod_U6V2uqzObgPxBE",
    price_id: "price_1T8I2gGWMFww3yH4Vs2tABV7",
    price_id_annual: "price_agente_annual_TODO",
    name: "Agente",
    price: 299,
    price_annual: 2990,
    scans: 100,
    users: 1,
  },
  agenzia: {
    product_id: "prod_U6V4rSHgXTbtnY",
    price_id: "price_1T8I4iGWMFww3yH4om3bi9ru",
    price_id_annual: "price_agenzia_annual_TODO",
    name: "Agenzia",
    price: 699,
    price_annual: 6990,
    scans: 300,
    users: 5,
  },
  enterprise: {
    product_id: "prod_U6V6LGKnn1SyT3",
    price_id: "price_1T8I6OGWMFww3yH4RyBCJmXL",
    price_id_annual: "price_enterprise_annual_TODO",
    name: "Enterprise",
    price: 1490,
    price_annual: 14900,
    scans: 1000,
    users: -1,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const PLAN_POPULAR: PlanKey = "agenzia";

export const PLAN_DESCRIPTIONS: Record<PlanKey, string> = {
  agente: "Per l'agente immobiliare indipendente o il professionista singolo.",
  agenzia: "Per l'agenzia strutturata. 5 account inclusi.",
  enterprise: "Per agenzie strutturate e grandi team.",
};

export const PLAN_FEATURES: Record<PlanKey, readonly string[]> = {
  agente: [
    "Analisi completa — dati ufficiali ed elaborati distinti",
    "Quotazioni OMI da fonti istituzionali italiane",
    "Quadro demografico ISTAT e indicatori di zona",
    "Rischio zona, infrastrutture, indice opportunità",
    "Storico scansioni 6 mesi",
    "Visualizzazione in-app",
  ],
  agenzia: [
    "Tutto del piano Agente",
    "Dashboard agenzia multi-agente",
    "Export PDF con logo agenzia",
    "Storico scansioni illimitato",
    "Supporto prioritario via email",
  ],
  enterprise: [
    "Tutto del piano Agenzia",
    "Utenti illimitati",
    "Volume scansioni elevato",
    "Supporto prioritario",
  ],
};

export function planScansLabel(scans: number): string {
  return `${scans} scansioni/mese`;
}

export function planUsersLabel(users: number): string {
  if (users < 0) return "Utenti illimitati";
  if (users === 1) return "1 account";
  return `${users} account`;
}

export function isPlaceholderPriceId(priceId: string): boolean {
  return priceId.includes("_TODO");
}

/** All allowed Stripe price IDs — used for server-side validation */
export const ALLOWED_PRICE_IDS: readonly string[] = Object.values(PLANS).flatMap(
  (p) => [p.price_id, p.price_id_annual].filter(Boolean),
);

/** True when at least one annual price is a real Stripe ID (not a TODO placeholder) */
export const HAS_REAL_ANNUAL_PRICES: boolean = Object.values(PLANS).some(
  (p) => !!p.price_id_annual && !p.price_id_annual.includes("_TODO"),
);

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}

export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.price_id === priceId || plan.price_id_annual === priceId) return key as PlanKey;
  }
  return null;
}
