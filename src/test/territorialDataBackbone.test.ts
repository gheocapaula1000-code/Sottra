import { describe, it, expect } from "vitest";
import {
  resolveTerritorialData,
  isDatasetUsable,
  bestAvailableQuality,
  dataQualityLabel,
  isQualityBetterOrEqual,
  qualityStatusLabel,
  type TerritorialDataResult,
} from "@/lib/territorialDataBackbone";
import {
  resolveFromInput,
  enrichWithCoverage,
} from "@/lib/geoBackbone";

/* ── Helpers ── */

function resolveComune(code: string, name?: string, dbCoverage?: Parameters<typeof enrichWithCoverage>[1]): TerritorialDataResult {
  const geo = resolveFromInput({ comune_istat_code: code, comune_name: name ?? `Comune ${code}` });
  const enriched = dbCoverage ? enrichWithCoverage(geo, dbCoverage) : geo;
  return resolveTerritorialData({ geo_result: enriched });
}

/* ── Tests ── */

describe("TerritorialDataBackbone", () => {
  describe("resolveTerritorialData from comune_istat_code", () => {
    it("resolves basic comune with no extra coverage", () => {
      const result = resolveComune("015146", "Milano");

      expect(result.territorial_identity.geo_level).toBe("comune");
      expect(result.territorial_identity.geo_code).toBe("015146");
      expect(result.territorial_identity.geo_label).toBe("Milano");
      expect(result.territorial_identity.normalized_path).toContain("Milano");

      expect(result.territorial_scope.resolved_level).toBe("comune");
      expect(result.territorial_scope.fallback_applied).toBe(false);

      // With no coverage data, datasets should be mostly unavailable
      expect(result.territorial_datasets.territorial_structure.availability).toBe("available");
      expect(result.territorial_datasets.demographic.availability).toBe("unavailable");
      expect(result.territorial_datasets.sub_municipal.availability).toBe("unavailable");
      expect(result.territorial_datasets.omi_linkage.availability).toBe("unavailable");
    });

    it("includes R03/ASC data when coverage present", () => {
      const result = resolveComune("015146", "Milano", {
        sezioni_count: 500,
        asc_count: 15,
        aggregati_count: 10,
        omi_count: 25,
      });

      expect(result.territorial_datasets.census_sections.availability).toBe("available");
      expect(result.territorial_datasets.census_sections.quality).toBe("official");
      expect(result.territorial_datasets.census_sections.record_count).toBe(500);

      expect(result.territorial_datasets.sub_municipal.availability).toBe("available");
      expect(result.territorial_datasets.sub_municipal.is_derived).toBe(true);

      expect(result.territorial_datasets.omi_linkage.availability).toBe("available");
      expect(result.territorial_datasets.omi_linkage.quality).toBe("official");

      expect(result.territorial_datasets.demographic.availability).toBe("available");
      expect(result.territorial_datasets.demographic.quality).toBe("elaborated");
    });
  });

  describe("resolveTerritorialData from ASC", () => {
    it("resolves from ASC code with sub-municipal data", () => {
      const geo = resolveFromInput({ asc_code: "015146_ASC2_001", comune_istat_code: "015146" });
      const enriched = enrichWithCoverage(geo, { asc_count: 5, aggregati_count: 3 });
      const result = resolveTerritorialData({ geo_result: enriched });

      expect(result.territorial_identity.geo_level).toBe("sub_comunale");
      expect(result.territorial_scope.resolved_level).toBe("sub_comunale");
      expect(result.territorial_datasets.sub_municipal.availability).toBe("available");
    });
  });

  describe("resolveTerritorialData from sezione censuaria", () => {
    it("resolves section with ASC coverage", () => {
      const geo = resolveFromInput({ section_code: "015146_001", comune_istat_code: "015146" });
      const enriched = enrichWithCoverage(geo, { sezioni_count: 100, asc_count: 5 });
      const result = resolveTerritorialData({ geo_result: enriched });

      expect(result.territorial_identity.geo_level).toBe("sezione_censuaria");
      expect(result.territorial_datasets.census_sections.availability).toBe("available");
      expect(result.territorial_datasets.census_sections.is_official).toBe(true);
    });
  });

  describe("comunale-only coverage", () => {
    it("shows no sub-municipal data when absent", () => {
      const result = resolveComune("058091", "Roma");

      expect(result.territorial_datasets.sub_municipal.availability).toBe("unavailable");
      expect(result.territorial_datasets.census_sections.availability).toBe("unavailable");
      expect(result.territorial_datasets.demographic.availability).toBe("unavailable");

      // Quality should reflect limited data
      expect(result.territorial_quality.overall_status).toBe("limited");
    });
  });

  describe("OMI linkage", () => {
    it("reports OMI linkage without altering OMI engine", () => {
      const result = resolveComune("015146", "Milano", { omi_count: 50 });

      expect(result.territorial_datasets.omi_linkage.availability).toBe("available");
      expect(result.territorial_datasets.omi_linkage.quality).toBe("official");
      expect(result.territorial_datasets.omi_linkage.note).toContain("non è alterato");
    });

    it("marks OMI unavailable when no data", () => {
      const result = resolveComune("099001", "TestComune");
      expect(result.territorial_datasets.omi_linkage.availability).toBe("unavailable");
    });
  });

  describe("quality classification", () => {
    it("classifies official correctly", () => {
      const result = resolveComune("015146", "Milano", { sezioni_count: 100, omi_count: 10 });
      expect(result.territorial_quality.officiality_mix).toBe("official");
    });

    it("classifies elaborated when only aggregates", () => {
      const result = resolveComune("015146", "Milano", { aggregati_count: 5 });
      expect(result.territorial_datasets.demographic.quality).toBe("elaborated");
    });

    it("classifies based on available blocks", () => {
      const result = resolveComune("099999", "Ignoto");
      // territorial_structure is always available for resolved comune, so officiality_mix is official
      expect(result.territorial_quality.officiality_mix).toBe("official");
    });
  });

  describe("coverage matrix", () => {
    it("builds coherent matrix with data", () => {
      const result = resolveComune("015146", "Milano", {
        sezioni_count: 100, asc_count: 10, aggregati_count: 5, omi_count: 20,
      });

      const cov = result.territorial_coverage;
      expect(cov.available_levels).toContain("sezione_censuaria");
      expect(cov.available_levels).toContain("sub_comunale");
      expect(cov.available_levels).toContain("zona_omi");
      expect(cov.available_levels).toContain("comune");
      expect(cov.precision_score).toBeGreaterThan(0);
      expect(cov.completeness_score).toBeGreaterThan(0);
    });

    it("builds matrix without data", () => {
      const result = resolveComune("099001", "TestComune");
      const cov = result.territorial_coverage;
      expect(cov.available_levels).toContain("comune"); // always structural
      expect(cov.unavailable_levels).toContain("sezione_censuaria");
    });
  });

  describe("fallback declaration", () => {
    it("declares fallback when level unavailable", () => {
      const geo = resolveFromInput({}); // no input → nazionale fallback
      const result = resolveTerritorialData({ geo_result: geo });

      expect(result.territorial_scope.fallback_applied).toBe(true);
      expect(result.territorial_scope.fallback_reason).toBeTruthy();
      expect(result.territorial_quality.overall_status).toBe("insufficient");
    });
  });

  describe("contract stability", () => {
    it("always returns all contract fields", () => {
      const result = resolveComune("015146", "Milano");

      // All top-level keys present
      expect(result.territorial_identity).toBeDefined();
      expect(result.territorial_scope).toBeDefined();
      expect(result.territorial_sources).toBeDefined();
      expect(result.territorial_datasets).toBeDefined();
      expect(result.territorial_coverage).toBeDefined();
      expect(result.territorial_quality).toBeDefined();
      expect(result.territorial_summary).toBeDefined();
      expect(result.geo_backbone).toBeDefined();

      // Dataset families always present
      expect(result.territorial_datasets.demographic).toBeDefined();
      expect(result.territorial_datasets.territorial_structure).toBeDefined();
      expect(result.territorial_datasets.sub_municipal).toBeDefined();
      expect(result.territorial_datasets.omi_linkage).toBeDefined();
      expect(result.territorial_datasets.census_sections).toBeDefined();
      expect(result.territorial_datasets.environmental).toBeDefined();
      expect(result.territorial_datasets.services).toBeDefined();
      expect(result.territorial_datasets.mobility).toBeDefined();
    });

    it("placeholder blocks are marked correctly", () => {
      const result = resolveComune("015146", "Milano");
      expect(result.territorial_datasets.environmental.availability).toBe("unavailable");
      expect(result.territorial_datasets.environmental.note).toContain("fase futura");
      expect(result.territorial_datasets.services.note).toContain("fase futura");
      expect(result.territorial_datasets.mobility.note).toContain("fase futura");
    });
  });

  describe("summary", () => {
    it("generates readable summary", () => {
      const result = resolveComune("015146", "Milano", { sezioni_count: 100 });
      expect(result.territorial_summary.short_summary).toContain("Milano");
      expect(result.territorial_summary.by_level.length).toBeGreaterThan(0);
    });
  });

  describe("utility functions", () => {
    it("isDatasetUsable works", () => {
      const result = resolveComune("015146", "Milano", { sezioni_count: 100 });
      expect(isDatasetUsable(result.territorial_datasets.census_sections)).toBe(true);
      expect(isDatasetUsable(result.territorial_datasets.environmental)).toBe(false);
    });

    it("bestAvailableQuality works", () => {
      const result = resolveComune("015146", "Milano", { sezioni_count: 100, aggregati_count: 5 });
      expect(bestAvailableQuality(result.territorial_datasets)).toBe("official");
    });

    it("dataQualityLabel works", () => {
      expect(dataQualityLabel("official")).toBe("Dato ufficiale");
      expect(dataQualityLabel("unavailable")).toBe("Non disponibile");
    });

    it("isQualityBetterOrEqual works", () => {
      expect(isQualityBetterOrEqual("official", "elaborated")).toBe(true);
      expect(isQualityBetterOrEqual("elaborated", "official")).toBe(false);
    });

    it("qualityStatusLabel works", () => {
      expect(qualityStatusLabel("strong")).toBe("Solido");
      expect(qualityStatusLabel("insufficient")).toBe("Insufficiente");
    });
  });

  describe("no regression on Phase 1", () => {
    it("geo backbone resolver still works", () => {
      const geo = resolveFromInput({ comune_istat_code: "015146", comune_name: "Milano" });
      expect(geo.geo_identity.geo_level).toBe("comune");
      expect(geo.geo_resolution.resolved).toBe(true);
    });

    it("enrichWithCoverage still works", () => {
      const geo = resolveFromInput({ comune_istat_code: "015146" });
      const enriched = enrichWithCoverage(geo, { sezioni_count: 10 });
      expect(enriched.geo_coverage.sezioni_r03.status).toBe("available");
    });
  });
});
