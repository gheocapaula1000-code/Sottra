// Stripe product/price mapping for Sottra plans
export const PLANS = {
  agente: {
    product_id: "prod_U6V2uqzObgPxBE",
    price_id: "price_1T8I2gGWMFww3yH4Vs2tABV7",
    name: "Agente",
    price: 129,
    scans: 80,
  },
  agenzia: {
    product_id: "prod_U6V4rSHgXTbtnY",
    price_id: "price_1T8I4iGWMFww3yH4om3bi9ru",
    name: "Agenzia",
    price: 349,
    scans: 250,
  },
  enterprise: {
    product_id: "prod_U6V6LGKnn1SyT3",
    price_id: "price_1T8I6OGWMFww3yH4RyBCJmXL",
    name: "Enterprise",
    price: 799,
    scans: -1, // unlimited
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
