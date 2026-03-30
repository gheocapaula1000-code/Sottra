/**
 * Zone Value Engine — Sottra WOW Layer
 *
 * Produces a typed contract for value per sqm based on zone-level data.
 * Does NOT invent data. Does NOT promote fallback to micro-local precision.
 * Shows ranges, not fake single-number precision.
 */

import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import { isDatasetUsable } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type ValuePrecisionStatus = "strong" | "medium" | "weak" | "insufficient";
export type ValueReliabilityStatus = "high" | "medium" | "low" | "not_determinable";
export type MarketSupportStatus = "deep" | "adequate" | "limited" | "unavailable";
export type ValueNarrativeMode = "full" | "partial" | "hidden";

export interface ValueIdentity {
  zone_geo_code: string;
  zone_geo_level: CanonicalGeoLevel;
  zone_label: string;
  value_scope_label: string;
  value_basis_type: "microzona_omi" | "zona_omi" | "comunale" | "fallback" | "unavailable";
}

export interface ValueResult {
  value_per_sqm_min: number | null;
  value_per_sqm_max: number | null;
  value_per_sqm_mid: number | null;
  value_confidence: number;
  value_precision_status: ValuePrecisionStatus;
  value_geo_validity_level: CanonicalGeoLevel;
  value_source_basis: string;
  fallback_used: boolean;
  fallback_weight: "none" | "low" | "medium" | "high";
  false_specificity_risk: "none" | "low" | "medium" | "high";
  /** The finest level actually used as primary data basis */
  primary_basis_level: CanonicalGeoLevel;
  /** Secondary/fallback level used, null if none */
  secondary_basis_level: CanonicalGeoLevel | null;
}

export interface ValueQuality {
  market_support_status: MarketSupportStatus;
  local_zone_support: boolean;
  comune_only_bias: boolean;
  reliability_status: ValueReliabilityStatus;
  transparency_notes: string[];
}

export interface ZoneValueResult {
  value_identity: ValueIdentity;
  value_result: ValueResult;
  value_quality: ValueQuality;
}

/* ═══════════════════════════════════════════════════════════
   NARRATIVE MODE — drives UI gating
   ═══════════════════════════════════════════════════════════ */

export function valueNarrativeMode(r: ZoneValueResult): ValueNarrativeMode {
  if (r.value_result.value_per_sqm_mid == null) return "hidden";
  if (r.value_result.value_precision_status === "insufficient") return "hidden";
  if (r.value_result.value_precision_status === "strong" && r.value_result.value_confidence >= 0.6) return "full";
  return "partial";
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function valuePrecisionLabel(s: ValuePrecisionStatus): string {
  const m: Record<ValuePrecisionStatus, string> = { strong: "Forte", medium: "Media", weak: "Debole", insufficient: "Insufficiente" };
  return m[s];
}

export function valueReliabilityLabel(s: ValueReliabilityStatus): string {
  const m: Record<ValueReliabilityStatus, string> = { high: "Alta", medium: "Media", low: "Bassa", not_determinable: "Non determinabile" };
  return m[s];
}

export function marketSupportLabel(s: MarketSupportStatus): string {
  const m: Record<MarketSupportStatus, string> = { deep: "Profondo", adequate: "Adeguato", limited: "Limitato", unavailable: "Non disponibile" };
  return m[s];
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export interface ValueEngineInput {
  data: TerritorialDataResult;
  corr: ZoneCorrespondenceResult;
  /** OMI pricing if available from scan */
  omiMin?: number | null;
  omiMax?: number | null;
  omiGeoLevel?: "microzona_omi" | "zona_specifica" | "quartiere" | "comune" | "non_determinato";
  omiPolygonMatch?: boolean;
}

export function buildZoneValue(input: ValueEngineInput): ZoneValueResult {
  const { data, corr, omiMin, omiMax, omiGeoLevel, omiPolygonMatch } = input;
  const { territorial_identity: id, territorial_datasets: ds } = data;

  const hasOmi = isDatasetUsable(ds.omi_linkage);
  const fallbackWeight = corr.zone_correspondence.fallback_weight;
  const falseSpecRisk = corr.zone_correspondence.false_specificity_risk;

  const hasOmiPricing = omiMin != null && omiMax != null && omiMin > 0 && omiMax > 0;

  // ── Determine basis ──
  let basisType: ValueIdentity["value_basis_type"] = "unavailable";
  let geoLevel: CanonicalGeoLevel = "non_determinato";
  let scopeLabel = "Non disponibile";
  let sourceBasis = "Nessun dato disponibile";

  if (hasOmiPricing && omiPolygonMatch && omiGeoLevel === "microzona_omi") {
    basisType = "microzona_omi";
    geoLevel = "zona_omi";
    scopeLabel = "Microzona OMI";
    sourceBasis = "Quotazione OMI microzona con match poligono";
  } else if (hasOmiPricing && (omiGeoLevel === "zona_specifica" || omiGeoLevel === "quartiere")) {
    basisType = "zona_omi";
    geoLevel = "zona_omi";
    scopeLabel = `Zona OMI (${omiGeoLevel === "zona_specifica" ? "specifica" : "quartiere"})`;
    sourceBasis = "Quotazione OMI zona";
  } else if (hasOmiPricing) {
    basisType = "comunale";
    geoLevel = "comune";
    scopeLabel = "Valore comunale OMI";
    sourceBasis = "Quotazione OMI a livello comunale";
  } else if (hasOmi) {
    basisType = "fallback";
    geoLevel = "comune";
    scopeLabel = "Stima da collegamento OMI";
    sourceBasis = "Collegamento OMI senza quotazione diretta";
  }

  // ── Values ──
  const min = hasOmiPricing ? omiMin! : null;
  const max = hasOmiPricing ? omiMax! : null;
  const mid = (min != null && max != null) ? Math.round((min + max) / 2) : null;

  // ── Confidence ──
  let confidence = 0;
  if (basisType === "microzona_omi") confidence = 0.85;
  else if (basisType === "zona_omi") confidence = 0.7;
  else if (basisType === "comunale") confidence = 0.45;
  else if (basisType === "fallback") confidence = 0.2;

  // Penalize for fallback weight
  if (fallbackWeight === "high") confidence = Math.max(confidence - 0.25, 0);
  else if (fallbackWeight === "medium") confidence = Math.max(confidence - 0.1, 0);

  // ── Precision ──
  let precisionStatus: ValuePrecisionStatus;
  if (basisType === "microzona_omi" && fallbackWeight === "none") precisionStatus = "strong";
  else if (basisType === "zona_omi" && fallbackWeight !== "high") precisionStatus = "medium";
  else if (hasOmiPricing) precisionStatus = "weak";
  else precisionStatus = "insufficient";

  // ── Market support ──
  let marketSupport: MarketSupportStatus;
  if (basisType === "microzona_omi") marketSupport = "deep";
  else if (basisType === "zona_omi") marketSupport = "adequate";
  else if (basisType === "comunale") marketSupport = "limited";
  else marketSupport = "unavailable";

  const comuneOnlyBias = basisType === "comunale" || basisType === "fallback";
  const localSupport = basisType === "microzona_omi" || basisType === "zona_omi";

  // ── Reliability ──
  let reliabilityStatus: ValueReliabilityStatus;
  if (confidence >= 0.7) reliabilityStatus = "high";
  else if (confidence >= 0.4) reliabilityStatus = "medium";
  else if (confidence > 0) reliabilityStatus = "low";
  else reliabilityStatus = "not_determinable";

  // ── Transparency notes ──
  const notes: string[] = [];
  if (comuneOnlyBias) notes.push("Il valore è riferito al livello comunale — la zona specifica potrebbe variare significativamente");
  if (fallbackWeight === "high") notes.push("Il dato ha una forte componente di fallback: la precisione è ridotta");
  if (falseSpecRisk === "high" || falseSpecRisk === "medium") notes.push("Rischio di falsa specificità: il valore potrebbe apparire più preciso di quanto supportato");
  if (basisType === "fallback") notes.push("Valore basato su collegamento OMI indiretto — stima orientativa");
  if (!hasOmiPricing) notes.push("Nessuna quotazione OMI diretta disponibile per questa zona");

  return {
    value_identity: {
      zone_geo_code: id.geo_code,
      zone_geo_level: id.geo_level,
      zone_label: id.geo_label,
      value_scope_label: scopeLabel,
      value_basis_type: basisType,
    },
    value_result: {
      value_per_sqm_min: min,
      value_per_sqm_max: max,
      value_per_sqm_mid: mid,
      value_confidence: confidence,
      value_precision_status: precisionStatus,
      value_geo_validity_level: geoLevel,
      value_source_basis: sourceBasis,
      fallback_used: fallbackWeight !== "none",
      fallback_weight: fallbackWeight,
      false_specificity_risk: falseSpecRisk,
    },
    value_quality: {
      market_support_status: marketSupport,
      local_zone_support: localSupport,
      comune_only_bias: comuneOnlyBias,
      reliability_status: reliabilityStatus,
      transparency_notes: notes,
    },
  };
}
