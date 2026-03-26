import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";

describe(".gitignore hygiene", () => {
  const gitignore = readFileSync(".gitignore", "utf-8");

  it("blocks *.local files (covers .env.*.local)", () => {
    expect(gitignore).toContain("*.local");
  });

  it("blocks dist/ from being committed", () => {
    expect(gitignore).toContain("dist");
  });
});

describe("headers artifact", () => {
  it("public/_headers exists", () => {
    expect(existsSync("public/_headers")).toBe(true);
  });

  const headers = readFileSync("public/_headers", "utf-8");

  it("has X-Frame-Options", () => {
    expect(headers).toContain("X-Frame-Options");
  });

  it("has X-Content-Type-Options", () => {
    expect(headers).toContain("X-Content-Type-Options: nosniff");
  });

  it("has Referrer-Policy", () => {
    expect(headers).toContain("Referrer-Policy");
  });

  it("has Permissions-Policy", () => {
    expect(headers).toContain("Permissions-Policy");
  });

  it("has HSTS", () => {
    expect(headers).toContain("Strict-Transport-Security");
  });
});

describe("index.html sanity", () => {
  const html = readFileSync("index.html", "utf-8");

  it("has no modulepreload pointing to src/assets", () => {
    expect(html).not.toMatch(/modulepreload.*\/src\/assets/);
  });

  it("has no preload for non-JS/CSS assets with wrong type", () => {
    const modulePreloads = html.match(/rel="modulepreload"[^>]*>/g) || [];
    for (const tag of modulePreloads) {
      expect(tag).not.toMatch(/\.(png|jpg|svg|webp)/);
    }
  });

  it("has canonical URL", () => {
    expect(html).toContain('rel="canonical"');
  });
});

describe("route shells defined in App.tsx", () => {
  const app = readFileSync("src/App.tsx", "utf-8");

  const requiredRoutes = [
    '/"',
    "/login",
    "/scan",
    "/result",
    "/privacy-policy",
    "/cookie-policy",
    "/termini-condizioni",
    "/note-legali",
  ];

  for (const route of requiredRoutes) {
    it(`defines route ${route}`, () => {
      expect(app).toContain(route);
    });
  }
});
