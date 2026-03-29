/**
 * Zone Boundaries Engine — Sottra
 *
 * Determines whether a REAL boundary exists for the current zone and at what
 * territorial level, without ever fabricating, estimating or promoting a
 * boundary that doesn't exist in the data.
 *
 * Core policy: real boundary > no boundary > fake boundary
 *
 * Does NOT alter OMI. Does NOT invent polygons. Does NOT promote comunale
 * perimeters to fine-grained zone boundaries.
 */

import type { TerritorialDataResult } from "@/lib/territorialDataBackbone";
import { isDatasetUsable } from "@/lib/territorialDataBackbone";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type BoundaryPrecisionStatus = "strong" | "medium" | "weak" | "insufficient";

export type BoundaryDisplayMode =
  | "exact_supported_boundary"
  | "broader_boundary"
  | "comune_only_boundary"
  | "not_renderable";

export type BoundaryConfidence = "high" | "medium" | "low" | "not_determinable";

export type BoundarySourceType =
  | "microzona_omi"
  | "asc"
  | "sezione_censuaria"
  | "comune"
  | "none";

export type BoundaryGeometryType = "polygon" | "multi_polygon" | "none";

export type BoundaryRenderMode = "polygon_fill" | "descriptive_only" | "hidden";

export interface ZoneBoundaryIdentity {
  zone_geo_code: string;
  zone_geo_level: CanonicalGeoLevel;
  zone_label: string;
  boundary_available: boolean;
  boundary_source_type: BoundarySourceType;
  boundary_geo_level: CanonicalGeoLevel;
  boundary_label: string;
  boundary_precision_status: BoundaryPrecisionStatus;
}

export interface ZoneBoundarySupport {
  supports_microzona_omi_boundary: boolean;
  supports_asc_boundary: boolean;
  supports_section_or_aggregate_boundary: boolean;
  supports_comune_boundary: boolean;
  primary_boundary_basis: string;
  fallback_used: boolean;
  fallback_weight: "none" | "low" | "medium" | "high";
  false_specificity_risk: "none" | "low" | "medium" | "high";
}

export interface ZoneBoundaryGeometry {
  geometry_available: boolean;
  geometry_type: BoundaryGeometryType;
  geometry_scope_label: string;
  render_mode: BoundaryRenderMode;
  boundary_display_mode: BoundaryDisplayMode;
  boundary_confidence: BoundaryConfidence;
}

export interface ZoneBoundaryLimitations {
  no_real_boundary_available: boolean;
  comune_only_boundary: boolean;
  weak_boundary_anchor: boolean;
  fallback_dominant: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface ZoneBoundaryResult {
  zone_boundary_identity: ZoneBoundaryIdentity;
  zone_boundary_support: ZoneBoundarySupport;
  zone_boundary_geometry: ZoneBoundaryGeometry;
  zone_boundary_limitations: ZoneBoundaryLimitations;
}

/* ═══════════════════════════════════════════════════════════
   NARRATIVE MODE — drives UI gating
   ═══════════════════════════════════════════════════════════ */

export type BoundaryNarrativeMode = "full" | "partial" | "hidden";

export function boundaryNarrativeMode(r: ZoneBoundaryResult): BoundaryNarrativeMode {
  if (!r.zone_boundary_identity.boundary_available) return "hidden";
  if (r.zone_boundary_geometry.boundary_display_mode === "not_renderable") return "hidden";
  if (r.zone_boundary_identity.boundary_precision_status === "insufficient") return "hidden";

  if (
    r.zone_boundary_identity.boundary_precision_status === "strong" &&
    r.zone_boundary_geometry.boundary_confidence === "high"
  ) {
    return "full";
  }
  return "partial";
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function boundaryPrecisionLabel(s: BoundaryPrecisionStatus): string {
  const map: Record<BoundaryPrecisionStatus, string> = {
    strong: "Forte",
    medium: "Media",
    weak: "Debole",
    insufficient: "Insufficiente",
  };
  return map[s];
}

export function boundaryDisplayModeLabel(m: BoundaryDisplayMode): string {
  const map: Record<BoundaryDisplayMode, string> = {
    exact_supported_boundary: "Confine supportato",
    broader_boundary: "Perimetro più ampio",
    comune_only_boundary: "Solo perimetro comunale",
    not_renderable: "Non renderizzabile",
  };
  return map[m];
}

export function boundaryConfidenceLabel(c: BoundaryConfidence): string {
  const map: Record<BoundaryConfidence, string> = {
    high: "Alta",
    medium: "Media",
    low: "Bassa",
    not_determinable: "Non determinabile",
  };
  return map[c];
}

export function boundarySourceLabel(s: BoundarySourceType): string {
  const map: Record<BoundarySourceType, string> = {
    microzona_omi: "Microzona OMI",
    asc: "Area sub-comunale",
    sezione_censuaria: "Sezione censuaria",
    comune: "Comune",
    none: "Nessuno",
  };
  return map[s];
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildZoneBoundaries(
  data: TerritorialDataResult,
  corr: ZoneCorrespondenceResult,
): ZoneBoundaryResult {
  const { territorial_identity: id, territorial_datasets: ds } = data;

  const hasOmi = isDatasetUsable(ds.omi_linkage);
  const hasAsc = isDatasetUsable(ds.sub_municipal);
  const hasSections = isDatasetUsable(ds.census_sections);
  const hasStructure = isDatasetUsable(ds.territorial_structure);
  const omiDirect = hasOmi && ds.omi_linkage.geo_level === "zona_omi";

  // Inherit fallback analysis from correspondence
  const fallbackWeight = corr.zone_correspondence.fallback_weight;
  const falseSpecRisk = corr.zone_correspondence.false_specificity_risk;

  // ── Boundary source hierarchy ──
  // Priority: microzona OMI > ASC > sezione/aggregate > comune
  // Each requires real geometry availability in the dataset

  let boundarySourceType: BoundarySourceType = "none";
  let boundaryGeoLevel: CanonicalGeoLevel = "non_determinato";
  let boundaryLabel = "Nessun confine disponibile";
  let boundaryAvailable = false;

  if (omiDirect) {
    boundarySourceType = "microzona_omi";
    boundaryGeoLevel = "zona_omi";
    boundaryLabel = "Confine disponibile a livello microzona OMI";
    boundaryAvailable = true;
  } else if (hasAsc && !ds.sub_municipal.is_derived) {
    boundarySourceType = "asc";
    boundaryGeoLevel = "sub_comunale";
    boundaryLabel = "Confine disponibile a livello ASC";
    boundaryAvailable = true;
  } else if (hasSections) {
    boundarySourceType = "sezione_censuaria";
    boundaryGeoLevel = "sezione_censuaria";
    boundaryLabel = "Confine disponibile a livello sezione/aggregato";
    boundaryAvailable = true;
  } else if (hasStructure) {
    boundarySourceType = "comune";
    boundaryGeoLevel = "comune";
    boundaryLabel = "Perimetro disponibile solo a livello comunale";
    boundaryAvailable = true;
  }

  // ── Support flags ──
  const supports_microzona_omi_boundary = omiDirect;
  const supports_asc_boundary = hasAsc && !ds.sub_municipal.is_derived;
  const supports_section_or_aggregate_boundary = hasSections;
  const supports_comune_boundary = hasStructure || hasAsc || hasSections || omiDirect;

  // ── Primary basis ──
  let primaryBasis: string;
  if (omiDirect) {
    primaryBasis = "Poligono microzona OMI reale";
  } else if (supports_asc_boundary) {
    primaryBasis = "Poligono area sub-comunale reale";
  } else if (supports_section_or_aggregate_boundary) {
    primaryBasis = "Poligono sezione/aggregato censuario";
  } else if (supports_comune_boundary) {
    primaryBasis = "Perimetro comunale (non fine)";
  } else {
    primaryBasis = "Nessun perimetro supportato";
  }

  // ── Precision status ──
  let precisionStatus: BoundaryPrecisionStatus;
  if (omiDirect && fallbackWeight === "none") {
    precisionStatus = "strong";
  } else if ((supports_asc_boundary || supports_section_or_aggregate_boundary) && fallbackWeight !== "high") {
    precisionStatus = "medium";
  } else if (boundaryAvailable && boundarySourceType !== "none") {
    precisionStatus = "weak";
  } else {
    precisionStatus = "insufficient";
  }

  // ── Display mode ──
  let displayMode: BoundaryDisplayMode;
  if (!boundaryAvailable) {
    displayMode = "not_renderable";
  } else if (boundarySourceType === "microzona_omi" || boundarySourceType === "asc") {
    displayMode = fallbackWeight === "high" ? "broader_boundary" : "exact_supported_boundary";
  } else if (boundarySourceType === "sezione_censuaria") {
    displayMode = "broader_boundary";
  } else {
    displayMode = "comune_only_boundary";
  }

  // ── Confidence ──
  let confidence: BoundaryConfidence;
  if (precisionStatus === "strong" && falseSpecRisk === "none") {
    confidence = "high";
  } else if (precisionStatus === "medium" && falseSpecRisk !== "high") {
    confidence = "medium";
  } else if (boundaryAvailable) {
    confidence = "low";
  } else {
    confidence = "not_determinable";
  }

  // ── Geometry ──
  const geometryAvailable = boundaryAvailable && displayMode !== "not_renderable";
  const geometryType: BoundaryGeometryType = geometryAvailable ? "polygon" : "none";
  const geometryScopeLabel = geometryAvailable ? geoLevelLabel(boundaryGeoLevel) : "Non disponibile";

  let renderMode: BoundaryRenderMode;
  if (!geometryAvailable) {
    renderMode = "hidden";
  } else if (displayMode === "exact_supported_boundary") {
    renderMode = "polygon_fill";
  } else {
    renderMode = "descriptive_only";
  }

  // ── Limitations ──
  const comuneOnly = boundarySourceType === "comune";
  const weakAnchor = precisionStatus === "weak" || precisionStatus === "insufficient";
  const fallbackDominant = fallbackWeight === "high";
  const noReal = !boundaryAvailable;

  const blockingGaps: string[] = [];
  const transparencyNotes: string[] = [];

  if (noReal) {
    blockingGaps.push("Nessun perimetro reale disponibile per questa zona");
  }
  if (comuneOnly) {
    transparencyNotes.push("Il perimetro mostrato corrisponde al confine comunale, non a una delimitazione fine della zona");
  }
  if (fallbackDominant && boundaryAvailable) {
    transparencyNotes.push("Il confine è basato su dati con forte componente di fallback: la delimitazione è approssimativa");
  }
  if (falseSpecRisk === "high" && boundaryAvailable) {
    transparencyNotes.push("Rischio di falsa specificità: il perimetro potrebbe apparire più preciso di quanto realmente supportato");
  }
  if (weakAnchor && boundaryAvailable) {
    transparencyNotes.push("Il livello attuale non consente una delimitazione fine della zona");
  }

  return {
    zone_boundary_identity: {
      zone_geo_code: id.geo_code,
      zone_geo_level: id.geo_level,
      zone_label: id.geo_label,
      boundary_available: boundaryAvailable,
      boundary_source_type: boundarySourceType,
      boundary_geo_level: boundaryGeoLevel,
      boundary_label: boundaryLabel,
      boundary_precision_status: precisionStatus,
    },
    zone_boundary_support: {
      supports_microzona_omi_boundary,
      supports_asc_boundary,
      supports_section_or_aggregate_boundary,
      supports_comune_boundary,
      primary_boundary_basis: primaryBasis,
      fallback_used: corr.zone_correspondence.fallback_used,
      fallback_weight: fallbackWeight,
      false_specificity_risk: falseSpecRisk,
    },
    zone_boundary_geometry: {
      geometry_available: geometryAvailable,
      geometry_type: geometryType,
      geometry_scope_label: geometryScopeLabel,
      render_mode: renderMode,
      boundary_display_mode: displayMode,
      boundary_confidence: confidence,
    },
    zone_boundary_limitations: {
      no_real_boundary_available: noReal,
      comune_only_boundary: comuneOnly,
      weak_boundary_anchor: weakAnchor,
      fallback_dominant: fallbackDominant,
      blocking_gaps: blockingGaps,
      transparency_notes: transparencyNotes,
    },
  };
}
