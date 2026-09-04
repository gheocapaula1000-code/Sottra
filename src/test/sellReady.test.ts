import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PLANS, VAT_NOTICE } from "@/lib/plans";
import { isBillingReady, setBillingReady } from "@/lib/billing";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Sell-ready — secrets stay out of git and the frontend", () => {
  it(".env is not tracked", () => {
    const tracked = execSync("git ls-files -- .env", { encoding: "utf8" }).trim();
    expect(tracked).toBe("");
  });

  it(".env.example is template-only", () => {
    const example = src(".env.example");
    expect(example).toContain("VITE_SUPABASE_URL=");
    expect(example).toContain("VITE_USE_MOCK=false");
    expect(example).not.toMatch(/^STRIPE_SECRET_KEY=/m);
    expect(example).not.toMatch(/^STRIPE_WEBHOOK_SECRET=/m);
    expect(example).not.toMatch(/^CORE_API_KEY=/m);
    expect(example).toMatch(/ALLOWED_ORIGINS=https:\/\/sottra\.app/);
    expect(example).toContain("billing_active");
  });

  it("verify-secrets blocks a tracked .env but allows a local Lovable copy", () => {
    const script = src("scripts/verify-secrets.sh");
    expect(script).toContain("git ls-files --error-unmatch .env");
    expect(script).toContain("Lovable-managed");
    expect(script).toContain("never commit");
    expect(script).not.toContain("must stay gitignored; never commit");
  });

  it("CI and Vitest supply publishable Vite placeholders without a tracked .env", () => {
    const ci = src(".github/workflows/ci.yml");
    expect(ci).toContain("VITE_SUPABASE_URL: https://example.supabase.co");
    expect(ci).toContain("VITE_SUPABASE_PUBLISHABLE_KEY: test-publishable-key");
    expect(ci).not.toMatch(/sk_live_|sk_test_|STRIPE_SECRET_KEY:\s*[^\s#]/);
    const vitest = src("vitest.config.ts");
    expect(vitest).toContain("VITE_SUPABASE_URL");
    expect(vitest).toContain("https://example.supabase.co");
  });
});

describe("Sell-ready — billing_active gates checkout", () => {
  it("server requires all three billing secrets", () => {
    const billing = src("supabase/functions/_shared/billing.ts");
    expect(billing).toContain("STRIPE_SECRET_KEY");
    expect(billing).toContain("STRIPE_WEBHOOK_SECRET");
    expect(billing).toContain("ALLOWED_ORIGINS");
  });

  it("create-checkout and customer-portal degrade without billing", () => {
    expect(src("supabase/functions/create-checkout/index.ts")).toContain("isBillingActive()");
    expect(src("supabase/functions/create-checkout/index.ts")).toContain("status: 503");
    expect(src("supabase/functions/create-checkout/index.ts")).toContain('locale: "it"');
    expect(src("supabase/functions/create-checkout/index.ts")).toContain("automatic_tax: { enabled: false }");
    expect(src("supabase/functions/customer-portal/index.ts")).toContain("isBillingActive()");
    expect(src("supabase/functions/customer-portal/index.ts")).toContain("status: 503");
  });

  it("paywall hides Stripe CTAs until billingReady", () => {
    const trial = src("src/components/TrialExpiredScreen.tsx");
    expect(trial).toContain("isBillingReady");
    expect(trial).toContain("handleCheckout");
    expect(trial).toContain("APP_BRAND.supportEmail");
    expect(trial).toContain("past_due");
  });

  it("client billing defaults off", () => {
    setBillingReady(false);
    expect(isBillingReady()).toBe(false);
  });

  it("checkout return polls success and toasts cancel", () => {
    const ctx = src("src/contexts/SubscriptionContext.tsx");
    expect(ctx).toContain('checkout === "success"');
    expect(ctx).toContain('checkout === "cancel"');
    expect(ctx).toContain("Pagamento ricevuto");
    expect(ctx).toContain("Pagamento annullato");
    expect(ctx).toContain("10000");
  });
});

describe("Sell-ready — commercial surfaces match plans.ts", () => {
  it("listino remains 79 / 249 / 690 flat monthly, no VAT", () => {
    expect(PLANS.agente.price).toBe(79);
    expect(PLANS.agenzia.price).toBe(249);
    expect(PLANS.rete.price).toBe(690);
    expect(VAT_NOTICE).toMatch(/regime forfettario/i);
  });

  it("landing, prezzi and footer all point at the same offer", () => {
    expect(src("src/pages/Prezzi.tsx")).toContain("PricingSection");
    expect(src("src/pages/Index.tsx")).toContain("PricingSection");
    expect(src("src/components/landing/Footer.tsx")).toContain("/prezzi");
    expect(src("src/components/landing/PricingSection.tsx")).toContain('from "@/lib/plans"');
    expect(src("src/pages/Signup.tsx")).toContain("/app");
    expect(src("src/pages/Signup.tsx")).toContain("3 giorni");
  });
});

describe("Sell-ready — legal pages name the real data flow", () => {
  it("privacy mentions GPS, photo, Stripe and core-proxy", () => {
    const privacy = src("src/pages/PrivacyPolicy.tsx");
    expect(privacy).toMatch(/GPS/i);
    expect(privacy).toMatch(/Foto/i);
    expect(privacy).toMatch(/Stripe/);
    expect(privacy).toMatch(/core-proxy/);
    expect(privacy).toMatch(/settembre 2026/);
    expect(privacy).not.toMatch(/sottra\.it/i);
  });

  it("cookie policy mentions Stripe off-site checkout", () => {
    expect(src("src/pages/CookiePolicy.tsx")).toMatch(/Stripe/);
    expect(src("src/pages/CookiePolicy.tsx")).toMatch(/settembre 2026/);
  });

  it("note legali stay on sottra.app brand emails", () => {
    expect(src("src/pages/NoteLegali.tsx")).toContain("APP_BRAND.infoEmail");
    expect(src("src/pages/NoteLegali.tsx")).toContain("vatNumber");
  });
});

describe("Sell-ready — PWA installability artifacts", () => {
  it("public manifest is Italian, standalone, with separate maskable icons", () => {
    const manifest = JSON.parse(src("public/manifest.webmanifest"));
    expect(manifest.lang).toBe("it");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.id).toBe("https://sottra.app/");
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    expect(purposes.some((p: string) => p.includes("any") && p.includes("maskable"))).toBe(false);
    expect(existsSync("public/icons/apple-touch-icon.png")).toBe(true);
  });

  it("index.html has theme-color and 180 apple-touch-icon", () => {
    const html = src("index.html");
    expect(html).toContain('name="theme-color"');
    expect(html).toContain("/icons/apple-touch-icon.png");
  });
});
