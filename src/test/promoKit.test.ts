import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PLANS, VAT_NOTICE } from "@/lib/plans";
import { PRICING_FAQ, faqJsonLd } from "@/lib/pricingFaq";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const SHARE_CARD = "https://sottra.app/brand/sottra-social-1200x630.jpg";

describe("Promo / SEO / OG kit", () => {
  const files = [
    "index.html",
    "public/robots.txt",
    "public/sitemap.xml",
    "src/pages/Prezzi.tsx",
    "src/lib/pricingFaq.ts",
    "src/components/landing/PricingSection.tsx",
  ];

  it("never mentions sottra.it or + IVA", () => {
    for (const f of files) {
      expect(src(f), f).not.toMatch(/sottra\.it/i);
      expect(src(f), f).not.toMatch(/\+\s?IVA/i);
    }
  });

  it("share card is the 1200x630 brand jpeg, not the app icon", () => {
    expect(existsSync(resolve(process.cwd(), "public/brand/sottra-social-1200x630.jpg"))).toBe(true);
    const html = src("index.html");
    expect(html).toContain(`property="og:image" content="${SHARE_CARD}"`);
    expect(html).toContain(`name="twitter:image" content="${SHARE_CARD}"`);
    expect(html).toContain('property="og:image:alt"');
    expect(html).toContain('name="twitter:image:alt"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('property="og:locale" content="it_IT"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toMatch(/og:image" content="[^"]*icon-512/);
    expect(html).not.toMatch(/twitter:image" content="[^"]*icon-512/);
  });

  it("Organization JSON-LD carries the legal entity and SoftwareApplication stays", () => {
    const html = src("index.html");
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain("Pi.Gi Service di Gheoca Paula");
    expect(html).toContain("05770260288");
    expect(html).toContain("Via Guidi Reni, 8");
    expect(html).toContain('"@type": "SoftwareApplication"');
    // no paid price declared as live checkout
    expect(html).not.toMatch(/"price":\s*"(79|249|690)"/);
  });

  it("/prezzi route exists and hero links to it", () => {
    const app = src("src/App.tsx");
    expect(app).toContain('path="/prezzi"');
    expect(app).toContain("pages/Prezzi");
    expect(src("src/components/landing/HeroSection.tsx")).toContain('navigate("/prezzi")');
    expect(src("src/pages/Index.tsx")).toContain("PricingSection");
  });

  it("prezzi page renders the FAQ array and emits FAQPage JSON-LD from it", () => {
    const page = src("src/pages/Prezzi.tsx");
    expect(page).toContain("PRICING_FAQ");
    expect(page).toContain("faqJsonLd");
    expect(page).toContain("application/ld+json");
    expect(page).toContain("PricingSection");
    const ld = faqJsonLd() as { "@type": string; mainEntity: unknown[] };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(PRICING_FAQ.length);
  });

  it("FAQ stays honest: VAT notice, no invented OMI/visura/APE/successione", () => {
    const all = PRICING_FAQ.map((f) => `${f.question} ${f.answer}`).join("\n");
    expect(all).toContain(VAT_NOTICE);
    expect(all).toMatch(/3 giorni/);
    expect(all).toMatch(/5 scansioni/);
    expect(all).toMatch(/WhatsApp/);
    expect(all).toMatch(/microzona, non questo interno/);
    expect(all).toMatch(/1\.400–1\.850 €\/m²/);
    expect(all).toMatch(/1° semestre 2025/);
    expect(all).not.toMatch(/\+\s?IVA/i);
    // only the homepage demo range is allowed as a numeric OMI example
    const omiNumbers = all.match(/\d[\d.]*\s?€\/m²/g) ?? [];
    expect(omiNumbers.every((n) => /1\.400|1\.850/.test(n))).toBe(true);
  });

  it("plans do not drift from 79 / 249 / 690", () => {
    expect(PLANS.agente.price).toBe(79);
    expect(PLANS.agenzia.price).toBe(249);
    expect(PLANS.rete.price).toBe(690);
    expect(PLANS.agenzia.users).toBe(-1);
    expect(VAT_NOTICE).toBe("IVA non applicabile (regime forfettario)");
    expect(src("src/components/landing/PricingSection.tsx")).toContain("VAT_NOTICE");
  });

  it("sitemap lists /prezzi and robots blocks the private area", () => {
    expect(src("public/sitemap.xml")).toContain("https://sottra.app/prezzi");
    const robots = src("public/robots.txt");
    expect(robots).toContain("Sitemap: https://sottra.app/sitemap.xml");
    for (const p of ["/app", "/admin", "/scan", "/result", "/history", "/territorial-report"]) {
      expect(robots).toContain(`Disallow: ${p}`);
    }
  });
});
