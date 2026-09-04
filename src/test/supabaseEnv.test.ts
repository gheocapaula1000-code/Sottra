import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertProductionSupabaseEnv,
  evaluateSupabasePublicEnv,
  isPlaceholderSupabaseUrl,
  isValidSupabaseProjectUrl,
  normalizeSupabaseUrl,
  resolveSupabasePublicConfig,
  SOTTRA_CLOUD_SUPABASE,
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

  it("rejects missing publishable key when evaluating raw env (before fallback)", () => {
    const result = evaluateSupabasePublicEnv({ url: REAL_URL, publishableKey: "  " }, { allowPlaceholders: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_key");
  });

  it("falls back to Sottra Cloud publishable values when env is empty", () => {
    const resolved = resolveSupabasePublicConfig({ url: "", publishableKey: "" });
    expect(resolved.source).toBe("fallback");
    expect(resolved.url).toBe(SOTTRA_CLOUD_SUPABASE.url);
    expect(resolved.publishableKey).toBe(SOTTRA_CLOUD_SUPABASE.publishableKey);
    expect(resolved.projectId).toBe("vveunbxfcfhnkkhrqutf");
  });

  it("prefers non-empty Vite env over the source fallback", () => {
    const resolved = resolveSupabasePublicConfig({
      url: "https://otherproject.supabase.co",
      publishableKey: "env-key",
      projectId: "otherproject",
    });
    expect(resolved.source).toBe("env");
    expect(resolved.url).toBe("https://otherproject.supabase.co");
    expect(resolved.publishableKey).toBe("env-key");
    expect(resolved.projectId).toBe("otherproject");
  });
});

describe("assertProductionSupabaseEnv", () => {
  it("allows empty URL because Sottra Cloud source fallbacks ship in the bundle", () => {
    expect(() =>
      assertProductionSupabaseEnv({
        url: "",
        publishableKey: "",
        ci: false,
        forceProductionVerify: true,
      }),
    ).not.toThrow();
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
  it("does not call createClient at module top-level and prefers env then Sottra Cloud fallback", () => {
    const source = readFileSync(resolve("src/integrations/supabase/client.ts"), "utf8");
    expect(source).not.toMatch(/export const supabase = createClient/);
    expect(source).toContain("https://vveunbxfcfhnkkhrqutf.supabase.co");
    expect(source).toContain(SOTTRA_CLOUD_SUPABASE.publishableKey);
    expect(source).toContain("envUrl || FALLBACK_SUPABASE_URL");
    expect(source).toContain("envKey || FALLBACK_SUPABASE_PUBLISHABLE_KEY");
    expect(source).toContain("createUnavailableClient");
    expect(source).toContain("new Proxy");
    const envSrc = readFileSync(resolve("src/integrations/supabase/env.ts"), "utf8");
    expect(envSrc).toContain("vveunbxfcfhnkkhrqutf");
    expect(envSrc).toContain(SOTTRA_CLOUD_SUPABASE.publishableKey);
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
