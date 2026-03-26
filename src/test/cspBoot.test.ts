import { describe, it, expect } from "vitest";
import fs from "fs";

const mainSrc = fs.readFileSync("src/main.tsx", "utf-8");

describe("main.tsx CSP safety", () => {
  it("does not use innerHTML", () => {
    expect(mainSrc).not.toContain("innerHTML");
  });

  it("does not use inline onclick handlers", () => {
    expect(mainSrc).not.toContain('onclick=');
    expect(mainSrc).not.toContain("onclick=");
  });

  it("uses addEventListener for click handlers", () => {
    expect(mainSrc).toContain("addEventListener");
  });

  it("calls markBootSuccess inside a useEffect, not directly after render()", () => {
    // markBootSuccess should appear inside a useEffect callback, not at top level
    expect(mainSrc).toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?markBootSuccess/);
    // It should NOT appear as a bare call right after .render()
    const lines = mainSrc.split("\n");
    const renderLineIdx = lines.findIndex((l) => l.includes(".render("));
    if (renderLineIdx !== -1) {
      // The line immediately after render should not call markBootSuccess
      const nextLine = lines[renderLineIdx + 1] || "";
      expect(nextLine).not.toContain("markBootSuccess");
    }
  });

  it("uses DOM API (createElement) for fallback UI", () => {
    expect(mainSrc).toContain("document.createElement");
  });
});
