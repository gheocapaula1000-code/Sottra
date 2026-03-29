/**
 * Zone Urban Transformations Engine — Sottra
 *
 * Collects and classifies signals about urban transformations, public works,
 * and territorial change for a zone. NO predictions. NO invented data.
 * NO absolute language ("zona destinata a crescere").
 *
 * Signal families:
 * A. opere_pubbliche — infrastructure, public redevelopment
 * B. rigenerazione_urbana — area recovery, reconversion
 * C. pianificazione_attuativa — urban plans, variants
 * D. attrattori_in_arrivo — new poles, structural attractors
 */

import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type UrbanSignalFamily =
  | "opere_pubbliche"
  | "rigenerazione_urbana"
  | "pianificazione_attuativa"
  | "attrattori_in_arrivo";

export type UrbanSignalStage =
  | "announced"
  | "planned"
  | "approved"
  | "funded"
  | "in_progress"
  | "completed"
  | "unclear";

export type TerritorialRelevance = "high" | "medium" | "low" | "not_determinable";
export type UrbanEvidenceLevel = "strong" | "medium" | "weak";
export type UrbanSignalDirection = "supportive" | "mixed" | "neutral" | "not_determinable";
export type OverallTransformationStatus = "supportive" | "mixed" | "weak" | "insufficient";
export type UrbanNarrativeMode = "full" | "partial" | "hidden";

export type ProximityRelevance =
  | "local_zone_signal"
  | "broader_area_signal"
  | "comune_wide_signal"
  | "weakly_mapped_signal";

export interface UrbanTransformationSignal {
  signal_key: string;
  signal_label: string;
  signal_family: UrbanSignalFamily;
  signal_type: string;
  signal_status: string;
  signal_stage: UrbanSignalStage;
  signal_direction: UrbanSignalDirection;
  territorial_relevance: TerritorialRelevance;
  geo_validity_level: CanonicalGeoLevel;
  proximity_relevance: ProximityRelevance;
  evidence_level: UrbanEvidenceLevel;
  source_basis: string;
  is_official: boolean;
  is_contextual: boolean;
  notes: string | null;
}

export interface UrbanTransformationIdentity {
  zone_geo_code: string;
  zone_geo_level: CanonicalGeoLevel;
  zone_label: string;
  analysis_scope: string;
  analysis_radius_or_scope_label: string;
  source_coverage_strength: "strong" | "medium" | "weak" | "none";
}

export interface UrbanTransformationSummary {
  total_signals: number;
  high_relevance_signals: number;
  medium_relevance_signals: number;
  low_relevance_signals: number;
  official_signal_count: number;
  mixed_signal_count: number;
  overall_transformation_signal_status: OverallTransformationStatus;
  narrative_mode: UrbanNarrativeMode;
}

export interface UrbanTransformationLimitations {
  sparse_coverage: boolean;
  weak_proximity_mapping: boolean;
  comuni_only_bias: boolean;
  insufficient_signal_depth: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface UrbanTransformationResult {
  urban_transformation_identity: UrbanTransformationIdentity;
  urban_transformation_signals: UrbanTransformationSignal[];
  urban_transformation_summary: UrbanTransformationSummary;
  urban_transformation_limitations: UrbanTransformationLimitations;
}

/* ═══════════════════════════════════════════════════════════
   INPUT CONTRACT — external signals passed in
   ═══════════════════════════════════════════════════════════ */

export interface UrbanTransformationInput {
  signal_key: string;
  signal_label: string;
  signal_family: UrbanSignalFamily;
  signal_type: string;
  signal_status: string;
  signal_stage: UrbanSignalStage;
  signal_direction: UrbanSignalDirection;
  geo_scope: CanonicalGeoLevel;
  evidence_level: UrbanEvidenceLevel;
  source_basis: string;
  is_official: boolean;
  notes?: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildUrbanTransformations(
  data: TerritorialDataResult,
  correspondence: ZoneCorrespondenceResult,
  inputSignals: UrbanTransformationInput[],
): UrbanTransformationResult {
  const zoneLevel = correspondence.zone_identity.geo_level_reale;
  const zoneCode = data.territorial_identity.geo_code;
  const zoneLabel = data.territorial_identity.geo_label;
  const comuneOnly = correspondence.zone_correspondence.corresponds_to_comune_only;

  // ─── Map input signals → classified signals with anti-fallback ───
  const signals: UrbanTransformationSignal[] = inputSignals.map(inp =>
    classifySignal(inp, zoneLevel, comuneOnly),
  );

  // ─── Summary ───
  const high = signals.filter(s => s.territorial_relevance === "high").length;
  const medium = signals.filter(s => s.territorial_relevance === "medium").length;
  const low = signals.filter(s => s.territorial_relevance === "low").length;
  const official = signals.filter(s => s.is_official).length;
  const mixedDir = signals.filter(s => s.signal_direction === "mixed").length;

  const strongLocalSignals = signals.filter(
    s => s.territorial_relevance === "high" && s.evidence_level !== "weak",
  ).length;

  let overall: OverallTransformationStatus;
  if (strongLocalSignals >= 2) {
    overall = "supportive";
  } else if (high >= 1 || (medium >= 2 && mixedDir <= 1)) {
    overall = "mixed";
  } else if (signals.length > 0) {
    overall = "weak";
  } else {
    overall = "insufficient";
  }

  let narrative_mode: UrbanNarrativeMode;
  if (overall === "supportive" && !comuneOnly) {
    narrative_mode = "full";
  } else if (overall === "supportive" && comuneOnly) {
    // Even "supportive" gets degraded when zone is only comunale
    narrative_mode = "partial";
  } else if (overall === "mixed" || overall === "weak") {
    narrative_mode = signals.length > 0 ? "partial" : "hidden";
  } else {
    narrative_mode = "hidden";
  }

  // ─── Coverage ───
  let source_coverage_strength: UrbanTransformationIdentity["source_coverage_strength"];
  if (official >= 2 && high >= 2) {
    source_coverage_strength = "strong";
  } else if (official >= 1 || high >= 1) {
    source_coverage_strength = "medium";
  } else if (signals.length > 0) {
    source_coverage_strength = "weak";
  } else {
    source_coverage_strength = "none";
  }

  // ─── Limitations ───
  const weak_proximity_mapping = signals.filter(
    s => s.proximity_relevance === "weakly_mapped_signal",
  ).length > signals.length / 2;

  const sparse_coverage = signals.length < 2;
  const comuni_only_bias = comuneOnly && signals.every(
    s => s.proximity_relevance === "comune_wide_signal" || s.proximity_relevance === "weakly_mapped_signal",
  );
  const insufficient_signal_depth = signals.length === 0;

  const blocking_gaps: string[] = [];
  const transparency_notes: string[] = [];

  if (insufficient_signal_depth) {
    blocking_gaps.push("Nessun segnale di trasformazione rilevato");
  }
  if (comuni_only_bias) {
    transparency_notes.push("Tutti i segnali sono a scala comunale: non è possibile distinguere impatti specifici sulla zona");
  }
  if (weak_proximity_mapping) {
    transparency_notes.push("La prossimità di molti segnali alla zona è debole o non determinabile");
  }
  if (sparse_coverage) {
    transparency_notes.push("Copertura segnali scarsa: il quadro potrebbe essere incompleto");
  }
  if (comuneOnly && signals.length > 0) {
    transparency_notes.push("La zona è letta a livello comunale: i segnali riflettono l'intero territorio, non la zona specifica");
  }

  const analysisScopeLabel = comuneOnly
    ? "Lettura a scala comunale"
    : `Lettura a livello ${zoneLevel}`;

  return {
    urban_transformation_identity: {
      zone_geo_code: zoneCode,
      zone_geo_level: zoneLevel,
      zone_label: zoneLabel,
      analysis_scope: zoneLevel,
      analysis_radius_or_scope_label: analysisScopeLabel,
      source_coverage_strength,
    },
    urban_transformation_signals: signals,
    urban_transformation_summary: {
      total_signals: signals.length,
      high_relevance_signals: high,
      medium_relevance_signals: medium,
      low_relevance_signals: low,
      official_signal_count: official,
      mixed_signal_count: mixedDir,
      overall_transformation_signal_status: overall,
      narrative_mode,
    },
    urban_transformation_limitations: {
      sparse_coverage,
      weak_proximity_mapping,
      comuni_only_bias,
      insufficient_signal_depth,
      blocking_gaps,
      transparency_notes,
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL CLASSIFICATION — ANTI-FALLBACK POLICY
   ═══════════════════════════════════════════════════════════ */

function classifySignal(
  inp: UrbanTransformationInput,
  zoneLevel: CanonicalGeoLevel,
  comuneOnly: boolean,
): UrbanTransformationSignal {
  // Determine proximity relevance based on signal geo scope vs zone level
  const proximity = resolveProximity(inp.geo_scope, zoneLevel, comuneOnly);

  // Territorial relevance is degraded when proximity is weak
  const territorial_relevance = resolveRelevance(inp, proximity);

  // Evidence may be degraded for weakly-mapped signals
  const evidence_level = proximity === "weakly_mapped_signal" && inp.evidence_level === "strong"
    ? "medium" as UrbanEvidenceLevel
    : inp.evidence_level;

  return {
    signal_key: inp.signal_key,
    signal_label: inp.signal_label,
    signal_family: inp.signal_family,
    signal_type: inp.signal_type,
    signal_status: inp.signal_status,
    signal_stage: inp.signal_stage,
    signal_direction: inp.signal_direction,
    territorial_relevance,
    geo_validity_level: inp.geo_scope,
    proximity_relevance: proximity,
    evidence_level,
    source_basis: inp.source_basis,
    is_official: inp.is_official,
    is_contextual: !inp.is_official,
    notes: inp.notes ?? null,
  };
}

function resolveProximity(
  signalGeoScope: CanonicalGeoLevel,
  zoneLevel: CanonicalGeoLevel,
  comuneOnly: boolean,
): ProximityRelevance {
  // Sub-municipal signals map well to sub-municipal zones
  const subMunicipalScopes: CanonicalGeoLevel[] = [
    "sezione_censuaria", "zona_omi", "sub_comunale", "localita",
  ];

  if (subMunicipalScopes.includes(signalGeoScope) && !comuneOnly) {
    return "local_zone_signal";
  }

  if (signalGeoScope === "comune") {
    return comuneOnly ? "comune_wide_signal" : "broader_area_signal";
  }

  // Provincial / regional scope = weakly mapped
  const broadScopes: CanonicalGeoLevel[] = [
    "provincia", "regione", "macrozona", "nazionale",
  ];
  if (broadScopes.includes(signalGeoScope)) {
    return "weakly_mapped_signal";
  }

  // Sub-municipal signal but zone is comunale-only = broader area
  if (subMunicipalScopes.includes(signalGeoScope) && comuneOnly) {
    return "broader_area_signal";
  }

  return "weakly_mapped_signal";
}

function resolveRelevance(
  inp: UrbanTransformationInput,
  proximity: ProximityRelevance,
): TerritorialRelevance {
  // Local signals with strong evidence → high
  if (proximity === "local_zone_signal" && inp.evidence_level !== "weak") {
    return "high";
  }

  // Local but weak evidence → medium
  if (proximity === "local_zone_signal" && inp.evidence_level === "weak") {
    return "medium";
  }

  // Broader area or comunale with good evidence → medium
  if (
    (proximity === "broader_area_signal" || proximity === "comune_wide_signal") &&
    inp.evidence_level !== "weak"
  ) {
    return "medium";
  }

  // Broader with weak evidence → low
  if (
    (proximity === "broader_area_signal" || proximity === "comune_wide_signal") &&
    inp.evidence_level === "weak"
  ) {
    return "low";
  }

  // Weakly mapped → low or not_determinable
  if (proximity === "weakly_mapped_signal") {
    return inp.evidence_level === "weak" ? "not_determinable" : "low";
  }

  return "not_determinable";
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function transformationStatusLabel(s: OverallTransformationStatus): string {
  switch (s) {
    case "supportive": return "Segnali di trasformazione presenti";
    case "mixed": return "Quadro misto";
    case "weak": return "Evidenza territoriale limitata";
    case "insufficient": return "Nessun segnale rilevante";
  }
}

export function stageLabel(s: UrbanSignalStage): string {
  switch (s) {
    case "announced": return "Annunciato";
    case "planned": return "Pianificato";
    case "approved": return "Approvato";
    case "funded": return "Finanziato";
    case "in_progress": return "In corso";
    case "completed": return "Completato";
    case "unclear": return "Stato non chiaro";
  }
}

export function proximityLabel(p: ProximityRelevance): string {
  switch (p) {
    case "local_zone_signal": return "Segnale locale alla zona";
    case "broader_area_signal": return "Segnale d'area più ampia";
    case "comune_wide_signal": return "Segnale a scala comunale";
    case "weakly_mapped_signal": return "Prossimità debole";
  }
}

export function relevanceLabel(r: TerritorialRelevance): string {
  switch (r) {
    case "high": return "Alta";
    case "medium": return "Media";
    case "low": return "Bassa";
    case "not_determinable": return "Non determinabile";
  }
}

export function familyLabel(f: UrbanSignalFamily): string {
  switch (f) {
    case "opere_pubbliche": return "Opere pubbliche";
    case "rigenerazione_urbana": return "Rigenerazione urbana";
    case "pianificazione_attuativa": return "Pianificazione attuativa";
    case "attrattori_in_arrivo": return "Attrattori in arrivo";
  }
}
