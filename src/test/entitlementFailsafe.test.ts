import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Server entitlement failsafe — source invariants.
 * checkEntitlement cannot be imported here (Deno + service role).
 * Decision rules must stay fail-closed: error / past_due / expired → denied.
 */
describe("checkEntitlement fail-closed", () => {
  const entitlement = readFileSync("supabase/functions/_shared/entitlement.ts", "utf-8");

  it("never trusts the client; every paid data function must call it", () => {
    expect(entitlement).toContain("Never trust client-side gating");
    expect(entitlement).toContain("export async function checkEntitlement");
  });

  it("uses service role + isOwnerById, not email lists", () => {
    expect(entitlement).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(entitlement).toContain("isOwnerById");
    expect(entitlement).not.toContain("isOwnerEmail");
    expect(entitlement).not.toContain("ADMIN_BOOTSTRAP_EMAILS");
    expect(entitlement).not.toContain("CORE_API_KEY");
  });

  it("subscription allowlist is only active and trialing (not past_due)", () => {
    expect(entitlement).toContain('.in("status", ["active", "trialing"])');
    expect(entitlement).not.toMatch(/in\("status".*past_due/);
  });

  it("trial requires both time remaining and scans remaining", () => {
    expect(entitlement).toContain("trial_end");
    expect(entitlement).toContain("scans_used");
    expect(entitlement).toContain("max_scans");
    expect(entitlement).toMatch(/scans_used\s*<\s*trial\.max_scans/);
  });

  it("catch path returns allowed: false reason error", () => {
    expect(entitlement).toContain('reason: "error"');
    expect(entitlement).toContain("allowed: false");
    expect(entitlement).toMatch(/return \{ allowed: false, reason: "error" \}/);
    expect(entitlement).toMatch(/return \{ allowed: false, reason: "expired" \}/);
  });

  it("agency seat inheritance is fail-closed on lookup error", () => {
    expect(entitlement).toContain("inheritsAgencySeat");
    expect(entitlement).toContain("fail-closed");
  });
});

describe("paid data functions gate on checkEntitlement", () => {
  const proxy = readFileSync("supabase/functions/core-proxy/index.ts", "utf-8");
  const pro = readFileSync("supabase/functions/pro-sources/index.ts", "utf-8");

  it("core-proxy denies before forwarding to /sottra/*", () => {
    expect(proxy).toContain("checkEntitlement");
    expect(proxy).toContain("limit_reached");
    expect(proxy).toContain("403");
    expect(proxy).toContain("/sottra");
    expect(proxy.indexOf("checkEntitlement")).toBeLessThan(proxy.indexOf("buildSottraCoreUrl"));
  });

  it("core-proxy still reads Core secret from env only", () => {
    expect(proxy).toContain("AI_CORE_SECRET_SOTTRA");
    expect(proxy).toContain("Deno.env.get(\"CORE_API_KEY\")");
    expect(proxy).not.toMatch(/CORE_API_KEY\s*=\s*["'`]/);
    expect(proxy).not.toContain("VITE_CORE_API_KEY");
  });

  it("pro-sources also uses the shared entitlement gate", () => {
    expect(pro).toContain("checkEntitlement");
    expect(pro).toContain("limit_reached");
  });
});

describe("record-scan does not grant access on Stripe failure", () => {
  const record = readFileSync("supabase/functions/record-scan/index.ts", "utf-8");

  it("uses DB subscription status before Stripe", () => {
    expect(record).toMatch(/active|trialing/);
    expect(record).not.toContain("isOwnerEmail(");
  });
});
