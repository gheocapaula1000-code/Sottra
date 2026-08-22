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

  it("refuses 0,0 without calling Core — no invented cinematic zona", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await getPhotoWow("data:image/jpeg;base64,xx", 0, 0, "address", "Via San Francesco 2, Padova");
    expect(res.error).toBe(true);
    expect(res.data).toBeNull();
    expect(res.message).toMatch(/non disponibile/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pairs the photo with address coords when geoSource is address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { scores: { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null } },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getPhotoWow(
      "data:image/jpeg;base64,xx",
      45.407,
      11.876,
      "address",
      "Via San Francesco 2, Padova",
    );

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.payload.geo).toEqual({
      latitude: 45.407,
      longitude: 11.876,
      source: "address",
    });
    expect(body.payload.quickFacts.address).toBe("Via San Francesco 2, Padova");
  });
});
