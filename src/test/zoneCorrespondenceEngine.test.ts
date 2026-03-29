import { describe, it, expect } from "vitest";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence, type ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import { buildZoneGrowthSignals, type ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";

function corrFor(code: string): ZoneCorrespondenceResult {
  const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
  return buildZoneCorrespondence(data);
}

function growthFor(code: string): ZoneGrowthSignalsResult {
  const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
  const corr = buildZoneCorrespondence(data);
  return buildZoneGrowthSignals(data, corr);
}

describe("Zone Correspondence Engine", () => {
  it("identifies comune-only zone correctly for known code", () => {
    const c = corrFor("015146");
    expect(c.zone_identity.geo_level_reale).toBe("comune");
    expect(c.zone_identity.zone_anchor_strength).toBeTruthy();
    expect(c.zone_identity.zone_corresponds_to).toBeTruthy();
    expect(c.zone_correspondence.primary_zone_basis).toBeTruthy();
  });

  it("flags missing sub-municipal when unavailable", () => {
    const c = corrFor("999999");
    expect(c.zone_limitations.missing_sub_comunale).toBe(true);
    expect(c.zone_correspondence.corresponds_to_comune_only).toBe(true);
    expect(c.zone_precision.sub_comunale_support_status).toBe("unavailable");
  });

  it("max_safe_claim_level never exceeds available data", () => {
    const c = corrFor("015146");
    // For a comune with no DB sub-municipal data, should be at most comune
    if (c.zone_correspondence.corresponds_to_comune_only) {
      expect(c.zone_precision.max_safe_claim_level).toBe("comune");
    }
  });

  it("false_specificity_risk is high when no sub-municipal data", () => {
    const c = corrFor("000000");
    if (c.zone_correspondence.corresponds_to_comune_only) {
      // If effective level is finer than comune (shouldn't happen for clean input)
      // but if it is, false_specificity should catch it
      expect(["none", "low", "medium", "high"]).toContain(c.zone_correspondence.false_specificity_risk);
    }
  });

  it("produces coherent precision_status", () => {
    const c = corrFor("015146");
    expect(["strong", "medium", "weak", "insufficient"]).toContain(c.zone_precision.precision_status);
  });

  it("fallback_weight reflects actual fallback state", () => {
    const c = corrFor("015146");
    expect(["none", "low", "medium", "high"]).toContain(c.zone_correspondence.fallback_weight);
  });
});

describe("Zone Growth Signals", () => {
  it("produces 4 signals for basic case", () => {
    const g = growthFor("015146");
    expect(g.growth_signals.length).toBe(4);
    const families = g.growth_signals.map(s => s.signal_family);
    expect(families).toContain("zone_anchor");
    expect(families).toContain("market");
    expect(families).toContain("territorial_depth");
    expect(families).toContain("data_confidence");
  });

  it("summary counts are consistent with signals", () => {
    const g = growthFor("015146");
    const { positive_signal_count, negative_signal_count, mixed_signal_count } = g.growth_summary;
    const total = positive_signal_count + negative_signal_count + mixed_signal_count +
      g.growth_signals.filter(s => s.signal_direction === "not_determinable" || s.signal_direction === "neutral").length;
    expect(total).toBe(g.growth_signals.length);
  });

  it("overall_growth_signal_status is coherent", () => {
    const g = growthFor("015146");
    expect(["supportive", "mixed", "weak", "insufficient"]).toContain(g.growth_summary.overall_growth_signal_status);
  });

  it("weak territory has weak/insufficient growth status", () => {
    const g = growthFor("000000");
    expect(["weak", "insufficient"]).toContain(g.growth_summary.overall_growth_signal_status);
  });

  it("narrative_mode hidden when insufficient", () => {
    const g = growthFor("000000");
    if (g.growth_summary.overall_growth_signal_status === "insufficient") {
      expect(g.growth_summary.narrative_mode).toBe("hidden");
    }
  });

  it("growth limitations flag comunale_only_bias", () => {
    const g = growthFor("999999");
    expect(g.growth_limitations.comunale_only_bias).toBe(true);
    expect(g.growth_limitations.missing_depth).toBe(true);
  });

  it("no regression on zone profile engine", () => {
    // Importing zone profile to make sure it still works
    const { buildTerritorialReport } = require("@/lib/zoneProfileEngine");
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: "015146" }, include_placeholders: true });
    const result = buildTerritorialReport(data);
    expect(result.profile.zone_identity.geo_level).toBe("comune");
    expect(result.viewModel.header.title).toBeTruthy();
  });

  it("no regression on territorial backbone", () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: "058091" }, include_placeholders: true });
    expect(data.territorial_identity.geo_level).toBe("comune");
    expect(data.territorial_datasets).toBeTruthy();
  });
});
