import { describe, it, expect } from "vitest";
import {
  buildBuildingProfile,
  buildBuildingReportViewModel,
  buildFullBuildingReport,
  type BuildingProfileInput,
} from "@/lib/buildingProfileEngine";
import { resolveTerritorialData, type TerritorialResolverInput } from "@/lib/territorialDataBackbone";

function makeTerritorialData(overrides?: Partial<TerritorialResolverInput>) {
  return resolveTerritorialData({
    geo_input: { comune_istat_code: "015146", comune_name: "Milano" },
    ...overrides,
  });
}

function makeInput(overrides?: Partial<BuildingProfileInput>): BuildingProfileInput {
  return {
    territorial_data: makeTerritorialData(),
    lat: 45.4642,
    lng: 9.1900,
    has_photo: true,
    identification_confidence: 0.85,
    identification_mode: "scan_photo",
    ...overrides,
  };
}

describe("BuildingProfileEngine", () => {
  it("generates profile from territory with good contextual coverage", () => {
    const profile = buildBuildingProfile(makeInput());
    expect(profile.building_identity.identification_mode).toBe("scan_photo");
    expect(profile.building_identity.identification_precision).toBe("high");
    expect(profile.building_identity.is_point_specific).toBe(true);
    expect(profile.building_identity.is_building_level_supported).toBe(true);
    expect(profile.building_identity.is_address_level_supported).toBe(false);
  });

  it("generates profile with territorial-only localization", () => {
    const profile = buildBuildingProfile(makeInput({
      lat: null,
      lng: null,
      has_photo: false,
      identification_confidence: 0,
      identification_mode: "territorial_only",
    }));
    expect(profile.building_identity.is_point_specific).toBe(false);
    expect(profile.building_identity.is_building_level_supported).toBe(false);
    expect(profile.building_localization.coordinate_status).toBe("unavailable");
    expect(profile.building_localization.civic_status).toBe("not_introduced_yet");
  });

  it("includes unsupported claims when address/civic/registry are missing", () => {
    const profile = buildBuildingProfile(makeInput());
    expect(profile.building_inferred_bounds.what_cannot_be_said.length).toBeGreaterThan(0);
    expect(profile.building_inferred_bounds.what_cannot_be_said).toContain("Anno di costruzione dell'edificio");
    expect(profile.building_inferred_bounds.what_cannot_be_said).toContain("Numero di unità immobiliari");
    expect(profile.building_limitations.missing_civic_link).toBe(true);
    expect(profile.building_limitations.missing_building_registry).toBe(true);
  });

  it("distinguishes direct vs contextual vs derived correctly", () => {
    const profile = buildBuildingProfile(makeInput());
    const facts = profile.building_supported_facts;
    
    // Coordinates are direct
    const coordFact = facts.localization_facts.find(f => f.key === "coordinates");
    expect(coordFact?.is_direct).toBe(true);

    // Territorial context is contextual
    const ctxFact = facts.territorial_context_facts.find(f => f.key === "geo_path");
    expect(ctxFact?.is_contextual).toBe(true);

    // Coverage score is derived
    const covFact = facts.coverage_facts.find(f => f.key === "precision_score");
    expect(covFact?.is_derived).toBe(true);
  });

  it("report_renderability correctly sets full/partial/hidden", () => {
    const profile = buildBuildingProfile(makeInput());
    const rr = profile.building_report_renderability.sections;
    
    expect(rr.identity.can_render).toBe(true);
    expect(rr.identity.render_mode).toBe("full");
    expect(rr.unsupported_claims.can_render).toBe(true);
    expect(rr.unsupported_claims.render_mode).toBe("full");
    expect(rr.limitations.can_render).toBe(true);
  });

  it("does not promote contextual data to direct building fact", () => {
    const profile = buildBuildingProfile(makeInput());
    const allFacts = [
      ...profile.building_supported_facts.territorial_context_facts,
      ...profile.building_supported_facts.market_linkage_facts,
    ];
    for (const f of allFacts) {
      expect(f.is_direct).toBe(false);
    }
  });

  it("limitations/transparency populated when data degrades", () => {
    const profile = buildBuildingProfile(makeInput({
      lat: null, lng: null, has_photo: false, identification_confidence: 0,
    }));
    expect(profile.building_limitations.missing_precise_address).toBe(true);
    expect(profile.building_limitations.transparency_notes.length).toBeGreaterThan(0);
    expect(profile.building_data_quality.identification_strength).toBe("none");
  });

  it("robust on territory with minimal coverage", () => {
    const td = resolveTerritorialData({ geo_input: {} });
    const profile = buildBuildingProfile({ territorial_data: td });
    expect(profile.building_identity.identification_mode).toBe("territorial_only");
    expect(profile.building_data_quality.overall_quality_status).toBeDefined();
    expect(profile.building_summary.executive_summary).toBeTruthy();
  });

  it("contract is stable and typed", () => {
    const profile = buildBuildingProfile(makeInput());
    expect(profile.building_identity).toBeDefined();
    expect(profile.building_localization).toBeDefined();
    expect(profile.building_context).toBeDefined();
    expect(profile.building_supported_facts).toBeDefined();
    expect(profile.building_inferred_bounds).toBeDefined();
    expect(profile.building_data_quality).toBeDefined();
    expect(profile.building_limitations).toBeDefined();
    expect(profile.building_summary).toBeDefined();
    expect(profile.building_report_renderability).toBeDefined();
  });

  it("buildBuildingReportViewModel produces valid view model", () => {
    const input = makeInput();
    const profile = buildBuildingProfile(input);
    const vm = buildBuildingReportViewModel(profile, input.territorial_data);
    expect(vm.header.title).toBeTruthy();
    expect(vm.unsupported_claims_panel).not.toBeNull();
    expect(vm.transparency_panel.sources.length).toBeGreaterThan(0);
  });

  it("buildFullBuildingReport convenience works end-to-end", () => {
    const { profile, viewModel } = buildFullBuildingReport(makeInput());
    expect(profile.building_identity.identification_mode).toBe("scan_photo");
    expect(viewModel.header.precision_badge.label).toContain("precisione");
  });

  // Regression: Phase 1/2/3 types still work
  it("does not break territorial data resolution", () => {
    const td = resolveTerritorialData({
      geo_input: { comune_istat_code: "015146", comune_name: "Milano" },
    });
    expect(td.territorial_identity.geo_level).toBe("comune");
    expect(td.territorial_identity.geo_label).toContain("Milano");
  });
});
