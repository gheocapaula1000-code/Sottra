import { describe, it, expect } from "vitest";
import {
  buildHouseDifferentiation,
  type HouseDifferentiationInput,
  differentiationStatusLabel,
  specificityStrengthLabel,
  separationLabel,
} from "@/lib/houseDifferentiationEngine";

function baseInput(overrides: Partial<HouseDifferentiationInput> = {}): HouseDifferentiationInput {
  return {
    photo_present: true,
    geo_present: true,
    lat: 45.464,
    lng: 9.191,
    address_raw: "Via Roma 10, Milano",
    address_resolution: {
      street_match_status: "exact_official_match",
      civic_match_status: "official_exact_match",
      official_street_support: true,
      official_civic_support: true,
      building_truth_support: false,
      ambiguity_level: "none",
      overall_address_quality: "strong",
      false_specificity_risk: "low",
    },
    building_profile: {
      building_truth_supported: false,
      address_fact_level: "contextual",
      zone_geo_level: "microzona",
      zone_geo_code: "MI_B1",
    },
    identify_hints: {
      confidence: 0.85,
      facade_visible: true,
      entrance_visible: true,
      civic_visible: true,
      neighboring_visible: false,
      signage_visible: false,
    },
    ...overrides,
  };
}

describe("HouseDifferentiationEngine (Boosted)", () => {
  it("strong candidate with clear facade + geo + address convergence", () => {
    const r = buildHouseDifferentiation(baseInput());
    expect(r.specificity.specificity_status).toBe("strong_building_candidate");
    expect(r.specificity.specificity_strength).toBe("strong");
    expect(r.specificity.house_vs_adjacent_separation).toBe("likely_distinct");
    expect(r.summary.usable_for_building_level_review).toBe(true);
    expect(r.summary.still_zone_dominant).toBe(false);
    expect(r.summary.narrative_mode).toBe("full");
    // Boosted structure signals present
    expect(r.visual_signals.structure.single_facade_likelihood).toBe("strong");
    expect(r.visual_signals.context_separation.visual_focus_strength).toBe("strong");
    // Diagnostics present
    expect(r.address_alignment.diagnostics).toBeDefined();
    expect(r.address_alignment.diagnostics.overall_alignment_status).toBe("high_alignment");
  });

  it("contiguous buildings + no civic = capped at ambiguity (anti-false-distinction)", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.8,
        facade_visible: true,
        entrance_visible: true,
        civic_visible: false,
        neighboring_visible: true,
      },
    }));
    // Must NOT be strong or limited_ambiguity
    expect(r.specificity.specificity_status).not.toBe("strong_building_candidate");
    expect(r.specificity.specificity_status).not.toBe("building_candidate_with_limited_ambiguity");
    expect(r.visual_signals.neighboring_buildings_presence).toBe("visible_contiguous");
    expect(r.visual_signals.context_separation.likely_adjacent_building_confusion).toBe("strong");
  });

  it("multiple buildings in frame → downgrade", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.7,
        facade_visible: true,
        entrance_visible: false,
        civic_visible: false,
        neighboring_visible: true,
      },
    }));
    expect(r.specificity.specificity_status).not.toBe("strong_building_candidate");
    expect(r.visual_signals.context_separation.likely_adjacent_building_confusion).not.toBe("not_determinable");
  });

  it("civic visible + ANNCSU + clear frontage → controlled boost", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.75,
        facade_visible: true,
        entrance_visible: true,
        civic_visible: true,
        neighboring_visible: false,
      },
    }));
    // Should be strong or limited_ambiguity with convergence
    expect(["strong_building_candidate", "building_candidate_with_limited_ambiguity"]).toContain(
      r.specificity.specificity_status
    );
    expect(r.visual_signals.structure.civic_plate_visibility).toBe("strong");
  });

  it("geo/address strong but photo vague → no excessive promotion", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.3,
        facade_visible: false,
        civic_visible: false,
      },
    }));
    expect(r.specificity.specificity_status).not.toBe("strong_building_candidate");
    expect(r.specificity.specificity_status).not.toBe("building_candidate_with_limited_ambiguity");
    expect(r.specificity.likely_single_building_focus).toBe(false);
    expect(r.address_alignment.diagnostics.alignment_conflict_flags).toContain("address_strong_photo_vague");
  });

  it("zone_only_context when signals are insufficient", () => {
    const r = buildHouseDifferentiation({
      photo_present: false,
      geo_present: true,
      lat: 45.0,
      lng: 9.0,
      address_raw: null,
      address_resolution: null,
      building_profile: {
        building_truth_supported: false,
        address_fact_level: "unavailable",
        zone_geo_level: "comune",
        zone_geo_code: "015146",
      },
      identify_hints: null,
    });
    expect(r.specificity.specificity_status).toBe("not_determinable");
    expect(r.summary.still_zone_dominant).toBe(true);
    expect(r.summary.narrative_mode).toBe("hidden");
  });

  it("wow specificity label maps correctly", () => {
    expect(specificityStrengthLabel("strong")).toBe("Alta");
    expect(specificityStrengthLabel("insufficient")).toBe("Non sufficiente");
  });

  it("differentiation status label includes new statuses", () => {
    expect(differentiationStatusLabel("strong_building_candidate")).toBe("Immobile probabilmente distinto");
    expect(differentiationStatusLabel("building_candidate_with_limited_ambiguity")).toBe("Candidato con ambiguità limitata");
    expect(differentiationStatusLabel("visually_ambiguous_context")).toBe("Contesto visivamente ambiguo");
    expect(differentiationStatusLabel("zone_only_context")).toBe("Lettura prevalentemente di zona");
  });

  it("separation label includes new levels", () => {
    expect(separationLabel("moderately_distinct")).toBe("Moderatamente distinto");
    expect(separationLabel("weakly_distinct")).toBe("Debolmente distinto");
  });

  it("no address resolution → still produces result with diagnostics", () => {
    const r = buildHouseDifferentiation(baseInput({
      address_resolution: null,
      identify_hints: { confidence: 0.6, facade_visible: true },
    }));
    expect(r.address_alignment.street_support_status).toBe("none");
    expect(r.address_alignment.anncsu_alignment_status).toBe("not_available");
    expect(r.address_alignment.diagnostics.overall_alignment_status).toBe("insufficient_alignment");
    expect(r.identity.photo_input_present).toBe(true);
  });

  it("building_truth_support stays false in all contract fields", () => {
    const r = buildHouseDifferentiation(baseInput());
    expect(r.specificity.max_safe_claim_level).not.toBe("building_truth");
  });

  it("type safety: all boosted fields present", () => {
    const r = buildHouseDifferentiation(baseInput());
    expect(r.identity).toBeDefined();
    expect(r.visual_signals).toBeDefined();
    expect(r.visual_signals.structure).toBeDefined();
    expect(r.visual_signals.context_separation).toBeDefined();
    expect(r.address_alignment).toBeDefined();
    expect(r.address_alignment.diagnostics).toBeDefined();
    expect(r.specificity).toBeDefined();
    expect(r.summary).toBeDefined();
    expect(r.summary.limitations.length).toBeGreaterThan(0);
  });

  it("conflicting photo+geo+address produces low alignment and conflicts", () => {
    const r = buildHouseDifferentiation(baseInput({
      address_resolution: {
        street_match_status: "not_found",
        civic_match_status: "not_found",
        official_street_support: false,
        official_civic_support: false,
        building_truth_support: false,
        ambiguity_level: "high",
        overall_address_quality: "weak",
        false_specificity_risk: "high",
      },
    }));
    expect(r.address_alignment.street_support_status).toBe("none");
    expect(r.address_alignment.civic_support_status).toBe("none");
    expect(r.specificity.false_specificity_risk).not.toBe("low");
  });

  it("single-source promotion is blocked", () => {
    // Strong ANNCSU but weak visual and geo
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.2,
        facade_visible: false,
        civic_visible: false,
      },
      address_resolution: {
        street_match_status: "exact_official_match",
        civic_match_status: "official_exact_match",
        official_street_support: true,
        official_civic_support: true,
        building_truth_support: false,
        ambiguity_level: "none",
        overall_address_quality: "strong",
        false_specificity_risk: "low",
      },
    }));
    expect(r.specificity.specificity_status).not.toBe("strong_building_candidate");
    expect(r.specificity.specificity_status).not.toBe("building_candidate_with_limited_ambiguity");
  });

  it("address_supported_but_visually_ambiguous when address ok but visual weak", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.35,
        facade_visible: true,
        civic_visible: false,
        entrance_visible: false,
        neighboring_visible: true,
      },
      address_resolution: {
        street_match_status: "exact_official_match",
        civic_match_status: "official_candidate_match",
        official_street_support: true,
        official_civic_support: false,
        building_truth_support: false,
        ambiguity_level: "low",
        overall_address_quality: "moderate",
        false_specificity_risk: "medium",
      },
    }));
    expect([
      "building_candidate_with_ambiguity",
      "address_supported_but_visually_ambiguous",
      "visually_ambiguous_context",
      "zone_only_context",
    ]).toContain(r.specificity.specificity_status);
  });
});
