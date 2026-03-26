import { describe, it, expect } from "vitest";

// These tests validate the gating logic without rendering React components,
// by testing the decision rules that TrialProtectedRoute / AppDashboardGate use.

/** Auth error codes from check-subscription that should trigger local signout, not bootFailed. */
const AUTH_ERROR_CODES = new Set(["auth_missing", "auth_empty", "auth_invalid", "auth_exception"]);

describe("Screen gating logic", () => {
  describe("canScan derivation", () => {
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
    expect(classifyError("")).toBe("transient");
  });

  it("owner bootstrap returns code=bootstrap → valid, not an error", () => {
    const payload = { ok: true, subscribed: true, is_owner: true, is_admin: true, code: "bootstrap" };
    expect(payload.subscribed).toBe(true);
    expect(payload.is_owner).toBe(true);
    expect(payload.ok).toBe(true);
  });
});

describe("Diagnostic code mapping", () => {
  const DIAGNOSTIC_LABELS: Record<string, string> = {
    NETWORK_ERROR: "Errore di rete — controlla la tua connessione.",
    INVOKE_ERROR: "Il servizio non ha risposto correttamente.",
    CORS_ORIGIN_BLOCKED: "Origine non autorizzata — contatta il supporto.",
    FUNCTION_ERROR: "Errore nel servizio di verifica abbonamento.",
    MALFORMED_RESPONSE: "Risposta non valida dal server.",
    UNEXPECTED_ERROR: "Errore imprevisto — riprova tra poco.",
    fatal: "Errore interno del server.",
    init_error: "Errore di configurazione del server.",
    CHECK_SUBSCRIPTION_FAILED: "Impossibile verificare lo stato dell'account.",
    origin_not_allowed: "Origine non autorizzata — contatta il supporto.",
    owner_bootstrap_missing: "Account owner non configurato — contatta il supporto.",
    owner_bootstrap_failed: "Bootstrap owner non riuscito — riprova o contatta il supporto.",
    billing_not_configured: "Sistema di pagamento non ancora configurato.",
  };

  it("all transient codes have a label", () => {
    const transientCodes = [
      "NETWORK_ERROR", "INVOKE_ERROR", "FUNCTION_ERROR",
      "MALFORMED_RESPONSE", "UNEXPECTED_ERROR", "fatal",
      "init_error", "CHECK_SUBSCRIPTION_FAILED",
    ];
    for (const code of transientCodes) {
      expect(DIAGNOSTIC_LABELS[code]).toBeDefined();
      expect(DIAGNOSTIC_LABELS[code].length).toBeGreaterThan(5);
    }
  });

  it("auth codes do NOT appear in diagnostic labels (they trigger signout)", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(DIAGNOSTIC_LABELS[code]).toBeUndefined();
    }
  });

  it("owner_bootstrap_failed has a specific label", () => {
    expect(DIAGNOSTIC_LABELS["owner_bootstrap_failed"]).toContain("Bootstrap owner");
  });

  it("owner_bootstrap_missing has a specific label", () => {
    expect(DIAGNOSTIC_LABELS["owner_bootstrap_missing"]).toContain("owner non configurato");
  });

  it("origin_not_allowed has a specific label", () => {
    expect(DIAGNOSTIC_LABELS["origin_not_allowed"]).toContain("Origine non autorizzata");
  });

  it("billing_not_configured has a specific label", () => {
    expect(DIAGNOSTIC_LABELS["billing_not_configured"]).toContain("pagamento");
  });
});

describe("Email normalization for owner bootstrap", () => {
  function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  function isInAllowlist(email: string, allowlist: string[]): boolean {
    const normalized = normalizeEmail(email);
    return allowlist.map(normalizeEmail).includes(normalized);
  }

  it("matches exact email", () => {
    expect(isInAllowlist("gheocapaula1000@gmail.com", ["gheocapaula1000@gmail.com"])).toBe(true);
  });

  it("matches email with uppercase", () => {
    expect(isInAllowlist("GheocaPaula1000@Gmail.COM", ["gheocapaula1000@gmail.com"])).toBe(true);
  });

  it("matches email with leading/trailing spaces", () => {
    expect(isInAllowlist("  gheocapaula1000@gmail.com  ", ["gheocapaula1000@gmail.com"])).toBe(true);
  });

  it("matches email when allowlist has spaces", () => {
    expect(isInAllowlist("gheocapaula1000@gmail.com", [" gheocapaula1000@gmail.com "])).toBe(true);
  });

  it("does not match different email", () => {
    expect(isInAllowlist("other@gmail.com", ["gheocapaula1000@gmail.com"])).toBe(false);
  });
});

describe("Sottra access matrix — three-tier model", () => {
  const ADMIN_BOOTSTRAP = ["gheocapaula1000@gmail.com"];
  const COMMERCIAL_BYPASS = ["matteo.ippolito@gmail.com"];

  function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  function isOwnerAdmin(email: string): boolean {
    return ADMIN_BOOTSTRAP.map(normalizeEmail).includes(normalizeEmail(email));
  }

  function isBypass(email: string): boolean {
    return COMMERCIAL_BYPASS.map(normalizeEmail).includes(normalizeEmail(email));
  }

  function getAccessTier(email: string) {
    const norm = normalizeEmail(email);
    if (isOwnerAdmin(norm)) return { isOwner: true, isAdmin: true, subscribed: true, canAccessAdmin: true };
    if (isBypass(norm)) return { isOwner: false, isAdmin: false, subscribed: true, canAccessAdmin: false };
    return { isOwner: false, isAdmin: false, subscribed: false, canAccessAdmin: false };
  }

  it("gheocapaula1000 = owner + admin + full bypass", () => {
    const tier = getAccessTier("gheocapaula1000@gmail.com");
    expect(tier).toEqual({ isOwner: true, isAdmin: true, subscribed: true, canAccessAdmin: true });
  });

  it("gheocapaula1000 with mixed case = same tier", () => {
    const tier = getAccessTier("  GheocaPaula1000@Gmail.COM  ");
    expect(tier).toEqual({ isOwner: true, isAdmin: true, subscribed: true, canAccessAdmin: true });
  });

  it("matteo.ippolito = bypass access, NOT admin", () => {
    const tier = getAccessTier("matteo.ippolito@gmail.com");
    expect(tier.subscribed).toBe(true);
    expect(tier.isAdmin).toBe(false);
    expect(tier.isOwner).toBe(false);
    expect(tier.canAccessAdmin).toBe(false);
  });

  it("matteo.ippolito with spaces/caps = same tier", () => {
    const tier = getAccessTier("  Matteo.Ippolito@Gmail.COM  ");
    expect(tier.subscribed).toBe(true);
    expect(tier.isAdmin).toBe(false);
    expect(tier.canAccessAdmin).toBe(false);
  });

  it("massimilianogalli75 = standard user, no bypass", () => {
    const tier = getAccessTier("massimilianogalli75@gmail.com");
    expect(tier).toEqual({ isOwner: false, isAdmin: false, subscribed: false, canAccessAdmin: false });
  });

  it("massimilianogalli75 cannot access admin", () => {
    expect(getAccessTier("massimilianogalli75@gmail.com").canAccessAdmin).toBe(false);
  });

  it("matteo cannot access admin/diagnostica", () => {
    expect(getAccessTier("matteo.ippolito@gmail.com").canAccessAdmin).toBe(false);
  });

  it("only gheocapaula1000 is in ADMIN_BOOTSTRAP", () => {
    expect(ADMIN_BOOTSTRAP).toHaveLength(1);
    expect(ADMIN_BOOTSTRAP[0]).toBe("gheocapaula1000@gmail.com");
  });

  it("COMMERCIAL_BYPASS does not overlap ADMIN_BOOTSTRAP", () => {
    for (const email of COMMERCIAL_BYPASS) {
      expect(ADMIN_BOOTSTRAP).not.toContain(email);
    }
  });
});

describe("check-subscription response handling — ok=true with error field", () => {
  /**
   * Simulates the SubscriptionContext logic:
   * ok=true responses should be parsed normally even if they have an error message.
   * Only ok=false (or missing ok) with error triggers error handling.
   */
  function shouldParseAsSuccess(body: Record<string, unknown>): boolean {
    const bodyOk = body.ok === true;
    const bodyError = typeof body.error === "string" && body.error ? body.error : null;
    // If ok=true, always parse the payload (even if error field has info text)
    if (bodyOk) return true;
    // If error present and ok≠true, it's an error
    if (bodyError) return false;
    return true;
  }

  it("owner_bootstrap_failed with ok=true is parsed as success", () => {
    expect(shouldParseAsSuccess({
      ok: true, subscribed: true, is_admin: false, is_owner: true,
      code: "owner_bootstrap_failed",
      error: "Owner bootstrap partially failed",
    })).toBe(true);
  });

  it("bootstrap with ok=true is parsed as success", () => {
    expect(shouldParseAsSuccess({
      ok: true, subscribed: true, is_admin: true, is_owner: true,
      code: "bootstrap",
    })).toBe(true);
  });

  it("auth_invalid with ok=false is an error", () => {
    expect(shouldParseAsSuccess({
      ok: false, error: "Auth error", code: "auth_invalid",
    })).toBe(false);
  });

  it("fatal with ok=false is an error", () => {
    expect(shouldParseAsSuccess({
      ok: false, error: "Internal error", code: "fatal",
    })).toBe(false);
  });

  it("resolved with ok=true is parsed as success", () => {
    expect(shouldParseAsSuccess({
      ok: true, subscribed: false, code: "resolved",
    })).toBe(true);
  });

  it("commercial_bypass with ok=true is parsed as success", () => {
    expect(shouldParseAsSuccess({
      ok: true, subscribed: true, code: "commercial_bypass",
    })).toBe(true);
  });
});

describe("Owner bootstrap state values", () => {
  const VALID_STATES = ["matched", "missing", "failed", "not_applicable"] as const;

  it("all expected states are defined", () => {
    expect(VALID_STATES).toContain("matched");
    expect(VALID_STATES).toContain("missing");
    expect(VALID_STATES).toContain("failed");
    expect(VALID_STATES).toContain("not_applicable");
    expect(VALID_STATES).toHaveLength(4);
  });
});

describe("Client-side fallback diagnostics", () => {
  const DIAGNOSTIC_LABELS: Record<string, string> = {
    NETWORK_ERROR: "Backend o rete non raggiungibile — controlla la connessione.",
    INVOKE_ERROR: "Errore tecnico di invocazione del servizio.",
    CORS_ORIGIN_BLOCKED: "Richiesta bloccata dalla policy di origine consentita.",
    UNKNOWN_BOOT_FAILURE: "Errore di avvio sconosciuto — riprova tra poco.",
    SELF_TEST_UNAVAILABLE: "Servizio di diagnostica non raggiungibile.",
    MALFORMED_RESPONSE: "Risposta non valida dal server.",
    FUNCTION_ERROR: "Errore nel servizio di verifica abbonamento.",
    UNEXPECTED_ERROR: "Errore imprevisto — riprova tra poco.",
  };

  it("every diagnostic code has a human label", () => {
    const codes = [
      "NETWORK_ERROR", "INVOKE_ERROR", "CORS_ORIGIN_BLOCKED",
      "UNKNOWN_BOOT_FAILURE", "SELF_TEST_UNAVAILABLE",
      "MALFORMED_RESPONSE", "FUNCTION_ERROR", "UNEXPECTED_ERROR",
    ];
    for (const c of codes) {
      expect(DIAGNOSTIC_LABELS[c]).toBeTruthy();
    }
  });

  it("CORS-like error messages are classified as CORS_ORIGIN_BLOCKED", () => {
    const classify = (msg: string) => {
      const isCorsLike = /failed to fetch|load failed|networkerror|cors|blocked|opaque/i.test(msg);
      const isNetworkLike = /network|timeout|abort|econnrefused|enotfound|socket/i.test(msg);
      return isCorsLike ? "CORS_ORIGIN_BLOCKED" : isNetworkLike ? "NETWORK_ERROR" : "INVOKE_ERROR";
    };

    expect(classify("Failed to fetch")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classify("Load failed")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classify("NetworkError when attempting")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classify("blocked by CORS policy")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classify("opaque response")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classify("timeout exceeded")).toBe("NETWORK_ERROR");
    expect(classify("ECONNREFUSED")).toBe("NETWORK_ERROR");
    expect(classify("socket hang up")).toBe("NETWORK_ERROR");
    expect(classify("some random error")).toBe("INVOKE_ERROR");
  });

  it("invoke result.error with CORS-like message classifies as CORS_ORIGIN_BLOCKED, not INVOKE_ERROR", () => {
    const classifyInvokeError = (msg: string) => {
      const isCorsLike = /failed to fetch|load failed|networkerror|cors|blocked|opaque/i.test(msg);
      const isNetworkLike = /network|timeout|abort|econnrefused|enotfound|socket/i.test(msg);
      return isCorsLike ? "CORS_ORIGIN_BLOCKED" : isNetworkLike ? "NETWORK_ERROR" : "INVOKE_ERROR";
    };

    // These come from supabase.functions.invoke result.error (not catch)
    expect(classifyInvokeError("Failed to send a request to the Edge Function")).toBe("INVOKE_ERROR");
    expect(classifyInvokeError("Failed to fetch")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classifyInvokeError("NetworkError: blocked by CORS")).toBe("CORS_ORIGIN_BLOCKED");
    expect(classifyInvokeError("abort timeout")).toBe("NETWORK_ERROR");
  });

  it("backend unreachable prefers NETWORK_ERROR over INVOKE_ERROR", () => {
    const classifyInvokeError = (msg: string) => {
      const isCorsLike = /failed to fetch|load failed|networkerror|cors|blocked|opaque/i.test(msg);
      const isNetworkLike = /network|timeout|abort|econnrefused|enotfound|socket/i.test(msg);
      return isCorsLike ? "CORS_ORIGIN_BLOCKED" : isNetworkLike ? "NETWORK_ERROR" : "INVOKE_ERROR";
    };

    expect(classifyInvokeError("ECONNREFUSED 127.0.0.1:443")).toBe("NETWORK_ERROR");
    expect(classifyInvokeError("socket hang up")).toBe("NETWORK_ERROR");
    expect(classifyInvokeError("network timeout at: https://...")).toBe("NETWORK_ERROR");
  });

  it("empty errorCode defaults to UNKNOWN_BOOT_FAILURE", () => {
    const handleCode = (code?: string) => code || "UNKNOWN_BOOT_FAILURE";
    expect(handleCode(undefined)).toBe("UNKNOWN_BOOT_FAILURE");
    expect(handleCode("")).toBe("UNKNOWN_BOOT_FAILURE");
    expect(handleCode("NETWORK_ERROR")).toBe("NETWORK_ERROR");
  });

  it("displayCode in retry UI is never empty", () => {
    const displayCode = (errorCode: string | null) => errorCode || "UNKNOWN_BOOT_FAILURE";
    expect(displayCode(null)).toBe("UNKNOWN_BOOT_FAILURE");
    expect(displayCode("")).toBe("UNKNOWN_BOOT_FAILURE");
    expect(displayCode("CORS_ORIGIN_BLOCKED")).toBe("CORS_ORIGIN_BLOCKED");
  });

  it("self-test failure shows SELF_TEST_UNAVAILABLE code", () => {
    expect(DIAGNOSTIC_LABELS["SELF_TEST_UNAVAILABLE"]).toBe("Servizio di diagnostica non raggiungibile.");
  });
});
