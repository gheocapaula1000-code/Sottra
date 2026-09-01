import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLANS,
  PLAN_FEATURES,
  PLAN_DESCRIPTIONS,
  PLAN_POPULAR,
  PLAN_SCAN_CAPS,
  ALLOWED_PRICE_IDS,
  VAT_NOTICE,
  planScansLabel,
  planUsersLabel,
  type PlanKey,
} from "@/lib/plans";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Commercial offer matches plans.ts", () => {
  it("flat monthly prices are 79 / 249 / 690", () => {
    expect(PLANS.agente.price).toBe(79);
    expect(PLANS.agenzia.price).toBe(249);
    expect(PLANS.rete.price).toBe(690);
  });

  it("scan caps are 80 / 600 / 2000", () => {
    expect(PLANS.agente.scans).toBe(80);
    expect(PLANS.agenzia.scans).toBe(600);
    expect(PLANS.rete.scans).toBe(2000);
    expect(PLAN_SCAN_CAPS).toEqual({ agente: 80, agenzia: 600, rete: 2000 });
  });

  it("phones: 1 for Agente, unlimited for Agenzia and Rete", () => {
    expect(PLANS.agente.users).toBe(1);
    expect(PLANS.agenzia.users).toBe(-1);
    expect(PLANS.rete.users).toBe(-1);
    expect(planUsersLabel(PLANS.agenzia.users)).toBe("Telefoni illimitati");
    expect(planUsersLabel(PLANS.agente.users)).toBe("1 telefono");
    expect(planScansLabel(PLANS.agente.scans)).toBe("80 scansioni/mese");
  });

  it("every plan has display copy", () => {
    for (const key of Object.keys(PLANS) as PlanKey[]) {
      expect(PLAN_DESCRIPTIONS[key].length).toBeGreaterThan(10);
      expect(PLAN_FEATURES[key].length).toBeGreaterThan(2);
    }
    expect(PLAN_POPULAR).toBe("agenzia");
  });

  it("no annual plan and no TODO placeholder price", () => {
    expect(ALLOWED_PRICE_IDS).toHaveLength(3);
    for (const id of ALLOWED_PRICE_IDS) {
      expect(id).toMatch(/^price_/);
      expect(id).not.toMatch(/_TODO/);
    }
    const server = src("supabase/functions/_shared/allowedPrices.ts");
    expect(server).not.toMatch(/_TODO/);
    for (const id of ALLOWED_PRICE_IDS) expect(server).toContain(id);
  });

  it("does not keep the retired prices", () => {
    const prices = [PLANS.agente.price, PLANS.agenzia.price, PLANS.rete.price];
    expect(prices).not.toContain(299);
    expect(prices).not.toContain(699);
    expect(prices).not.toContain(1490);
  });
});

describe("Landing and SEO kit — sottra.app only, no VAT, no renovation claim", () => {
  const files = [
    "index.html",
    "public/sitemap.xml",
    "public/robots.txt",
    "public/manifest.webmanifest",
    "src/components/landing/PricingSection.tsx",
    "src/lib/plans.ts",
  ];

  it("never references sottra.it, + IVA, ristrutturazione or the old prices", () => {
    for (const f of files) {
      const content = src(f);
      expect(content, f).not.toMatch(/sottra\.it/i);
      expect(content, f).not.toMatch(/\+\s?IVA/i);
      expect(content, f).not.toMatch(/ristruttur/i);
      expect(content, f).not.toMatch(/\b(299|699|1490)\b/);
    }
  });

  it("canonical, og:url, og:image and sitemap point to sottra.app", () => {
    const html = src("index.html");
    expect(html).toContain('<link rel="canonical" href="https://sottra.app/" />');
    expect(html).toContain('property="og:url" content="https://sottra.app/"');
    expect(html).toContain('property="og:image" content="https://sottra.app/icons/icon-512.png"');
    expect(html).toContain('name="twitter:image" content="https://sottra.app/icons/icon-512.png"');
    expect(src("public/sitemap.xml")).toContain("https://sottra.app/");
    expect(src("public/robots.txt")).toContain("https://sottra.app/sitemap.xml");
  });

  it("meta description keeps OMI microzone honesty", () => {
    const html = src("index.html");
    expect(html).toMatch(/OMI ufficiale di microzona/);
    expect(html).toMatch(/stime restano stime/i);
    expect(html).toMatch(/catastale/i);
  });

  it("manifest declares italian language", () => {
    const manifest = JSON.parse(src("public/manifest.webmanifest"));
    expect(manifest.lang).toBe("it");
  });

  it("pricing page shows 79/249/690, VAT notice, trial, coverage and WhatsApp gesture", () => {
    const pricing = src("src/components/landing/PricingSection.tsx");
    expect(pricing).toContain("VAT_NOTICE");
    expect(VAT_NOTICE).toBe("IVA non applicabile (regime forfettario)");
    expect(pricing).toMatch(/3 giorni/);
    expect(pricing).toMatch(/5 scansioni/);
    expect(pricing).toMatch(/senza carta|zero carta|Nessuna carta/i);
    expect(pricing).toMatch(/WhatsApp/);
    expect(pricing).toMatch(/Padova/);
    expect(pricing).not.toMatch(/successione|vendita del civico/i);
  });
});
