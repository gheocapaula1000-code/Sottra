import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { geocodeAddress, reverseGeocode } from "@/services/proSources";
import { formatNominatimStreetAddress } from "@/lib/reverseGeocodeAddress";

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

describe("formatNominatimStreetAddress", () => {
  it("formats Via San Francesco 2, Padova from Nominatim parts", () => {
    expect(formatNominatimStreetAddress({
      road: "Via San Francesco",
      house_number: "2",
      city: "Padova",
    })).toBe("Via San Francesco 2, Padova");
  });

  it("formats Via Tiziano Aspetti 245, Padova", () => {
    expect(formatNominatimStreetAddress({
      road: "Via Tiziano Aspetti",
      house_number: "245",
      city: "Padova",
    })).toBe("Via Tiziano Aspetti 245, Padova");
  });

  it("does not invent a street when Nominatim has no road", () => {
    expect(formatNominatimStreetAddress({ city: "Padova" })).toBe("Padova");
    expect(formatNominatimStreetAddress({})).toBeNull();
    expect(formatNominatimStreetAddress(null)).toBeNull();
  });
});

describe("reverseGeocode", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("returns the street from pro-sources reverse and never looks up 0,0", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, data: { reverse: { address: "Via San Francesco 2, Padova", sourceType: "verified_geo" } } },
      error: null,
    });

    await expect(reverseGeocode(45.4064, 11.8768)).resolves.toBe("Via San Francesco 2, Padova");
    expect(mockInvoke).toHaveBeenCalledWith("pro-sources", {
      body: { lat: 45.4064, lng: 11.8768, modules: ["reverse"] },
    });

    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("returns null when reverse is unavailable — no invented street", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, data: { reverse: { sourceType: "unavailable", availabilityReason: "no_match" } } },
      error: null,
    });
    await expect(reverseGeocode(45.4064, 11.8768)).resolves.toBeNull();
  });
});
