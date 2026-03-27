/**
 * Integration tests for the pro-sources → frontend parser → resolver pipeline.
 * Verifies that critical territorial fields survive from backend response
 * through parsing all the way to the report mapper.
 */
import { describe, it, expect } from "vitest";

// ── Helper: simulates parseOmiResult from proSources.ts ──
function simulateParseOmiResult(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.sourceType === "unavailable") return null;
  return {
    totalPois: typeof d.totalPois === "number" ? d.totalPois : 0,
    zonaOmi: typeof d.zonaOmi === "string" ? d.zonaOmi : null,
    zonaOmiLabel: typeof d.zonaOmiLabel === "string" ? d.zonaOmiLabel : null,
    comuneLabel: typeof d.comuneLabel === "string" ? d.comuneLabel : null,
    quotazioneMinResidenziale: typeof d.quotazioneMinResidenziale === "number" ? d.quotazioneMinResidenziale : null,
    quotazioneMaxResidenziale: typeof d.quotazioneMaxResidenziale === "number" ? d.quotazioneMaxResidenziale : null,
    polygonMatch: d.polygonMatch === true,
    omiGeoLevel: typeof d.omiGeoLevel === "string" ? d.omiGeoLevel : undefined,
    matchMethod: typeof d.matchMethod === "string" ? d.matchMethod : undefined,
    matchConfidence: typeof d.matchConfidence === "number" ? d.matchConfidence : undefined,
    sourceType: d.sourceType ?? "official",
    sourceCoverageLevel: typeof d.sourceCoverageLevel === "string" ? d.sourceCoverageLevel : undefined,
    sourceFreshness: typeof d.sourceFreshness === "string" ? d.sourceFreshness : undefined,
  };
}

// ── Helper: simulates parseSubMunicipalMatch from proSources.ts ──
function simulateParseSubMunicipalMatch(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  return {
    available: d.available === true,
    matched: d.matched === true,
    level: typeof d.level === "number" ? d.level : null,
    code: typeof d.code === "string" ? d.code : undefined,
    name: typeof d.name === "string" ? d.name : undefined,
    type: typeof d.type === "string" ? d.type : undefined,
    comune_code: typeof d.comune_code === "string" ? d.comune_code : null,
    comune_name: typeof d.comune_name === "string" ? d.comune_name : undefined,
    coverage_status: (d.coverage_status === "available" || d.coverage_status === "partial") ? d.coverage_status : "unavailable",
    localita_name: typeof d.localita_name === "string" ? d.localita_name : null,
    localita_type: typeof d.localita_type === "string" ? d.localita_type : null,
    localita_code: typeof d.localita_code === "string" ? d.localita_code : null,
    r03_enriched: d.r03_enriched === true,
    r03_population: typeof d.r03_population === "number" ? d.r03_population : null,
    r03_families: typeof d.r03_families === "number" ? d.r03_families : null,
    r03_density: typeof d.r03_density === "number" ? d.r03_density : null,
    popolazione: typeof d.popolazione === "number" ? d.popolazione : null,
    densita: typeof d.densita === "number" ? d.densita : null,
  };
}

describe("parseOmiResult field preservation", () => {
  it("preserves polygonMatch=true and all territorial fields", () => {
    const parsed = simulateParseOmiResult({
      zonaOmi: "B1", zonaOmiLabel: "Centro storico", comuneLabel: "Milano",
      quotazioneMinResidenziale: 3500, quotazioneMaxResidenziale: 5000,
      sourceType: "official", sourceCoverageLevel: "zone_omi", sourceFreshness: "2024-S1",
      polygonMatch: true, omiGeoLevel: "microzona_omi", matchMethod: "polygon", matchConfidence: 0.95,
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.polygonMatch).toBe(true);
    expect(parsed!.omiGeoLevel).toBe("microzona_omi");
    expect(parsed!.matchMethod).toBe("polygon");
    expect(parsed!.matchConfidence).toBe(0.95);
    expect(parsed!.sourceCoverageLevel).toBe("zone_omi");
    expect(parsed!.sourceFreshness).toBe("2024-S1");
  });

  it("preserves polygonMatch=false for catastale fallback", () => {
    const parsed = simulateParseOmiResult({
      zonaOmi: "B1, C2, D3", comuneLabel: "Roma",
      quotazioneMinResidenziale: 2000, quotazioneMaxResidenziale: 6000,
      sourceType: "official", polygonMatch: false, omiGeoLevel: "comune",
      matchMethod: "catastale_fallback", matchConfidence: 0.5, sourceCoverageLevel: "comune",
    });
    expect(parsed!.polygonMatch).toBe(false);
    expect(parsed!.omiGeoLevel).toBe("comune");
    expect(parsed!.matchConfidence).toBe(0.5);
  });

  it("does NOT drop omiGeoLevel when set to zona_specifica", () => {
    const parsed = simulateParseOmiResult({
      zonaOmi: "B1", sourceType: "official",
      polygonMatch: false, omiGeoLevel: "zona_specifica",
      matchMethod: "catastale_fallback", matchConfidence: 0.7,
    });
    expect(parsed!.omiGeoLevel).toBe("zona_specifica");
  });

  it("returns null for unavailable OMI", () => {
    const parsed = simulateParseOmiResult({ sourceType: "unavailable", sourceProvider: "omi" });
    expect(parsed).toBeNull();
  });
});

describe("parseSubMunicipalMatch field preservation", () => {
  it("preserves localita fields from backend", () => {
    const parsed = simulateParseSubMunicipalMatch({
      available: true, matched: true, level: 1, code: "001001",
      name: "Centro", type: "area_sub_comunale", comune_code: "A001",
      comune_name: "Torino", coverage_status: "available",
      localita_name: "Borgo Po", localita_type: "localita", localita_code: "LOC001",
      r03_enriched: false,
    });
    expect(parsed!.localita_name).toBe("Borgo Po");
    expect(parsed!.localita_type).toBe("localita");
    expect(parsed!.localita_code).toBe("LOC001");
  });

  it("handles missing localita fields gracefully", () => {
    const parsed = simulateParseSubMunicipalMatch({
      available: true, matched: true, level: 1, code: "001001",
      name: "Centro", coverage_status: "available",
    });
    expect(parsed!.localita_name).toBeNull();
    expect(parsed!.localita_type).toBeNull();
    expect(parsed!.localita_code).toBeNull();
  });

  it("preserves R03 enrichment fields alongside localita", () => {
    const parsed = simulateParseSubMunicipalMatch({
      available: true, matched: true, level: 1, code: "015001", name: "Zona 1",
      coverage_status: "available", localita_name: "Baggio", localita_code: "LOC123",
      r03_enriched: true, r03_population: 12500, r03_families: 5200, r03_density: 4500,
      popolazione: 12500, densita: 4500,
    });
    expect(parsed!.localita_name).toBe("Baggio");
    expect(parsed!.r03_enriched).toBe(true);
    expect(parsed!.r03_population).toBe(12500);
    expect(parsed!.popolazione).toBe(12500);
  });

  it("preserves coverage_status=partial correctly", () => {
    const parsed = simulateParseSubMunicipalMatch({
      available: true, matched: false, coverage_status: "partial",
    });
    expect(parsed!.coverage_status).toBe("partial");
  });
});

describe("Territorial resolution with OMI polygon data", () => {
  const makeMinimalResult = (overrides: Record<string, any> = {}) => ({
    identify: { status: "success" as const, data: { address: "Via Roma 1", buildingId: "X", confidence: 0.8 }, message: null },
    pricing: { status: "idle" as const, data: null, message: null },
    marketContext: { status: "idle" as const, data: null, message: null },
    timeView: { status: "idle" as const, data: null, message: null },
    opportunity: { status: "idle" as const, data: null, message: null },
    infrastrutture: { status: "idle" as const, data: null, message: null },
    rischioZona: { status: "idle" as const, data: null, message: null },
    trendDemografico: { status: "idle" as const, data: null, message: null },
    sviluppoArea: { status: "idle" as const, data: null, message: null },
    convergenzaTerritoriale: { status: "idle" as const, data: null, message: null },
    poiEnrichment: { status: "idle" as const, data: null, message: null },
    omiZone: { status: "idle" as const, data: null, message: null },
    istatDemographic: { status: "idle" as const, data: null, message: null },
    subMunicipalMatch: { status: "idle" as const, data: null, message: null },
    profiloRapido: { status: "idle" as const, data: null, message: null },
    immobileFacciata: { status: "idle" as const, data: null, message: null },
    contestoVicinato: { status: "idle" as const, data: null, message: null },
    posizionamentoCommerciale: { status: "idle" as const, data: null, message: null },
    profiloArea: { status: "idle" as const, data: null, message: null },
    scenarioTemporale: { status: "idle" as const, data: null, message: null },
    sintesiFinale: { status: "idle" as const, data: null, message: null },
    prioritaCriticita: { status: "idle" as const, data: null, message: null },
    ...overrides,
  });

  it("OMI polygon match results in microzona_omi identified level", async () => {
    const { resolveTerritorialContext } = await import("@/lib/sourceResolver");
    const resolution = resolveTerritorialContext(makeMinimalResult({
      omiZone: {
        status: "success", data: {
          zonaOmi: "B1", zonaOmiLabel: "Centro storico", comuneLabel: "Milano",
          quotazioneMinResidenziale: 3500, quotazioneMaxResidenziale: 5000,
          polygonMatch: true, omiGeoLevel: "microzona_omi" as const,
          matchMethod: "polygon", matchConfidence: 0.95,
          sourceType: "official" as const, sourceProvider: "omi" as const,
          sourceLabel: "OMI", sourceCoverageLevel: "zone_omi" as const,
        }, message: null,
      },
      istatDemographic: {
        status: "success", data: {
          popolazione: 1350000, comuneLabel: "Milano", annoRilevazione: "2024",
          sourceType: "official" as const, sourceProvider: "istat" as const,
          sourceLabel: "ISTAT", geoLevel: "comune" as const,
        }, message: null,
      },
    }) as any);
    expect(resolution.identified_geo_level).toBe("microzona_omi");
    expect(resolution.match_method).toBe("polygon");
    expect(resolution.data_coverage_level).toBe("microzona_omi");
    expect(resolution.territorial_warning).toBeUndefined();
  });

  it("località identified but data only at comune generates warning", async () => {
    const { resolveTerritorialContext } = await import("@/lib/sourceResolver");
    const resolution = resolveTerritorialContext(makeMinimalResult({
      istatDemographic: {
        status: "success", data: {
          popolazione: 50000, comuneLabel: "Sirmione", annoRilevazione: "2024",
          sourceType: "official" as const, sourceProvider: "istat" as const,
          sourceLabel: "ISTAT", geoLevel: "comune" as const,
        }, message: null,
      },
      subMunicipalMatch: {
        status: "success", data: {
          available: true, matched: false, coverage_status: "unavailable" as const,
          localita_name: "Colombare", localita_type: "localita", localita_code: "LOC42",
        }, message: null,
      },
    }) as any);
    expect(resolution.identified_geo_level).toBe("localita");
    expect(resolution.identified_label).toBe("Colombare");
    expect(resolution.data_coverage_level).toBe("comune");
    expect(resolution.territorial_warning).toBeTruthy();
    expect(resolution.territorial_warning).toContain("Località");
    expect(resolution.territorial_warning).toContain("Comune");
  });

  it("no dataset = no invented località", async () => {
    const { resolveTerritorialContext } = await import("@/lib/sourceResolver");
    const resolution = resolveTerritorialContext(makeMinimalResult() as any);
    expect(resolution.identified_label).toBeUndefined();
    expect(resolution.identified_geo_level).toBe("non_determinato");
  });

  it("OMI catastale fallback — no warning when both at comune level", async () => {
    const { resolveTerritorialContext } = await import("@/lib/sourceResolver");
    const resolution = resolveTerritorialContext(makeMinimalResult({
      omiZone: {
        status: "success", data: {
          zonaOmi: null, comuneLabel: "Lecce",
          quotazioneMinResidenziale: 1200, quotazioneMaxResidenziale: 1800,
          polygonMatch: false, matchMethod: "catastale_fallback", matchConfidence: 0.5,
          sourceType: "official" as const, sourceProvider: "omi" as const, sourceLabel: "OMI",
        }, message: null,
      },
    }) as any);
    expect(resolution.identified_geo_level).toBe("comune");
    expect(resolution.territorial_warning).toBeUndefined();
  });

  it("ASC Lombardia R03 enriched = zona_specifica data coverage", async () => {
    const { resolveTerritorialContext } = await import("@/lib/sourceResolver");
    const resolution = resolveTerritorialContext(makeMinimalResult({
      subMunicipalMatch: {
        status: "success", data: {
          available: true, matched: true, level: 1, code: "015001",
          name: "Zona 1 — Bresso", type: "area_sub_comunale",
          coverage_status: "available" as const,
          r03_enriched: true, r03_population: 12500, r03_coverage: "available",
          popolazione: 12500, densita: 4500,
          match_method: "polygon", match_confidence: "polygon",
        }, message: null,
      },
    }) as any);
    expect(resolution.identified_geo_level).toBe("zona_specifica");
    expect(resolution.data_coverage_level).toBe("zona_specifica");
  });
});

describe("resolveGeoContext with locality support", () => {
  it("includes locality in geo resolution when available via ISTAT", async () => {
    const { resolveGeoContext } = await import("@/lib/reportMapper");
    const mockResult = {
      omiZone: { status: "idle" as const, data: null, message: null },
      istatDemographic: {
        status: "success" as const, data: {
          popolazione: 30000, comuneLabel: "Desenzano del Garda",
          geoLevel: "localita" as const, geoLabel: "Rivoltella",
          sourceType: "official" as const, sourceProvider: "istat" as const, sourceLabel: "ISTAT",
        }, message: null,
      },
      trendDemografico: { status: "idle" as const, data: null, message: null },
      subMunicipalMatch: { status: "idle" as const, data: null, message: null },
    };
    const geo = resolveGeoContext(mockResult as any);
    expect(geo.geoLevel).toBe("localita");
    expect(geo.geoLabel).toContain("Rivoltella");
  });
});
