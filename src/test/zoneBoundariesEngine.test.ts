/**
 * Zone Boundaries Engine — Tests
 */
import { describe, it, expect } from "vitest";
import {
  buildZoneBoundaries,
  boundaryNarrativeMode,
  boundaryPrecisionLabel,
  boundaryDisplayModeLabel,
  boundaryConfidenceLabel,
  boundarySourceLabel,
  type ZoneBoundaryResult,
  type BoundaryPrecisionStatus,
  type BoundaryDisplayMode,
  type BoundaryConfidence,
  type BoundarySourceType,
  type BoundaryNarrativeMode,
} from "@/lib/zoneBoundariesEngine";
import { buildZoneCorrespondence, type ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";

function resolve(code: string) {
  return resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
}

describe("Zone Boundaries Engine", () => {
  it("produces a typed contract with all sections", () => {
    const data = resolve("015146");
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity).toBeDefined();
    expect(r.zone_boundary_support).toBeDefined();
    expect(r.zone_boundary_geometry).toBeDefined();
    expect(r.zone_boundary_limitations).toBeDefined();
    expect(typeof r.zone_boundary_identity.boundary_available).toBe("boolean");
    expect(typeof r.zone_boundary_support.fallback_used).toBe("boolean");
  });

  it("microzona OMI with real data → strong boundary", () => {
    const data = resolve("015146");
    // Force omi_linkage to zona_omi level for this test
    data.territorial_datasets.omi_linkage = {
      availability: "available",
      quality: "official",
      geo_level: "zona_omi",
      record_count: 5,
      source_key: "omi_zone",
      source_label: "OMI Zone",
      is_official: true,
      is_derived: false,
      note: null,
    };
    data.territorial_datasets.sub_municipal = {
      availability: "available",
      quality: "official",
      geo_level: "sub_comunale",
      record_count: 3,
      source_key: "asc",
      source_label: "ASC",
      is_official: true,
      is_derived: false,
      note: null,
    };
    data.territorial_datasets.census_sections = {
      availability: "available",
      quality: "official",
      geo_level: "sezione_censuaria",
      record_count: 10,
      source_key: "r03",
      source_label: "R03",
      is_official: true,
      is_derived: false,
      note: null,
    };
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity.boundary_available).toBe(true);
    expect(r.zone_boundary_identity.boundary_source_type).toBe("microzona_omi");
    expect(r.zone_boundary_identity.boundary_precision_status).toBe("strong");
    expect(r.zone_boundary_geometry.boundary_display_mode).toBe("exact_supported_boundary");
    expect(r.zone_boundary_geometry.boundary_confidence).toBe("high");
  });

  it("ASC with real polygon → medium boundary", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage.availability = "unavailable";
    data.territorial_datasets.omi_linkage.record_count = 0;
    data.territorial_datasets.sub_municipal = {
      availability: "available",
      quality: "official",
      geo_level: "sub_comunale",
      record_count: 3,
      source_key: "asc",
      source_label: "ASC",
      is_official: true,
      is_derived: false,
      note: null,
    };
    data.territorial_datasets.census_sections = {
      availability: "available",
      quality: "official",
      geo_level: "sezione_censuaria",
      record_count: 5,
      source_key: "r03",
      source_label: "R03",
      is_official: true,
      is_derived: false,
      note: null,
    };
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity.boundary_available).toBe(true);
    expect(r.zone_boundary_identity.boundary_source_type).toBe("asc");
    expect(r.zone_boundary_identity.boundary_precision_status).toBe("medium");
  });

  it("sezione/aggregato available", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage.availability = "unavailable";
    data.territorial_datasets.omi_linkage.record_count = 0;
    data.territorial_datasets.sub_municipal.availability = "unavailable";
    data.territorial_datasets.sub_municipal.record_count = 0;
    data.territorial_datasets.census_sections = {
      availability: "available",
      quality: "official",
      geo_level: "sezione_censuaria",
      record_count: 8,
      source_key: "r03",
      source_label: "R03",
      is_official: true,
      is_derived: false,
      note: null,
    };
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity.boundary_available).toBe(true);
    expect(r.zone_boundary_identity.boundary_source_type).toBe("sezione_censuaria");
  });

  it("solo comune → boundary available but labeled comunale", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage.availability = "unavailable";
    data.territorial_datasets.omi_linkage.record_count = 0;
    data.territorial_datasets.sub_municipal.availability = "unavailable";
    data.territorial_datasets.sub_municipal.record_count = 0;
    data.territorial_datasets.census_sections.availability = "unavailable";
    data.territorial_datasets.census_sections.record_count = 0;
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity.boundary_available).toBe(true);
    expect(r.zone_boundary_identity.boundary_source_type).toBe("comune");
    expect(r.zone_boundary_geometry.boundary_display_mode).toBe("comune_only_boundary");
    expect(r.zone_boundary_limitations.comune_only_boundary).toBe(true);
    expect(r.zone_boundary_limitations.transparency_notes.length).toBeGreaterThan(0);
  });

  it("fallback dominant → degraded correctly", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage = {
      availability: "available",
      quality: "official",
      geo_level: "zona_omi",
      record_count: 2,
      source_key: "omi",
      source_label: "OMI",
      is_official: true,
      is_derived: false,
      note: null,
    };
    // Force high fallback in the quality
    data.territorial_quality.fallback_count = 8;
    data.territorial_sources = Array.from({ length: 10 }, (_, i) => ({
      source_key: `s${i}`,
      source_label: `Source ${i}`,
      source_type: "elaborated" as const,
      is_official: false,
      geo_level_supported: "comune" as const,
      coverage_status: "available" as const,
      freshness: null,
      matched_by: "fallback",
      record_count: 1,
      warnings: [],
    }));
    data.territorial_scope.fallback_applied = true;
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_support.fallback_weight).toBe("high");
    expect(r.zone_boundary_geometry.boundary_display_mode).toBe("broader_boundary");
  });

  it("no data at all → hidden narrative", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage.availability = "unavailable";
    data.territorial_datasets.omi_linkage.record_count = 0;
    data.territorial_datasets.sub_municipal.availability = "unavailable";
    data.territorial_datasets.sub_municipal.record_count = 0;
    data.territorial_datasets.census_sections.availability = "unavailable";
    data.territorial_datasets.census_sections.record_count = 0;
    data.territorial_datasets.territorial_structure.availability = "unavailable";
    data.territorial_datasets.territorial_structure.record_count = 0;
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    expect(r.zone_boundary_identity.boundary_available).toBe(false);
    expect(boundaryNarrativeMode(r)).toBe("hidden");
    expect(r.zone_boundary_limitations.no_real_boundary_available).toBe(true);
  });

  it("no fake boundary ever constructed", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage.availability = "unavailable";
    data.territorial_datasets.omi_linkage.record_count = 0;
    data.territorial_datasets.sub_municipal.availability = "unavailable";
    data.territorial_datasets.sub_municipal.record_count = 0;
    data.territorial_datasets.census_sections.availability = "unavailable";
    data.territorial_datasets.census_sections.record_count = 0;
    data.territorial_datasets.territorial_structure.availability = "unavailable";
    data.territorial_datasets.territorial_structure.record_count = 0;
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);

    // Must never invent geometry
    expect(r.zone_boundary_geometry.geometry_available).toBe(false);
    expect(r.zone_boundary_geometry.geometry_type).toBe("none");
    expect(r.zone_boundary_geometry.render_mode).toBe("hidden");
    expect(r.zone_boundary_identity.boundary_source_type).toBe("none");
  });

  it("zone correspondence is not regressed", () => {
    const data = resolve("015146");
    const corr = buildZoneCorrespondence(data);
    // Correspondence contract must remain intact
    expect(corr.zone_identity).toBeDefined();
    expect(corr.zone_correspondence).toBeDefined();
    expect(corr.zone_precision).toBeDefined();
    expect(corr.zone_limitations).toBeDefined();
  });

  it("type safety: all labels produce strings", () => {
    const precisions: BoundaryPrecisionStatus[] = ["strong", "medium", "weak", "insufficient"];
    precisions.forEach(p => expect(typeof boundaryPrecisionLabel(p)).toBe("string"));

    const displays: BoundaryDisplayMode[] = ["exact_supported_boundary", "broader_boundary", "comune_only_boundary", "not_renderable"];
    displays.forEach(d => expect(typeof boundaryDisplayModeLabel(d)).toBe("string"));

    const confidences: BoundaryConfidence[] = ["high", "medium", "low", "not_determinable"];
    confidences.forEach(c => expect(typeof boundaryConfidenceLabel(c)).toBe("string"));

    const sources: BoundarySourceType[] = ["microzona_omi", "asc", "sezione_censuaria", "comune", "none"];
    sources.forEach(s => expect(typeof boundarySourceLabel(s)).toBe("string"));
  });

  it("narrative mode: full for strong+high, partial for medium", () => {
    const data = resolve("015146");
    data.territorial_datasets.omi_linkage = {
      availability: "available", quality: "official", geo_level: "zona_omi",
      record_count: 5, source_key: "omi", source_label: "OMI",
      is_official: true, is_derived: false, note: null,
    };
    data.territorial_datasets.sub_municipal = {
      availability: "available", quality: "official", geo_level: "sub_comunale",
      record_count: 3, source_key: "asc", source_label: "ASC",
      is_official: true, is_derived: false, note: null,
    };
    data.territorial_datasets.census_sections = {
      availability: "available", quality: "official", geo_level: "sezione_censuaria",
      record_count: 10, source_key: "r03", source_label: "R03",
      is_official: true, is_derived: false, note: null,
    };
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);
    expect(boundaryNarrativeMode(r)).toBe("full");

    // Partial case — ASC only
    const data2 = resolve("015146");
    data2.territorial_datasets.omi_linkage.availability = "unavailable";
    data2.territorial_datasets.omi_linkage.record_count = 0;
    data2.territorial_datasets.sub_municipal = {
      availability: "available", quality: "official", geo_level: "sub_comunale",
      record_count: 3, source_key: "asc", source_label: "ASC",
      is_official: true, is_derived: false, note: null,
    };
    const corr2 = buildZoneCorrespondence(data2);
    const r2 = buildZoneBoundaries(data2, corr2);
    expect(boundaryNarrativeMode(r2)).toBe("partial");
  });
});
