import { describe, it, expect } from "vitest";
import { resolveTerritorialContext } from "@/lib/sourceResolver";
import type { ScanResult, SubMunicipalMatchData, OmiZoneData, IstatDemographicData } from "@/types";

/* ── Mock helpers ─────────────────────────────────────── */

function mockSection<T>(status: "success" | "error" | "idle", data: T | null = null) {
  return { status, data, message: null };
}

function emptyScanResult(): ScanResult {
  const idle = { status: "idle" as const, data: null, message: null };
  return {
    identify: idle, pricing: idle, marketContext: idle, timeView: idle,
    opportunity: idle, infrastrutture: idle, rischioZona: idle,
    trendDemografico: idle, sviluppoArea: idle, convergenzaTerritoriale: idle,
    poiEnrichment: idle, omiZone: idle, istatDemographic: idle,
    subMunicipalMatch: idle, profiloRapido: idle, immobileFacciata: idle,
    contestoVicinato: idle, posizionamentoCommerciale: idle,
    profiloArea: idle, scenarioTemporale: idle, sintesiFinale: idle,
    prioritaCriticita: idle,
  };
}

/* ── Tests ─────────────────────────────────────────────── */

describe("resolveTerritorialContext — priority chain", () => {
  it("OMI polygon match takes highest identification priority", () => {
    const result = emptyScanResult();
    result.omiZone = mockSection("success", {
      zonaOmiLabel: "B1 - Centro",
      polygonMatch: true,
      omiGeoLevel: "microzona_omi",
      matchMethod: "polygon",
      matchConfidence: 0.95,
      comuneLabel: "Milano",
      quotazioneMinResidenziale: 2000,
      quotazioneMaxResidenziale: 3000,
    } as OmiZoneData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("microzona_omi");
    expect(res.identified_label).toContain("B1");
    expect(res.match_method).toBe("polygon");
    expect(res.data_coverage_level).toBe("microzona_omi");
    expect(res.territorial_warning).toBeUndefined();
  });

  it("ASC match used when OMI polygon not available", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Centro Storico",
      coverage_status: "available", match_method: "polygon",
      match_confidence: "0.85", type: "area_sub_comunale",
      popolazione: 5000,
    } as SubMunicipalMatchData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("zona_specifica");
    expect(res.identified_label).toContain("Centro Storico");
    expect(res.data_coverage_level).toBe("quartiere");
  });

  it("locality used when ASC not matched but locality resolved", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: false, coverage_status: "unavailable",
      localita_name: "Borgo Antico", localita_type: "capoluogo",
    } as SubMunicipalMatchData) as any;
    result.istatDemographic = mockSection("success", {
      popolazione: 30000, comuneLabel: "Verona",
      geoLevel: "comune", sourceLabel: "ISTAT",
    } as IstatDemographicData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("localita");
    expect(res.identified_label).toBe("Borgo Antico");
    // Data is only at comunale level
    expect(res.data_coverage_level).toBe("comune");
    expect(res.territorial_warning).toContain("Località");
    expect(res.territorial_warning).toContain("Comune");
  });

  it("comune fallback when nothing finer available", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", {
      popolazione: 50000, comuneLabel: "Roma",
      geoLevel: "comune", sourceLabel: "ISTAT",
    } as IstatDemographicData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("comune");
    expect(res.data_coverage_level).toBe("comune");
    expect(res.territorial_warning).toBeUndefined(); // same level → no warning
  });

  it("non_determinato when no data at all", () => {
    const result = emptyScanResult();
    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("non_determinato");
    expect(res.data_coverage_level).toBe("non_determinato");
    expect(res.territorial_warning).toBeUndefined();
  });
});

describe("resolveTerritorialContext — Lombardia pilot", () => {
  it("R03 enrichment gives zona_specifica data level", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Zona 1",
      coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 12000,
      match_method: "polygon", match_confidence: "0.9",
    } as SubMunicipalMatchData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("zona_specifica");
    expect(res.data_coverage_level).toBe("zona_specifica");
    expect(res.source_label).toContain("Lombardia");
  });

  it("OMI polygon still wins over ASC for identification", () => {
    const result = emptyScanResult();
    result.omiZone = mockSection("success", {
      zonaOmiLabel: "B2", polygonMatch: true,
      omiGeoLevel: "microzona_omi",
      quotazioneMinResidenziale: 1500, quotazioneMaxResidenziale: 2500,
    } as OmiZoneData) as any;
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Centro",
      coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 8000,
    } as SubMunicipalMatchData) as any;

    const res = resolveTerritorialContext(result);
    // OMI wins identification
    expect(res.identified_geo_level).toBe("microzona_omi");
    // But R03 has finer data for demographics
    expect(res.data_coverage_level).toBe("zona_specifica");
  });
});

describe("resolveTerritorialContext — territorial_warning", () => {
  it("warns when identified at localita but data is comunale", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: false, coverage_status: "unavailable",
      localita_name: "Centro",
    } as SubMunicipalMatchData) as any;
    result.istatDemographic = mockSection("success", {
      popolazione: 20000, comuneLabel: "Padova", geoLevel: "comune",
    } as IstatDemographicData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.territorial_warning).toBeDefined();
    expect(res.territorial_warning).toContain("Località");
    expect(res.territorial_warning).toContain("Comune");
  });

  it("no warning when identified and data at same level", () => {
    const result = emptyScanResult();
    result.omiZone = mockSection("success", {
      zonaOmiLabel: "C1", polygonMatch: true,
      omiGeoLevel: "microzona_omi",
      quotazioneMinResidenziale: 1000, quotazioneMaxResidenziale: 2000,
    } as OmiZoneData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.territorial_warning).toBeUndefined();
  });

  it("no warning when data is finer than identified (edge case)", () => {
    const result = emptyScanResult();
    // Identify at comune (OMI catastale fallback)
    result.omiZone = mockSection("success", {
      comuneLabel: "Bergamo",
      quotazioneMinResidenziale: null,
      quotazioneMaxResidenziale: null,
    } as OmiZoneData) as any;
    // But have sub-municipal demographic data
    result.istatDemographic = mockSection("success", {
      popolazione: 5000, geoLevel: "microzona",
      geoLabel: "Microzona Centro", comuneLabel: "Bergamo",
    } as IstatDemographicData) as any;

    const res = resolveTerritorialContext(result);
    // identified at microzona (ISTAT wins), data at microzona
    expect(res.territorial_warning).toBeUndefined();
  });
});

describe("resolveTerritorialContext — no regression", () => {
  it("does not crash with empty result", () => {
    const result = emptyScanResult();
    expect(() => resolveTerritorialContext(result)).not.toThrow();
  });

  it("does not crash with null data in sections", () => {
    const result = emptyScanResult();
    result.omiZone = mockSection("success", null) as any;
    result.subMunicipalMatch = mockSection("success", null) as any;
    expect(() => resolveTerritorialContext(result)).not.toThrow();
  });

  it("preserves existing SubMunicipalMatchData fields", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: true, name: "Test",
      coverage_status: "available",
      localita_name: "Centro", localita_type: "capoluogo", localita_code: "001",
      r03_enriched: true, r03_coverage: "available", r03_population: 5000,
      r03_families: 2000, r03_dwellings: 3000,
    };
    expect(match.localita_name).toBe("Centro");
    expect(match.r03_population).toBe(5000);
  });
});

describe("resolveTerritorialContext — no overclaim", () => {
  it("locality identification does NOT give sub-comunale data", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: false, coverage_status: "unavailable",
      localita_name: "Borgo Sud",
    } as SubMunicipalMatchData) as any;
    // No ISTAT data
    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("localita");
    expect(res.data_coverage_level).toBe("non_determinato");
  });

  it("ASC without population does NOT claim data coverage", () => {
    const result = emptyScanResult();
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Area X",
      coverage_status: "available",
      popolazione: null, // no population data
    } as SubMunicipalMatchData) as any;

    const res = resolveTerritorialContext(result);
    expect(res.identified_geo_level).toBe("zona_specifica");
    // Data level should NOT be sub-municipal without real data
    expect(res.data_coverage_level).toBe("non_determinato");
  });
});
