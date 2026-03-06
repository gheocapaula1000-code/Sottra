import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { coreRequest, isError, _resetCircuitBreaker } from "@/services/api";

describe("api.ts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetCircuitBreaker();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("coreRequest", () => {
    it("returns parsed JSON on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: "test" }),
      });

      const result = await coreRequest("/test", "GET");
      expect(result).toEqual({ id: 1, name: "test" });
    });

    it("returns CoreError on HTTP error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.message).toContain("500");
      }
    });

    it("returns CoreError on network failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.message).toBe("Network error");
      }
    });

    it("sends JSON body on POST", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await coreRequest("/test", "POST", { foo: "bar" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(call[1].body)).toEqual({ foo: "bar" });
    });

    it("retries once on 503 then succeeds", async () => {
      let calls = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) return Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve("Unavailable") });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1 }) });
      });

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(false);
      expect(calls).toBe(2);
    });

    it("returns circuit breaker error after repeated failures", async () => {
      vi.useFakeTimers();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      for (let i = 0; i < 5; i++) {
        const p = coreRequest("/test", "GET");
        await vi.advanceTimersByTimeAsync(2000);
        await p;
      }
      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.message).toContain("non raggiungibile");
      }
      vi.useRealTimers();
    });
  });

  describe("isError", () => {
    it("returns true for CoreError objects", () => {
      expect(isError({ error: true, message: "fail" })).toBe(true);
    });

    it("returns false for normal objects", () => {
      expect(isError({ id: 1 })).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError("string")).toBe(false);
    });
  });
});
