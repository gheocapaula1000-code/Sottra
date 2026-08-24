import { describe, it, expect, vi, beforeEach } from "vitest";

// getPhotoWow now routes through core-proxy via supabase.functions.invoke
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { getPhotoWow } from "@/services/photoWow";
import { _resetCircuitBreaker } from "@/services/api";

describe("getPhotoWow", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    _resetCircuitBreaker();
  });

  it("unwraps dual-readable Core envelope into PhotoWowResponse + official zona", async () => {
    mockInvoke.mockResolvedValue({
      data: {
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
      },
      error: null,
    });

    const res = await getPhotoWow("data:image/jpeg;base64,xx", 45.407, 11.876);
    expect(res.error).toBe(false);
    expect(res.data?.zona.nomeZonaOmi).toBe("Centro (OMI B1)");
    expect(res.data?.zona.valoreMinOmi).toBe(2400);
    expect(res.data?.zona.valoreMaxOmi).toBe(3400);
    expect(res.data?.scores.vendibilita).toBeNull();
  });

  it("returns error when Core says ok:false", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: { message: "no geo" } },
      error: null,
    });

    const res = await getPhotoWow("data:image/jpeg;base64,xx", 45.407, 11.876);
    expect(res.error).toBe(true);
    expect(res.data).toBeNull();
  });

  it("refuses 0,0 without calling Core — no invented cinematic zona", async () => {
    const res = await getPhotoWow("data:image/jpeg;base64,xx", 0, 0, "address", "Via San Francesco 2, Padova");
    expect(res.error).toBe(true);
    expect(res.data).toBeNull();
    expect(res.message).toMatch(/non disponibile/i);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("pairs the photo with address coords when geoSource is address", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        data: { scores: { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null } },
      },
      error: null,
    });

    await getPhotoWow(
      "data:image/jpeg;base64,xx",
      45.407,
      11.876,
      "address",
      "Via San Francesco 2, Padova",
    );

    expect(mockInvoke).toHaveBeenCalled();
    const [fn, opts] = mockInvoke.mock.calls[0] as [string, { body: Record<string, any> }];
    expect(fn).toBe("core-proxy");
    expect(opts.body.endpoint).toBe("/scan/photo-wow");
    expect(opts.body.payload.geo).toEqual({
      latitude: 45.407,
      longitude: 11.876,
      source: "address",
    });
    expect(opts.body.payload.address).toBe("Via San Francesco 2, Padova");
  });
});
