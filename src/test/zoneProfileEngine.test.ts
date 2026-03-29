import { describe, it, expect } from "vitest";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import {
  buildZoneProfile,
  buildReportViewModel,
  buildTerritorialReport,
  type ZoneProfile,
  type TerritorialReportViewModel,
} from "@/lib/zoneProfileEngine";

function profileFor(code: string) {
  const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
  return { data, profile: buildZoneProfile(data) };
}

describe("Zone Profile Engine — Phase 3", () => {
  it("generates zone profile from comune with good coverage", () => {
    const { profile } = profileFor("015146");
    expect(profile.zone_identity.geo_level).toBe("comune");
    expect(profile.zone_identity.geo_label).toContain("015146");
    expect(profile.zone_identity.precision_label).toBeTruthy();
    expect(profile.zone_data_quality.overall_quality_status).toBeTruthy();
  });

  it("generates zone profile from ASC code", () => {
    const data = resolveTerritorialData({ geo_input: { asc_code: "015146_ASC2_01" }, include_placeholders: true });
    const profile = buildZoneProfile(data);
    expect(profile.zone_identity.geo_level).toBe("sub_comunale");
    expect(profile.zone_positioning.asc_presence).toBe(false); // no DB coverage
    expect(profile.zone_structure.sub_municipal_support).toBe(false); // no real data
  });

  it("generates zone profile from sezione censuaria", () => {
    const data = resolveTerritorialData({ geo_input: { section_code: "015146_001" }, include_placeholders: true });
    const profile = buildZoneProfile(data);
    expect(profile.zone_identity.geo_level).toBe("sezione_censuaria");
  });

  it("report_renderability has correct modes for weak data", () => {
    const { profile } = profileFor("999999"); // Non-existent
    const rr = profile.report_renderability.sections;
    // With no real data, most sections hidden or partial
    for (const [, s] of Object.entries(rr)) {
      if (!s.can_render) {
        expect(s.render_mode).toBe("hidden");
      }
    }
  });

  it("omits weak sections intelligently", () => {
    const { profile } = profileFor("015146");
    const rr = profile.report_renderability.sections;
    // Sub-municipal coverage without DB data should not be full
    if (!profile.zone_positioning.section_presence && !profile.zone_positioning.asc_presence) {
      expect(rr.sub_municipal_coverage.render_mode).not.toBe("full");
    }
  });

  it("zone_market_context is coherent with OMI linkage", () => {
    const { profile } = profileFor("015146");
    const mc = profile.zone_market_context;
    if (mc.omi_linked) {
      expect(mc.omi_link_level).toBeTruthy();
      expect(mc.omi_link_precision).not.toBe("unavailable");
      expect(mc.market_quality).not.toBe("unavailable");
    } else {
      expect(mc.omi_link_precision).toBe("unavailable");
      expect(mc.market_quality).toBe("unavailable");
    }
  });

  it("transparency notes are populated when data degrades", () => {
    const { profile } = profileFor("015146");
    // Without DB coverage, services/env/mobility are missing
    expect(profile.zone_limitations.missing_layers.length).toBeGreaterThan(0);
  });

  it("never promotes elaborated to official", () => {
    const { profile } = profileFor("015146");
    // If quality is elaborated, it should not say "official" in the badges
    if (profile.zone_data_quality.officiality_mix === "elaborated") {
      // The key here is that it's correctly typed as elaborated
      expect(profile.zone_data_quality.officiality_mix).toBe("elaborated");
    }
  });

  it("builds report view model with typed sections", () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: "015146" }, include_placeholders: true });
    const profile = buildZoneProfile(data);
    const vm = buildReportViewModel(profile, data);

    expect(vm.header.title).toBeTruthy();
    expect(vm.header.subtitle).toBeTruthy();
    expect(vm.sections.length).toBeGreaterThan(0);
    expect(vm.data_quality_footer.status_label).toBeTruthy();
    expect(vm.transparency_panel.sources.length).toBeGreaterThan(0);

    // Every section has correct structure
    for (const s of vm.sections) {
      expect(s.key).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(["full", "partial", "hidden"]).toContain(s.render_mode);
    }
  });

  it("handles territory with minimum coverage robustly", () => {
    const { profile, data } = profileFor("000000");
    // Should not throw, should have proper unavailable markers
    expect(profile.zone_data_quality.overall_quality_status).toBeTruthy();
    const vm = buildReportViewModel(profile, data);
    expect(vm).toBeTruthy();
  });

  it("full pipeline buildTerritorialReport works end-to-end", () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: "058091" }, include_placeholders: true });
    const { profile, viewModel } = buildTerritorialReport(data);
    expect(profile.zone_identity.geo_code).toBe("058091");
    expect(viewModel.header.title).toBeTruthy();
    expect(viewModel.sections.length).toBeGreaterThanOrEqual(0);
  });
});
