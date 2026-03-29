import { describe, it, expect } from "vitest";
import {
  resolveAddress,
  addressFactSupportLevel,
  type AddressResolutionInput,
  type AnncsuCandidate,
} from "@/lib/addressResolutionEngine";

function makeInput(overrides?: Partial<AddressResolutionInput>): AddressResolutionInput {
  return {
    raw_address: "Via Roma 12",
    comune: "Milano",
    provincia: "MI",
    regione: "Lombardia",
    ...overrides,
  };
}

function makeAnncsuCandidate(overrides?: Partial<AnncsuCandidate>): AnncsuCandidate {
  return {
    street_name: "Roma",
    street_type: "Via",
    civic_normalized: null,
    esponente: null,
    cod_strada: "001",
    comune_istat_code: "015146",
    comune_label: "Milano",
    ingest_readiness: "ready",
    ambiguity_flags: [],
    ...overrides,
  };
}

describe("AddressResolutionEngine", () => {
  it("normalizes a simple address with comune", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_identity.normalized_street_type).toBe("Via");
    expect(res.address_identity.normalized_street_name).toBe("Roma");
    expect(res.address_normalization.house_number_raw).toBe("12");
    expect(res.address_identity.normalized_comune).toBe("Milano");
  });

  it("distinguishes normalized address from truly resolved address", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_resolution.resolution_status).toBe("partially_resolved");
    expect(res.address_resolution.matched_by).toBe("normalized");
    expect(res.address_resolution.matched_street_confidence).toBeLessThan(0.6);
  });

  it("detects street matched but civic ambiguous", () => {
    const res = resolveAddress(makeInput({ raw_address: "Via Roma 12" }));
    expect(res.address_resolution.matched_street_status).toBe("normalized_match");
    expect(res.civic_resolution.civic_input_present).toBe(true);
    expect(res.civic_resolution.civic_match_status).toBe("partial_match");
    expect(res.civic_resolution.civic_ambiguity).not.toBe("none");
  });

  it("civic present in text but NOT supported as building truth", () => {
    const res = resolveAddress(makeInput({ raw_address: "Via Garibaldi 45" }));
    expect(res.civic_resolution.civic_input_present).toBe(true);
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
    expect(res.civic_resolution.civic_supported_as_precise_location).toBe(false);
    expect(res.civic_resolution.civic_reasoning_summary).toContain("non viene promosso");
  });

  it("coordinates improve match without undue promotion", () => {
    const withCoords = resolveAddress(makeInput({ lat: 45.46, lng: 9.19 }));
    const withoutCoords = resolveAddress(makeInput());
    expect(withCoords.address_resolution.matched_street_confidence)
      .toBeGreaterThan(withoutCoords.address_resolution.matched_street_confidence);
    expect(withCoords.civic_resolution.civic_supported_as_building_truth).toBe(false);
  });

  it("fails cleanly on noisy or incomplete input", () => {
    const res = resolveAddress({ raw_address: "" });
    expect(res.address_resolution.resolution_status).toBe("unresolved");
    expect(res.address_resolution.matched_street_status).toBe("not_found");
    expect(res.address_quality.overall_address_quality).toBe("none");
    expect(res.address_normalization.ambiguity_flags).toContain("no_input");
  });

  it("address_reportability correct full/partial/hidden", () => {
    const res = resolveAddress(makeInput());
    const rr = res.address_reportability.sections;
    expect(rr.address_precision.render_mode).toBe("partial");
    expect(rr.address_limitations.render_mode).toBe("full");
    expect(rr.false_precision_risk.can_render).toBe(true);

    const empty = resolveAddress({ raw_address: "" });
    expect(empty.address_reportability.sections.street_match.render_mode).toBe("hidden");
    expect(empty.address_reportability.sections.civic_match.render_mode).toBe("hidden");
  });

  it("addressFactSupportLevel returns correct level", () => {
    const res = resolveAddress(makeInput());
    const level = addressFactSupportLevel(res);
    expect(["contextual", "derived", "unavailable"]).toContain(level);
  });

  it("unsupported claims stay when civic is unreliable", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_limitations.no_precise_building_link).toBe(true);
    expect(res.address_limitations.blocking_gaps.length).toBeGreaterThan(0);
  });

  it("does not regress — handles various street types", () => {
    const cases = [
      { input: "P.za Duomo 1", expectedType: "Piazza" },
      { input: "C.so Buenos Aires 33", expectedType: "Corso" },
      { input: "Viale Monza 120", expectedType: "Viale" },
      { input: "L.go Cairoli 5", expectedType: "Largo" },
    ];
    for (const c of cases) {
      const res = resolveAddress({ raw_address: c.input });
      expect(res.address_identity.normalized_street_type).toBe(c.expectedType);
    }
  });

  // === ANNCSU INTEGRATION TESTS ===

  it("exact official street match with coherent comune", () => {
    const candidates = [makeAnncsuCandidate()];
    const res = resolveAddress(makeInput({ anncsu_street_candidates: candidates }));
    expect(res.address_resolution.matched_street_status).toBe("exact_official_match");
    expect(res.address_resolution.official_street_support).toBe(true);
    expect(res.address_resolution.matched_by).toBe("official_exact");
    expect(res.address_resolution.matched_by_source).toBe("anncsu_official");
    expect(res.address_resolution.matched_street_confidence).toBeGreaterThan(0.6);
    expect(res.address_resolution.building_truth_support).toBe(false);
  });

  it("normalized official street match without undue promotion", () => {
    // street_type differs but name matches
    const candidates = [makeAnncsuCandidate({ street_type: "Viale" })];
    const res = resolveAddress(makeInput({ anncsu_street_candidates: candidates }));
    expect(res.address_resolution.matched_street_status).toBe("normalized_official_match");
    expect(res.address_resolution.official_street_support).toBe(true);
    expect(res.address_resolution.matched_by).toBe("official_normalized");
    // Confidence should be lower than exact
    expect(res.address_resolution.matched_street_confidence).toBeLessThan(0.85);
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
  });

  it("civic found in ANNCSU → official_civic_support true but building_truth false", () => {
    const streetCandidates = [makeAnncsuCandidate()];
    const civicCandidates = [makeAnncsuCandidate({ civic_normalized: "12" })];
    const res = resolveAddress(makeInput({
      anncsu_street_candidates: streetCandidates,
      anncsu_civic_candidates: civicCandidates,
    }));
    expect(res.address_resolution.official_civic_support).toBe(true);
    expect(res.civic_resolution.civic_match_status).toBe("official_exact_match");
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
    expect(res.address_resolution.building_truth_support).toBe(false);
    expect(res.civic_resolution.civic_reasoning_summary).toContain("ANNCSU");
    expect(res.civic_resolution.civic_reasoning_summary).toContain("non viene promosso");
  });

  it("multiple civic candidates → ambiguous", () => {
    const streetCandidates = [makeAnncsuCandidate()];
    const civicCandidates = [
      makeAnncsuCandidate({ civic_normalized: "12", esponente: "A" }),
      makeAnncsuCandidate({ civic_normalized: "12", esponente: "B" }),
    ];
    const res = resolveAddress(makeInput({
      anncsu_street_candidates: streetCandidates,
      anncsu_civic_candidates: civicCandidates,
    }));
    expect(res.address_resolution.anncsu_civic_exactness).toBe("ambiguous");
    expect(res.civic_resolution.civic_match_status).toBe("official_ambiguous");
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
    expect(res.address_resolution.official_civic_support).toBe(false);
  });

  it("no ANNCSU match → legacy behavior robust", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_resolution.anncsu_match_status).toBe("not_determinable");
    expect(res.address_resolution.official_street_support).toBe(false);
    expect(res.address_resolution.official_civic_support).toBe(false);
    expect(res.address_resolution.building_truth_support).toBe(false);
    expect(res.address_resolution.matched_by_source).toBe("text_parsing");
  });

  it("address precision panel not promoted improperly to full", () => {
    // With ANNCSU street match but no civic → should not be "full"
    const candidates = [makeAnncsuCandidate()];
    const res = resolveAddress(makeInput({
      raw_address: "Via Roma",
      anncsu_street_candidates: candidates,
    }));
    // No civic → address_precision should be partial at most, not full
    expect(res.address_reportability.sections.address_precision.render_mode).not.toBe("hidden");
    // Building truth still false
    expect(res.address_resolution.building_truth_support).toBe(false);
  });

  it("civic_supported_as_building_truth always false", () => {
    // Even with perfect ANNCSU match
    const streetCandidates = [makeAnncsuCandidate()];
    const civicCandidates = [makeAnncsuCandidate({ civic_normalized: "12" })];
    const res = resolveAddress(makeInput({
      lat: 45.46, lng: 9.19,
      anncsu_street_candidates: streetCandidates,
      anncsu_civic_candidates: civicCandidates,
    }));
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
    expect(res.address_resolution.building_truth_support).toBe(false);
  });

  it("ANNCSU with blocked readiness is ignored", () => {
    const candidates = [makeAnncsuCandidate({ ingest_readiness: "blocked" })];
    const res = resolveAddress(makeInput({ anncsu_street_candidates: candidates }));
    expect(res.address_resolution.official_street_support).toBe(false);
    expect(res.address_resolution.anncsu_match_status).toBe("no_official_match");
  });

  it("precise_location_support only with exact civic + coords", () => {
    const streetCandidates = [makeAnncsuCandidate()];
    const civicCandidates = [makeAnncsuCandidate({ civic_normalized: "12" })];

    // Without coords
    const noCoords = resolveAddress(makeInput({
      anncsu_street_candidates: streetCandidates,
      anncsu_civic_candidates: civicCandidates,
    }));
    expect(noCoords.address_resolution.precise_location_support).toBe(false);

    // With coords
    const withCoords = resolveAddress(makeInput({
      lat: 45.46, lng: 9.19,
      anncsu_street_candidates: streetCandidates,
      anncsu_civic_candidates: civicCandidates,
    }));
    expect(withCoords.address_resolution.precise_location_support).toBe(true);
  });

  it("ANNCSU quality improves source_chain_clarity", () => {
    const candidates = [makeAnncsuCandidate()];
    const withAnncsu = resolveAddress(makeInput({ anncsu_street_candidates: candidates }));
    const withoutAnncsu = resolveAddress(makeInput());
    expect(withAnncsu.address_quality.source_chain_clarity).toBe("high");
    expect(withoutAnncsu.address_quality.source_chain_clarity).toBe("low");
  });

  it("limitations correctly reflect ANNCSU availability", () => {
    const candidates = [makeAnncsuCandidate()];
    const withAnncsu = resolveAddress(makeInput({ anncsu_street_candidates: candidates }));
    expect(withAnncsu.address_limitations.missing_official_address_registry).toBe(false);
    // building link always missing (ANNCSU is not building truth)
    expect(withAnncsu.address_limitations.no_precise_building_link).toBe(true);

    const withoutAnncsu = resolveAddress(makeInput());
    expect(withoutAnncsu.address_limitations.missing_official_address_registry).toBe(true);
  });

  it("type safety: contract has all required ANNCSU fields", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_resolution).toHaveProperty("anncsu_match_status");
    expect(res.address_resolution).toHaveProperty("anncsu_candidate_count");
    expect(res.address_resolution).toHaveProperty("anncsu_street_exactness");
    expect(res.address_resolution).toHaveProperty("anncsu_civic_exactness");
    expect(res.address_resolution).toHaveProperty("source_chain");
    expect(res.address_resolution).toHaveProperty("official_street_support");
    expect(res.address_resolution).toHaveProperty("official_civic_support");
    expect(res.address_resolution).toHaveProperty("precise_location_support");
    expect(res.address_resolution).toHaveProperty("building_truth_support");
    expect(res.address_resolution).toHaveProperty("matched_by_source");
  });
});
