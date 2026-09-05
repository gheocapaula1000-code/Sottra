import { afterEach, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import {
  clearPendingPlan,
  consumePendingPlan,
  parsePlanKey,
  peekPendingPlan,
  rememberPendingPlan,
  releaseCheckoutLaunchLock,
  resolvePendingPlan,
  safeInternalPath,
  takeCheckoutLaunchLock,
  withPlanParam,
} from "@/lib/pendingCheckout";

describe("pending checkout plan intent", () => {
  afterEach(() => {
    clearPendingPlan();
    releaseCheckoutLaunchLock();
  });

  it("accepts only the three live plan keys", () => {
    expect(parsePlanKey("agente")).toBe("agente");
    expect(parsePlanKey("AGENZIA")).toBe("agenzia");
    expect(parsePlanKey(" rete ")).toBe("rete");
    expect(parsePlanKey("pro")).toBeNull();
    expect(parsePlanKey("price_1UBRDoGhKJTTu87hDT1WGBdS")).toBeNull();
    expect(parsePlanKey(null)).toBeNull();
  });

  it("round-trips through sessionStorage", () => {
    rememberPendingPlan("agenzia");
    expect(peekPendingPlan()).toBe("agenzia");
    expect(consumePendingPlan()).toBe("agenzia");
    expect(peekPendingPlan()).toBeNull();
  });

  it("prefers ?plan= over storage", () => {
    rememberPendingPlan("rete");
    expect(resolvePendingPlan("plan=agente")).toBe("agente");
    expect(resolvePendingPlan("")).toBe("rete");
  });

  it("builds auth URLs without dropping other query params", () => {
    expect(withPlanParam("/signup", "agente")).toBe("/signup?plan=agente");
    expect(withPlanParam("/login?next=/abbonamento", "rete")).toBe("/login?next=%2Fabbonamento&plan=rete");
    expect(withPlanParam("/login", null)).toBe("/login");
  });

  it("rejects open redirects", () => {
    expect(safeInternalPath("/abbonamento")).toBe("/abbonamento");
    expect(safeInternalPath("/app?checkout=success")).toBe("/app?checkout=success");
    expect(safeInternalPath("https://evil.test/phish")).toBeNull();
    expect(safeInternalPath("//evil.test")).toBeNull();
    expect(safeInternalPath("/login")).toBeNull();
    expect(safeInternalPath("/signup?plan=agente")).toBeNull();
  });

  it("checkout launch lock is single-flight", () => {
    expect(takeCheckoutLaunchLock()).toBe(true);
    expect(takeCheckoutLaunchLock()).toBe(false);
    releaseCheckoutLaunchLock();
    expect(takeCheckoutLaunchLock()).toBe(true);
  });

  it("live price IDs stay on the known Pigiservice catalog", () => {
    expect(PLANS.agente.price_id).toBe("price_1UBRDoGhKJTTu87hDT1WGBdS");
    expect(PLANS.agenzia.price_id).toBe("price_1UBRDpGhKJTTu87hNtUKeWJ3");
    expect(PLANS.rete.price_id).toBe("price_1UBRDqGhKJTTu87h7Qj9n6Hd");
  });
});
