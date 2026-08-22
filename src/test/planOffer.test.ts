import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_FEATURES,
  PLAN_DESCRIPTIONS,
  PLAN_POPULAR,
  planScansLabel,
  planUsersLabel,
  isPlaceholderPriceId,
  HAS_REAL_ANNUAL_PRICES,
  type PlanKey,
} from "@/lib/plans";

describe("Commercial offer matches plans.ts", () => {
  it("live monthly prices are 299 / 699 / 1490", () => {
    expect(PLANS.agente.price).toBe(299);
    expect(PLANS.agenzia.price).toBe(699);
    expect(PLANS.enterprise.price).toBe(1490);
  });

  it("scan allowances are 100 / 300 / 1000", () => {
    expect(PLANS.agente.scans).toBe(100);
    expect(PLANS.agenzia.scans).toBe(300);
    expect(PLANS.enterprise.scans).toBe(1000);
  });

  it("user seats are 1 / 5 / unlimited", () => {
    expect(PLANS.agente.users).toBe(1);
    expect(PLANS.agenzia.users).toBe(5);
    expect(PLANS.enterprise.users).toBe(-1);
    expect(planUsersLabel(PLANS.enterprise.users)).toBe("Utenti illimitati");
    expect(planUsersLabel(PLANS.agenzia.users)).toBe("5 account");
    expect(planScansLabel(PLANS.agente.scans)).toBe("100 scansioni/mese");
  });

  it("every plan has display copy", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(PLAN_DESCRIPTIONS[key].length).toBeGreaterThan(10);
      expect(PLAN_FEATURES[key].length).toBeGreaterThan(2);
    }
    expect(PLAN_POPULAR).toBe("agenzia");
  });

  it("annual Stripe IDs stay TODO until real prices exist", () => {
    expect(HAS_REAL_ANNUAL_PRICES).toBe(false);
    expect(isPlaceholderPriceId(PLANS.agente.price_id_annual)).toBe(true);
    expect(isPlaceholderPriceId(PLANS.agente.price_id)).toBe(false);
  });

  it("does not keep the retired landing prices", () => {
    expect([PLANS.agente.price, PLANS.agenzia.price, PLANS.enterprise.price]).not.toContain(129);
    expect([PLANS.agente.price, PLANS.agenzia.price, PLANS.enterprise.price]).not.toContain(349);
    expect([PLANS.agente.scans, PLANS.agenzia.scans, PLANS.enterprise.scans]).not.toContain(80);
  });
});
