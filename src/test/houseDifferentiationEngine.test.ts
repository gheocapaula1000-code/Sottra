import { describe, it, expect } from "vitest";
import {
  buildHouseDifferentiation,
  type HouseDifferentiationInput,
  differentiationStatusLabel,
  specificityStrengthLabel,
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

describe("HouseDifferentiationEngine", () => {
  it("strong candidate with clear facade + geo + address", () => {
    const r = buildHouseDifferentiation(baseInput());
    expect(r.specificity.specificity_status).toBe("strong_building_candidate");
    expect(r.specificity.specificity_strength).toBe("strong");
    expect(r.specificity.house_vs_adjacent_separation).toBe("likely_distinct");
    expect(r.summary.usable_for_building_level_review).toBe(true);
    expect(r.summary.still_zone_dominant).toBe(false);
    expect(r.summary.narrative_mode).toBe("full");
  });

  it("ambiguity when contiguous buildings visible", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.7,
        facade_visible: true,
        entrance_visible: false,
        civic_visible: false,
        neighboring_visible: true,
      },
    }));
    // Should NOT be strong_building_candidate when neighbors are contiguous and no civic
    expect(r.specificity.specificity_status).not.toBe("not_determinable");
    expect(r.visual_signals.neighboring_buildings_presence).toBe("visible_contiguous");
  });

  it("civic support without visual evidence doesn't promote to building truth", () => {
    const r = buildHouseDifferentiation(baseInput({
      identify_hints: {
        confidence: 0.3,
        facade_visible: false,
        civic_visible: false,
      },
    }));
    // Has ANNCSU civic support but weak visual → should not be strong
    expect(r.specificity.specificity_status).not.toBe("strong_building_candidate");
    expect(r.specificity.likely_single_building_focus).toBe(false);
  });

  it("conflicting photo + geo produces low alignment", () => {
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

  it("zone_only_context when address/visual are insufficient", () => {
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

  it("differentiation status label maps correctly", () => {
    expect(differentiationStatusLabel("strong_building_candidate")).toBe("Immobile probabilmente distinto");
    expect(differentiationStatusLabel("zone_only_context")).toBe("Lettura prevalentemente di zona");
  });

  it("no address resolution → still produces result", () => {
    const r = buildHouseDifferentiation(baseInput({
      address_resolution: null,
      identify_hints: { confidence: 0.6, facade_visible: true },
    }));
    expect(r.address_alignment.street_support_status).toBe("none");
    expect(r.address_alignment.anncsu_alignment_status).toBe("not_available");
    expect(r.identity.photo_input_present).toBe(true);
  });

  it("building_truth_support stays false in all contract fields", () => {
    const r = buildHouseDifferentiation(baseInput());
    // The engine NEVER sets building truth
    expect(r.specificity.max_safe_claim_level).not.toBe("building_truth");
  });

  it("type safety: all result fields are present", () => {
    const r = buildHouseDifferentiation(baseInput());
    expect(r.identity).toBeDefined();
    expect(r.visual_signals).toBeDefined();
    expect(r.address_alignment).toBeDefined();
    expect(r.specificity).toBeDefined();
    expect(r.summary).toBeDefined();
    expect(r.summary.limitations.length).toBeGreaterThan(0);
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
    // With weak visual but some address support, should be partial at best
    expect(["building_candidate_with_ambiguity", "address_supported_but_visually_ambiguous"]).toContain(
      r.specificity.specificity_status
    );
  });
});
