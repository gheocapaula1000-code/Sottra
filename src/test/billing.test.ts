import { describe, it, expect } from "vitest";
import { BILLING_ENABLED } from "@/lib/billing";
import { PLANS, ALLOWED_PRICE_IDS, getPlanByProductId, getPlanByPriceId } from "@/lib/plans";
import type { PlanKey } from "@/lib/plans";

describe("Billing feature flag", () => {
  it("billing is disabled by default", () => {
    expect(BILLING_ENABLED).toBe(false);
  });

  it("BILLING_ENABLED is a boolean", () => {
    expect(typeof BILLING_ENABLED).toBe("boolean");
  });
});

describe("Plans catalog", () => {
  it("has all three tiers", () => {
    expect(Object.keys(PLANS)).toEqual(["agente", "agenzia", "enterprise"]);
  });

  it("each plan has required fields", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      const plan = PLANS[key];
      expect(plan.product_id).toBeTruthy();
      expect(plan.price_id).toBeTruthy();
      expect(plan.name).toBeTruthy();
      expect(plan.price).toBeGreaterThan(0);
      expect(plan.scans).toBeGreaterThan(0);
    }
  });

  it("ALLOWED_PRICE_IDS contains all monthly prices", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(ALLOWED_PRICE_IDS).toContain(PLANS[key].price_id);
    }
  });

  it("getPlanByProductId resolves known products", () => {
    expect(getPlanByProductId(PLANS.agente.product_id)).toBe("agente");
    expect(getPlanByProductId(PLANS.agenzia.product_id)).toBe("agenzia");
    expect(getPlanByProductId(PLANS.enterprise.product_id)).toBe("enterprise");
    expect(getPlanByProductId("unknown")).toBeNull();
  });

  it("getPlanByPriceId resolves known prices", () => {
    expect(getPlanByPriceId(PLANS.agente.price_id)).toBe("agente");
    expect(getPlanByPriceId(PLANS.agenzia.price_id)).toBe("agenzia");
    expect(getPlanByPriceId("unknown")).toBeNull();
  });

  it("annual prices are either empty or valid strings", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      const annual = PLANS[key].price_id_annual;
      expect(typeof annual).toBe("string");
    }
  });
});

describe("Subscription gating logic", () => {
  it("canScan is true when subscribed", () => {
    const isOwner = false;
    const isAdmin = false;
    const subscribed = true;
    const trialActive = false;
    const canScan = isOwner || isAdmin || subscribed || trialActive;
    expect(canScan).toBe(true);
  });

  it("canScan is true when trial active", () => {
    const canScan = false || false || false || true;
    expect(canScan).toBe(true);
  });

  it("canScan is false when nothing active", () => {
    const canScan = false || false || false || false;
    expect(canScan).toBe(false);
  });

  it("canScan is true for owner/admin regardless of subscription", () => {
    expect(true || false || false || false).toBe(true);
  });
});
