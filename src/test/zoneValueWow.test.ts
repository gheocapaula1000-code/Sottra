import { describe, it, expect } from "vitest";
import { buildZoneValue, valueNarrativeMode } from "@/lib/zoneValueEngine";
import { buildRenovationEstimate, renovationNarrativeMode } from "@/lib/renovationCostEngine";
import { buildWowSnapshot } from "@/lib/sottraWowSnapshot";
import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";

/* ── Minimal stubs ── */

function stubTerritorial(geoLevel = "zona_omi"): TerritorialDataResult {
  const block = (avail: string, geo: string) => ({
    availability: avail, quality: "official" as const, geo_level: geo,
    source_key: "test", source_label: "test", is_derived: false,
    officiality: "official" as const, limitations: [],
  });
  return {
    territorial_identity: { geo_level: geoLevel as any, geo_code: "015146_B1", geo_label: "Milano B1", normalized_path: "Lombardia > Milano", resolution_method: "direct" },
    territorial_scope: { resolved_level: geoLevel as any, effective_level: geoLevel as any, max_supported_detail: geoLevel as any, fallback_applied: false, fallback_reason: null },
    territorial_datasets: {
      demographic: block("full", "comune"),
      territorial_structure: block("full", "comune"),
      sub_municipal: block("full", "sub_comunale"),
      omi_linkage: block("full", geoLevel),
      census_sections: block("full", "sezione_censuaria"),
      environmental: block("unavailable", "unknown"),
      services: block("unavailable", "unknown"),
      mobility: block("unavailable", "unknown"),
    },
    territorial_coverage: { available_levels: [geoLevel as any], completeness_score: 0.7, level_coverage: {} as any },
    territorial_quality: { overall_status: "strong", officiality_mix: "official", data_coherence: true, warnings: [], fallback_count: 0, blocking_gaps: [] },
    territorial_summary: { executive: "", status_label: "", key_strengths: [], key_gaps: [] },
  } as TerritorialDataResult;
}

function stubCorr(fallbackWeight: "none" | "low" | "medium" | "high" = "none"): ZoneCorrespondenceResult {
  return {
    zone_correspondence: {
      zone_geo_code: "015146_B1",
      zone_geo_level: "zona_omi" as any,
      zone_label: "Milano B1",
      resolved_zone_label: "Milano B1",
      zone_precision_label: "Microzona OMI",
      correspondence_quality: "strong",
      fallback_used: fallbackWeight !== "none",
      fallback_weight: fallbackWeight,
      false_specificity_risk: fallbackWeight === "high" ? "high" : "none",
      mapping_method: "direct_omi",
      transparency_notes: [],
    },
    zone_precision: {} as any,
    zone_fallback_analysis: {} as any,
  } as ZoneCorrespondenceResult;
}

function stubGrowth(status: "supportive" | "mixed" | "weak" | "insufficient" = "supportive"): ZoneGrowthSignalResult {
  return {
    growth_identity: {} as any,
    growth_signals: [],
    growth_summary: { positive_signal_count: 3, negative_signal_count: 0, mixed_signal_count: 0, weak_signal_count: 0, overall_growth_signal_status: status, narrative_mode: status === "insufficient" ? "hidden" : "full" },
    growth_limitations: { missing_depth: false, comunale_only_bias: false, weak_signal_base: false, blocking_gaps: [], transparency_notes: [] },
  } as ZoneGrowthSignalResult;
}

/* ═══════════════════════════════════════════════════════════
   VALUE ENGINE TESTS
   ═══════════════════════════════════════════════════════════ */

describe("ZoneValueEngine", () => {
  it("produces strong precision for microzona OMI with polygon match", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    expect(r.value_result.value_precision_status).toBe("strong");
    expect(r.value_result.value_per_sqm_mid).toBe(3150);
    expect(r.value_quality.local_zone_support).toBe(true);
    expect(valueNarrativeMode(r)).toBe("full");
  });

  it("degrades to weak for comunale-only OMI", () => {
    const r = buildZoneValue({ data: stubTerritorial("comune"), corr: stubCorr("medium"), omiMin: 1800, omiMax: 2500, omiGeoLevel: "comune" });
    expect(r.value_result.value_precision_status).toBe("weak");
    expect(r.value_quality.comune_only_bias).toBe(true);
    expect(r.value_identity.value_basis_type).toBe("comunale");
  });

  it("returns hidden when no OMI pricing", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr() });
    expect(r.value_result.value_per_sqm_mid).toBeNull();
    expect(valueNarrativeMode(r)).toBe("hidden");
  });

  it("penalizes confidence for high fallback weight", () => {
    const base = buildZoneValue({ data: stubTerritorial(), corr: stubCorr("none"), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const penalized = buildZoneValue({ data: stubTerritorial(), corr: stubCorr("high"), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    expect(penalized.value_result.value_confidence).toBeLessThan(base.value_result.value_confidence);
  });

  it("has coherent range (min < mid < max)", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2000, omiMax: 3000, omiGeoLevel: "zona_specifica" });
    expect(r.value_result.value_per_sqm_min!).toBeLessThan(r.value_result.value_per_sqm_mid!);
    expect(r.value_result.value_per_sqm_mid!).toBeLessThan(r.value_result.value_per_sqm_max!);
  });
});

/* ═══════════════════════════════════════════════════════════
   RENOVATION ENGINE TESTS
   ═══════════════════════════════════════════════════════════ */

describe("RenovationCostEngine", () => {
  it("produces range with photo support", () => {
    const r = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true, facadeConsistencyLevel: "good", photoReadability: "clear" });
    expect(r.renovation_estimate.renovation_cost_min).toBeGreaterThan(0);
    expect(r.renovation_estimate.renovation_cost_max).toBeGreaterThan(r.renovation_estimate.renovation_cost_min!);
    expect(r.renovation_quality.photo_support_used).toBe(true);
    expect(renovationNarrativeMode(r)).not.toBe("hidden");
  });

  it("falls back to contextual-only without photo", () => {
    const r = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: false, value_per_sqm_mid: 2500 });
    expect(r.renovation_estimate.estimate_mode).toBe("contextual_only");
    expect(r.renovation_quality.contextual_only).toBe(true);
  });

  it("returns unavailable without photo and without value", () => {
    const r = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: false });
    expect(r.renovation_estimate.estimate_mode).toBe("unavailable");
    expect(renovationNarrativeMode(r)).toBe("hidden");
  });

  it("never claims precision — always has transparency notes", () => {
    const r = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true, facadeConsistencyLevel: "strong" });
    expect(r.renovation_quality.transparency_notes.length).toBeGreaterThan(0);
    expect(r.renovation_quality.structural_unknowns_present).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════
   WOW SNAPSHOT TESTS
   ═══════════════════════════════════════════════════════════ */

describe("WowSnapshot", () => {
  it("composes full snapshot with strong data", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true, facadeConsistencyLevel: "good" });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth("supportive"), corr: stubCorr() });
    expect(snap.narrative_mode).toBe("full");
    expect(snap.attenzione_area).toBe("high");
    expect(snap.valore_al_mq).toBeTruthy();
    expect(snap.costo_ristrutturazione).toBeTruthy();
  });

  it("degrades snapshot with weak data", () => {
    const value = buildZoneValue({ data: stubTerritorial("comune"), corr: stubCorr("high"), omiMin: 1800, omiMax: 2500, omiGeoLevel: "comune" });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: false, value_per_sqm_mid: 2000 });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth("weak"), corr: stubCorr("high") });
    expect(snap.attenzione_area).not.toBe("high");
    expect(snap.limite_principale).toBeTruthy();
  });

  it("shows hidden when no value available", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr() });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: false });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: null, corr: stubCorr() });
    expect(snap.narrative_mode).toBe("hidden");
    expect(snap.attenzione_area).toBe("insufficient");
  });

  it("type-checks all snapshot fields", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr() });
    expect(typeof snap.zona_reale).toBe("string");
    expect(typeof snap.livello_lettura).toBe("string");
    expect(typeof snap.affidabilita_valore).toBe("string");
    expect(typeof snap.segnali_zona).toBe("string");
    expect(typeof snap.limite_principale).toBe("string");
    expect(["high", "medium", "low", "insufficient"]).toContain(snap.attenzione_area);
    expect(["full", "partial", "hidden"]).toContain(snap.narrative_mode);
  });
});
