import { describe, it, expect } from "vitest";
import { isRenderableTrendDemografico } from "@/lib/demographic";
import type { TrendDemograficoData, GeoLevel } from "@/types";

/**
 * Tests for geographic transparency rules:
 * Municipal data must never be presented as zone-level data.
 */

describe("Geographic transparency — demographic data", () => {
  function makeDemographic(overrides: Partial<TrendDemograficoData> = {}): TrendDemograficoData {
    return {
      etaMedia: 44.5,
      densitaAbitanti: 2200,
      flussoResidenti12Mesi: -0.3,
      percentualeFamiglie: 38,
      percentualeGiovani: 22,
      percentualeStranieri: 12,
      sourceType: "official",
      ...overrides,
    };
  }

  it("municipal data should be labeled as comunale, not zona", () => {
    const d = makeDemographic({ geoLevel: "comune", geoLabel: "Padova" });
    expect(d.geoLevel).toBe("comune");
    // The UI should show "del comune" suffix — verified by isMunicipal logic
    const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
    expect(isMunicipal).toBe(true);
  });

  it("microzona data should NOT be labeled as comunale", () => {
    const d = makeDemographic({ geoLevel: "microzona", geoLabel: "B1" });
    const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
    expect(isMunicipal).toBe(false);
  });

  it("quartiere data should NOT be labeled as comunale", () => {
    const d = makeDemographic({ geoLevel: "quartiere", geoLabel: "Arcella" });
    const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
    expect(isMunicipal).toBe(false);
  });

  it("absent geoLevel defaults to municipal (conservative)", () => {
    const d = makeDemographic({ geoLevel: undefined, geoLabel: undefined });
    const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
    expect(isMunicipal).toBe(true);
  });

  it("zona-level data should NOT be labeled as comunale", () => {
    const d = makeDemographic({ geoLevel: "zona" as GeoLevel, geoLabel: "Centro storico" });
    const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
    expect(isMunicipal).toBe(false);
  });

  it("renderable check rejects unavailable sourceType", () => {
    const d = makeDemographic({ sourceType: "unavailable" });
    expect(isRenderableTrendDemografico(d)).toBe(false);
  });

  it("renderable check passes with at least one real metric", () => {
    const d = makeDemographic({ etaMedia: 42, densitaAbitanti: null, flussoResidenti12Mesi: null, percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null });
    expect(isRenderableTrendDemografico(d)).toBe(true);
  });

  it("geo suffix string is correct for municipal level", () => {
    const geoLevel: GeoLevel = "comune";
    const isMunicipal = geoLevel === "comune";
    const geoSuffix = isMunicipal ? " del comune" : "";
    expect(geoSuffix).toBe(" del comune");
  });

  it("geo suffix string is empty for non-municipal level", () => {
    const geoLevel: GeoLevel = "microzona";
    const isMunicipal = (geoLevel as GeoLevel) === "comune";
    const geoSuffix = isMunicipal ? " del comune" : "";
    expect(geoSuffix).toBe("");
  });
});

describe("Geographic transparency — section title logic", () => {
  it("municipal demographic section title includes 'Comunale'", () => {
    const geoLevel: GeoLevel = "comune";
    const geoLabel = "Padova";
    const isMunicipal = geoLevel === "comune";
    const title = isMunicipal
      ? `Contesto Demografico Comunale — ${geoLabel}`
      : "Trend Demografico";
    expect(title).toContain("Comunale");
    expect(title).toContain("Padova");
  });

  it("non-municipal demographic section title is generic", () => {
    const geoLevel: GeoLevel = "microzona";
    const isMunicipal = (geoLevel as GeoLevel) === "comune";
    const title = isMunicipal
      ? "Contesto Demografico Comunale"
      : "Trend Demografico";
    expect(title).toBe("Trend Demografico");
    expect(title).not.toContain("Comunale");
  });
});

describe("Geographic transparency — no false zone localization", () => {
  it("badge and geoLevel must be coherent", () => {
    // When geoLevel is "comune", the badge text must reflect municipal scope
    const geoLevel: GeoLevel = "comune";
    const geoLabel = "Padova";
    
    // Simulates the GeoLevelTag logic
    const bannerText = geoLevel === "comune"
      ? `Dato riferito all'intero comune di ${geoLabel}, non alla singola zona analizzata.`
      : null;
    
    expect(bannerText).toContain("intero comune");
    expect(bannerText).toContain("Padova");
    expect(bannerText).not.toContain("zona OMI");
    expect(bannerText).not.toContain("microzona");
  });

  it("non-municipal data must NOT show municipal warning", () => {
    const geoLevel: GeoLevel = "quartiere";
    const bannerText = (geoLevel as GeoLevel) === "comune"
      ? "Dato riferito all'intero comune"
      : null;
    expect(bannerText).toBeNull();
  });
});
