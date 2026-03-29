import { describe, it, expect } from "vitest";
import {
  resolveAddress,
  addressFactSupportLevel,
  type AddressResolutionInput,
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
    // Without registry, resolution is at best partial
    expect(res.address_resolution.resolution_status).toBe("partially_resolved");
    expect(res.address_resolution.matched_by).toBe("normalized");
    // Never full confidence without registry
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
    // Still not building truth
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

    // Empty input → hidden for street/civic
    const empty = resolveAddress({ raw_address: "" });
    expect(empty.address_reportability.sections.street_match.render_mode).toBe("hidden");
    expect(empty.address_reportability.sections.civic_match.render_mode).toBe("hidden");
  });

  it("addressFactSupportLevel returns correct level", () => {
    const res = resolveAddress(makeInput());
    // Without registry, quality is at best weak → derived
    const level = addressFactSupportLevel(res);
    expect(["contextual", "derived", "unavailable"]).toContain(level);
  });

  it("unsupported claims stay when civic is unreliable", () => {
    const res = resolveAddress(makeInput());
    expect(res.address_limitations.missing_official_address_registry).toBe(true);
    expect(res.address_limitations.missing_civic_registry).toBe(true);
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
});
