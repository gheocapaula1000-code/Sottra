import { describe, it, expect, vi, beforeEach } from "vitest";
import { isChunkLoadError } from "@/lib/chunkErrorRecovery";

describe("isChunkLoadError", () => {
  it("detects dynamic import failure", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module /assets/Scan-abc123.js"))).toBe(true);
  });

  it("detects loading chunk error", () => {
    expect(isChunkLoadError(new Error("Loading chunk 5 failed"))).toBe(true);
  });

  it("detects CSS chunk error", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk assets/style-xyz.css failed"))).toBe(true);
  });

  it("ignores regular errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("ignores non-error values", () => {
    expect(isChunkLoadError("string error")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("chunkErrorRecovery module", () => {
  it("exports markBootSuccess", async () => {
    const mod = await import("@/lib/chunkErrorRecovery");
    expect(typeof mod.markBootSuccess).toBe("function");
  });

  it("exports recoverFromChunkError", async () => {
    const mod = await import("@/lib/chunkErrorRecovery");
    expect(typeof mod.recoverFromChunkError).toBe("function");
  });
});
