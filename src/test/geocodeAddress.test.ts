import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { geocodeAddress } from "@/services/proSources";

describe("geocodeAddress", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("returns verified coords from the pro-sources geocode module", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, data: { geocode: { lat: 45.407, lng: 11.876, sourceType: "verified_geo" } } },
      error: null,
    });

    await expect(geocodeAddress("Via San Francesco 2, Padova")).resolves.toEqual({
      lat: 45.407,
      lng: 11.876,
    });
    expect(mockInvoke).toHaveBeenCalledWith("pro-sources", {
      body: { address: "Via San Francesco 2, Padova", modules: ["geocode"] },
    });
  });

  it("returns null when geocode is unavailable — no invented zone", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        data: { geocode: { sourceType: "unavailable", availabilityReason: "no_match" } },
      },
      error: null,
    });

    await expect(geocodeAddress("indirizzo inesistente")).resolves.toBeNull();
  });

  it("returns null for empty input without calling the network", async () => {
    await expect(geocodeAddress("  ")).resolves.toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
