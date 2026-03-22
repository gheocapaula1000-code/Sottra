import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("PWA update banner source", () => {
  const source = readFileSync("src/components/PwaUpdateBanner.tsx", "utf-8");

  it("uses useRegisterSW from vite-plugin-pwa", () => {
    expect(source).toContain("useRegisterSW");
    expect(source).toContain("virtual:pwa-register/react");
  });

  it("polls for updates", () => {
    expect(source).toContain("registration.update");
  });

  it("auto-reloads on update", () => {
    expect(source).toContain("window.location.reload");
  });
});

describe("Offline banner", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  it("OfflineBanner module exports default component", async () => {
    const mod = await import("@/components/OfflineBanner");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});

describe("PWA vite config", () => {
  it("vite.config.ts contains required PWA configuration", async () => {
    const { readFileSync } = await import("fs");
    const config = readFileSync("vite.config.ts", "utf-8");

    // Register type
    expect(config).toContain('"autoUpdate"');
    // Workbox config
    expect(config).toContain("skipWaiting");
    expect(config).toContain("clientsClaim");
    expect(config).toContain("cleanupOutdatedCaches");
    // OAuth exclusion
    expect(config).toContain("~oauth");
    // Manifest fields
    expect(config).toContain('"standalone"');
    expect(config).toContain('"portrait"');
    expect(config).toContain("192x192");
    expect(config).toContain("512x512");
    expect(config).toContain('"maskable"');
  });
});
