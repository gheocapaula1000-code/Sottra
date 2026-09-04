import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertProductionSupabaseEnv,
  evaluateSupabasePublicEnv,
  isPlaceholderSupabaseUrl,
  isValidSupabaseProjectUrl,
  normalizeSupabaseUrl,
  SUPABASE_BOOT_ERROR_IT,
} from "@/integrations/supabase/env";

const REAL_URL = "https://vveunbxfcfhnkkhrqutf.supabase.co";
const REAL_KEY = "test-publishable-key";

describe("Supabase public env validation", () => {
  it("accepts a real https project URL", () => {
    expect(isValidSupabaseProjectUrl(REAL_URL)).toBe(true);
    expect(isPlaceholderSupabaseUrl(REAL_URL)).toBe(false);
    expect(evaluateSupabasePublicEnv({ url: REAL_URL, publishableKey: REAL_KEY }, { allowPlaceholders: false })).toEqual({
      ok: true,
    });
  });

  it("rejects empty, http, and non-supabase hosts", () => {
    expect(normalizeSupabaseUrl("  ")).toBe("");
    expect(isValidSupabaseProjectUrl("")).toBe(false);
    expect(isValidSupabaseProjectUrl("http://vveunbxfcfhnkkhrqutf.supabase.co")).toBe(false);
    expect(isValidSupabaseProjectUrl("https://evil.example.com")).toBe(false);
    expect(evaluateSupabasePublicEnv({ url: "", publishableKey: REAL_KEY }, { allowPlaceholders: false }).code).toBe(
      "missing_url",
    );
  });

  it("treats CI example hosts as placeholders", () => {
    expect(isPlaceholderSupabaseUrl("https://example.supabase.co")).toBe(true);
    expect(isPlaceholderSupabaseUrl("https://your-project.supabase.co")).toBe(true);
    const blocked = evaluateSupabasePublicEnv(
      { url: "https://example.supabase.co", publishableKey: REAL_KEY },
      { allowPlaceholders: false },
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("placeholder");
    const allowed = evaluateSupabasePublicEnv(
      { url: "https://example.supabase.co", publishableKey: REAL_KEY },
      { allowPlaceholders: true },
    );
    expect(allowed.ok).toBe(true);
  });

  it("rejects missing publishable key", () => {
    const result = evaluateSupabasePublicEnv({ url: REAL_URL, publishableKey: "  " }, { allowPlaceholders: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_key");
  });
});

describe("assertProductionSupabaseEnv", () => {
  it("always fails on empty URL (the production black-screen cause)", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: "",
        publishableKey: REAL_KEY,
        ci: true,
        forceProductionVerify: false,
      }),
    ).toThrow(/VITE_SUPABASE_URL is empty/);
  });

  it("allows CI placeholders for test packaging", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: "https://example.supabase.co",
        publishableKey: REAL_KEY,
        ci: true,
        forceProductionVerify: false,
      }),
    ).not.toThrow();
  });

  it("rejects placeholders for production packaging even in CI when forced", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: "https://example.supabase.co",
        publishableKey: REAL_KEY,
        ci: true,
        forceProductionVerify: true,
      }),
    ).toThrow(/placeholder/);
  });

  it("rejects placeholders outside CI", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: "https://example.supabase.co",
        publishableKey: REAL_KEY,
        ci: false,
        forceProductionVerify: false,
      }),
    ).toThrow(/placeholder/);
  });

  it("accepts the real project URL for production packaging", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: REAL_URL,
        publishableKey: REAL_KEY,
        ci: false,
        forceProductionVerify: true,
      }),
    ).not.toThrow();
  });
});

describe("client.ts and boot surfaces stay defensive", () => {
  it("does not call createClient at module top-level", () => {
    const source = readFileSync(resolve("src/integrations/supabase/client.ts"), "utf8");
    expect(source).not.toMatch(/export const supabase = createClient/);
    expect(source).toContain("getSupabaseBootError");
    expect(source).toContain("createUnavailableClient");
    expect(source).toContain("new Proxy");
  });

  it("App gates missing env inside ErrorBoundary", () => {
    const app = readFileSync(resolve("src/App.tsx"), "utf8");
    expect(app).toContain("SupabaseConfigGate");
    expect(app).toContain("getSupabaseBootError");
    expect(app.indexOf("<ErrorBoundary>")).toBeLessThan(app.indexOf("<SupabaseConfigGate>"));
  });

  it("main.tsx installs empty-root guards and Italian fallback", () => {
    const main = readFileSync(resolve("src/main.tsx"), "utf8");
    expect(main).toContain("installEmptyRootGuards");
    expect(main).toContain("unhandledrejection");
    expect(main).toContain("Errore di avvio");
    expect(main).toContain("data-sottra-fatal");
  });

  it("vite production plugin asserts env before bake", () => {
    const vite = readFileSync(resolve("vite.config.ts"), "utf8");
    expect(vite).toContain("assertProductionSupabaseEnv");
    expect(vite).toContain("supabaseProductionEnvGuard");
  });

  it("boot copy is Italian", () => {
    expect(SUPABASE_BOOT_ERROR_IT.missingUrl).toMatch(/Impossibile avviare Sottra/);
  });
});
