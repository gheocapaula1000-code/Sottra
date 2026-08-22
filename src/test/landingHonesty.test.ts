import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Landing and scan copy stay honest", () => {
  it("hero claims official Italian sources, not world-uniqueness or catasto truth", () => {
    const hero = src("src/components/landing/HeroSection.tsx");
    expect(hero).toMatch(/fonti ufficiali italiane/i);
    expect(hero).toMatch(/OMI/);
    expect(hero).not.toMatch(/unico al mondo/i);
    expect(hero).not.toMatch(/verifica catastale/i);
    expect(hero).not.toMatch(/visura/i);
  });

  it("pricing section reads live prices from plans.ts", () => {
    const pricing = src("src/components/landing/PricingSection.tsx");
    expect(pricing).toContain('from "@/lib/plans"');
    expect(pricing).toContain("plan.price");
    expect(pricing).not.toMatch(/price:\s*129/);
    expect(pricing).not.toMatch(/80 scansioni/);
  });

  it("trial expired screen uses the same plan catalog", () => {
    const trial = src("src/components/TrialExpiredScreen.tsx");
    expect(trial).toContain("PLAN_FEATURES");
    expect(trial).toContain("planScansLabel");
    expect(trial).toContain("isBillingReady");
    expect(trial).not.toMatch(/80 scansioni/);
  });

  it("capture gate does not claim civic/catasto building truth", () => {
    const gate = src("src/components/CaptureGate.tsx");
    expect(gate).toMatch(/Non è una verifica catastale/);
  });

  it("photoWow is documented as opener, not official report", () => {
    const wow = src("src/services/photoWow.ts");
    expect(wow).toMatch(/NOT the official Sottra report/);
    expect(wow).toMatch(/pro-sources/);
  });

  it("runtime scan hook does not import mockData", () => {
    const hook = src("src/hooks/useBuildingScan.ts");
    expect(hook).not.toMatch(/mockData/);
    expect(hook).toContain("runOfficialPipeline");
    expect(hook).toContain("runPhotoWow");
  });
});
