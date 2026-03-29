/**
 * Geo Backbone Tests — Sottra
 */
import { describe, it, expect } from "vitest";
import {
  resolveFromInput,
  buildHierarchy,
  enrichWithCoverage,
  getAncestors,
  getDescendants,
  hasChildLevel,
  normalizedPath,
  geoLevelRank,
  geoLevelLabel,
  isGeoLevelFinerOrEqual,
  finerOf,
  coarserOf,
  buildEmptyCoverage,
  type GeoIdentity,
  type GeoBackboneResult,
  type CanonicalGeoLevel,
} from "@/lib/geoBackbone";

/* ── 1. Resolution from comune_istat_code ─────────────── */
describe("resolveFromInput — comune_istat_code", () => {
  it("resolves a municipality by ISTAT code", () => {
    const r = resolveFromInput({ comune_istat_code: "015146", comune_name: "Milano" });
    expect(r.geo_identity.geo_level).toBe("comune");
    expect(r.geo_identity.geo_code).toBe("015146");
    expect(r.geo_identity.geo_label).toBe("Milano");
    expect(r.geo_resolution.resolved).toBe(true);
    expect(r.geo_resolution.match_method).toBe("exact_code");
    expect(r.geo_resolution.match_confidence).toBe("high");
    expect(r.geo_resolution.confidence_score).toBeGreaterThanOrEqual(0.9);
    expect(r.geo_identity.is_official).toBe(true);
    expect(r.geo_identity.is_derived).toBe(false);
  });
});

/* ── 2. Resolution from ASC code ──────────────────────── */
describe("resolveFromInput — ASC code", () => {
  it("resolves sub-municipal area by ASC code", () => {
    const r = resolveFromInput({ asc_code: "015146_ASC2_01", comune_istat_code: "015146" });
    expect(r.geo_identity.geo_level).toBe("sub_comunale");
    expect(r.geo_identity.geo_code).toBe("015146_ASC2_01");
    expect(r.geo_resolution.resolved).toBe(true);
    expect(r.geo_resolution.match_method).toBe("exact_code");
  });
});

/* ── 3. Resolution from section code ──────────────────── */
describe("resolveFromInput — section code", () => {
  it("resolves census section", () => {
    const r = resolveFromInput({ section_code: "015146_001", comune_istat_code: "015146" });
    expect(r.geo_identity.geo_level).toBe("sezione_censuaria");
    expect(r.geo_identity.geo_code).toBe("015146_001");
    expect(r.geo_resolution.resolved).toBe(true);
    expect(r.geo_resolution.confidence_score).toBeGreaterThanOrEqual(0.9);
  });
});

/* ── 4. Resolution with incomplete input and fallback ── */
describe("resolveFromInput — incomplete input", () => {
  it("falls back to nazionale when no input", () => {
    const r = resolveFromInput({});
    expect(r.geo_identity.geo_level).toBe("nazionale");
    expect(r.geo_resolution.resolved).toBe(true);
    expect(r.geo_resolution.fallback_used).toBe("nazionale");
    expect(r.geo_identity.is_derived).toBe(true);
    expect(r.geo_resolution.warnings.length).toBeGreaterThan(0);
  });

  it("resolves by name with lower confidence", () => {
    const r = resolveFromInput({ comune_name: "Roma" });
    expect(r.geo_identity.geo_level).toBe("comune");
    expect(r.geo_resolution.match_method).toBe("name_match");
    expect(r.geo_resolution.confidence_score).toBeLessThan(0.9);
    expect(r.geo_resolution.warnings.length).toBeGreaterThan(0);
  });

  it("flags coordinate-only input as needing DB lookup", () => {
    const r = resolveFromInput({ lat: 45.4642, lng: 9.1900 });
    expect(r.geo_resolution.resolved).toBe(false);
    expect(r.geo_resolution.warnings.some(w => w.includes("Coordinate"))).toBe(true);
  });
});

/* ── 5. Hierarchy: comune → regione → macrozona → nazionale */
describe("buildHierarchy — full chain", () => {
  it("builds complete chain for a municipality", () => {
    const identity: GeoIdentity = {
      geo_level: "comune",
      geo_code: "015146",
      geo_label: "Milano",
      parent_geo_code: null,
      comune_istat_code: "015146",
      provincia_code: "015",
      regione_code: "03",
      source_system: "istat",
      is_official: true,
      is_derived: false,
    };
    const h = buildHierarchy(identity, { provincia_name: "Milano", regione_name: "Lombardia" });

    expect(h.chain.length).toBeGreaterThanOrEqual(4); // comune, provincia, regione, macrozona, nazionale
    expect(h.chain[0].level).toBe("comune");

    const levels = h.chain.map(n => n.level);
    expect(levels).toContain("regione");
    expect(levels).toContain("macrozona");
    expect(levels).toContain("nazionale");

    // Macrozone should be Nord-Ovest for Lombardia
    const mzNode = h.chain.find(n => n.level === "macrozona");
    expect(mzNode?.label).toBe("Nord-Ovest");
  });
});

/* ── 6. Chain: section → ASC → comune when available ── */
describe("buildHierarchy — section → ASC → comune", () => {
  it("includes section and ASC in chain", () => {
    const identity: GeoIdentity = {
      geo_level: "sezione_censuaria",
      geo_code: "015146_001",
      geo_label: "Sezione 015146_001",
      parent_geo_code: "015146",
      comune_istat_code: "015146",
      provincia_code: "015",
      regione_code: "03",
      source_system: "r03",
      is_official: true,
      is_derived: false,
    };
    const h = buildHierarchy(identity, {
      asc_code: "015146_ASC2_01",
      asc_name: "Centro Storico",
      regione_name: "Lombardia",
    });

    const levels = h.chain.map(n => n.level);
    expect(levels).toContain("sezione_censuaria");
    expect(levels).toContain("sub_comunale");
    expect(levels).toContain("comune");
    expect(h.deepest_level).toBe("sezione_censuaria");
    expect(h.children_available.sezione_censuaria).toBe(true);
    expect(h.children_available.sub_comunale).toBe(true);
  });
});

/* ── 7. Absence of ASC without false positive ─────────── */
describe("buildHierarchy — no ASC", () => {
  it("does not claim ASC when not present", () => {
    const identity: GeoIdentity = {
      geo_level: "comune",
      geo_code: "058091",
      geo_label: "Roma",
      parent_geo_code: null,
      comune_istat_code: "058091",
      provincia_code: "058",
      regione_code: "12",
      source_system: "istat",
      is_official: true,
      is_derived: false,
    };
    const h = buildHierarchy(identity);
    expect(h.children_available.sub_comunale).toBe(false);
    expect(h.children_available.sezione_censuaria).toBe(false);
  });
});

/* ── 8. Coverage map: with and without ASC ─────────────── */
describe("enrichWithCoverage", () => {
  it("reflects available layers correctly", () => {
    const base = resolveFromInput({ comune_istat_code: "015146", comune_name: "Milano" });

    const enriched = enrichWithCoverage(base, {
      sezioni_count: 1500,
      asc_count: 12,
      aggregati_count: 10,
      omi_count: 45,
    });

    expect(enriched.geo_coverage.sezioni_r03.status).toBe("available");
    expect(enriched.geo_coverage.asc_areas.status).toBe("available");
    expect(enriched.geo_coverage.aggregati_r03.status).toBe("available");
    expect(enriched.geo_coverage.zona_omi.status).toBe("available");
    expect(enriched.geo_coverage.max_depth).toBe("sezione_censuaria");
    expect(enriched.geo_coverage.quality_score).toBeGreaterThan(0);
  });

  it("shows unavailable when no data", () => {
    const base = resolveFromInput({ comune_istat_code: "001001", comune_name: "Agliè" });
    const enriched = enrichWithCoverage(base, {});
    expect(enriched.geo_coverage.sezioni_r03.status).toBe("unknown");
    expect(enriched.geo_coverage.asc_areas.status).toBe("unknown");
    expect(enriched.geo_coverage.max_depth).toBe("comune");
  });
});

/* ── 9. Contract stability ─────────────────────────────── */
describe("GeoBackboneResult contract", () => {
  it("has all required top-level fields", () => {
    const r = resolveFromInput({ comune_istat_code: "015146" });
    expect(r).toHaveProperty("geo_identity");
    expect(r).toHaveProperty("geo_hierarchy");
    expect(r).toHaveProperty("geo_resolution");
    expect(r).toHaveProperty("geo_coverage");
    expect(r).toHaveProperty("geo_quality");
    expect(r).toHaveProperty("geo_sources");
  });

  it("identity has required fields", () => {
    const id = resolveFromInput({ comune_istat_code: "015146" }).geo_identity;
    expect(id).toHaveProperty("geo_level");
    expect(id).toHaveProperty("geo_code");
    expect(id).toHaveProperty("geo_label");
    expect(id).toHaveProperty("source_system");
    expect(id).toHaveProperty("is_official");
    expect(id).toHaveProperty("is_derived");
  });

  it("resolution has required fields", () => {
    const res = resolveFromInput({ comune_istat_code: "015146" }).geo_resolution;
    expect(res).toHaveProperty("resolved");
    expect(res).toHaveProperty("match_method");
    expect(res).toHaveProperty("match_confidence");
    expect(res).toHaveProperty("confidence_score");
    expect(res).toHaveProperty("warnings");
    expect(res).toHaveProperty("debug_summary");
    expect(typeof res.debug_summary).toBe("string");
    expect(res.debug_summary.length).toBeGreaterThan(0);
  });
});

/* ── 10. No regression: existing macrozone registry ────── */
describe("Geo level utilities", () => {
  it("ranks correctly", () => {
    expect(geoLevelRank("sezione_censuaria")).toBeLessThan(geoLevelRank("comune"));
    expect(geoLevelRank("comune")).toBeLessThan(geoLevelRank("regione"));
    expect(geoLevelRank("regione")).toBeLessThan(geoLevelRank("nazionale"));
    expect(geoLevelRank("non_determinato")).toBe(99);
  });

  it("labels are correct", () => {
    expect(geoLevelLabel("comune")).toBe("Comune");
    expect(geoLevelLabel("nazionale")).toBe("Nazionale");
    expect(geoLevelLabel("sub_comunale")).toContain("ASC");
  });

  it("finerOf and coarserOf work", () => {
    expect(finerOf("comune", "regione")).toBe("comune");
    expect(coarserOf("comune", "regione")).toBe("regione");
    expect(isGeoLevelFinerOrEqual("comune", "regione")).toBe(true);
    expect(isGeoLevelFinerOrEqual("regione", "comune")).toBe(false);
  });
});

/* ── Hierarchy walkers ─────────────────────────────────── */
describe("Hierarchy walkers", () => {
  const identity: GeoIdentity = {
    geo_level: "comune",
    geo_code: "015146",
    geo_label: "Milano",
    parent_geo_code: null,
    comune_istat_code: "015146",
    provincia_code: "015",
    regione_code: "03",
    source_system: "istat",
    is_official: true,
    is_derived: false,
  };

  it("getAncestors returns coarser levels", () => {
    const h = buildHierarchy(identity, { regione_name: "Lombardia" });
    const ancestors = getAncestors(h, "comune");
    const levels = ancestors.map(n => n.level);
    expect(levels).toContain("regione");
    expect(levels).toContain("nazionale");
    expect(levels).not.toContain("comune");
  });

  it("normalizedPath returns readable string", () => {
    const h = buildHierarchy(identity, { regione_name: "Lombardia" });
    const path = normalizedPath(h);
    expect(path).toContain("Milano");
    expect(path).toContain("Lombardia");
    expect(path).toContain("Italia");
    expect(path).toContain("→");
  });

  it("hasChildLevel works", () => {
    const h = buildHierarchy(identity);
    expect(hasChildLevel(h, "comune")).toBe(true);
    expect(hasChildLevel(h, "sezione_censuaria")).toBe(false);
  });
});

/* ── Region fallback resolution ────────────────────────── */
describe("resolveFromInput — regione fallback", () => {
  it("resolves by region name", () => {
    const r = resolveFromInput({ regione: "Lombardia" });
    expect(r.geo_identity.geo_level).toBe("regione");
    expect(r.geo_identity.geo_code).toBe("03");
    expect(r.geo_resolution.resolved).toBe(true);
    expect(r.geo_resolution.fallback_used).toBe("regione");
  });
});
