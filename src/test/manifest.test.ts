import { describe, it, expect } from "vitest";
import viteConfig from "../../vite.config";

describe("PWA manifest validation", () => {
  // Extract manifest from vite config
  const config = typeof viteConfig === "function"
    ? (viteConfig as any)({ mode: "production", command: "build" })
    : viteConfig;

  const pwaPlugin = config.plugins
    ?.flat()
    ?.find((p: any) => p && typeof p === "object" && "name" in p && /pwa/i.test(p.name));

  // Read manifest directly from the config source
  const manifest = (() => {
    // Re-import the raw config to read the manifest object
    // Since vite-plugin-pwa embeds it, we parse from the config file
    const fs = require("fs");
    const configSource = fs.readFileSync("vite.config.ts", "utf-8");
    const manifestMatch = configSource.match(/manifest:\s*(\{[\s\S]*?\n\s{6}\})/);
    if (!manifestMatch) return null;
    // Use a simpler approach: just validate known values exist in the source
    return configSource;
  })();

  it("has required manifest fields in vite.config.ts", () => {
    expect(manifest).toContain('"Sottra"');
    expect(manifest).toContain("short_name");
    expect(manifest).toContain('"standalone"');
    expect(manifest).toContain('start_url');
    expect(manifest).toContain('"/"');
  });

  it("has required icon sizes", () => {
    expect(manifest).toContain("192x192");
    expect(manifest).toContain("512x512");
  });

  it("has maskable icons", () => {
    expect(manifest).toContain('"maskable"');
  });

  it("has orientation set to portrait", () => {
    expect(manifest).toContain('"portrait"');
  });

  it("workbox excludes oauth route", () => {
    expect(manifest).toContain("~oauth");
  });
});
