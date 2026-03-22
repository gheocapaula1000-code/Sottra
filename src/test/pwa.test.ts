import { describe, it, expect, vi, beforeEach } from "vitest";

describe("PWA update banner", () => {
  it("PwaUpdateBanner module exports default component", async () => {
    // Mock virtual:pwa-register/react before importing
    vi.mock("virtual:pwa-register/react", () => ({
      useRegisterSW: () => ({
        needRefresh: [false],
        updateServiceWorker: vi.fn(),
      }),
    }));
    const mod = await import("@/components/PwaUpdateBanner");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
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
