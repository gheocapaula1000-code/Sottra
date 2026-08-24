import { describe, it, expect } from "vitest";
import { deriveGeoFromIdentify, readIdentifyResolvedCoords } from "@/lib/deriveScanGeo";
import type { IdentifyResult } from "@/types";

const indoorGps = { lat: 45.0, lng: 9.0 };
const padova = { lat: 45.407, lng: 11.876 };

const identifyPadova: IdentifyResult = {
  address: "Via Roma 1, Padova",
  buildingId: "PD-VR1",
  confidence: 0.9,
};

const identifyWithResolved: IdentifyResult = {
  ...identifyPadova,
  resolvedLat: padova.lat,
  resolvedLng: padova.lng,
  geoResolution: { resolvedLat: padova.lat, resolvedLng: padova.lng, resolvedComune: "Padova" },
};

describe("deriveGeoFromIdentify — manual address vs device GPS", () => {
  it("manual address + geocode wins over non-zero indoor GPS", () => {
    const geo = deriveGeoFromIdentify(
      identifyPadova,
      "Via San Francesco 2, Padova",
      indoorGps.lat,
      indoorGps.lng,
      padova,
    );
    expect(geo.finalLat).toBe(padova.lat);
    expect(geo.finalLng).toBe(padova.lng);
    expect(geo.geoSource).toBe("geocode");
    expect(geo.address).toBe("Via San Francesco 2, Padova");
  });

  it("manual address + identify resolved coords win over non-zero GPS and geocode", () => {
    const geo = deriveGeoFromIdentify(
      identifyWithResolved,
      "Via San Francesco 2, Padova",
      indoorGps.lat,
      indoorGps.lng,
      { lat: 41.9, lng: 12.5 },
    );
    expect(geo.finalLat).toBe(padova.lat);
    expect(geo.finalLng).toBe(padova.lng);
    expect(geo.geoSource).toBe("identify");
  });

  it("no address → device GPS is used even if identify has resolved coords", () => {
    const geo = deriveGeoFromIdentify(identifyWithResolved, undefined, 45.41, 11.87, null);
    expect(geo.finalLat).toBe(45.41);
    expect(geo.finalLng).toBe(11.87);
    expect(geo.geoSource).toBe("device");
  });

  it("geocode fail + no identify coords → honest unavailable, no invented zone", () => {
    const geo = deriveGeoFromIdentify(
      identifyPadova,
      "Via San Francesco 2, Padova",
      indoorGps.lat,
      indoorGps.lng,
      null,
    );
    expect(geo.finalLat).toBeNull();
    expect(geo.finalLng).toBeNull();
    expect(geo.geoSource).toBe("none");
    expect(geo.address).toBe("Via San Francesco 2, Padova");
  });

  it("does not treat 0,0 identify coords as resolved", () => {
    expect(readIdentifyResolvedCoords({
      ...identifyPadova,
      resolvedLat: 0,
      resolvedLng: 0,
    })).toBeNull();
  });

  it("Scan.tsx 0,0 + manual address uses geocode, never raw 0,0", () => {
    const geo = deriveGeoFromIdentify(
      identifyPadova,
      "Via San Francesco 2, Padova",
      0,
      0,
      padova,
    );
    expect(geo.finalLat).toBe(padova.lat);
    expect(geo.finalLng).toBe(padova.lng);
    expect(geo.geoSource).toBe("geocode");
  });

  it("no address and GPS 0,0 falls back to identify-resolved coords", () => {
    const geo = deriveGeoFromIdentify(identifyWithResolved, undefined, 0, 0, null);
    expect(geo.finalLat).toBe(padova.lat);
    expect(geo.finalLng).toBe(padova.lng);
    expect(geo.geoSource).toBe("identify");
  });

  it("does not treat 0,0 as a lookup coordinate when nothing else resolved", () => {
    const geo = deriveGeoFromIdentify(identifyPadova, undefined, 0, 0, null);
    expect(geo.finalLat).toBeNull();
    expect(geo.finalLng).toBeNull();
    expect(geo.geoSource).toBe("none");
  });
});
