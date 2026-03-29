/**
 * Zone Correspondence Engine — Sottra
 *
 * Determines what a zone REALLY corresponds to, how strong the anchor is,
 * how much fallback is present, and what precision level is safe to claim.
 *
 * Does NOT touch OMI logic. Does NOT invent data.
 * Does NOT promote fallback-heavy zones to "fine" reading.
 */

import type { TerritorialDataResult, DatasetBlock, TerritorialDataQuality } from "@/lib/territorialDataBackbone";
import { isDatasetUsable } from "@/lib/territorialDataBackbone";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel, geoLevelRank } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   ZONE CORRESPONDENCE CONTRACT
   ═══════════════════════════════════════════════════════════ */

export interface ZoneCorrespondenceIdentity {
  geo_level_reale: CanonicalGeoLevel;
  geo_code: string;
  geo_label: string;
  normalized_path: string;
  zone_type_label: string;
  zone_corresponds_to: string;
  zone_anchor_strength: "strong" | "medium" | "weak" | "insufficient";
}

export interface ZoneCorrespondence {
  corresponds_to_microzona_omi: boolean;
  corresponds_to_asc: boolean;
  corresponds_to_section_or_aggregate: boolean;
  corresponds_to_comune_only: boolean;
  primary_zone_basis: string;
  secondary_zone_basis: string[];
  fallback_used: boolean;
  fallback_weight: "none" | "low" | "medium" | "high";
  false_specificity_risk: "none" | "low" | "medium" | "high";
}

export type PrecisionStatus = "strong" | "medium" | "weak" | "insufficient";

export interface ZonePrecision {
  precision_status: PrecisionStatus;
  sub_comunale_support_status: "available" | "partial" | "unavailable";
  market_zone_support_status: "direct" | "fallback" | "unavailable";
  territorial_support_status: "complete" | "partial" | "minimal";
  max_safe_claim_level: CanonicalGeoLevel;
}

export interface ZoneCorrespondenceLimitations {
  missing_sub_comunale: boolean;
  market_only_comunale: boolean;
  weak_zone_anchor: boolean;
  fallback_dominant: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface ZoneCorrespondenceResult {
  zone_identity: ZoneCorrespondenceIdentity;
  zone_correspondence: ZoneCorrespondence;
  zone_precision: ZonePrecision;
  zone_limitations: ZoneCorrespondenceLimitations;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildZoneCorrespondence(data: TerritorialDataResult): ZoneCorrespondenceResult {
  const { territorial_identity: id, territorial_scope: scope, territorial_datasets: ds, territorial_coverage: cov } = data;

  const hasOmi = isDatasetUsable(ds.omi_linkage);
  const hasAsc = isDatasetUsable(ds.sub_municipal);
  const hasSections = isDatasetUsable(ds.census_sections);
  const hasStructure = isDatasetUsable(ds.territorial_structure);
  const omiDirect = hasOmi && ds.omi_linkage.geo_level === "zona_omi";

  // Correspondence flags
  const corresponds_to_microzona_omi = omiDirect;
  const corresponds_to_asc = hasAsc;
  const corresponds_to_section_or_aggregate = hasSections || (hasAsc && ds.sub_municipal.is_derived);
  const corresponds_to_comune_only = !hasAsc && !hasSections && !omiDirect;

  // Primary basis
  let primary_zone_basis: string;
  if (omiDirect && hasAsc) {
    primary_zone_basis = "Microzona OMI + supporto sub-comunale";
  } else if (omiDirect) {
    primary_zone_basis = "Microzona OMI";
  } else if (hasAsc && hasSections) {
    primary_zone_basis = "Aree sub-comunali + sezioni censuarie";
  } else if (hasAsc) {
    primary_zone_basis = "Aree sub-comunali";
  } else if (hasSections) {
    primary_zone_basis = "Sezioni censuarie";
  } else if (hasStructure) {
    primary_zone_basis = "Struttura territoriale comunale";
  } else {
    primary_zone_basis = "Identificazione geografica base";
  }

  const secondary: string[] = [];
  if (hasOmi && !omiDirect) secondary.push("OMI via fallback comunale");
  if (hasSections && hasAsc) secondary.push("Aggregati R03→ASC");
  if (hasStructure && !corresponds_to_comune_only) secondary.push("Registro territoriale ISTAT");

  // Fallback analysis
  const fallback_used = scope.fallback_applied;
  const fallbackCount = data.territorial_quality.fallback_count;
  const totalSources = data.territorial_sources.length;
  const fallbackRatio = totalSources > 0 ? fallbackCount / totalSources : 0;

  let fallback_weight: ZoneCorrespondence["fallback_weight"] = "none";
  if (!fallback_used && fallbackCount === 0) {
    fallback_weight = "none";
  } else if (fallbackRatio <= 0.2) {
    fallback_weight = "low";
  } else if (fallbackRatio <= 0.5) {
    fallback_weight = "medium";
  } else {
    fallback_weight = "high";
  }

  // False specificity risk
  let false_specificity_risk: ZoneCorrespondence["false_specificity_risk"] = "none";
  if (corresponds_to_comune_only && geoLevelRank(scope.effective_level) < geoLevelRank("comune")) {
    false_specificity_risk = "high";
  } else if (fallback_weight === "high") {
    false_specificity_risk = "high";
  } else if (fallback_weight === "medium" || (hasOmi && !omiDirect && !hasAsc)) {
    false_specificity_risk = "medium";
  } else if (fallback_weight === "low") {
    false_specificity_risk = "low";
  }

  // Zone anchor strength
  let zone_anchor_strength: ZoneCorrespondenceIdentity["zone_anchor_strength"];
  if ((omiDirect || hasAsc) && hasSections && fallback_weight === "none") {
    zone_anchor_strength = "strong";
  } else if ((hasAsc || hasSections) && fallback_weight !== "high") {
    zone_anchor_strength = "medium";
  } else if (hasStructure && !corresponds_to_comune_only) {
    zone_anchor_strength = "weak";
  } else {
    zone_anchor_strength = "insufficient";
  }

  // zone_corresponds_to label
  let zone_corresponds_to: string;
  if (omiDirect && hasAsc) {
    zone_corresponds_to = "Microzona OMI con supporto sub-comunale";
  } else if (omiDirect) {
    zone_corresponds_to = "Microzona OMI";
  } else if (hasAsc) {
    zone_corresponds_to = "Area sub-comunale ISTAT";
  } else if (hasSections) {
    zone_corresponds_to = "Aggregato sezioni censuarie";
  } else {
    zone_corresponds_to = "Perimetro comunale";
  }

  // zone_type_label
  let zone_type_label: string;
  if (geoLevelRank(id.geo_level) <= geoLevelRank("sub_comunale")) {
    zone_type_label = "Zona sub-comunale";
  } else if (id.geo_level === "comune") {
    zone_type_label = "Comune";
  } else {
    zone_type_label = geoLevelLabel(id.geo_level);
  }

  // Precision
  let precision_status: PrecisionStatus;
  if (zone_anchor_strength === "strong" && false_specificity_risk === "none") {
    precision_status = "strong";
  } else if (zone_anchor_strength === "medium" && false_specificity_risk !== "high") {
    precision_status = "medium";
  } else if (zone_anchor_strength !== "insufficient") {
    precision_status = "weak";
  } else {
    precision_status = "insufficient";
  }

  const sub_comunale_support_status: ZonePrecision["sub_comunale_support_status"] =
    hasAsc && hasSections ? "available" : (hasAsc || hasSections) ? "partial" : "unavailable";

  const market_zone_support_status: ZonePrecision["market_zone_support_status"] =
    omiDirect ? "direct" : hasOmi ? "fallback" : "unavailable";

  const territorial_support_status: ZonePrecision["territorial_support_status"] =
    hasStructure && (hasAsc || hasSections) ? (hasAsc && hasSections ? "complete" : "partial") : "minimal";

  // Max safe claim level
  let max_safe_claim_level: CanonicalGeoLevel;
  if (omiDirect && hasAsc) {
    max_safe_claim_level = "zona_omi";
  } else if (hasAsc) {
    max_safe_claim_level = "sub_comunale";
  } else if (hasSections) {
    max_safe_claim_level = "sezione_censuaria";
  } else {
    max_safe_claim_level = "comune";
  }

  // Limitations
  const blocking_gaps: string[] = [];
  const transparency_notes: string[] = [];

  const missing_sub_comunale = !hasAsc && !hasSections;
  const market_only_comunale = hasOmi && !omiDirect;
  const weak_zone_anchor = zone_anchor_strength === "weak" || zone_anchor_strength === "insufficient";
  const fallback_dominant = fallback_weight === "high";

  if (missing_sub_comunale) {
    transparency_notes.push("Nessun dato sub-comunale disponibile: la lettura è limitata al perimetro comunale");
  }
  if (market_only_comunale) {
    transparency_notes.push("Il collegamento OMI è a livello comunale, non di microzona");
  }
  if (fallback_dominant) {
    transparency_notes.push("La maggior parte dei dati proviene da fallback: la lettura di zona è molto approssimativa");
  }
  if (false_specificity_risk === "high") {
    transparency_notes.push("Rischio di falsa specificità: il livello di dettaglio dichiarato potrebbe non essere sostenuto");
  }
  if (weak_zone_anchor) {
    blocking_gaps.push("Ancoraggio della zona debole: dati insufficienti per una lettura zona forte");
  }

  return {
    zone_identity: {
      geo_level_reale: id.geo_level,
      geo_code: id.geo_code,
      geo_label: id.geo_label,
      normalized_path: id.normalized_path,
      zone_type_label,
      zone_corresponds_to,
      zone_anchor_strength,
    },
    zone_correspondence: {
      corresponds_to_microzona_omi,
      corresponds_to_asc,
      corresponds_to_section_or_aggregate,
      corresponds_to_comune_only,
      primary_zone_basis,
      secondary_zone_basis: secondary,
      fallback_used,
      fallback_weight,
      false_specificity_risk,
    },
    zone_precision: {
      precision_status,
      sub_comunale_support_status,
      market_zone_support_status,
      territorial_support_status,
      max_safe_claim_level,
    },
    zone_limitations: {
      missing_sub_comunale,
      market_only_comunale,
      weak_zone_anchor,
      fallback_dominant,
      blocking_gaps,
      transparency_notes,
    },
  };
}
