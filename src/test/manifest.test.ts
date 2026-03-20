import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("PWA manifest validation", () => {
  const configSource = readFileSync("vite.config.ts", "utf-8");

  it("has required manifest fields", () => {
    expect(configSource).toContain('"Sottra"');
    expect(configSource).toContain("short_name");
    expect(configSource).toContain('"standalone"');
    expect(configSource).toContain('start_url');
    expect(configSource).toContain('"/"');
  });

  it("has required icon sizes (192 and 512)", () => {
    expect(configSource).toContain("192x192");
    expect(configSource).toContain("512x512");
  });

  it("has maskable icons", () => {
    expect(configSource).toContain('"maskable"');
  });

  it("has portrait orientation", () => {
    expect(configSource).toContain('"portrait"');
  });

  it("workbox excludes oauth route from caching", () => {
    expect(configSource).toContain("~oauth");
  });

  it("uses autoUpdate register type", () => {
    expect(configSource).toContain('"autoUpdate"');
  });
});

describe("index.html PWA meta tags", () => {
  const html = readFileSync("index.html", "utf-8");

  it("has apple-mobile-web-app-capable", () => {
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  it("has theme-color", () => {
    expect(html).toContain('name="theme-color"');
  });

  it("has viewport-fit=cover", () => {
    expect(html).toContain("viewport-fit=cover");
  });

  it("has CSP meta tag", () => {
    expect(html).toContain("Content-Security-Policy");
  });
});
