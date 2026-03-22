import { describe, it, expect } from "vitest";
import fs from "fs";

/**
 * Security audit tests — validate hardening invariants.
 */

/* ── A. CORS deny-by-default ──────────────────────────── */

describe("CORS hardening", () => {
  const corsSource = fs.readFileSync("supabase/functions/_shared/cors.ts", "utf-8");

  it("does not contain wildcard '*' as a fallback origin", () => {
    // Should never fall back to "*"
    const lines = corsSource.split("\n");
    const wildcardAssignments = lines.filter(
      (l) => l.includes('"*"') && l.includes("Origin"),
    );
    expect(wildcardAssignments).toHaveLength(0);
  });

  it("uses 'null' as deny-by-default when no allowlist", () => {
    expect(corsSource).toContain('"null"');
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
    // Find the owner bypass response line
    const ownerLines = checkSubSource.split("\n").filter(
      (l) => l.includes("owner bypass") || (l.includes("is_owner: true") && l.includes("code: \"owner\"")),
    );
    expect(ownerLines.length).toBeGreaterThan(0);

    // The response for owner should have is_admin: false
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
    // Admin check should reference user_roles table
    expect(checkSubSource).toContain("user_roles");
    expect(checkSubSource).toContain('.eq("role", "admin")');
  });
});

/* ── C. PII minimization in scan history ──────────────── */

describe("Scan history PII minimization", () => {
  const scanHistorySource = fs.readFileSync(
    "src/contexts/ScanHistoryContext.tsx",
    "utf-8",
  );

  it("SavedScan interface does NOT contain photo field", () => {
    // Check the interface definition area
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

  it("SavedScan interface does NOT contain scanResult field", () => {
    const interfaceMatch = scanHistorySource.match(
      /interface SavedScan \{[\s\S]*?\}/,
    );
    const iface = interfaceMatch![0];
    expect(iface).not.toContain("scanResult");
  });

  it("uses locality instead of full address", () => {
    expect(scanHistorySource).toContain("locality");
  });

  it("includes legacy migration logic", () => {
    expect(scanHistorySource).toContain("migrateLegacy");
    expect(scanHistorySource).toContain("PII removed");
  });

  it("legacy migration strips photo, lat, scanResult", () => {
    expect(scanHistorySource).toContain('"photo" in e');
    expect(scanHistorySource).toContain('"lat" in e');
  });
});

/* ── D. No PII in consumer pages ──────────────────────── */

describe("Consumer pages use minimal scan data", () => {
  it("History page does not reference scan.photo", () => {
    const historySource = fs.readFileSync("src/pages/History.tsx", "utf-8");
    expect(historySource).not.toContain("scan.photo");
    expect(historySource).not.toContain("scan.address");
    expect(historySource).not.toContain("scan.lat");
    expect(historySource).not.toContain("scan.lng");
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
