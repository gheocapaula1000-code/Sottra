import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPhotoWow } from "@/services/photoWow";

describe("getPhotoWow", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("unwraps dual-readable Core envelope into PhotoWowResponse + official zona", async () => {
    if (typeof AbortSignal.timeout !== "function") {
      AbortSignal.timeout = ((ms: number) => {
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
      }) as typeof AbortSignal.timeout;
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          scores: { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null },
        },
        zona: "Centro (OMI B1)",
        officialMicrozona: "B1",
        prezzoMqMin: 2400,
        prezzoMqMax: 3400,
        sourceType: "official",
        polygonMatch: true,
      }),
    }) as unknown as typeof fetch;

    const res = await getPhotoWow("data:image/jpeg;base64,xx", 45.407, 11.876);
    expect(res.message).toBeNull();
    expect(res.error).toBe(false);
    expect(res.data?.zona.nomeZonaOmi).toBe("Centro (OMI B1)");
    expect(res.data?.zona.valoreMinOmi).toBe(2400);
    expect(res.data?.zona.valoreMaxOmi).toBe(3400);
    expect(res.data?.scores.vendibilita).toBeNull();
  });

  it("returns error when Core says ok:false", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: { message: "no geo" } }),
    }) as unknown as typeof fetch;

    const res = await getPhotoWow("data:image/jpeg;base64,xx", 45.407, 11.876);
    expect(res.error).toBe(true);
    expect(res.data).toBeNull();
  });
});
