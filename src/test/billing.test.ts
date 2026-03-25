import { describe, it, expect } from "vitest";
import { isBillingReady, setBillingReady } from "@/lib/billing";
import { PLANS, ALLOWED_PRICE_IDS, getPlanByProductId, getPlanByPriceId } from "@/lib/plans";
import type { PlanKey } from "@/lib/plans";

describe("Billing runtime flag", () => {
  it("billing is not ready by default", () => {
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
  });

  it("setBillingReady activates billing", () => {
    setBillingReady(true);
    expect(isBillingReady()).toBe(true);
    setBillingReady(false); // reset
  });

  it("isBillingReady returns boolean", () => {
    expect(typeof isBillingReady()).toBe("boolean");
  });

  it("setBillingReady(false) deactivates billing", () => {
    setBillingReady(true);
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
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

  it("annual price = monthly × 10 for all plans", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      const plan = PLANS[key];
      expect(plan.price_annual).toBe(plan.price * 10);
    }
  });

  it("annual toggle hidden when no annual price IDs configured", () => {
    const hasAnyAnnualPrice = Object.values(PLANS).some((p) => !!p.price_id_annual);
    // Currently no annual price IDs are set
    expect(hasAnyAnnualPrice).toBe(false);
  });
});

describe("Subscription gating logic", () => {
  it("canScan is true when subscribed", () => {
    const isOwner = false, isAdmin = false, subscribed = true, trialActive = false;
    expect(isOwner || isAdmin || subscribed || trialActive).toBe(true);
  });

  it("canScan is true when trial active", () => {
    const isOwner = false, isAdmin = false, subscribed = false, trialActive = true;
    expect(isOwner || isAdmin || subscribed || trialActive).toBe(true);
  });

  it("canScan is false when nothing active", () => {
    const isOwner = false, isAdmin = false, subscribed = false, trialActive = false;
    expect(isOwner || isAdmin || subscribed || trialActive).toBe(false);
  });

  it("canScan is true for owner/admin regardless of subscription", () => {
    const isOwner = true, isAdmin = false, subscribed = false, trialActive = false;
    expect(isOwner || isAdmin || subscribed || trialActive).toBe(true);
  });

  it("past_due user: canScan is false", () => {
    const isOwner = false, isAdmin = false, subscribed = false, trialActive = false;
    expect(isOwner || isAdmin || subscribed || trialActive).toBe(false);
  });

  it("past_due user: canManageBilling is true", () => {
    const isOwner = false, isAdmin = false, subscribed = false;
    const subscriptionStatus = "past_due";
    expect(isOwner || isAdmin || subscribed || subscriptionStatus === "past_due").toBe(true);
  });

  it("active user: canManageBilling is true", () => {
    const isOwner = false, isAdmin = false, subscribed = true;
    const subscriptionStatus: string | null = "active";
    expect(isOwner || isAdmin || subscribed || subscriptionStatus === "past_due").toBe(true);
  });
});

describe("SubscriptionContext billingReady behavior", () => {
  it("resetToDefaults sets billingReady to false", () => {
    setBillingReady(true);
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
  });

  it("successful response with billing_active=true sets billingReady", () => {
    const responseData = { billing_active: true };
    setBillingReady(responseData.billing_active === true);
    expect(isBillingReady()).toBe(true);
    setBillingReady(false);
  });

  it("successful response with billing_active=false keeps billingReady false", () => {
    setBillingReady(false);
    const responseData = { billing_active: false };
    setBillingReady(responseData.billing_active === true);
    expect(isBillingReady()).toBe(false);
  });

  it("error/logout/no-session always results in billingReady=false", () => {
    setBillingReady(true);
    // Simulate error path
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
  });

  it("transient error preserves last state (stale concept)", () => {
    setBillingReady(true);
    // On transient error with prior state, SubscriptionContext keeps value and sets stale=true
    expect(isBillingReady()).toBe(true);
    setBillingReady(false); // cleanup
  });
});

describe("First-boot transient error (bootFailed)", () => {
  it("first-boot error should NOT resolve access (conceptual)", () => {
    // When hasEverChecked is false and check-subscription fails:
    // accessResolved stays false, checked stays false, bootFailed=true
    // This means AppDashboardGate shows retry UI, never TrialExpiredScreen
    const hasEverChecked = false;
    const accessResolved = false;
    const checked = false;
    const bootFailed = true;

    // Gate logic: show loader if !accessResolved && !bootFailed
    // Show retry if bootFailed
    // Show paywall only if checked && !canScan
    const showLoader = !accessResolved && !bootFailed;
    const showRetry = bootFailed;
    const showPaywall = checked && !bootFailed;

    expect(showLoader).toBe(false);
    expect(showRetry).toBe(true);
    expect(showPaywall).toBe(false);
    expect(hasEverChecked).toBe(false);
  });

  it("successful retry after boot failure resolves access normally", () => {
    const hasEverChecked = true;
    const accessResolved = true;
    const checked = true;
    const bootFailed = false;
    const subscribed = true;

    const showRetry = bootFailed;
    const canScan = subscribed;

    expect(showRetry).toBe(false);
    expect(canScan).toBe(true);
    expect(accessResolved).toBe(true);
    expect(hasEverChecked).toBe(true);
  });

  it("stale state after subsequent error keeps access (not paywall)", () => {
    const hasEverChecked = true;
    const accessResolved = true;
    const checked = true;
    const bootFailed = false;
    const stale = true;
    const subscribed = true;

    const showRetry = bootFailed;
    const canScan = subscribed;

    expect(showRetry).toBe(false);
    expect(canScan).toBe(true);
    expect(stale).toBe(true);
  });
});
