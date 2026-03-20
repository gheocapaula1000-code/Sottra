import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Mock the supabase client — coreRequest uses supabase.functions.invoke, not raw fetch
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { coreRequest, isError, _resetCircuitBreaker } from "@/services/api";

describe("api.ts", () => {
  beforeEach(() => {
    _resetCircuitBreaker();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("coreRequest", () => {
    it("returns parsed JSON on success", async () => {
      mockInvoke.mockResolvedValue({
        data: { ok: true, data: { id: 1, name: "test" } },
        error: null,
      });

      const result = await coreRequest("/test", "GET");
      expect(result).toEqual({ id: 1, name: "test" });
    });

    it("returns CoreError on invoke error", async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: "Edge Function returned a non-2xx status code" },
      });

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(true);
    });

    it("returns CoreError on error envelope", async () => {
      mockInvoke.mockResolvedValue({
        data: { error: { message: "Something went wrong" }, status: 500 },
        error: null,
      });

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(true);
    });

    it("sends correct payload to invoke", async () => {
      mockInvoke.mockResolvedValue({
        data: { ok: true, data: {} },
        error: null,
      });

      await coreRequest("/test", "POST", { foo: "bar" });
      expect(mockInvoke).toHaveBeenCalledWith("core-proxy", {
        body: { endpoint: "/test", method: "POST", payload: { foo: "bar" }, timeout: 10000 },
      });
    });

    it("retries once on invoke error then succeeds", async () => {
      mockInvoke
        .mockResolvedValueOnce({ data: null, error: { message: "temporary" } })
        .mockResolvedValueOnce({ data: { ok: true, data: { id: 1 } }, error: null });

      const result = await coreRequest("/test", "GET");
      expect(isError(result)).toBe(false);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("returns circuit breaker error after repeated failures", async () => {
      vi.useFakeTimers();
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: "fail" },
      });

      // Each coreRequest now does 3 attempts with exponential backoff
      // We need 5 full requests to trip the circuit breaker (CB_THRESHOLD=5)
      for (let i = 0; i < 5; i++) {
        const p = coreRequest("/test", "GET");
        // Advance enough time for all backoff delays within a single request
        await vi.advanceTimersByTimeAsync(20_000);
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
