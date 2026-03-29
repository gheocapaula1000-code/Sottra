/**
 * Zone Attractors & Settlement Pressure Engine — Sottra
 *
 * Classifies attractors (educational, health, directional, transit, structural)
 * and settlement pressure signals for a zone. NO predictions. NO invented data.
 * NO absolute language ("zona in fortissima espansione").
 *
 * Attractor families:
 * A. poli_formativi — universities, campuses, major schools
 * B. poli_sanitari — hospitals, clinics
 * C. poli_direzionali_produttivi — HQs, production clusters, logistics hubs
 * D. nodi_di_flusso — transit nodes, interchange hubs
 * E. attrattori_strutturali — major functional polarities
 */

import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type AttractorFamily =
  | "poli_formativi"
  | "poli_sanitari"
  | "poli_direzionali_produttivi"
  | "nodi_di_flusso"
  | "attrattori_strutturali";

export type AttractorTerritorialRelevance = "high" | "medium" | "low" | "not_determinable";

export type AttractorProximityRelevance =
  | "immediate"
  | "near"
  | "broader_area"
  | "weakly_mapped"
  | "not_determinable";

export type AttractorIntensityHint = "strong" | "medium" | "weak" | "unknown";
export type AttractorEvidenceLevel = "strong" | "medium" | "weak";
export type AttractorSignalDirection = "supportive" | "mixed" | "neutral" | "not_determinable";
export type OverallPressureStatus = "supportive" | "mixed" | "weak" | "insufficient";
export type AttractorNarrativeMode = "full" | "partial" | "hidden";

export interface AttractorSignal {
  signal_key: string;
  signal_label: string;
  signal_family: AttractorFamily;
  signal_type: string;
  attractor_category: string;
  signal_status: string;
  territorial_relevance: AttractorTerritorialRelevance;
  geo_validity_level: CanonicalGeoLevel;
  proximity_relevance: AttractorProximityRelevance;
  intensity_hint: AttractorIntensityHint;
  evidence_level: AttractorEvidenceLevel;
  signal_direction: AttractorSignalDirection;
  source_basis: string;
  is_official: boolean;
  is_contextual: boolean;
  notes: string | null;
}

export interface AttractorIdentity {
  zone_geo_code: string;
  zone_geo_level: CanonicalGeoLevel;
  zone_label: string;
  analysis_scope: string;
  source_coverage_strength: "strong" | "medium" | "weak" | "none";
}

export interface PressureSummary {
  total_signals: number;
  high_relevance_signals: number;
  medium_relevance_signals: number;
  low_relevance_signals: number;
  strong_attractor_count: number;
  mixed_signal_count: number;
  overall_pressure_signal_status: OverallPressureStatus;
  narrative_mode: AttractorNarrativeMode;
}

export interface PressureLimitations {
  sparse_coverage: boolean;
  weak_proximity_mapping: boolean;
  broader_area_bias: boolean;
  insufficient_signal_depth: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface AttractorPressureResult {
  attractor_identity: AttractorIdentity;
  attractor_signals: AttractorSignal[];
  pressure_summary: PressureSummary;
  pressure_limitations: PressureLimitations;
}

/* ═══════════════════════════════════════════════════════════
   INPUT CONTRACT — external signals passed in
   ═══════════════════════════════════════════════════════════ */

export interface AttractorInput {
  signal_key: string;
  signal_label: string;
  signal_family: AttractorFamily;
  signal_type: string;
  attractor_category: string;
  signal_status: string;
  signal_direction: AttractorSignalDirection;
  geo_scope: CanonicalGeoLevel;
  proximity_hint: AttractorProximityRelevance;
  intensity_hint: AttractorIntensityHint;
  evidence_level: AttractorEvidenceLevel;
  source_basis: string;
  is_official: boolean;
  notes?: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildAttractorsPressure(
  data: TerritorialDataResult,
  correspondence: ZoneCorrespondenceResult,
  inputSignals: AttractorInput[],
): AttractorPressureResult {
  const zoneLevel = correspondence.zone_identity.geo_level_reale;
  const zoneCode = data.territorial_identity.geo_code;
  const zoneLabel = data.territorial_identity.geo_label;
  const comuneOnly = correspondence.zone_correspondence.corresponds_to_comune_only;

  // ─── Classify each input signal with anti-fallback ───
  const signals: AttractorSignal[] = inputSignals.map(inp =>
    classifyAttractor(inp, zoneLevel, comuneOnly),
  );

  // ─── Summary ───
  const high = signals.filter(s => s.territorial_relevance === "high").length;
  const medium = signals.filter(s => s.territorial_relevance === "medium").length;
  const low = signals.filter(s => s.territorial_relevance === "low").length;
  const strongAttractors = signals.filter(
    s => s.territorial_relevance === "high" && s.intensity_hint !== "weak" && s.evidence_level !== "weak",
  ).length;
  const mixedDir = signals.filter(s => s.signal_direction === "mixed").length;

  let overall: OverallPressureStatus;
  if (strongAttractors >= 2) {
    overall = "supportive";
  } else if (high >= 1 || (medium >= 2 && mixedDir <= 1)) {
    overall = "mixed";
  } else if (signals.length > 0) {
    overall = "weak";
  } else {
    overall = "insufficient";
  }

  let narrative_mode: AttractorNarrativeMode;
  if (overall === "supportive" && !comuneOnly) {
    narrative_mode = "full";
  } else if (overall === "supportive" && comuneOnly) {
    narrative_mode = "partial";
  } else if (overall === "mixed" || overall === "weak") {
    narrative_mode = signals.length > 0 ? "partial" : "hidden";
  } else {
    narrative_mode = "hidden";
  }

  // ─── Coverage strength ───
  const officialCount = signals.filter(s => s.is_official).length;
  let source_coverage_strength: AttractorIdentity["source_coverage_strength"];
  if (officialCount >= 2 && high >= 2) {
    source_coverage_strength = "strong";
  } else if (officialCount >= 1 || high >= 1) {
    source_coverage_strength = "medium";
  } else if (signals.length > 0) {
    source_coverage_strength = "weak";
  } else {
    source_coverage_strength = "none";
  }

  // ─── Limitations ───
  const weaklyMapped = signals.filter(
    s => s.proximity_relevance === "weakly_mapped" || s.proximity_relevance === "not_determinable",
  ).length;
  const weak_proximity_mapping = signals.length > 0 && weaklyMapped > signals.length / 2;

  const broaderOrWeakCount = signals.filter(
    s => s.proximity_relevance === "broader_area" || s.proximity_relevance === "weakly_mapped" || s.proximity_relevance === "not_determinable",
  ).length;
  const broader_area_bias = signals.length > 0 && broaderOrWeakCount === signals.length;

  const sparse_coverage = signals.length < 2;
  const insufficient_signal_depth = signals.length === 0;

  const blocking_gaps: string[] = [];
  const transparency_notes: string[] = [];

  if (insufficient_signal_depth) {
    blocking_gaps.push("Nessun attrattore o segnale di pressione rilevato");
  }
  if (broader_area_bias) {
    transparency_notes.push("Tutti i segnali sono a scala d'area o comunale: non è possibile distinguere impatti specifici sulla zona");
  }
  if (weak_proximity_mapping) {
    transparency_notes.push("La prossimità di molti attrattori alla zona è debole o non determinabile");
  }
  if (sparse_coverage) {
    transparency_notes.push("Copertura attrattori scarsa: il quadro potrebbe essere incompleto");
  }
  if (comuneOnly && signals.length > 0) {
    transparency_notes.push("La zona è letta a livello comunale: gli attrattori riflettono l'intero territorio, non la zona specifica");
  }

  const analysisScopeLabel = comuneOnly
    ? "Lettura a scala comunale"
    : `Lettura a livello ${zoneLevel}`;

  return {
    attractor_identity: {
      zone_geo_code: zoneCode,
      zone_geo_level: zoneLevel,
      zone_label: zoneLabel,
      analysis_scope: analysisScopeLabel,
      source_coverage_strength,
    },
    attractor_signals: signals,
    pressure_summary: {
      total_signals: signals.length,
      high_relevance_signals: high,
      medium_relevance_signals: medium,
      low_relevance_signals: low,
      strong_attractor_count: strongAttractors,
      mixed_signal_count: mixedDir,
      overall_pressure_signal_status: overall,
      narrative_mode,
    },
    pressure_limitations: {
      sparse_coverage,
      weak_proximity_mapping,
      broader_area_bias,
      insufficient_signal_depth,
      blocking_gaps,
      transparency_notes,
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CLASSIFICATION — ANTI-FALLBACK POLICY
   ═══════════════════════════════════════════════════════════ */

function classifyAttractor(
  inp: AttractorInput,
  zoneLevel: CanonicalGeoLevel,
  comuneOnly: boolean,
): AttractorSignal {
  const proximity = resolveProximity(inp.proximity_hint, inp.geo_scope, comuneOnly);
  const territorial_relevance = resolveRelevance(inp, proximity);

  // Evidence degraded for weakly-mapped signals
  const evidence_level: AttractorEvidenceLevel =
    (proximity === "weakly_mapped" || proximity === "not_determinable") && inp.evidence_level === "strong"
      ? "medium"
      : inp.evidence_level;

  // Intensity degraded when proximity is weak
  const intensity_hint: AttractorIntensityHint =
    (proximity === "weakly_mapped" || proximity === "not_determinable") && inp.intensity_hint === "strong"
      ? "medium"
      : inp.intensity_hint;

  return {
    signal_key: inp.signal_key,
    signal_label: inp.signal_label,
    signal_family: inp.signal_family,
    signal_type: inp.signal_type,
    attractor_category: inp.attractor_category,
    signal_status: inp.signal_status,
    territorial_relevance,
    geo_validity_level: inp.geo_scope,
    proximity_relevance: proximity,
    intensity_hint,
    evidence_level,
    signal_direction: inp.signal_direction,
    source_basis: inp.source_basis,
    is_official: inp.is_official,
    is_contextual: !inp.is_official,
    notes: inp.notes ?? null,
  };
}

function resolveProximity(
  hint: AttractorProximityRelevance,
  geoScope: CanonicalGeoLevel,
  comuneOnly: boolean,
): AttractorProximityRelevance {
  // If hint is already specific and credible, respect it (unless zone is comunale-only)
  const subMunicipalScopes: CanonicalGeoLevel[] = [
    "sezione_censuaria", "zona_omi", "sub_comunale", "localita",
  ];

  // Sub-municipal geo scope + immediate/near hint → trust if zone is sub-municipal
  if (subMunicipalScopes.includes(geoScope) && !comuneOnly) {
    if (hint === "immediate" || hint === "near") return hint;
    return "near";
  }

  // Sub-municipal scope but zone is comunale-only → broader area at best
  if (subMunicipalScopes.includes(geoScope) && comuneOnly) {
    return "broader_area";
  }

  // Comunale scope
  if (geoScope === "comune") {
    return comuneOnly ? "broader_area" : "broader_area";
  }

  // Provincial / regional / national → weakly mapped
  const broadScopes: CanonicalGeoLevel[] = [
    "provincia", "regione", "macrozona", "nazionale",
  ];
  if (broadScopes.includes(geoScope)) {
    return "weakly_mapped";
  }

  return "not_determinable";
}

function resolveRelevance(
  inp: AttractorInput,
  proximity: AttractorProximityRelevance,
): AttractorTerritorialRelevance {
  // Immediate/near + good evidence + strong/medium intensity → high
  if (
    (proximity === "immediate" || proximity === "near") &&
    inp.evidence_level !== "weak" &&
    inp.intensity_hint !== "weak"
  ) {
    return "high";
  }

  // Immediate/near but weak evidence or weak intensity → medium
  if (proximity === "immediate" || proximity === "near") {
    return "medium";
  }

  // Broader area with good evidence → medium
  if (proximity === "broader_area" && inp.evidence_level !== "weak") {
    return "medium";
  }

  // Broader area with weak evidence → low
  if (proximity === "broader_area" && inp.evidence_level === "weak") {
    return "low";
  }

  // Weakly mapped → low or not_determinable
  if (proximity === "weakly_mapped") {
    return inp.evidence_level === "weak" ? "not_determinable" : "low";
  }

  return "not_determinable";
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function pressureStatusLabel(s: OverallPressureStatus): string {
  switch (s) {
    case "supportive": return "Attrattori rilevanti presenti";
    case "mixed": return "Pressione territoriale mista";
    case "weak": return "Evidenza limitata";
    case "insufficient": return "Nessun attrattore rilevante";
  }
}

export function attractorFamilyLabel(f: AttractorFamily): string {
  switch (f) {
    case "poli_formativi": return "Poli formativi";
    case "poli_sanitari": return "Poli sanitari";
    case "poli_direzionali_produttivi": return "Poli direzionali/produttivi";
    case "nodi_di_flusso": return "Nodi di flusso";
    case "attrattori_strutturali": return "Attrattori strutturali";
  }
}

export function attractorProximityLabel(p: AttractorProximityRelevance): string {
  switch (p) {
    case "immediate": return "Immediato alla zona";
    case "near": return "Vicino alla zona";
    case "broader_area": return "Area più ampia";
    case "weakly_mapped": return "Prossimità debole";
    case "not_determinable": return "Non determinabile";
  }
}

export function attractorRelevanceLabel(r: AttractorTerritorialRelevance): string {
  switch (r) {
    case "high": return "Alta";
    case "medium": return "Media";
    case "low": return "Bassa";
    case "not_determinable": return "Non determinabile";
  }
}

export function attractorIntensityLabel(i: AttractorIntensityHint): string {
  switch (i) {
    case "strong": return "Forte";
    case "medium": return "Media";
    case "weak": return "Debole";
    case "unknown": return "Non nota";
  }
}
