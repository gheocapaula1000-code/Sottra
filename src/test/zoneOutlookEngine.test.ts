import { describe, it, expect } from "vitest";
import { buildZoneOutlook, outlookNarrativeMode, type ZoneOutlookResult } from "@/lib/zoneOutlookEngine";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";
import type { UrbanTransformationResult, UrbanTransformationSignal } from "@/lib/zoneUrbanTransformations";
import type { AttractorPressureResult } from "@/lib/zoneAttractorsPressure";

/* ── Factories ── */

function makeCorr(overrides: Partial<{
  geo_level: string; fallback_weight: string; anchor: string;
}> = {}): ZoneCorrespondenceResult {
  return {
    zone_identity: {
      geo_level_reale: (overrides.geo_level ?? "microzona") as any,
      geo_code: "015146",
      geo_label: "Milano",
      normalized_path: "lombardia > milano > milano",
      zone_type_label: "Microzona OMI",
      zone_corresponds_to: "Microzona OMI B1",
      zone_anchor_strength: (overrides.anchor ?? "strong") as any,
    },
    zone_correspondence: {
      corresponds_to_microzona_omi: true,
      corresponds_to_asc: false,
      corresponds_to_section_or_aggregate: false,
      corresponds_to_comune_only: false,
      primary_zone_basis: "omi_linkage",
      secondary_zone_basis: [],
      fallback_used: (overrides.fallback_weight ?? "none") !== "none",
      fallback_weight: (overrides.fallback_weight ?? "none") as any,
      false_specificity_risk: "none" as any,
    },
    zone_precision: {
      precision_status: "strong",
      sub_comunale_support_status: "available",
      market_zone_support_status: "direct",
      territorial_support_status: "complete",
      max_safe_claim_level: "microzona" as any,
    },
    zone_limitations: {
      missing_sub_comunale: false,
      market_only_comunale: false,
      weak_zone_anchor: false,
      fallback_dominant: (overrides.fallback_weight === "high"),
      blocking_gaps: [],
      transparency_notes: [],
    },
  };
}

function makeGrowth(dir: string = "positive", ev: string = "strong"): ZoneGrowthSignalsResult {
  return {
    growth_identity: { zone_geo_code: "015146", zone_geo_level: "microzona" as any, signal_coverage_strength: "strong" },
    growth_signals: [{
      signal_key: "mkt", signal_label: "Market", signal_family: "market",
      signal_value: "ok", signal_direction: dir as any, evidence_level: ev as any,
      source_basis: "omi", geo_validity_level: "microzona" as any,
      is_official: true, is_contextual: false, notes: null,
    }],
    growth_summary: {
      positive_signal_count: 1, negative_signal_count: 0, mixed_signal_count: 0,
      weak_signal_count: 0, overall_growth_signal_status: "supportive",
      narrative_mode: "full",
    },
    growth_limitations: {
      missing_depth: false,
      comunale_only_bias: false,
      weak_signal_base: false,
      blocking_gaps: [],
      transparency_notes: [],
    },
  };
}

function makeUrban(stages: string[] = ["in_progress", "approved"]): UrbanTransformationResult {
  const signals: UrbanTransformationSignal[] = stages.map((st, i) => ({
    signal_key: `s${i}`, signal_label: `Signal ${i}`, signal_family: "opere_pubbliche" as any,
    signal_type: "infra", signal_status: st, signal_stage: st as any,
    signal_direction: "supportive" as any, territorial_relevance: "high" as any,
    geo_validity_level: "microzona" as any, proximity_relevance: "local_zone_signal" as any,
    evidence_level: "strong" as any, source_basis: "delibera", is_official: true,
    is_contextual: false, notes: null,
  }));
  return {
    urban_transformation_identity: {} as any,
    urban_transformation_signals: signals,
    urban_transformation_summary: {
      total_signals: signals.length, high_relevance_signals: signals.length,
      medium_relevance_signals: 0, low_relevance_signals: 0, official_signal_count: signals.length,
      mixed_signal_count: 0, overall_transformation_signal_status: "supportive", narrative_mode: "full",
    },
    urban_transformation_limitations: { sparse_coverage: false, weak_proximity_mapping: false, comuni_only_bias: false, insufficient_signal_depth: false, blocking_gaps: [], transparency_notes: [] },
  };
}

function makeAttractors(count: number = 2): AttractorPressureResult {
  return {
    attractor_identity: {} as any,
    attractor_signals: Array.from({ length: count }, (_, i) => ({
      signal_key: `a${i}`, signal_label: `Attr ${i}`, signal_family: "poli_formativi" as any,
      signal_type: "uni", attractor_category: "edu", signal_status: "active",
      territorial_relevance: "high" as any, geo_validity_level: "microzona" as any,
      proximity_relevance: "immediate" as any, intensity_hint: "strong" as any,
      evidence_level: "strong" as any, signal_direction: "supportive" as any,
      source_basis: "official", is_official: true, is_contextual: false, notes: null,
    })),
    pressure_summary: {
      total_signals: count, high_relevance_signals: count, medium_relevance_signals: 0,
      low_relevance_signals: 0, strong_attractor_count: count, mixed_signal_count: 0,
      overall_pressure_signal_status: "supportive" as any, narrative_mode: "full" as any,
    },
    pressure_limitations: { sparse_coverage: false, weak_proximity_mapping: false, broader_area_bias: false, insufficient_signal_depth: false, blocking_gaps: [], transparency_notes: [] },
  };
}

/* ── Tests ── */

describe("zoneOutlookEngine", () => {
  it("1 — strong 2y with concrete signals", () => {
    const r = buildZoneOutlook(makeCorr(), makeGrowth(), makeUrban(["in_progress", "funded"]), makeAttractors());
    expect(r.horizon_2y.outlook_status).toBe("supportive");
    expect(r.horizon_2y.narrative_mode).toBe("full");
    expect(r.horizon_2y.outlook_direction).toBe("upward_pressure");
  });

  it("2 — 5y mixed with intermediate signals", () => {
    const r = buildZoneOutlook(makeCorr(), makeGrowth("mixed"), makeUrban(["planned"]), makeAttractors(1));
    expect(["mixed", "weak"]).toContain(r.horizon_5y.outlook_status);
  });

  it("3 — 10y degraded when base is weak", () => {
    const r = buildZoneOutlook(makeCorr(), makeGrowth("negative", "weak"), makeUrban(["announced"]), null);
    expect(["weak", "insufficient"]).toContain(r.horizon_10y.outlook_status);
    expect(r.horizon_10y.evidence_level).not.toBe("strong");
  });

  it("4 — pressure without exact future price", () => {
    const r = buildZoneOutlook(makeCorr(), makeGrowth(), makeUrban(), makeAttractors());
    expect(r.outlook_value_pressure.pressure_direction).toBeDefined();
    expect(r.outlook_value_pressure.pressure_basis).not.toContain("prezzo futuro");
    expect(JSON.stringify(r)).not.toMatch(/prezzo.*sar[àa]/i);
  });

  it("5 — attention coerente with fallback penalties", () => {
    const r = buildZoneOutlook(
      makeCorr({ fallback_weight: "high", geo_level: "comune" }),
      makeGrowth("mixed", "weak"),
      makeUrban(["planned"]),
      null,
    );
    expect(["low", "insufficient"]).toContain(r.outlook_attention);
    expect(r.outlook_limitations.comune_only_bias).toBe(true);
  });

  it("6 — comune-only → narrative not too strong", () => {
    const r = buildZoneOutlook(
      makeCorr({ fallback_weight: "high", geo_level: "comune" }),
      makeGrowth(),
      makeUrban(),
      makeAttractors(),
    );
    expect(r.outlook_value_pressure.false_specificity_risk).toBe(true);
    expect(r.outlook_limitations.transparency_notes.some(n => n.includes("comunale"))).toBe(true);
  });

  it("7 — hidden when signals are too broad or insufficient", () => {
    const r = buildZoneOutlook(
      makeCorr({ fallback_weight: "high", geo_level: "comune", anchor: "weak" }),
      null, null, null,
    );
    expect(outlookNarrativeMode(r)).toBe("hidden");
    expect(r.outlook_attention).toBe("insufficient");
  });

  it("8 — no regression: result is fully typed", () => {
    const r = buildZoneOutlook(makeCorr(), makeGrowth(), makeUrban(), makeAttractors());
    expect(r.outlook_identity.zone_geo_code).toBe("015146");
    expect(r.horizon_2y.horizon_label).toBe("2 anni");
    expect(r.horizon_5y.horizon_label).toBe("5 anni");
    expect(r.horizon_10y.horizon_label).toBe("10 anni");
    expect(r.outlook_value_pressure).toBeDefined();
    expect(r.outlook_limitations).toBeDefined();
  });

  it("9 — no regression on Zone Transformations contract", () => {
    const u = makeUrban();
    expect(u.urban_transformation_signals[0].signal_stage).toBeDefined();
    expect(u.urban_transformation_summary.overall_transformation_signal_status).toBeDefined();
  });

  it("10 — no regression on Attractors contract", () => {
    const a = makeAttractors();
    expect(a.pressure_summary.overall_pressure_signal_status).toBeDefined();
    expect(a.attractor_signals[0].intensity_hint).toBeDefined();
  });

  it("11 — type safety of full contract", () => {
    const r: ZoneOutlookResult = buildZoneOutlook(makeCorr(), makeGrowth(), makeUrban(), makeAttractors());
    const directions: string[] = [
      r.outlook_value_pressure.near_term_value_pressure,
      r.outlook_value_pressure.mid_term_value_pressure,
      r.outlook_value_pressure.long_term_value_pressure,
    ];
    for (const d of directions) {
      expect(["upward_pressure", "mixed_pressure", "neutral_pressure", "not_determinable"]).toContain(d);
    }
  });
});
