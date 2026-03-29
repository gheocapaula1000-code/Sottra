/**
 * Zone Growth Signals — Sottra
 *
 * Collects and classifies real signals about zone trajectory.
 * NO predictions. NO invented data. NO external new sources.
 * Uses only data already available in the backbone.
 *
 * Signal families activated now:
 * A. strength_of_zone_anchor
 * B. market_signal_strength
 * C. territorial_depth_signal
 * D. data_confidence_signal
 */

import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import { isDatasetUsable } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   GROWTH SIGNAL CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type SignalDirection = "positive" | "neutral" | "negative" | "mixed" | "not_determinable";
export type EvidenceLevel = "strong" | "medium" | "weak";
export type NarrativeMode = "full" | "partial" | "hidden";
export type OverallGrowthStatus = "supportive" | "mixed" | "weak" | "insufficient";

export interface GrowthSignal {
  signal_key: string;
  signal_label: string;
  signal_family: "zone_anchor" | "market" | "territorial_depth" | "data_confidence";
  signal_value: string;
  signal_direction: SignalDirection;
  evidence_level: EvidenceLevel;
  source_basis: string;
  geo_validity_level: CanonicalGeoLevel;
  is_official: boolean;
  is_contextual: boolean;
  notes: string | null;
}

export interface GrowthSummary {
  positive_signal_count: number;
  negative_signal_count: number;
  mixed_signal_count: number;
  weak_signal_count: number;
  overall_growth_signal_status: OverallGrowthStatus;
  narrative_mode: NarrativeMode;
}

export interface GrowthLimitations {
  missing_depth: boolean;
  comunale_only_bias: boolean;
  weak_signal_base: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface ZoneGrowthSignalsResult {
  growth_identity: {
    zone_geo_code: string;
    zone_geo_level: CanonicalGeoLevel;
    signal_coverage_strength: "strong" | "medium" | "weak" | "none";
  };
  growth_signals: GrowthSignal[];
  growth_summary: GrowthSummary;
  growth_limitations: GrowthLimitations;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildZoneGrowthSignals(
  data: TerritorialDataResult,
  correspondence: ZoneCorrespondenceResult,
): ZoneGrowthSignalsResult {
  const signals: GrowthSignal[] = [];
  const { territorial_datasets: ds, territorial_coverage: cov, territorial_quality: qual } = data;
  const zc = correspondence.zone_correspondence;
  const zp = correspondence.zone_precision;

  // ─── Family A: Zone Anchor Strength ───
  signals.push(buildAnchorSignal(correspondence));

  // ─── Family B: Market Signal Strength ───
  signals.push(buildMarketSignal(ds, data.territorial_identity.geo_level));

  // ─── Family C: Territorial Depth ───
  signals.push(buildDepthSignal(ds, zp, data.territorial_identity.geo_level));

  // ─── Family D: Data Confidence ───
  signals.push(buildConfidenceSignal(qual, cov, data.territorial_identity.geo_level));

  // ─── Summary ───
  const positive = signals.filter(s => s.signal_direction === "positive").length;
  const negative = signals.filter(s => s.signal_direction === "negative").length;
  const mixed = signals.filter(s => s.signal_direction === "mixed").length;
  const weak = signals.filter(s => s.evidence_level === "weak").length;

  let overall: OverallGrowthStatus;
  if (positive >= 3 && negative === 0) {
    overall = "supportive";
  } else if (positive >= 2 && negative <= 1) {
    overall = "mixed";
  } else if (positive >= 1) {
    overall = "weak";
  } else {
    overall = "insufficient";
  }

  let narrative_mode: NarrativeMode;
  if (overall === "supportive" || (overall === "mixed" && weak <= 1)) {
    narrative_mode = "full";
  } else if (overall === "mixed" || overall === "weak") {
    narrative_mode = "partial";
  } else {
    narrative_mode = "hidden";
  }

  // ─── Limitations ───
  const missing_depth = zc.corresponds_to_comune_only;
  const comunale_only_bias = zc.corresponds_to_comune_only && !zc.corresponds_to_microzona_omi;
  const weak_signal_base = weak >= 3;

  const blocking_gaps: string[] = [];
  const transparency_notes: string[] = [];

  if (missing_depth) {
    transparency_notes.push("Segnali basati solo su lettura comunale: profondità sub-comunale non disponibile");
  }
  if (comunale_only_bias) {
    transparency_notes.push("Tutti i segnali riflettono il perimetro comunale, non una zona specifica");
  }
  if (weak_signal_base) {
    blocking_gaps.push("Base segnali troppo debole per una narrativa di crescita");
  }

  // Signal coverage strength
  let signal_coverage_strength: "strong" | "medium" | "weak" | "none";
  if (positive >= 3 && weak <= 1) {
    signal_coverage_strength = "strong";
  } else if (positive >= 2) {
    signal_coverage_strength = "medium";
  } else if (positive >= 1) {
    signal_coverage_strength = "weak";
  } else {
    signal_coverage_strength = "none";
  }

  return {
    growth_identity: {
      zone_geo_code: data.territorial_identity.geo_code,
      zone_geo_level: data.territorial_identity.geo_level,
      signal_coverage_strength,
    },
    growth_signals: signals,
    growth_summary: {
      positive_signal_count: positive,
      negative_signal_count: negative,
      mixed_signal_count: mixed,
      weak_signal_count: weak,
      overall_growth_signal_status: overall,
      narrative_mode,
    },
    growth_limitations: {
      missing_depth,
      comunale_only_bias,
      weak_signal_base,
      blocking_gaps,
      transparency_notes,
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   SIGNAL BUILDERS
   ═══════════════════════════════════════════════════════════ */

function buildAnchorSignal(corr: ZoneCorrespondenceResult): GrowthSignal {
  const strength = corr.zone_identity.zone_anchor_strength;
  const direction: SignalDirection =
    strength === "strong" ? "positive" :
    strength === "medium" ? "positive" :
    strength === "weak" ? "negative" : "negative";

  const evidence: EvidenceLevel =
    strength === "strong" ? "strong" :
    strength === "medium" ? "medium" : "weak";

  const valueLabels: Record<string, string> = {
    strong: "Zona ancorata con supporto sub-comunale e market zone",
    medium: "Zona con ancoraggio parziale",
    weak: "Ancoraggio debole, prevalentemente comunale",
    insufficient: "Ancoraggio insufficiente",
  };

  return {
    signal_key: "zone_anchor_strength",
    signal_label: "Solidità dell'ancoraggio zona",
    signal_family: "zone_anchor",
    signal_value: valueLabels[strength] ?? "Non determinabile",
    signal_direction: direction,
    evidence_level: evidence,
    source_basis: corr.zone_correspondence.primary_zone_basis,
    geo_validity_level: corr.zone_precision.max_safe_claim_level,
    is_official: false,
    is_contextual: true,
    notes: corr.zone_correspondence.fallback_weight !== "none"
      ? `Peso fallback: ${corr.zone_correspondence.fallback_weight}`
      : null,
  };
}

function buildMarketSignal(
  ds: TerritorialDataResult["territorial_datasets"],
  geoLevel: CanonicalGeoLevel,
): GrowthSignal {
  const hasOmi = isDatasetUsable(ds.omi_linkage);
  const omiDirect = hasOmi && ds.omi_linkage.geo_level === "zona_omi";

  let direction: SignalDirection;
  let evidence: EvidenceLevel;
  let value: string;

  if (omiDirect) {
    direction = "positive";
    evidence = "strong";
    value = "Collegamento OMI diretto a microzona";
  } else if (hasOmi) {
    direction = "mixed";
    evidence = "medium";
    value = "Collegamento OMI via fallback comunale";
  } else {
    direction = "not_determinable";
    evidence = "weak";
    value = "Nessun collegamento OMI disponibile";
  }

  return {
    signal_key: "market_zone_coverage",
    signal_label: "Copertura mercato immobiliare",
    signal_family: "market",
    signal_value: value,
    signal_direction: direction,
    evidence_level: evidence,
    source_basis: hasOmi ? (ds.omi_linkage.source_key ?? "omi") : "nessuna",
    geo_validity_level: omiDirect ? "zona_omi" : hasOmi ? "comune" : geoLevel,
    is_official: hasOmi,
    is_contextual: false,
    notes: hasOmi && !omiDirect ? "Il dato di mercato è a livello comunale, non di microzona" : null,
  };
}

function buildDepthSignal(
  ds: TerritorialDataResult["territorial_datasets"],
  zp: ZoneCorrespondenceResult["zone_precision"],
  geoLevel: CanonicalGeoLevel,
): GrowthSignal {
  const hasAsc = isDatasetUsable(ds.sub_municipal);
  const hasSections = isDatasetUsable(ds.census_sections);
  const hasDemographic = isDatasetUsable(ds.demographic);

  let direction: SignalDirection;
  let evidence: EvidenceLevel;
  let value: string;

  if (hasAsc && hasSections) {
    direction = "positive";
    evidence = "strong";
    value = "Profondità sub-comunale completa (ASC + sezioni)";
  } else if (hasAsc || hasSections) {
    direction = "positive";
    evidence = "medium";
    value = hasAsc ? "Aree sub-comunali disponibili" : "Sezioni censuarie disponibili";
  } else if (hasDemographic) {
    direction = "mixed";
    evidence = "weak";
    value = "Solo dati demografici a livello comunale";
  } else {
    direction = "negative";
    evidence = "weak";
    value = "Nessuna profondità territoriale disponibile";
  }

  return {
    signal_key: "territorial_depth",
    signal_label: "Profondità territoriale",
    signal_family: "territorial_depth",
    signal_value: value,
    signal_direction: direction,
    evidence_level: evidence,
    source_basis: hasAsc
      ? (ds.sub_municipal.source_key ?? "asc")
      : hasSections
        ? (ds.census_sections.source_key ?? "r03")
        : "nessuna",
    geo_validity_level: zp.max_safe_claim_level,
    is_official: (hasAsc || hasSections),
    is_contextual: false,
    notes: null,
  };
}

function buildConfidenceSignal(
  qual: TerritorialDataResult["territorial_quality"],
  cov: TerritorialDataResult["territorial_coverage"],
  geoLevel: CanonicalGeoLevel,
): GrowthSignal {
  let direction: SignalDirection;
  let evidence: EvidenceLevel;
  let value: string;

  if (qual.overall_status === "strong") {
    direction = "positive";
    evidence = "strong";
    value = "Base dati solida con fonti ufficiali multiple";
  } else if (qual.overall_status === "adequate") {
    direction = "positive";
    evidence = "medium";
    value = "Base dati adeguata";
  } else if (qual.overall_status === "limited") {
    direction = "mixed";
    evidence = "weak";
    value = "Copertura dati limitata";
  } else {
    direction = "negative";
    evidence = "weak";
    value = "Dati insufficienti";
  }

  return {
    signal_key: "data_confidence_overall",
    signal_label: "Confidenza complessiva dei dati",
    signal_family: "data_confidence",
    signal_value: value,
    signal_direction: direction,
    evidence_level: evidence,
    source_basis: `${cov.available_levels.length} livelli coperti`,
    geo_validity_level: geoLevel,
    is_official: qual.officiality_mix === "official",
    is_contextual: true,
    notes: qual.warnings.length > 0 ? `${qual.warnings.length} avvisi presenti` : null,
  };
}

/* ═══════════════════════════════════════════════════════════
   GROWTH STATUS LABELS
   ═══════════════════════════════════════════════════════════ */

export function growthStatusLabel(s: OverallGrowthStatus): string {
  switch (s) {
    case "supportive": return "Segnali di supporto";
    case "mixed": return "Quadro misto";
    case "weak": return "Evidenza limitata";
    case "insufficient": return "Dati insufficienti";
  }
}

export function narrativeModeLabel(m: NarrativeMode): string {
  switch (m) {
    case "full": return "Narrativa completa";
    case "partial": return "Narrativa parziale";
    case "hidden": return "Non mostrata";
  }
}
