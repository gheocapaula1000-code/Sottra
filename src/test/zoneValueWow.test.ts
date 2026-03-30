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
    territorial_sources: [],
    geo_backbone: {} as any,
  } as unknown as TerritorialDataResult;
}

function stubCorr(fallbackWeight: "none" | "low" | "medium" | "high" = "none"): ZoneCorrespondenceResult {
  return {
    zone_identity: {
      geo_level_reale: "zona_omi" as any,
      geo_code: "015146_B1",
      geo_label: "Milano B1",
      normalized_path: "Lombardia > Milano",
      zone_type_label: "Microzona OMI",
      zone_corresponds_to: "Microzona OMI B1",
      zone_anchor_strength: "strong",
    },
    zone_correspondence: {
      corresponds_to_microzona_omi: true,
      corresponds_to_asc: false,
      corresponds_to_section_or_aggregate: false,
      corresponds_to_comune_only: false,
      primary_zone_basis: "OMI diretto",
      secondary_zone_basis: [],
      fallback_used: fallbackWeight !== "none",
      fallback_weight: fallbackWeight,
      false_specificity_risk: fallbackWeight === "high" ? "high" : "none",
    },
    zone_precision: {} as any,
    zone_limitations: { missing_sub_comunale: false, market_only_comunale: false, weak_zone_anchor: false, fallback_dominant: false, blocking_gaps: [], transparency_notes: [] },
  } as ZoneCorrespondenceResult;
}

function stubGrowth(status: "supportive" | "mixed" | "weak" | "insufficient" = "supportive"): ZoneGrowthSignalsResult {
  return {
    growth_identity: {} as any,
    growth_signals: [],
    growth_summary: { positive_signal_count: 3, negative_signal_count: 0, mixed_signal_count: 0, weak_signal_count: 0, overall_growth_signal_status: status, narrative_mode: status === "insufficient" ? "hidden" : "full" },
    growth_limitations: { missing_depth: false, comunale_only_bias: false, weak_signal_base: false, blocking_gaps: [], transparency_notes: [] },
  } as ZoneGrowthSignalsResult;
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

/* ═══════════════════════════════════════════════════════════
   COMMERCIAL REPORT POLISH TESTS
   ═══════════════════════════════════════════════════════════ */

describe("CommercialReportPolish", () => {
  it("wow snapshot includes specificita_immobile field", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr(), specificity_strength: "strong" });
    expect(snap.specificita_immobile).toBe("Alta");
  });

  it("wow snapshot specificita_immobile is null without input", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr() });
    expect(snap.specificita_immobile).toBeNull();
  });

  it("limite_principale always present in snapshot", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr() });
    expect(snap.limite_principale).toBeTruthy();
    expect(snap.limite_principale.length).toBeGreaterThan(5);
  });

  it("snapshot with high fallback does not claim high attention", () => {
    const value = buildZoneValue({ data: stubTerritorial("comune"), corr: stubCorr("high"), omiMin: 1500, omiMax: 2000, omiGeoLevel: "comune" });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: false, value_per_sqm_mid: 1750 });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth("weak"), corr: stubCorr("high") });
    expect(snap.attenzione_area).not.toBe("high");
  });

  it("specificita_immobile maps correctly for all strengths", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const labels = ["strong", "medium", "weak", "insufficient"] as const;
    const expected = ["Alta", "Media", "Bassa", "Non sufficiente"];
    labels.forEach((s, i) => {
      const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr(), specificity_strength: s });
      expect(snap.specificita_immobile).toBe(expected[i]);
    });
  });

  it("no regression: outlook engine types are compatible", async () => {
    const { buildZoneOutlook } = await import("@/lib/zoneOutlookEngine");
    expect(typeof buildZoneOutlook).toBe("function");
  });

  it("no regression: house differentiation types are compatible", async () => {
    const { buildHouseDifferentiation } = await import("@/lib/houseDifferentiationEngine");
    expect(typeof buildHouseDifferentiation).toBe("function");
  });

  it("segnali zona uses premium tone (no 'deboli' or 'insufficienti')", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snapWeak = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth("weak"), corr: stubCorr() });
    expect(snapWeak.segnali_zona).not.toContain("deboli");
    expect(snapWeak.segnali_zona).not.toContain("Insufficienti");
    const snapNone = buildWowSnapshot({ value, renovation: reno, growth: null, corr: stubCorr() });
    expect(snapNone.segnali_zona).not.toContain("sufficienti");
  });

  it("limite_principale uses constructive phrasing", () => {
    const value = buildZoneValue({ data: stubTerritorial("comune"), corr: stubCorr("high"), omiMin: 1800, omiMax: 2500, omiGeoLevel: "comune" });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr("high") });
    expect(snap.limite_principale).not.toContain("Forte componente di fallback");
  });

  it("readiness state is set correctly", async () => {
    const { READINESS_STATE } = await import("@/lib/buildInfo");
    expect(READINESS_STATE.ready_for_device_validation).toBe(true);
    expect(READINESS_STATE.engines_modified).toBe(false);
    expect(READINESS_STATE.device_tested).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════
   GEO PRIORITY ENFORCEMENT TESTS
   ═══════════════════════════════════════════════════════════ */

describe("GeoPriorityEnforcement", () => {
  it("microzona available → primary_basis_level is zona_omi, not comune", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    expect(r.value_result.primary_basis_level).toBe("zona_omi");
    expect(r.value_quality.comune_only_bias).toBe(false);
    expect(r.value_identity.value_basis_type).toBe("microzona_omi");
  });

  it("zona_specifica available → primary_basis_level is zona_omi, not comune", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2000, omiMax: 3000, omiGeoLevel: "zona_specifica" });
    expect(r.value_result.primary_basis_level).toBe("zona_omi");
    expect(r.value_quality.comune_only_bias).toBe(false);
    expect(r.value_identity.value_basis_type).toBe("zona_omi");
  });

  it("comunale-only OMI → primary_basis_level is comune", () => {
    const r = buildZoneValue({ data: stubTerritorial("comune"), corr: stubCorr("medium"), omiMin: 1800, omiMax: 2500, omiGeoLevel: "comune" });
    expect(r.value_result.primary_basis_level).toBe("comune");
    expect(r.value_quality.comune_only_bias).toBe(true);
  });

  it("snapshot with microzona does not say 'comunale' in limite_principale", () => {
    const value = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth(), corr: stubCorr() });
    expect(snap.limite_principale).not.toContain("comunale");
    expect(snap.valore_zona_fine).toBe(true);
    expect(snap.livello_valore).toContain("Microzona");
  });

  it("snapshot with comunale-only correctly flags comunale in limit", () => {
    const comuneCorr = {
      ...stubCorr("high"),
      zone_identity: { ...stubCorr("high").zone_identity, geo_level_reale: "comune" as const },
      zone_correspondence: { ...stubCorr("high").zone_correspondence, corresponds_to_comune_only: true },
    };
    const value = buildZoneValue({ data: stubTerritorial("comune"), corr: comuneCorr as any, omiMin: 1800, omiMax: 2500, omiGeoLevel: "comune" });
    const reno = buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "comune", hasPhoto: true });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: stubGrowth("weak"), corr: comuneCorr as any });
    expect(snap.limite_principale).toContain("comunale");
    expect(snap.valore_zona_fine).toBe(false);
  });

  it("strong case evaluator does not penalize for comune_only_bias when zone is fine", () => {
    const { evaluateStrongCase } = require("@/lib/strongCaseEvaluator");
    const fineSnap = buildWowSnapshot({
      value: buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true }),
      renovation: buildRenovationEstimate({ zone_geo_code: "015146", zone_geo_level: "zona_omi", hasPhoto: true, facadeConsistencyLevel: "good" }),
      growth: stubGrowth("supportive"),
      corr: stubCorr(),
      specificity_strength: "strong",
    });
    const result = evaluateStrongCase({
      snapshot: fineSnap,
      house_specificity_strength: "strong",
      alignment_status: "high_alignment",
      outlook_status: "supportive",
      boundary_available: true,
    });
    expect(result.limiters.comune_only_bias).toBe(false);
  });

  it("value engine sets secondary_basis_level to null for fine-zone primary", () => {
    const r = buildZoneValue({ data: stubTerritorial(), corr: stubCorr(), omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    expect(r.value_result.secondary_basis_level).toBeNull();
  });
});
