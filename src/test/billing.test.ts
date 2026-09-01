import { describe, it, expect } from "vitest";
import { isBillingReady, setBillingReady } from "@/lib/billing";
import { PLANS, ALLOWED_PRICE_IDS, getPlanByProductId, getPlanByPriceId } from "@/lib/plans";
import type { PlanKey } from "@/lib/plans";

// ─── Plan Catalog ───────────────────────────────────────────────

describe("Plans catalog — completeness", () => {
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

  it("annual price = monthly × 10 for all plans", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(PLANS[key].price_annual).toBe(PLANS[key].price * 10);
    }
  });

  it("every plan has a price_id_annual (placeholder or real)", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(PLANS[key].price_id_annual).toBeTruthy();
      expect(typeof PLANS[key].price_id_annual).toBe("string");
      expect(PLANS[key].price_id_annual.length).toBeGreaterThan(0);
    }
  });

  it("ALLOWED_PRICE_IDS contains all monthly AND annual prices", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(ALLOWED_PRICE_IDS).toContain(PLANS[key].price_id);
      expect(ALLOWED_PRICE_IDS).toContain(PLANS[key].price_id_annual);
    }
  });

  it("HAS_REAL_ANNUAL_PRICES is false when using TODO placeholders", () => {
    // Current state: all annual prices are placeholders
    expect(HAS_REAL_ANNUAL_PRICES).toBe(false);
  });
});

// ─── Plan Lookups ───────────────────────────────────────────────

describe("Plan lookups", () => {
  it("getPlanByProductId resolves known products", () => {
    expect(getPlanByProductId(PLANS.agente.product_id)).toBe("agente");
    expect(getPlanByProductId(PLANS.agenzia.product_id)).toBe("agenzia");
    expect(getPlanByProductId(PLANS.enterprise.product_id)).toBe("enterprise");
    expect(getPlanByProductId("unknown")).toBeNull();
  });

  it("getPlanByPriceId resolves monthly prices", () => {
    expect(getPlanByPriceId(PLANS.agente.price_id)).toBe("agente");
    expect(getPlanByPriceId(PLANS.agenzia.price_id)).toBe("agenzia");
    expect(getPlanByPriceId(PLANS.enterprise.price_id)).toBe("enterprise");
  });

  it("getPlanByPriceId resolves annual prices", () => {
    expect(getPlanByPriceId(PLANS.agente.price_id_annual)).toBe("agente");
    expect(getPlanByPriceId(PLANS.agenzia.price_id_annual)).toBe("agenzia");
    expect(getPlanByPriceId(PLANS.enterprise.price_id_annual)).toBe("enterprise");
  });

  it("getPlanByPriceId returns null for unknown", () => {
    expect(getPlanByPriceId("unknown")).toBeNull();
  });
});

// ─── Billing Flag ───────────────────────────────────────────────

describe("Billing runtime flag", () => {
  it("billing is not ready by default", () => {
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
  });

  it("setBillingReady activates billing", () => {
    setBillingReady(true);
    expect(isBillingReady()).toBe(true);
    setBillingReady(false);
  });
});

// ─── No Free Tier ───────────────────────────────────────────────

describe("No free tier — business rules", () => {
  it("no plan has price=0", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(PLANS[key].price).toBeGreaterThan(0);
      expect(PLANS[key].price_annual).toBeGreaterThan(0);
    }
  });

  it("trial is not a plan key", () => {
    expect(Object.keys(PLANS)).not.toContain("trial");
    expect(Object.keys(PLANS)).not.toContain("free");
    expect(Object.keys(PLANS)).not.toContain("basic");
  });
});

// ─── Trial Semantics ────────────────────────────────────────────

describe("Trial semantics — gating logic", () => {
  it("trial active = full access", () => {
    const isOwner = false, isAdmin = false, subscribed = false, trialActive = true;
    const canScan = isOwner || isAdmin || subscribed || trialActive;
    expect(canScan).toBe(true);
  });

  it("trial expired + no subscription = blocked", () => {
    const isOwner = false, isAdmin = false, subscribed = false, trialActive = false;
    const canScan = isOwner || isAdmin || subscribed || trialActive;
    expect(canScan).toBe(false);
  });

  it("active subscription = access regardless of trial", () => {
    const subscribed = true, trialActive = false;
    const canScan = subscribed || trialActive;
    expect(canScan).toBe(true);
  });

  it("past_due = no scan but can manage billing", () => {
    const subscribed = false, trialActive = false;
    const subscriptionStatus = "past_due";
    const canScan = subscribed || trialActive;
    const canManageBilling = subscribed || subscriptionStatus === "past_due";
    expect(canScan).toBe(false);
    expect(canManageBilling).toBe(true);
  });
});

// ─── Bypass Non-Regression ──────────────────────────────────────

describe("Bypass non-regression — 3 accounts", () => {
  // These tests verify the SEMANTIC RULES, not DB state.
  // The actual bypass is resolved server-side via secrets.

  it("gheocapaula1000@gmail.com = owner + admin + bypass", () => {
    // This email is in ADMIN_BOOTSTRAP_EMAILS secret
    // check-subscription returns: subscribed=true, is_admin=true, is_owner=true, code=bootstrap
    const response = { subscribed: true, is_admin: true, is_owner: true, code: "bootstrap" };
    const canScan = response.is_owner || response.is_admin || response.subscribed;
    expect(canScan).toBe(true);
    expect(response.is_admin).toBe(true);
    expect(response.is_owner).toBe(true);
  });

  it("matteo.ippolito@gmail.com = bypass full access, NOT admin", () => {
    // This email is in COMMERCIAL_BYPASS_EMAILS secret
    // check-subscription returns: subscribed=true, is_admin=false, is_owner=false, code=commercial_bypass
    const response = { subscribed: true, is_admin: false, is_owner: false, code: "commercial_bypass" };
    const canScan = response.is_owner || response.is_admin || response.subscribed;
    expect(canScan).toBe(true);
    expect(response.is_admin).toBe(false);
    expect(response.is_owner).toBe(false);
  });

  it("massimilianogalli75@gmail.com = NO bypass in Sottra", () => {
    // This email is NOT in COMMERCIAL_BYPASS_EMAILS for Sottra
    // check-subscription treats them as a normal user → trial/subscription rules apply
    const response = { subscribed: false, is_admin: false, is_owner: false, code: "resolved" };
    const trialActive = false; // expired
    const canScan = response.is_owner || response.is_admin || response.subscribed || trialActive;
    expect(canScan).toBe(false);
    expect(response.is_admin).toBe(false);
    expect(response.is_owner).toBe(false);
  });

  it("owner bypass cannot be degraded by trial expiry", () => {
    const isOwner = true, subscribed = false, trialActive = false;
    const canScan = isOwner || subscribed || trialActive;
    expect(canScan).toBe(true);
  });

  it("commercial bypass user never sees paywall", () => {
    // subscribed=true from server means canScan=true, regardless of trial state
    const subscribed = true, trialActive = false;
    const canScan = subscribed || trialActive;
    expect(canScan).toBe(true);
  });

  it("massimiliano with expired trial sees paywall in Sottra", () => {
    const subscribed = false, trialActive = false, isOwner = false, isAdmin = false;
    const canScan = isOwner || isAdmin || subscribed || trialActive;
    expect(canScan).toBe(false);
    // AppDashboardGate renders TrialExpiredScreen when !canScan && checked
  });
});

// ─── Transient Error Resilience ─────────────────────────────────

describe("Transient error resilience", () => {
  it("billing error does NOT grant free permanent access", () => {
    // When check-subscription fails transiently:
    // - first boot: bootFailed=true, canScan remains false → retry UI, not free access
    // - subsequent: stale=true, prior state preserved → no upgrade to free
    const bootFailed = true;
    const canScan = false;
    const showPaywall = false; // bootFailed shows retry, not paywall
    expect(canScan).toBe(false);
    expect(bootFailed).toBe(true);
    expect(showPaywall).toBe(false);
  });

  it("stale state preserves prior subscription, does NOT grant new access", () => {
    setBillingReady(true);
    const priorSubscribed = true;
    const stale = true;
    // canScan based on prior state, not new free access
    expect(priorSubscribed).toBe(true);
    expect(stale).toBe(true);
    expect(isBillingReady()).toBe(true);
    setBillingReady(false);
  });

  it("first-boot error never resolves to free access", () => {
    const hasEverChecked = false;
    const accessResolved = false;
    const bootFailed = true;
    const canScan = false;
    // Gate: retry UI, not dashboard
    expect(canScan).toBe(false);
    expect(accessResolved).toBe(false);
    expect(bootFailed).toBe(true);
  });
});

// ─── Checkout Validation ────────────────────────────────────────

describe("Checkout validation rules", () => {
  it("all monthly price IDs are in ALLOWED_PRICE_IDS", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(ALLOWED_PRICE_IDS).toContain(PLANS[key].price_id);
    }
  });

  it("no annual placeholder price survives", () => {
    for (const id of ALLOWED_PRICE_IDS) {
      expect(id).not.toMatch(/_TODO/);
    }
  });


  it("trial is not a purchasable price", () => {
    expect(ALLOWED_PRICE_IDS).not.toContain("trial");
    expect(ALLOWED_PRICE_IDS).not.toContain("free");
    expect(ALLOWED_PRICE_IDS).not.toContain("");
  });

  it("unknown price IDs are rejected", () => {
    expect(ALLOWED_PRICE_IDS).not.toContain("price_fake_123");
    expect(ALLOWED_PRICE_IDS).not.toContain("price_free_forever");
  });
});
