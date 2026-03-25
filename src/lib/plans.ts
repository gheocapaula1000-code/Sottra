// Stripe product/price mapping for Sottra plans
// Rule: annual price = monthly × 10 (customer saves 2 months)
export const PLANS = {
  agente: {
    product_id: "prod_U6V2uqzObgPxBE",
    price_id: "price_1T8I2gGWMFww3yH4Vs2tABV7",
    price_id_annual: "", // To be set when annual pricing is created in Stripe
    name: "Agente",
    price: 129,
    price_annual: 1290, // 129 × 10
    scans: 80,
  },
  agenzia: {
    product_id: "prod_U6V4rSHgXTbtnY",
    price_id: "price_1T8I4iGWMFww3yH4om3bi9ru",
    price_id_annual: "",
    name: "Agenzia",
    price: 349,
    price_annual: 3490, // 349 × 10
    scans: 250,
  },
  enterprise: {
    product_id: "prod_U6V6LGKnn1SyT3",
    price_id: "price_1T8I6OGWMFww3yH4RyBCJmXL",
    price_id_annual: "",
    name: "Enterprise",
    price: 749,
    price_annual: 7490, // 749 × 10
    scans: 800,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** All allowed Stripe price IDs — used for server-side validation */
export const ALLOWED_PRICE_IDS: readonly string[] = Object.values(PLANS).flatMap(
  (p) => [p.price_id, p.price_id_annual].filter(Boolean),
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
