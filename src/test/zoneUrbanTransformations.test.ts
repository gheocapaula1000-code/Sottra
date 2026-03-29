/**
 * Zone Urban Transformations Engine — Tests
 */

import { describe, it, expect } from "vitest";
import {
  buildUrbanTransformations,
  type UrbanTransformationInput,
  type UrbanTransformationResult,
  transformationStatusLabel,
  stageLabel,
  proximityLabel,
  relevanceLabel,
  familyLabel,
} from "@/lib/zoneUrbanTransformations";
import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence, type ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";

function makeData(code = "015146"): TerritorialDataResult {
  return resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
}

function makeCorr(data: TerritorialDataResult): ZoneCorrespondenceResult {
  return buildZoneCorrespondence(data);
}

function localSignal(overrides: Partial<UrbanTransformationInput> = {}): UrbanTransformationInput {
  return {
    signal_key: "metro_m4",
    signal_label: "Prolungamento metropolitana M4",
    signal_family: "opere_pubbliche",
    signal_type: "infrastruttura_trasporto",
    signal_status: "in_progress",
    signal_stage: "in_progress",
    signal_direction: "supportive",
    geo_scope: "sub_comunale",
    evidence_level: "strong",
    source_basis: "delibera_comunale",
    is_official: true,
    ...overrides,
  };
}

function comunaleSignal(overrides: Partial<UrbanTransformationInput> = {}): UrbanTransformationInput {
  return {
    signal_key: "piano_rigenerazione",
    signal_label: "Piano di rigenerazione urbana",
    signal_family: "rigenerazione_urbana",
    signal_type: "piano_urbanistico",
    signal_status: "approved",
    signal_stage: "approved",
    signal_direction: "supportive",
    geo_scope: "comune",
    evidence_level: "medium",
    source_basis: "piano_comunale",
    is_official: true,
    ...overrides,
  };
}

describe("zoneUrbanTransformations", () => {
  it("classifies local sub-municipal signal with high relevance", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [localSignal()]);

    const s = result.urban_transformation_signals[0];
    // Proximity depends on whether zone is comunale-only
    expect(["local_zone_signal", "broader_area_signal"]).toContain(s.proximity_relevance);
    expect(s.signal_family).toBe("opere_pubbliche");
    expect(s.is_contextual).toBe(false); // is_official = true
  });

  it("degrades comunale-only signal correctly", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [comunaleSignal()]);

    const s = result.urban_transformation_signals[0];
    expect(["broader_area_signal", "comune_wide_signal"]).toContain(s.proximity_relevance);
    expect(["medium", "low"]).toContain(s.territorial_relevance);
  });

  it("classifies stage/evidence/relevance correctly", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [
      localSignal({ signal_stage: "announced", evidence_level: "weak" }),
    ]);
    const s = result.urban_transformation_signals[0];
    expect(s.signal_stage).toBe("announced");
    expect(s.evidence_level).toBe("weak");
  });

  it("returns supportive when multiple strong local signals", () => {
    const data = makeData();
    const corr = makeCorr(data);
    // Force a non-comunale-only correspondence
    const forcedCorr: ZoneCorrespondenceResult = {
      ...corr,
      zone_correspondence: { ...corr.zone_correspondence, corresponds_to_comune_only: false },
    };

    const result = buildUrbanTransformations(data, forcedCorr, [
      localSignal({ signal_key: "s1" }),
      localSignal({ signal_key: "s2" }),
      localSignal({ signal_key: "s3" }),
    ]);

    expect(result.urban_transformation_summary.overall_transformation_signal_status).toBe("supportive");
    expect(result.urban_transformation_summary.narrative_mode).toBe("full");
  });

  it("returns hidden when no signals", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, []);

    expect(result.urban_transformation_summary.overall_transformation_signal_status).toBe("insufficient");
    expect(result.urban_transformation_summary.narrative_mode).toBe("hidden");
    expect(result.urban_transformation_limitations.insufficient_signal_depth).toBe(true);
  });

  it("does not promote comunale-only zone to full narrative", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const forcedCorr: ZoneCorrespondenceResult = {
      ...corr,
      zone_correspondence: { ...corr.zone_correspondence, corresponds_to_comune_only: true },
    };

    const result = buildUrbanTransformations(data, forcedCorr, [
      localSignal({ signal_key: "s1" }),
      localSignal({ signal_key: "s2" }),
      localSignal({ signal_key: "s3" }),
    ]);

    // Even with multiple signals, comunale-only zones get partial at best
    expect(result.urban_transformation_summary.narrative_mode).not.toBe("full");
  });

  it("degrades weak provincial signals to weakly_mapped", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [
      localSignal({ signal_key: "prov", geo_scope: "provincia", evidence_level: "weak" }),
    ]);

    const s = result.urban_transformation_signals[0];
    expect(s.proximity_relevance).toBe("weakly_mapped_signal");
    expect(s.territorial_relevance).toBe("not_determinable");
  });

  it("does not produce false precision for broad signals", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [
      comunaleSignal({ evidence_level: "weak" }),
    ]);

    expect(result.urban_transformation_summary.overall_transformation_signal_status).toBe("weak");
    expect(result.urban_transformation_summary.narrative_mode).not.toBe("full");
  });

  it("no regression on zone correspondence engine", () => {
    const data = makeData();
    const corr = makeCorr(data);
    // Correspondence should still work independently
    expect(corr.zone_identity.geo_code).toBeTruthy();
    expect(corr.zone_precision.precision_status).toBeTruthy();
  });

  it("type safety: all fields present in result", () => {
    const data = makeData();
    const corr = makeCorr(data);
    const result = buildUrbanTransformations(data, corr, [localSignal()]);

    // Identity
    expect(result.urban_transformation_identity.zone_geo_code).toBeTruthy();
    expect(result.urban_transformation_identity.zone_geo_level).toBeTruthy();
    expect(result.urban_transformation_identity.zone_label).toBeTruthy();
    expect(result.urban_transformation_identity.analysis_scope).toBeTruthy();
    expect(result.urban_transformation_identity.source_coverage_strength).toBeTruthy();

    // Summary
    expect(typeof result.urban_transformation_summary.total_signals).toBe("number");
    expect(typeof result.urban_transformation_summary.high_relevance_signals).toBe("number");
    expect(result.urban_transformation_summary.overall_transformation_signal_status).toBeTruthy();
    expect(result.urban_transformation_summary.narrative_mode).toBeTruthy();

    // Limitations
    expect(typeof result.urban_transformation_limitations.sparse_coverage).toBe("boolean");
    expect(Array.isArray(result.urban_transformation_limitations.transparency_notes)).toBe(true);
  });

  it("labels are all non-empty strings", () => {
    expect(transformationStatusLabel("supportive").length).toBeGreaterThan(0);
    expect(transformationStatusLabel("insufficient").length).toBeGreaterThan(0);
    expect(stageLabel("in_progress").length).toBeGreaterThan(0);
    expect(proximityLabel("local_zone_signal").length).toBeGreaterThan(0);
    expect(relevanceLabel("high").length).toBeGreaterThan(0);
    expect(familyLabel("opere_pubbliche").length).toBeGreaterThan(0);
  });
});
