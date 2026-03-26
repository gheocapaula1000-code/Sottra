import { describe, it, expect } from "vitest";
import { calculateNeighborhoodIndex } from "@/lib/neighborhoodIndex";
import type { PoiEnrichmentData, IstatDemographicData, RischioZonaData, OmiZoneData } from "@/types";

function makePoi(totalPois: number, categories: { category: string; categoryLabel: string; count: number }[] = []): PoiEnrichmentData {
  return {
    totalPois, categories, pois: [], searchRadius: 800,
    sourceType: "verified_geo", sourceProvider: "overpass", sourceLabel: "OpenStreetMap",
  };
}

function makeIstat(opts: Partial<IstatDemographicData> = {}): IstatDemographicData {
  return {
    popolazione: 10000, densita: 1500, indiceVecchiaia: 160,
    percentualeStranieri: 8, comuneLabel: "Padova",
    annoRilevazione: "2024", sourceType: "official",
    sourceProvider: "istat", sourceLabel: "ISTAT",
    geoLevel: "comune", geoLabel: "Comune di Padova",
    ...opts,
  };
}

function makeRischio(score: number): RischioZonaData {
  return {
    idrogeologico: "basso", sismico: "zona4", inquinamento: "basso",
    alluvionale: false, scoreRischio: score,
    sourceType: "official", sourceProvider: "core_v3", sourceLabel: "Fonti istituzionali",
  };
}

function makeOmi(opts: Partial<OmiZoneData> = {}): OmiZoneData {
  return {
    zonaOmi: "B1", zonaOmiLabel: "Centro storico",
    comuneLabel: "Padova", quotazioneMinResidenziale: 1500,
    quotazioneMaxResidenziale: 2500, semestre: "1° semestre 2025",
    sourceType: "official", sourceProvider: "omi",
    sourceLabel: "OMI / Agenzia delle Entrate",
    polygonMatch: true,
    ...opts,
  };
}

describe("NeighborhoodIndex", () => {
  it("calculates composite score when all 5 dimensions available", () => {
    const poi = makePoi(20, [
      { category: "transport", categoryLabel: "Trasporti", count: 3 },
      { category: "health", categoryLabel: "Salute", count: 2 },
      { category: "education", categoryLabel: "Istruzione", count: 2 },
      { category: "shopping", categoryLabel: "Commercio", count: 5 },
      { category: "parks", categoryLabel: "Aree verdi", count: 3 },
      { category: "culture", categoryLabel: "Cultura", count: 1 },
    ]);
    const istat = makeIstat();
    const rischio = makeRischio(25);
    const omi = makeOmi();

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    expect(result.isRenderable).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.band).toBeTruthy();
    expect(result.dimensionsAvailable).toBe(5);
    expect(result.dimensionsTotal).toBe(5);
    expect(result.coveragePct).toBe(100);
    expect(result.dimensions).toHaveLength(5);
  });

  it("returns non-renderable with fewer than 3 dimensions", () => {
    const poi = makePoi(0);
    const result = calculateNeighborhoodIndex(poi, null, null, null);

    expect(result.isRenderable).toBe(false);
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.dimensionsAvailable).toBeLessThan(3);
  });

  it("marks dimension as non_disponibile when data missing", () => {
    const result = calculateNeighborhoodIndex(null, null, null, null);

    for (const dim of result.dimensions) {
      expect(dim.status).toBe("non_disponibile");
      expect(dim.score).toBeNull();
    }
  });

  it("uses sub-municipal geoLevel from ISTAT when available", () => {
    const poi = makePoi(15, [
      { category: "transport", categoryLabel: "Trasporti", count: 3 },
      { category: "shopping", categoryLabel: "Commercio", count: 5 },
      { category: "health", categoryLabel: "Salute", count: 2 },
    ]);
    const istat = makeIstat({ geoLevel: "microzona", geoLabel: "Arcella" });
    const rischio = makeRischio(30);
    const omi = makeOmi();

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    const demDim = result.dimensions.find(d => d.id === "demografico");
    expect(demDim?.geoLevel).toBe("microzona");
    expect(demDim?.geoLabel).toContain("Arcella");
    expect(demDim?.note).not.toContain("intero comune");
  });

  it("labels comunale data clearly in demographic dimension", () => {
    const istat = makeIstat({ geoLevel: "comune", geoLabel: "Comune di Padova" });
    const rischio = makeRischio(20);
    const omi = makeOmi();
    const poi = makePoi(10, [
      { category: "transport", categoryLabel: "Trasporti", count: 2 },
      { category: "shopping", categoryLabel: "Commercio", count: 3 },
    ]);

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    const demDim = result.dimensions.find(d => d.id === "demografico");
    expect(demDim?.geoLevel).toBe("comune");
    expect(demDim?.note).toContain("intero comune");
  });

  it("never shows score without minimum 3 dimensions", () => {
    // Only POI available
    const poi = makePoi(25, [
      { category: "transport", categoryLabel: "Trasporti", count: 5 },
      { category: "shopping", categoryLabel: "Commercio", count: 10 },
      { category: "health", categoryLabel: "Salute", count: 3 },
    ]);

    const result = calculateNeighborhoodIndex(poi, null, null, null);

    // servizi and commerciale available = 2 dimensions, not enough
    expect(result.isRenderable).toBe(false);
    expect(result.score).toBeNull();
  });

  it("prefers finest geo level overall", () => {
    const poi = makePoi(15, [
      { category: "transport", categoryLabel: "Trasporti", count: 3 },
      { category: "shopping", categoryLabel: "Commercio", count: 5 },
      { category: "health", categoryLabel: "Salute", count: 2 },
    ]);
    const istat = makeIstat({ geoLevel: "quartiere", geoLabel: "Arcella" });
    const rischio = makeRischio(20);
    const omi = makeOmi();

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    // OMI and rischio are "zona" (coordinate-based), ISTAT is "quartiere", OMI mercato is "microzona"
    expect(result.geoLevel).toBeTruthy();
    expect(["microzona", "quartiere", "zona"]).toContain(result.geoLevel);
  });

  it("no crime data shown without real source", () => {
    // safety_zones table exists but is not queried in the index
    const result = calculateNeighborhoodIndex(null, null, null, null);

    const crimeDim = result.dimensions.find(d => d.id === "criminalita" || d.id === "sicurezza");
    expect(crimeDim).toBeUndefined();
  });

  it("assigns correct bands", () => {
    const poi = makePoi(30, [
      { category: "transport", categoryLabel: "T", count: 5 },
      { category: "health", categoryLabel: "H", count: 5 },
      { category: "education", categoryLabel: "E", count: 3 },
      { category: "shopping", categoryLabel: "S", count: 10 },
      { category: "parks", categoryLabel: "P", count: 5 },
      { category: "culture", categoryLabel: "C", count: 2 },
    ]);
    const istat = makeIstat({ densita: 5000, indiceVecchiaia: 100 });
    const rischio = makeRischio(10); // very low risk = high quality
    const omi = makeOmi({ quotazioneMinResidenziale: 3000, quotazioneMaxResidenziale: 4000 });

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    expect(result.isRenderable).toBe(true);
    expect(result.band).toBeTruthy();
    // High quality area should be buono or ottimo
    expect(["buono", "ottimo"]).toContain(result.band);
  });

  it("handles partial OMI without quotazioni", () => {
    const omi = makeOmi({
      quotazioneMinResidenziale: null,
      quotazioneMaxResidenziale: null,
    });
    const poi = makePoi(10, [
      { category: "transport", categoryLabel: "T", count: 2 },
      { category: "shopping", categoryLabel: "S", count: 3 },
    ]);
    const istat = makeIstat();
    const rischio = makeRischio(40);

    const result = calculateNeighborhoodIndex(poi, istat, rischio, omi);

    const mercDim = result.dimensions.find(d => d.id === "mercato");
    expect(mercDim?.status).toBe("parziale");
    expect(mercDim?.score).toBeNull();
    // Should still render if other 4 are available minus mercato
    // servizi + commerciale + demografico + qualita = 4 dims
    expect(result.dimensionsAvailable).toBeGreaterThanOrEqual(3);
  });
});
