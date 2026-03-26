import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("_headers hardening", () => {
  const headers = readFileSync("public/_headers", "utf-8");

  it("has CSP header with restrictive default-src", () => {
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("default-src 'self'");
  });

  it("CSP blocks frames and objects", () => {
    expect(headers).toContain("frame-src 'none'");
    expect(headers).toContain("object-src 'none'");
  });

  it("CSP restricts form-action", () => {
    expect(headers).toContain("form-action 'self'");
  });

  it("CSP includes upgrade-insecure-requests", () => {
    expect(headers).toContain("upgrade-insecure-requests");
  });

  it("CSP does not allow unsafe-eval", () => {
    expect(headers).not.toContain("unsafe-eval");
  });

  it("has no-cache rule for sw.js", () => {
    expect(headers).toContain("/sw.js");
    expect(headers).toContain("no-cache, no-store, must-revalidate");
  });

  it("has cache rule for manifest", () => {
    expect(headers).toContain("/manifest.webmanifest");
    expect(headers).toContain("application/manifest+json");
  });

  it("has immutable cache for assets", () => {
    expect(headers).toContain("/assets/*");
    expect(headers).toContain("immutable");
  });

  it("has HSTS with preload", () => {
    expect(headers).toContain("Strict-Transport-Security");
    expect(headers).toContain("preload");
  });
});

describe("index.html CSP cleanup", () => {
  const html = readFileSync("index.html", "utf-8");

  it("does NOT have a meta CSP tag (headers are authoritative)", () => {
    expect(html).not.toContain("Content-Security-Policy");
  });

  it("still has essential meta tags", () => {
    expect(html).toContain('name="theme-color"');
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain('rel="canonical"');
    expect(html).toContain("apple-mobile-web-app-capable");
  });
});
