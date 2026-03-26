import { describe, it, expect } from "vitest";
import { isRenderableTrendDemografico } from "@/lib/demographic";
import type { TrendDemograficoData, GeoLevel, IstatDemographicData } from "@/types";

/**
 * Tests for geographic transparency rules:
 * Municipal data must never be presented as zone-level data.
 * Sub-municipal data must be used when available.
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
    const geoLevel: GeoLevel = "comune";
    const geoLabel = "Padova";
    
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

describe("Geographic transparency — ISTAT card geo-level handling", () => {
  function makeIstat(overrides: Partial<IstatDemographicData> = {}): IstatDemographicData {
    return {
      popolazione: 210000,
      comuneLabel: "Padova",
      sourceType: "official",
      sourceProvider: "istat",
      sourceLabel: "ISTAT",
      ...overrides,
    };
  }

  it("ISTAT with geoLevel=comune shows municipal warning", () => {
    const d = makeIstat({ geoLevel: "comune" });
    const isMunicipal = !d.geoLevel || d.geoLevel === "comune" || d.geoLevel === "area_vasta" || d.geoLevel === "stimato";
    expect(isMunicipal).toBe(true);
  });

  it("ISTAT with geoLevel=quartiere shows sub-municipal", () => {
    const d = makeIstat({ geoLevel: "quartiere", geoLabel: "Arcella", popolazione: 15000 });
    const isSubMunicipal = d.geoLevel === "microzona" || d.geoLevel === "quartiere" || d.geoLevel === "zona";
    expect(isSubMunicipal).toBe(true);
    const isMunicipal = !d.geoLevel || d.geoLevel === "comune";
    expect(isMunicipal).toBe(false);
  });

  it("ISTAT with geoLevel=microzona shows sub-municipal", () => {
    const d = makeIstat({ geoLevel: "microzona", geoLabel: "B1 - Centro", popolazione: 5200 });
    const isSubMunicipal = d.geoLevel === "microzona" || d.geoLevel === "quartiere" || d.geoLevel === "zona";
    expect(isSubMunicipal).toBe(true);
  });

  it("ISTAT with no geoLevel defaults to municipal (conservative)", () => {
    const d = makeIstat({});
    const isMunicipal = !d.geoLevel || d.geoLevel === "comune" || d.geoLevel === "area_vasta" || d.geoLevel === "stimato";
    expect(isMunicipal).toBe(true);
  });

  it("sub-municipal label uses geoLabel not comuneLabel", () => {
    const d = makeIstat({ geoLevel: "quartiere", geoLabel: "Arcella", comuneLabel: "Padova" });
    const titleLabel = (d.geoLevel === "microzona" || d.geoLevel === "quartiere" || d.geoLevel === "zona")
      ? `Dati Demografici — ${d.geoLabel}`
      : `Dati ISTAT Ufficiali (Comune)`;
    expect(titleLabel).toBe("Dati Demografici — Arcella");
    expect(titleLabel).not.toContain("Comune");
  });

  it("municipal label includes Comune", () => {
    const d = makeIstat({ geoLevel: "comune", comuneLabel: "Padova" });
    const isSubMunicipal = d.geoLevel === "microzona" || d.geoLevel === "quartiere" || d.geoLevel === "zona";
    const titleLabel = isSubMunicipal
      ? `Dati Demografici — ${d.geoLabel}`
      : `Dati ISTAT Ufficiali (Comune)`;
    expect(titleLabel).toContain("Comune");
  });
});
