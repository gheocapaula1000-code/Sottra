import { describe, it, expect } from "vitest";
import {
  buildAttractorsPressure,
  type AttractorInput,
  type AttractorPressureResult,
} from "@/lib/zoneAttractorsPressure";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";

function buildForTest(inputs: AttractorInput[]): AttractorPressureResult {
  const data = resolveTerritorialData({
    geo_input: { comune_istat_code: "015146" },
    include_placeholders: true,
  });
  const corr = buildZoneCorrespondence(data);
  return buildAttractorsPressure(data, corr, inputs);
}

const LOCAL_STRONG: AttractorInput = {
  signal_key: "uni_statale",
  signal_label: "Università Statale",
  signal_family: "poli_formativi",
  signal_type: "università",
  attractor_category: "istruzione_superiore",
  signal_status: "active",
  signal_direction: "supportive",
  geo_scope: "sub_comunale",
  proximity_hint: "immediate",
  intensity_hint: "strong",
  evidence_level: "strong",
  source_basis: "anagrafe_istruzione",
  is_official: true,
};

const LOCAL_HOSPITAL: AttractorInput = {
  signal_key: "ospedale_niguarda",
  signal_label: "Ospedale Niguarda",
  signal_family: "poli_sanitari",
  signal_type: "ospedale",
  attractor_category: "sanità",
  signal_status: "active",
  signal_direction: "supportive",
  geo_scope: "sub_comunale",
  proximity_hint: "near",
  intensity_hint: "strong",
  evidence_level: "strong",
  source_basis: "ats_strutture",
  is_official: true,
};

const COMUNALE_WEAK: AttractorInput = {
  signal_key: "polo_logistico",
  signal_label: "Hub logistico comunale",
  signal_family: "poli_direzionali_produttivi",
  signal_type: "hub_logistico",
  attractor_category: "logistica",
  signal_status: "active",
  signal_direction: "supportive",
  geo_scope: "comune",
  proximity_hint: "broader_area",
  intensity_hint: "medium",
  evidence_level: "weak",
  source_basis: "camera_commercio",
  is_official: false,
};

const PROVINCIAL_SIGNAL: AttractorInput = {
  signal_key: "fiera_provinciale",
  signal_label: "Polo fieristico provinciale",
  signal_family: "attrattori_strutturali",
  signal_type: "polo_fieristico",
  attractor_category: "eventi_strutturali",
  signal_status: "active",
  signal_direction: "supportive",
  geo_scope: "provincia",
  proximity_hint: "broader_area",
  intensity_hint: "strong",
  evidence_level: "strong",
  source_basis: "camera_commercio",
  is_official: true,
};

describe("zoneAttractorsPressure", () => {
  it("classifies local strong attractors as high relevance", () => {
    const r = buildForTest([LOCAL_STRONG, LOCAL_HOSPITAL]);
    expect(r.pressure_summary.high_relevance_signals).toBeGreaterThanOrEqual(2);
    expect(r.pressure_summary.overall_pressure_signal_status).toBe("supportive");
  });

  it("degrades comunale-only signals correctly", () => {
    const r = buildForTest([COMUNALE_WEAK]);
    const sig = r.attractor_signals[0];
    expect(sig.territorial_relevance).toBe("low");
    expect(sig.proximity_relevance).toBe("broader_area");
  });

  it("degrades provincial signals to weakly_mapped", () => {
    const r = buildForTest([PROVINCIAL_SIGNAL]);
    const sig = r.attractor_signals[0];
    expect(sig.proximity_relevance).toBe("weakly_mapped");
    expect(sig.territorial_relevance).toBe("low");
    // Evidence should be degraded from strong to medium
    expect(sig.evidence_level).toBe("medium");
    // Intensity should be degraded from strong to medium
    expect(sig.intensity_hint).toBe("medium");
  });

  it("returns insufficient when no signals", () => {
    const r = buildForTest([]);
    expect(r.pressure_summary.overall_pressure_signal_status).toBe("insufficient");
    expect(r.pressure_summary.narrative_mode).toBe("hidden");
    expect(r.pressure_limitations.insufficient_signal_depth).toBe(true);
  });

  it("returns mixed when 1 high relevance signal", () => {
    const r = buildForTest([LOCAL_STRONG]);
    expect(r.pressure_summary.overall_pressure_signal_status).toBe("mixed");
  });

  it("returns weak when only broad/weak signals", () => {
    const r = buildForTest([COMUNALE_WEAK]);
    expect(r.pressure_summary.overall_pressure_signal_status).toBe("weak");
    expect(r.pressure_summary.narrative_mode).toBe("partial");
  });

  it("sets broader_area_bias when all signals are broad", () => {
    const r = buildForTest([COMUNALE_WEAK, PROVINCIAL_SIGNAL]);
    expect(r.pressure_limitations.broader_area_bias).toBe(true);
  });

  it("sets sparse_coverage when fewer than 2 signals", () => {
    const r = buildForTest([LOCAL_STRONG]);
    expect(r.pressure_limitations.sparse_coverage).toBe(true);
  });

  it("contract is fully typed and complete", () => {
    const r = buildForTest([LOCAL_STRONG]);
    // Identity
    expect(r.attractor_identity.zone_geo_code).toBeTruthy();
    expect(r.attractor_identity.zone_geo_level).toBeTruthy();
    expect(r.attractor_identity.zone_label).toBeTruthy();
    expect(r.attractor_identity.source_coverage_strength).toBeTruthy();
    // Signals
    const s = r.attractor_signals[0];
    expect(s.signal_key).toBe("uni_statale");
    expect(s.signal_family).toBe("poli_formativi");
    expect(s.is_contextual).toBe(false); // is_official=true → is_contextual=false
    // Summary
    expect(typeof r.pressure_summary.total_signals).toBe("number");
    expect(typeof r.pressure_summary.narrative_mode).toBe("string");
    // Limitations
    expect(typeof r.pressure_limitations.sparse_coverage).toBe("boolean");
    expect(Array.isArray(r.pressure_limitations.transparency_notes)).toBe(true);
  });

  it("does not regress zone correspondence engine", () => {
    const data = resolveTerritorialData({
      geo_input: { comune_istat_code: "015146" },
      include_placeholders: true,
    });
    const corr = buildZoneCorrespondence(data);
    expect(corr.zone_identity.geo_code).toBeTruthy();
    expect(corr.zone_correspondence).toBeDefined();
    expect(corr.zone_precision).toBeDefined();
  });
});
