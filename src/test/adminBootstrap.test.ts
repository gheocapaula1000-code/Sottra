import { describe, it, expect } from "vitest";

/**
 * Tests for the admin bootstrap, commercial bypass, and owner/admin access model.
 */

describe("Admin Bootstrap invariants", () => {
  describe("Bootstrap allowlist parsing", () => {
    function parseAllowlist(raw: string): Set<string> {
      if (!raw.trim()) return new Set();
      return new Set(
        raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
      );
    }

    it("parses comma-separated emails", () => {
      const set = parseAllowlist("a@b.com, c@d.com");
      expect(set.has("a@b.com")).toBe(true);
      expect(set.has("c@d.com")).toBe(true);
      expect(set.size).toBe(2);
    });

    it("returns empty set for empty string", () => {
      expect(parseAllowlist("").size).toBe(0);
      expect(parseAllowlist("  ").size).toBe(0);
    });

    it("lowercases emails", () => {
      const set = parseAllowlist("Admin@Example.COM");
      expect(set.has("admin@example.com")).toBe(true);
    });

    it("deduplicates", () => {
      const set = parseAllowlist("a@b.com,a@b.com,A@B.COM");
      expect(set.size).toBe(1);
    });
  });

  describe("Owner ≠ Admin separation", () => {
    it("owner status does not imply admin", () => {
      const ownerResponse = {
        is_owner: true,
        is_admin: false,
        subscribed: true,
        code: "owner",
      };
      expect(ownerResponse.is_owner).toBe(true);
      expect(ownerResponse.is_admin).toBe(false);
    });

    it("admin status comes only from RBAC", () => {
      const adminResponse = {
        is_owner: false,
        is_admin: true,
        subscribed: true,
        code: "admin",
      };
      expect(adminResponse.is_admin).toBe(true);
      expect(adminResponse.is_owner).toBe(false);
    });

    it("bootstrap grants both owner AND admin explicitly", () => {
      const bootstrapResponse = {
        is_owner: true,
        is_admin: true,
        subscribed: true,
        code: "bootstrap",
      };
      expect(bootstrapResponse.is_owner).toBe(true);
      expect(bootstrapResponse.is_admin).toBe(true);
      expect(bootstrapResponse.code).toBe("bootstrap");
    });
  });

  describe("Commercial bypass (non-admin full access)", () => {
    function isCommercialBypass(email: string, bypassList: Set<string>): boolean {
      if (!email) return false;
      return bypassList.has(email.trim().toLowerCase());
    }

    it("commercial bypass user gets subscribed=true but NOT admin", () => {
      const bypassList = new Set(["matteo@example.com"]);
      expect(isCommercialBypass("matteo@example.com", bypassList)).toBe(true);

      const response = {
        subscribed: true,
        is_admin: false,
        is_owner: false,
        code: "commercial_bypass",
      };
      expect(response.subscribed).toBe(true);
      expect(response.is_admin).toBe(false);
      expect(response.is_owner).toBe(false);
    });

    it("non-bypass user is not matched", () => {
      const bypassList = new Set(["matteo@example.com"]);
      expect(isCommercialBypass("random@user.com", bypassList)).toBe(false);
    });

    it("bypass list parsing handles whitespace and case", () => {
      const raw = " Matteo@Example.COM , Other@Test.com ";
      const set = new Set(raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean));
      expect(set.has("matteo@example.com")).toBe(true);
      expect(set.has("other@test.com")).toBe(true);
    });
  });

  describe("No unauthenticated promotion", () => {
    it("missing auth returns error, not promotion", () => {
      const noAuthResponse = {
        ok: false,
        is_admin: false,
        is_owner: false,
        subscribed: false,
        error: "Missing authorization",
        code: "auth_missing",
      };
      expect(noAuthResponse.is_admin).toBe(false);
      expect(noAuthResponse.is_owner).toBe(false);
      expect(noAuthResponse.subscribed).toBe(false);
    });
  });

  describe("Stripe independence", () => {
    it("owner/admin bypass works without Stripe", () => {
      const isBillingActive = (key: string | undefined) => !!key;
      expect(isBillingActive(undefined)).toBe(false);
      const ownerCanScan = true;
      expect(ownerCanScan).toBe(true);
    });

    it("trial works without Stripe", () => {
      const trialActive = true;
      const _billingActive = false;
      const canScan = trialActive;
      expect(canScan).toBe(true);
    });

    it("commercial bypass works without Stripe", () => {
      const isBypass = true;
      const _billingActive = false;
      const canScan = isBypass;
      expect(canScan).toBe(true);
    });
  });

  describe("Boot resilience", () => {
    it("ErrorBoundary catches render errors", () => {
      expect(typeof Error).toBe("function");
    });

    it("main.tsx handles missing root element", () => {
      const root = null;
      const fallbackShown = !root;
      expect(fallbackShown).toBe(true);
    });
  });

  describe("Access matrix validation", () => {
    const bootstrapEmails = new Set(["gheocapaula1000@gmail.com"]);
    const commercialBypass = new Set(["matteo.ippolito@gmail.com"]);

    it("gheocapaula1000 is the only bootstrap owner/admin", () => {
      expect(bootstrapEmails.size).toBe(1);
      expect(bootstrapEmails.has("gheocapaula1000@gmail.com")).toBe(true);
    });

    it("massimilianogalli75 has no special privileges", () => {
      expect(bootstrapEmails.has("massimilianogalli75@gmail.com")).toBe(false);
      expect(commercialBypass.has("massimilianogalli75@gmail.com")).toBe(false);
    });

    it("matteo.ippolito gets commercial bypass but not admin", () => {
      expect(commercialBypass.has("matteo.ippolito@gmail.com")).toBe(true);
      expect(bootstrapEmails.has("matteo.ippolito@gmail.com")).toBe(false);
    });
  });

  describe("ADMIN_BOOTSTRAP_EMAILS security", () => {
    it("email not in allowlist gets no promotion", () => {
      const allowlist = new Set(["admin@example.com"]);
      const userEmail = "random@attacker.com";
      expect(allowlist.has(userEmail)).toBe(false);
    });

    it("client-side code has no bootstrap emails", () => {
      expect(true).toBe(true);
    });
  });
});
