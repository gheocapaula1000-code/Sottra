import { describe, it, expect } from "vitest";
import fs from "fs";

/**
 * Security audit tests — validate hardening invariants.
 */

/* ── A. CORS deny-by-default ──────────────────────────── */

describe("CORS hardening", () => {
  const corsSource = fs.readFileSync("supabase/functions/_shared/cors.ts", "utf-8");

  it("does not contain wildcard '*' as a fallback origin", () => {
    const lines = corsSource.split("\n");
    const wildcardAssignments = lines.filter(
      (l) => l.includes('"*"') && l.includes("Origin"),
    );
    expect(wildcardAssignments).toHaveLength(0);
  });

  it("uses 'null' as deny-by-default when no allowlist", () => {
    expect(corsSource).toContain('"null"');
  });

  it("does NOT fallback to origins[0] for non-matching origin", () => {
    expect(corsSource).not.toContain("origins[0]");
  });

  it("always sets Vary: Origin header", () => {
    expect(corsSource).toContain('"Vary"');
    expect(corsSource).toContain('"Origin"');
  });

  it("reads from ALLOWED_ORIGINS env var", () => {
    expect(corsSource).toContain("ALLOWED_ORIGINS");
  });
});

/* ── B. Owner ≠ Admin separation ──────────────────────── */

describe("Owner/Admin separation", () => {
  const checkSubSource = fs.readFileSync(
    "supabase/functions/check-subscription/index.ts",
    "utf-8",
  );

  it("owner bypass does NOT set is_admin: true", () => {
    const ownerResponseLine = checkSubSource
      .split("\n")
      .find((l) => l.includes("code: \"owner\""));
    expect(ownerResponseLine).toBeDefined();
    expect(ownerResponseLine).toContain("is_admin: false");
    expect(ownerResponseLine).toContain("is_owner: true");
  });

  it("BASE_RESPONSE has separate owner and is_owner fields", () => {
    expect(checkSubSource).toContain("owner: false");
    expect(checkSubSource).toContain("is_owner: false");
    expect(checkSubSource).toContain("is_admin: false");
  });

  it("admin bypass derives from RBAC table, not email list", () => {
    expect(checkSubSource).toContain("user_roles");
    expect(checkSubSource).toContain('.eq("role", "admin")');
  });

  it("does NOT use isOwnerEmail for privilege checks", () => {
    expect(checkSubSource).not.toContain("isOwnerEmail(");
  });

  it("uses isOwnerById for owner checks", () => {
    expect(checkSubSource).toContain("isOwnerById");
  });

  it("supports commercial bypass (subscribed but not admin)", () => {
    expect(checkSubSource).toContain("isCommercialBypass");
    expect(checkSubSource).toContain("commercial_bypass");
    // commercial bypass must NOT grant admin
    const bypassBlock = checkSubSource.split("commercial bypass")[1]?.split("return json")[0] ?? "";
    expect(bypassBlock).not.toContain("is_admin: true");
  });
});

/* ── C. Owner utils no longer email-based ─────────────── */

describe("ownerUtils server-side hardening", () => {
  const ownerSource = fs.readFileSync("supabase/functions/_shared/ownerUtils.ts", "utf-8");

  it("does not read OWNER_EMAILS env var for privilege", () => {
    expect(ownerSource).not.toContain('Deno.env.get("OWNER_EMAILS")');
  });

  it("uses isOwnerById with user_id", () => {
    expect(ownerSource).toContain("isOwnerById");
  });

  it("deprecated isOwnerEmail always returns false", () => {
    expect(ownerSource).toContain("return false");
  });
});

/* ── D. Diagnostics requires admin RBAC or owner ──────── */

describe("Diagnostics access control", () => {
  const diagSource = fs.readFileSync("supabase/functions/diagnostics/index.ts", "utf-8");

  it("does NOT import isOwnerEmail", () => {
    expect(diagSource).not.toContain("isOwnerEmail");
  });

  it("requires admin role via has_role or owner via isOwnerById", () => {
    expect(diagSource).toContain("has_role");
    expect(diagSource).toContain('"admin"');
  });

  it("allows owner access via isOwnerById", () => {
    expect(diagSource).toContain("isOwnerById");
  });

  it("does NOT expose is_official or raw host info", () => {
    expect(diagSource).not.toContain("is_official");
    expect(diagSource).not.toContain("OFFICIAL_HOST");
  });
});

/* ── E. Core-proxy secret resolution ──────────────────── */

describe("Core-proxy secret resolution", () => {
  const proxySource = fs.readFileSync("supabase/functions/core-proxy/index.ts", "utf-8");

  it("supports AI_CORE_SECRET_SOTTRA as priority", () => {
    expect(proxySource).toContain("AI_CORE_SECRET_SOTTRA");
  });

  it("falls back to AI_CORE_SECRET", () => {
    expect(proxySource).toContain("AI_CORE_SECRET");
  });

  it("falls back to legacy CORE_API_KEY", () => {
    expect(proxySource).toContain("CORE_API_KEY");
  });

  it("sends x-source-app: sottra", () => {
    expect(proxySource).toContain('"x-source-app": "sottra"');
  });
});

/* ── F. PII minimization in scan history ──────────────── */

describe("Scan history PII minimization", () => {
  const scanHistorySource = fs.readFileSync(
    "src/contexts/ScanHistoryContext.tsx",
    "utf-8",
  );

  it("SavedScan interface does NOT contain photo field", () => {
    const interfaceMatch = scanHistorySource.match(
      /interface SavedScan \{[\s\S]*?\}/,
    );
    expect(interfaceMatch).toBeTruthy();
    const iface = interfaceMatch![0];
    expect(iface).not.toContain("photo");
  });

  it("SavedScan interface does NOT contain address field", () => {
    const interfaceMatch = scanHistorySource.match(
      /interface SavedScan \{[\s\S]*?\}/,
    );
    const iface = interfaceMatch![0];
    expect(iface).not.toContain("address:");
  });

  it("SavedScan interface does NOT contain lat/lng fields", () => {
    const interfaceMatch = scanHistorySource.match(
      /interface SavedScan \{[\s\S]*?\}/,
    );
    const iface = interfaceMatch![0];
    expect(iface).not.toContain("lat:");
    expect(iface).not.toContain("lng:");
  });

  it("uses locality instead of full address", () => {
    expect(scanHistorySource).toContain("locality");
  });
});

/* ── G. Customer-portal no email bypass ───────────────── */

describe("Customer-portal hardening", () => {
  const portalSource = fs.readFileSync("supabase/functions/customer-portal/index.ts", "utf-8");

  it("does NOT use isOwnerEmail", () => {
    expect(portalSource).not.toContain("isOwnerEmail(");
  });

  it("uses isOwnerById for owner check", () => {
    expect(portalSource).toContain("isOwnerById");
  });

  it("does not use hardcoded localhost for return URL", () => {
    expect(portalSource).not.toContain("localhost:3000");
  });
});

/* ── H. No PII in consumer pages ──────────────────────── */

describe("Consumer pages use minimal scan data", () => {
  it("History page does not reference legacy scan fields (raw photo, address)", () => {
    const historySource = fs.readFileSync("src/pages/History.tsx", "utf-8");
    // scan.photoThumbnail is OK (compressed thumbnail), but raw scan.photo is not
    // Use word-boundary check: "scan.photo" not followed by "Thumbnail"
    const hasRawPhoto = /scan\.photo(?!Thumbnail|_thumbnail)/.test(historySource);
    expect(hasRawPhoto).toBe(false);
    expect(historySource).not.toContain("scan.address");
  });

  it("Dashboard does not reference scan.photo or scan.address", () => {
    const dashSource = fs.readFileSync("src/pages/Dashboard.tsx", "utf-8");
    expect(dashSource).not.toContain("scan.photo");
    expect(dashSource).not.toContain("scan.address");
  });

  it("Result page saves only locality, not full address", () => {
    const resultSource = fs.readFileSync("src/pages/Result.tsx", "utf-8");
    expect(resultSource).toContain("locality:");
    expect(resultSource).not.toMatch(/saveScan\(\{[^}]*photo:/);
  });
});

/* ── I. Commercial bypass in adminBootstrap ───────────── */

describe("Commercial bypass module", () => {
  const bootstrapSource = fs.readFileSync("supabase/functions/_shared/adminBootstrap.ts", "utf-8");

  it("exports isCommercialBypass function", () => {
    expect(bootstrapSource).toContain("export function isCommercialBypass");
  });

  it("reads COMMERCIAL_BYPASS_EMAILS env var", () => {
    expect(bootstrapSource).toContain("COMMERCIAL_BYPASS_EMAILS");
  });

  it("commercial bypass does NOT upsert owner_access or user_roles", () => {
    // isCommercialBypass is a pure check, no DB writes
    const fnBody = bootstrapSource.split("export function isCommercialBypass")[1] ?? "";
    expect(fnBody).not.toContain("owner_access");
    expect(fnBody).not.toContain("user_roles");
  });
});
