import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("ErrorBoundary component", () => {
  const source = readFileSync("src/components/ErrorBoundary.tsx", "utf-8");

  it("implements getDerivedStateFromError", () => {
    expect(source).toContain("getDerivedStateFromError");
  });

  it("implements componentDidCatch", () => {
    expect(source).toContain("componentDidCatch");
  });

  it("has user-facing error message in Italian", () => {
    expect(source).toContain("Qualcosa è andato storto");
  });

  it("has reload action", () => {
    expect(source).toContain("window.location.reload");
  });

  it("supports custom fallback prop", () => {
    expect(source).toContain("fallback");
  });

  it("detects chunk load errors for recovery", () => {
    expect(source).toContain("isChunkLoadError");
    expect(source).toContain("recoverFromChunkError");
  });

  it("shows spinner during chunk recovery", () => {
    expect(source).toContain("recovering");
  });
});

describe("App surfaces missing Supabase env through ErrorBoundary", () => {
  it("wraps SupabaseConfigGate inside ErrorBoundary", () => {
    const app = readFileSync("src/App.tsx", "utf-8");
    expect(app).toContain("SupabaseConfigGate");
    expect(app).toContain("getSupabaseBootError");
    expect(app.indexOf("<ErrorBoundary>")).toBeLessThan(app.indexOf("<SupabaseConfigGate>"));
  });
});
