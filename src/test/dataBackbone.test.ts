import { describe, it, expect } from "vitest";
import {
  evaluateSectionExposure,
  evaluateSubMunicipalGate,
  buildReportExposureMap,
  summarizeRegistry,
  isSourcePublishable,
  getSourceSections,
  sectionAllowsMacrozone,
  sourceCoversRegion,
  type DataSourceEntry,
  type ReportSectionKey,
} from "@/lib/dataBackbone";
import type { ScanResult, SubMunicipalMatchData } from "@/types";

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

function mockRegistryEntry(overrides: Partial<DataSourceEntry> = {}): DataSourceEntry {
  return {
    source_key: "test",
    source_label: "Test Source",
    source_type: "official",
    source_family: "test",
    source_year: 2024,
    provider_label: "Test",
    officiality_level: "official",
    geographic_level_supported: "comune",
    geographic_scope: "nazionale",
    regions_supported: [],
    report_sections_supported: ["profiloRapido"],
    dataset_status: "active",
    ingestion_mode: "manual",
    refresh_mode: "manual",
    last_imported_at: null,
    last_validated_at: null,
    current_coverage_status: "available",
    record_count: 100,
    coverage_comuni: 10,
    coverage_regioni: 1,
    notes: null,
    ...overrides,
  };
}

/* ── Tests ─────────────────────────────────────────────── */

describe("dataBackbone — evaluateSectionExposure", () => {
  it("hides section when required module is missing", () => {
    const result = emptyScanResult();
    const exposure = evaluateSectionExposure("profiloRapido", result);
    expect(exposure.decision).toBe("hidden");
    expect(exposure.reason).toContain("required_module_missing");
  });

  it("shows section when required module is available", () => {
    const result = emptyScanResult();
    result.identify = mockSection("success", { address: "Via Test", buildingId: "1", confidence: 0.9 }) as any;
    const exposure = evaluateSectionExposure("profiloRapido", result);
    expect(exposure.decision).toBe("shown");
  });

  it("hides posizionamentoCommerciale when no pricing or OMI", () => {
    const result = emptyScanResult();
    const exposure = evaluateSectionExposure("posizionamentoCommerciale", result);
    expect(exposure.decision).toBe("hidden");
  });

  it("shows posizionamentoCommerciale when OMI is available", () => {
    const result = emptyScanResult();
    result.omiZone = mockSection("success", { zonaOmiLabel: "B1", quotazioneMinResidenziale: 1500 }) as any;
    const exposure = evaluateSectionExposure("posizionamentoCommerciale", result);
    expect(exposure.decision).toBe("shown");
  });

  it("reduces profiloArea when only municipal data", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", { popolazione: 50000, geoLevel: "comune" }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    expect(exposure.decision).toBe("reduced");
    expect(exposure.reason).toBe("municipal_level_only");
  });

  it("shows profiloArea when sub-municipal data available", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", { popolazione: 5000, geoLevel: "microzona" }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    expect(exposure.decision).toBe("shown");
  });

  it("shows profiloArea when locality data is available", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", { popolazione: 5000, geoLevel: "localita" }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    expect(exposure.decision).toBe("shown");
  });

  it("infers localita geoLevel when subMunicipalMatch has localita_name", () => {
    const result = emptyScanResult();
    result.poiEnrichment = mockSection("success", { totalPois: 5, categories: [] }) as any;
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Centro", coverage_status: "available",
      localita_name: "Borgo Sud",
    }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    expect(exposure.geographic_level).toBe("localita");
    expect(exposure.decision).toBe("shown");
  });
});

describe("dataBackbone — evaluateSubMunicipalGate", () => {
  it("returns no show when no match", () => {
    const gate = evaluateSubMunicipalGate(null);
    expect(gate.showR03Block).toBe(false);
    expect(gate.showAscBlock).toBe(false);
  });

  it("shows ASC block when matched and available", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: true, name: "Centro", coverage_status: "available",
    };
    const gate = evaluateSubMunicipalGate(match);
    expect(gate.showAscBlock).toBe(true);
    expect(gate.showR03Block).toBe(false);
  });

  it("shows R03 block when enriched with population", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: true, name: "Centro", coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 12000,
    };
    const gate = evaluateSubMunicipalGate(match);
    expect(gate.showR03Block).toBe(true);
    expect(gate.showAscBlock).toBe(true);
    expect(gate.region).toBe("Lombardia");
    expect(gate.macrozone?.macrozone_code).toBe("nord_ovest");
  });

  it("does not show R03 when population is null", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: true, name: "Centro", coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: null,
    };
    const gate = evaluateSubMunicipalGate(match);
    expect(gate.showR03Block).toBe(false);
  });
});

describe("dataBackbone — buildReportExposureMap", () => {
  it("builds map for all sections", () => {
    const result = emptyScanResult();
    result.identify = mockSection("success", { address: "Via Test", buildingId: "1", confidence: 0.9 }) as any;
    const map = buildReportExposureMap(result);
    expect(Object.keys(map)).toHaveLength(8);
    expect(map.profiloRapido.decision).toBe("shown");
    expect(map.contestoVicinato.decision).toBe("hidden");
  });
});

describe("dataBackbone — registry helpers", () => {
  it("summarizes registry correctly with byGeoScope", () => {
    const entries = [
      mockRegistryEntry({ dataset_status: "active", source_family: "valori", geographic_scope: "nazionale" }),
      mockRegistryEntry({ dataset_status: "pilot", source_family: "demo", source_key: "k2", geographic_scope: "regionale" }),
      mockRegistryEntry({ dataset_status: "inactive", source_family: "valori", source_key: "k3", geographic_scope: "nazionale" }),
    ];
    const summary = summarizeRegistry(entries);
    expect(summary.total).toBe(3);
    expect(summary.active).toBe(1);
    expect(summary.pilot).toBe(1);
    expect(summary.inactive).toBe(1);
    expect(summary.byGeoScope["nazionale"]).toBe(2);
    expect(summary.byGeoScope["regionale"]).toBe(1);
  });

  it("isSourcePublishable works", () => {
    expect(isSourcePublishable(mockRegistryEntry({ dataset_status: "active", current_coverage_status: "available" }))).toBe(true);
    expect(isSourcePublishable(mockRegistryEntry({ dataset_status: "inactive", current_coverage_status: "available" }))).toBe(false);
    expect(isSourcePublishable(mockRegistryEntry({ dataset_status: "active", current_coverage_status: "unavailable" }))).toBe(false);
  });

  it("getSourceSections returns valid sections", () => {
    const entry = mockRegistryEntry({ report_sections_supported: ["profiloRapido", "invalidSection"] });
    const sections = getSourceSections(entry);
    expect(sections).toContain("profiloRapido");
    expect(sections).not.toContain("invalidSection");
  });
});

describe("dataBackbone — macrozone support", () => {
  it("sectionAllowsMacrozone is true for profiloArea", () => {
    expect(sectionAllowsMacrozone("profiloArea")).toBe(true);
    expect(sectionAllowsMacrozone("sintesiFinale")).toBe(true);
  });

  it("sectionAllowsMacrozone is false for profiloRapido", () => {
    expect(sectionAllowsMacrozone("profiloRapido")).toBe(false);
    expect(sectionAllowsMacrozone("immobileFacciata")).toBe(false);
  });

  it("sourceCoversRegion correctly for national source", () => {
    const national = mockRegistryEntry({ geographic_scope: "nazionale" });
    expect(sourceCoversRegion(national, "03")).toBe(true);
    expect(sourceCoversRegion(national, "19")).toBe(true);
  });

  it("regional source covers ONLY declared regions, not the whole macrozone", () => {
    const regional = mockRegistryEntry({
      geographic_scope: "regionale",
      regions_supported: ["Lombardia"],
    });
    expect(sourceCoversRegion(regional, "03")).toBe(true);
    expect(sourceCoversRegion(regional, "01")).toBe(false);
    expect(sourceCoversRegion(regional, "19")).toBe(false);
  });

  it("regional source Veneto does NOT cover Emilia-Romagna", () => {
    const veneto = mockRegistryEntry({
      geographic_scope: "regionale",
      regions_supported: ["Veneto"],
    });
    expect(sourceCoversRegion(veneto, "05")).toBe(true);
    expect(sourceCoversRegion(veneto, "08")).toBe(false);
  });

  it("macrozonale source covers all regions in the macrozone", () => {
    const nordEst = mockRegistryEntry({
      geographic_scope: "macrozonale",
      regions_supported: ["Veneto"],
    });
    expect(sourceCoversRegion(nordEst, "05")).toBe(true);
    expect(sourceCoversRegion(nordEst, "08")).toBe(true);
    expect(sourceCoversRegion(nordEst, "03")).toBe(false);
  });

  it("evaluateSubMunicipalGate resolves macrozone", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: true, name: "Centro", coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 5000,
    };
    const gate = evaluateSubMunicipalGate(match);
    expect(gate.macrozone).not.toBeNull();
    expect(gate.macrozone?.macrozone_label).toBe("Nord-Ovest");
  });
});

describe("dataBackbone — geographic hierarchy with localita", () => {
  it("localita level is between quartiere and comune in geo ranking", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", { popolazione: 3000, geoLevel: "localita", geoLabel: "Borgo Antico" }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    // localita is finer than comune → should be shown, not reduced
    expect(exposure.decision).toBe("shown");
  });

  it("does not promote localita to sub-comunale precision", () => {
    const result = emptyScanResult();
    // Only localita available, no ASC/R03
    result.istatDemographic = mockSection("success", { popolazione: 3000, geoLevel: "localita" }) as any;
    const exposure = evaluateSectionExposure("profiloArea", result);
    // shown but not with sub-comunale confidence
    expect(exposure.confidence).toBeLessThanOrEqual(0.85);
  });

  it("SubMunicipalMatchData supports locality fields", () => {
    const match: SubMunicipalMatchData = {
      available: true, matched: false, coverage_status: "unavailable",
      localita_name: "Borgo Vecchio",
      localita_type: "capoluogo",
      localita_code: "001001",
    };
    expect(match.localita_name).toBe("Borgo Vecchio");
    expect(match.localita_type).toBe("capoluogo");
  });
});

describe("dataBackbone — no regression", () => {
  it("empty scan result produces all hidden except identify-dependent", () => {
    const result = emptyScanResult();
    const map = buildReportExposureMap(result);
    expect(map.profiloRapido.decision).toBe("hidden");
    expect(map.scenarioTemporale.decision).toBe("hidden");
    expect(map.posizionamentoCommerciale.decision).toBe("hidden");
  });

  it("does not crash with null/undefined ascMatch", () => {
    expect(() => evaluateSubMunicipalGate(null)).not.toThrow();
    expect(() => evaluateSubMunicipalGate(undefined as any)).not.toThrow();
  });

  it("Lombardia pilot still works with R03 enrichment", () => {
    const result = emptyScanResult();
    result.istatDemographic = mockSection("success", { popolazione: 5000, geoLevel: "microzona" }) as any;
    result.subMunicipalMatch = mockSection("success", {
      available: true, matched: true, name: "Centro", coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 5000,
    }) as any;
    const gate = evaluateSubMunicipalGate(result.subMunicipalMatch.data as SubMunicipalMatchData);
    expect(gate.showR03Block).toBe(true);
    expect(gate.region).toBe("Lombardia");
  });
});
