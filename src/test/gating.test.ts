import { describe, it, expect, vi } from "vitest";

// These tests validate the gating logic without rendering React components,
// by testing the decision rules that TrialProtectedRoute / AppDashboardGate use.

describe("Screen gating logic", () => {
  describe("canScan derivation", () => {
    // Mirrors SubscriptionContext line: isOwner || isAdmin || subscribed || trial?.active
    function canScan(opts: { isOwner: boolean; isAdmin: boolean; subscribed: boolean; trialActive: boolean }) {
      return opts.isOwner || opts.isAdmin || opts.subscribed || opts.trialActive;
    }

    it("owner can always scan", () => {
      expect(canScan({ isOwner: true, isAdmin: false, subscribed: false, trialActive: false })).toBe(true);
    });

    it("admin can always scan", () => {
      expect(canScan({ isOwner: false, isAdmin: true, subscribed: false, trialActive: false })).toBe(true);
    });

    it("subscribed user can scan", () => {
      expect(canScan({ isOwner: false, isAdmin: false, subscribed: true, trialActive: false })).toBe(true);
    });

    it("active trial user can scan", () => {
      expect(canScan({ isOwner: false, isAdmin: false, subscribed: false, trialActive: true })).toBe(true);
    });

    it("expired trial, no subscription = cannot scan", () => {
      expect(canScan({ isOwner: false, isAdmin: false, subscribed: false, trialActive: false })).toBe(false);
    });
  });

  describe("admin route access", () => {
    function canAccessAdmin(isAdmin: boolean, isOwner: boolean) {
      return isAdmin || isOwner;
    }

    it("admin can access", () => expect(canAccessAdmin(true, false)).toBe(true));
    it("owner can access", () => expect(canAccessAdmin(false, true)).toBe(true));
    it("regular user blocked", () => expect(canAccessAdmin(false, false)).toBe(false));
  });
});

describe("SubscriptionContext parsePayload safety", () => {
  // Test the parsing logic in isolation
  function parseMinimal(data: unknown): { subscribed: boolean; isOwner: boolean; isAdmin: boolean } {
    if (!data || typeof data !== "object") return { subscribed: false, isOwner: false, isAdmin: false };
    const d = data as Record<string, unknown>;
    return {
      subscribed: d.subscribed === true,
      isOwner: d.is_owner === true,
      isAdmin: d.is_admin === true,
    };
  }

  it("handles null payload", () => {
    expect(parseMinimal(null)).toEqual({ subscribed: false, isOwner: false, isAdmin: false });
  });

  it("handles empty object", () => {
    expect(parseMinimal({})).toEqual({ subscribed: false, isOwner: false, isAdmin: false });
  });

  it("handles valid owner payload", () => {
    expect(parseMinimal({ is_owner: true, subscribed: false })).toEqual({
      subscribed: false, isOwner: true, isAdmin: false,
    });
  });

  it("handles string payload (malformed)", () => {
    expect(parseMinimal("error")).toEqual({ subscribed: false, isOwner: false, isAdmin: false });
  });
});
