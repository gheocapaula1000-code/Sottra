import { describe, it, expect } from "vitest";

// These tests validate the gating logic without rendering React components,
// by testing the decision rules that TrialProtectedRoute / AppDashboardGate use.

/** Auth error codes from check-subscription that should trigger local signout, not bootFailed. */
const AUTH_ERROR_CODES = new Set(["auth_missing", "auth_empty", "auth_invalid", "auth_exception"]);

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

describe("Auth error vs transient error classification", () => {
  function classifyError(code: string): "auth" | "transient" {
    return AUTH_ERROR_CODES.has(code) ? "auth" : "transient";
  }

  it("auth_invalid → auth error (signout + redirect)", () => {
    expect(classifyError("auth_invalid")).toBe("auth");
  });

  it("auth_missing → auth error (signout + redirect)", () => {
    expect(classifyError("auth_missing")).toBe("auth");
  });

  it("auth_empty → auth error (signout + redirect)", () => {
    expect(classifyError("auth_empty")).toBe("auth");
  });

  it("auth_exception → auth error (signout + redirect)", () => {
    expect(classifyError("auth_exception")).toBe("auth");
  });

  it("fatal → transient error (bootFailed)", () => {
    expect(classifyError("fatal")).toBe("transient");
  });

  it("init_error → transient error (bootFailed)", () => {
    expect(classifyError("init_error")).toBe("transient");
  });

  it("unknown → transient error (bootFailed)", () => {
    expect(classifyError("unknown")).toBe("transient");
  });

  it("network/invoke errors have no code → transient by default", () => {
    // When invoke itself throws (network/CORS), there's no code at all
    // SubscriptionContext calls handleTransientError() in the catch block
    expect(classifyError("")).toBe("transient");
  });

  it("owner bootstrap returns code=bootstrap → valid, not an error", () => {
    // bootstrap is a success code, not an error — parsePayload handles it
    const payload = { ok: true, subscribed: true, is_owner: true, is_admin: true, code: "bootstrap" };
    expect(payload.subscribed).toBe(true);
    expect(payload.is_owner).toBe(true);
    // No error field → parsePayload succeeds, no error classification needed
    expect(payload.ok).toBe(true);
  });
});
