import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  AUTH_ERROR_CODES,
  deriveEntitlementFlags,
  isAuthErrorCode,
  sessionNeedsReauth,
} from "@/lib/sessionGuard";

describe("AuthContext session hydration", () => {
  const auth = readFileSync("src/contexts/AuthContext.tsx", "utf-8");

  it("waits for getSession before treating the user as logged out", () => {
    expect(auth).toContain("getSession()");
    expect(auth).toContain("initialised");
    expect(auth).toContain("onAuthStateChange");
    expect(auth).toMatch(/if \(initialised\) setLoading\(false\)/);
  });

  it("signOut is local-scope only (does not revoke other devices)", () => {
    expect(auth).toContain('signOut({ scope: "local" })');
  });

  it("does not read owner emails or CORE secrets", () => {
    expect(auth).not.toContain("CORE_API_KEY");
    expect(auth).not.toContain("ADMIN_BOOTSTRAP");
    expect(auth).not.toContain("gheocapaula1000");
  });
});

describe("sessionNeedsReauth", () => {
  const now = 1_700_000_000_000;

  it("null session is handled by the no-session path, not reauth", () => {
    expect(sessionNeedsReauth(null, now)).toBe(false);
  });

  it("missing access token requires reauth", () => {
    expect(sessionNeedsReauth({ access_token: "", expires_at: now / 1000 + 60 }, now)).toBe(true);
    expect(sessionNeedsReauth({ access_token: null, expires_at: now / 1000 + 60 }, now)).toBe(true);
  });

  it("expired expires_at requires reauth", () => {
    expect(sessionNeedsReauth({ access_token: "tok", expires_at: now / 1000 - 1 }, now)).toBe(true);
  });

  it("valid token is not reauth", () => {
    expect(sessionNeedsReauth({ access_token: "tok", expires_at: now / 1000 + 120 }, now)).toBe(false);
  });

  it("missing expires_at with a token is not treated as expired", () => {
    expect(sessionNeedsReauth({ access_token: "tok" }, now)).toBe(false);
  });
});

describe("SubscriptionContext session failsafe wiring", () => {
  const ctx = readFileSync("src/contexts/SubscriptionContext.tsx", "utf-8");

  it("uses sessionGuard helpers instead of a local AUTH_ERROR set", () => {
    expect(ctx).toContain("sessionNeedsReauth");
    expect(ctx).toContain("isAuthErrorCode");
    expect(ctx).toContain("deriveEntitlementFlags");
    expect(ctx).toContain('from "@/lib/sessionGuard"');
  });

  it("expired or tokenless session signs out locally (not paywall)", () => {
    expect(ctx).toContain("sessionNeedsReauth(activeSession)");
    expect(ctx).toContain('signOut({ scope: "local" })');
    expect(ctx).toContain("Sessione scaduta");
  });

  it("auth_* codes from check-subscription also sign out locally", () => {
    expect(ctx).toContain("isAuthErrorCode(errorCode)");
  });
});

describe("auth error codes vs transient", () => {
  it("known auth codes trigger reauth", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(isAuthErrorCode(code)).toBe(true);
    }
  });

  it("bootstrap / network codes are not auth errors", () => {
    expect(isAuthErrorCode("bootstrap")).toBe(false);
    expect(isAuthErrorCode("NETWORK_ERROR")).toBe(false);
    expect(isAuthErrorCode("fatal")).toBe(false);
    expect(isAuthErrorCode("")).toBe(false);
    expect(isAuthErrorCode(null)).toBe(false);
  });
});

describe("client entitlement flags (failsafe)", () => {
  it("past_due cannot scan, can open billing portal", () => {
    const flags = deriveEntitlementFlags({
      isOwner: false,
      isAdmin: false,
      subscribed: false,
      trialActive: false,
      subscriptionStatus: "past_due",
    });
    expect(flags.canScan).toBe(false);
    expect(flags.canManageBilling).toBe(true);
  });

  it("expired trial without subscription cannot scan", () => {
    const flags = deriveEntitlementFlags({
      isOwner: false,
      isAdmin: false,
      subscribed: false,
      trialActive: false,
      subscriptionStatus: null,
    });
    expect(flags.canScan).toBe(false);
    expect(flags.canManageBilling).toBe(false);
  });

  it("owner and admin keep scan if Stripe is down", () => {
    expect(deriveEntitlementFlags({
      isOwner: true, isAdmin: false, subscribed: false, trialActive: false, subscriptionStatus: null,
    }).canScan).toBe(true);
    expect(deriveEntitlementFlags({
      isOwner: false, isAdmin: true, subscribed: false, trialActive: false, subscriptionStatus: null,
    }).canScan).toBe(true);
  });

  it("active trial can scan without a Stripe subscription", () => {
    expect(deriveEntitlementFlags({
      isOwner: false, isAdmin: false, subscribed: false, trialActive: true, subscriptionStatus: null,
    }).canScan).toBe(true);
  });
});
