/**
 * Building Profile Engine — Sottra Phase 4+5
 *
 * Produces a building/property profile from the territorial backbone,
 * clearly distinguishing direct facts, contextual facts, derived facts
 * and unsupported claims.
 *
 * Phase 5 addition: integrates Address Resolution Engine as an optional
 * precision layer — never promoting address parsing to building truth.
 */

import type {
  TerritorialDataResult,
  TerritorialDataQuality,
  OverallQualityStatus,
} from "@/lib/territorialDataBackbone";
import {
  dataQualityLabel,
  isDatasetUsable,
  qualityStatusLabel,
} from "@/lib/territorialDataBackbone";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel, geoLevelRank } from "@/lib/geoBackbone";
import {
  buildZoneProfile,
  type ZoneProfile,
  type SectionRenderMode,
  type ReportBadge,
  type ReportKeyFact,
} from "@/lib/zoneProfileEngine";
import {
  resolveAddress,
  addressFactSupportLevel,
  addressQualityLabel,
  streetMatchLabel,
  civicMatchLabel,
  type AddressResolutionResult,
} from "@/lib/addressResolutionEngine";

/* ═══════════════════════════════════════════════════════════
   SUPPORT LEVEL — direct vs contextual vs derived
   ═══════════════════════════════════════════════════════════ */

export type FactSupportLevel = "direct" | "contextual" | "derived" | "unavailable";

const SUPPORT_LABELS: Record<FactSupportLevel, string> = {
  direct: "Dato diretto",
  contextual: "Dato contestuale",
  derived: "Dato derivato",
  unavailable: "Non disponibile",
};

export function supportLevelLabel(s: FactSupportLevel): string {
  return SUPPORT_LABELS[s];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS / CIVIC STATUS
   ═══════════════════════════════════════════════════════════ */

export type AddressStatus =
  | "available"
  | "approximate"
  | "unavailable"
  | "not_introduced_yet"
  | "not_determinable";

export type CoordinateStatus =
  | "available"
  | "approximate"
  | "unavailable";

/* ═══════════════════════════════════════════════════════════
   BUILDING PROFILE CONTRACT
   ═══════════════════════════════════════════════════════════ */

export interface BuildingIdentity {
  building_reference_id: string;
  geo_context_path: string;
  building_scope_label: string;
  identification_mode: "scan_photo" | "coordinate" | "address_input" | "territorial_only" | "none";
  identification_precision: "high" | "medium" | "low" | "none";
  is_point_specific: boolean;
  is_building_level_supported: boolean;
  is_address_level_supported: boolean;
}

export interface BuildingLocalization {
  resolved_geo_level: CanonicalGeoLevel;
  effective_building_scope: string;
  localization_method: string;
  localization_confidence: number;
  territorial_anchor: string;
  zone_anchor: string | null;
  omi_anchor: string | null;
  sub_municipal_anchor: string | null;
  coordinate_status: CoordinateStatus;
  address_status: AddressStatus;
  civic_status: AddressStatus;
  /** Phase 5: full address resolution layer (null if no address input) */
  address_resolution: AddressResolutionResult | null;
}

export interface BuildingContext {
  zone_profile_linked: boolean;
  territorial_structure_linked: boolean;
  market_context_linked: boolean;
  sub_municipal_support: boolean;
  precision_boundary: CanonicalGeoLevel;
  nearest_reliable_scope: string;
}

export interface BuildingFact {
  key: string;
  label: string;
  value: string;
  support_level: FactSupportLevel;
  source_basis: string | null;
  geo_validity_level: CanonicalGeoLevel;
  quality_label: string;
  is_direct: boolean;
  is_contextual: boolean;
  is_derived: boolean;
}

export type BuildingFactCategory =
  | "identification"
  | "localization"
  | "territorial_context"
  | "market_linkage"
  | "coverage"
  | "source";

export interface BuildingSupportedFacts {
  identification_facts: BuildingFact[];
  localization_facts: BuildingFact[];
  territorial_context_facts: BuildingFact[];
  market_linkage_facts: BuildingFact[];
  coverage_facts: BuildingFact[];
  source_facts: BuildingFact[];
}

export interface BuildingInferredBounds {
  what_can_be_said: string[];
  what_cannot_be_said: string[];
  max_supported_claim_level: CanonicalGeoLevel;
  min_safe_scope: string;
  overprecision_risk: "low" | "medium" | "high";
  false_specificity_risk: "low" | "medium" | "high";
  downgrade_notes: string[];
}

export interface BuildingDataQuality {
  overall_quality_status: OverallQualityStatus;
  identification_strength: "strong" | "moderate" | "weak" | "none";
  localization_strength: "strong" | "moderate" | "weak" | "none";
  contextual_support_strength: "strong" | "moderate" | "weak" | "none";
  source_chain_clarity: "high" | "medium" | "low";
  fallback_count: number;
  transparency_score: number;
  key_warnings: string[];
}

export interface BuildingLimitations {
  missing_precise_address: boolean;
  missing_civic_link: boolean;
  missing_building_registry: boolean;
  missing_building_attributes: boolean;
  missing_unit_level_data: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface BuildingSummary {
  executive_summary: string;
  analytical_summary: string;
  safe_user_summary: string;
  next_best_step: string;
}

export type BuildingReportSectionKey =
  | "identity"
  | "localization"
  | "territorial_context"
  | "supported_facts"
  | "quality"
  | "limitations"
  | "unsupported_claims";

export interface BuildingSectionRenderability {
  can_render: boolean;
  render_mode: SectionRenderMode;
  reason: string;
  source_basis: string | null;
}

export interface BuildingReportRenderability {
  sections: Record<BuildingReportSectionKey, BuildingSectionRenderability>;
}

export interface BuildingProfile {
  building_identity: BuildingIdentity;
  building_localization: BuildingLocalization;
  building_context: BuildingContext;
  building_supported_facts: BuildingSupportedFacts;
  building_inferred_bounds: BuildingInferredBounds;
  building_data_quality: BuildingDataQuality;
  building_limitations: BuildingLimitations;
  building_summary: BuildingSummary;
  building_report_renderability: BuildingReportRenderability;
}

/* ═══════════════════════════════════════════════════════════
   BUILDING REPORT VIEW MODEL
   ═══════════════════════════════════════════════════════════ */

export interface BuildingReportSectionVM {
  key: BuildingReportSectionKey;
  title: string;
  render_mode: SectionRenderMode;
  reason: string;
  facts: ReportKeyFact[];
  notes: string[];
  badges: ReportBadge[];
}

export interface BuildingReportViewModel {
  header: {
    title: string;
    subtitle: string;
    precision_badge: ReportBadge;
  };
  identity_panel: BuildingReportSectionVM | null;
  localization_panel: BuildingReportSectionVM | null;
  context_panel: BuildingReportSectionVM | null;
  supported_facts_panel: BuildingReportSectionVM | null;
  quality_panel: BuildingReportSectionVM | null;
  limitations_panel: BuildingReportSectionVM | null;
  transparency_panel: {
    sources: Array<{ label: string; quality: string; level: string }>;
    fallback_count: number;
  };
  unsupported_claims_panel: BuildingReportSectionVM | null;
  hidden_sections: string[];
}

/* ═══════════════════════════════════════════════════════════
   ENGINE INPUT
   ═══════════════════════════════════════════════════════════ */

export interface BuildingProfileInput {
  territorial_data: TerritorialDataResult;
  /** Identification mode */
  identification_mode?: BuildingIdentity["identification_mode"];
  /** Address string if available */
  address?: string | null;
  /** Coordinates if available */
  lat?: number | null;
  lng?: number | null;
  /** Photo available */
  has_photo?: boolean;
  /** Confidence from identification */
  identification_confidence?: number;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE: Build BuildingProfile
   ═══════════════════════════════════════════════════════════ */

export function buildBuildingProfile(input: BuildingProfileInput): BuildingProfile {
  const { territorial_data: td } = input;
  const zp = buildZoneProfile(td);

  const identity = buildIdentity(input, td, zp);
  const localization = buildLocalization(input, td, zp);
  const context = buildContext(td, zp);
  const facts = buildFacts(input, td, zp, identity, localization);
  const bounds = buildBounds(td, zp, identity);
  const quality = buildQuality(td, zp, identity, localization);
  const limitations = buildLimitations(identity, localization);
  const summary = buildSummary(identity, localization, quality, limitations, td);
  const renderability = computeRenderability(identity, localization, quality, facts);

  return {
    building_identity: identity,
    building_localization: localization,
    building_context: context,
    building_supported_facts: facts,
    building_inferred_bounds: bounds,
    building_data_quality: quality,
    building_limitations: limitations,
    building_summary: summary,
    building_report_renderability: renderability,
  };
}

/* ═══════════════════════════════════════════════════════════
   INTERNAL BUILDERS
   ═══════════════════════════════════════════════════════════ */

function buildIdentity(
  input: BuildingProfileInput,
  td: TerritorialDataResult,
  _zp: ZoneProfile,
): BuildingIdentity {
  const hasCoords = input.lat != null && input.lng != null;
  const hasAddress = !!input.address;
  const hasPhoto = !!input.has_photo;

  let mode: BuildingIdentity["identification_mode"] = input.identification_mode ?? "none";
  if (mode === "none") {
    if (hasPhoto && hasCoords) mode = "scan_photo";
    else if (hasCoords) mode = "coordinate";
    else if (hasAddress) mode = "address_input";
    else mode = "territorial_only";
  }

  const conf = input.identification_confidence ?? 0;
  let precision: BuildingIdentity["identification_precision"] = "none";
  if (conf >= 0.8) precision = "high";
  else if (conf >= 0.5) precision = "medium";
  else if (conf > 0 || hasCoords) precision = "low";

  const refId = [
    td.territorial_identity.geo_code,
    input.lat?.toFixed(4),
    input.lng?.toFixed(4),
  ].filter(Boolean).join("_");

  return {
    building_reference_id: refId,
    geo_context_path: td.territorial_identity.normalized_path,
    building_scope_label: hasPhoto
      ? "Edificio identificato da foto"
      : hasCoords
        ? "Posizione da coordinate"
        : hasAddress
          ? "Riferimento da indirizzo"
          : "Solo contesto territoriale",
    identification_mode: mode,
    identification_precision: precision,
    is_point_specific: hasCoords,
    is_building_level_supported: hasPhoto && conf >= 0.5,
    is_address_level_supported: false, // Not introduced yet
  };
}

function buildLocalization(
  input: BuildingProfileInput,
  td: TerritorialDataResult,
  zp: ZoneProfile,
): BuildingLocalization {
  const hasCoords = input.lat != null && input.lng != null;
  const hasAddress = !!input.address;

  const coordStatus: CoordinateStatus = hasCoords ? "available" : "unavailable";
  const addrStatus: AddressStatus = hasAddress ? "approximate" : "not_introduced_yet";

  let method = "territorial_resolution";
  if (hasCoords) method = "coordinate_lookup";
  if (input.has_photo) method = "photo_scan_with_coordinates";

  const conf = hasCoords ? 0.7 : 0.3;

  return {
    resolved_geo_level: td.territorial_identity.geo_level,
    effective_building_scope: geoLevelLabel(td.territorial_scope.effective_level),
    localization_method: method,
    localization_confidence: conf,
    territorial_anchor: td.territorial_identity.normalized_path,
    zone_anchor: zp.zone_positioning.omi_linkage_status !== "unavailable"
      ? "OMI collegato" : null,
    omi_anchor: zp.zone_market_context.omi_linked
      ? `OMI ${zp.zone_market_context.omi_link_precision}` : null,
    sub_municipal_anchor: zp.zone_positioning.asc_presence
      ? "ASC disponibile" : null,
    coordinate_status: coordStatus,
    address_status: addrStatus,
    civic_status: "not_introduced_yet",
  };
}

function buildContext(
  td: TerritorialDataResult,
  zp: ZoneProfile,
): BuildingContext {
  return {
    zone_profile_linked: true,
    territorial_structure_linked: isDatasetUsable(td.territorial_datasets.territorial_structure),
    market_context_linked: zp.zone_market_context.omi_linked,
    sub_municipal_support: zp.zone_positioning.asc_presence || zp.zone_positioning.section_presence,
    precision_boundary: td.territorial_scope.effective_level,
    nearest_reliable_scope: geoLevelLabel(td.territorial_scope.effective_level),
  };
}

function makeFact(
  key: string,
  label: string,
  value: string,
  support: FactSupportLevel,
  source: string | null,
  level: CanonicalGeoLevel,
  quality: TerritorialDataQuality,
): BuildingFact {
  return {
    key,
    label,
    value,
    support_level: support,
    source_basis: source,
    geo_validity_level: level,
    quality_label: dataQualityLabel(quality),
    is_direct: support === "direct",
    is_contextual: support === "contextual",
    is_derived: support === "derived",
  };
}

function buildFacts(
  input: BuildingProfileInput,
  td: TerritorialDataResult,
  zp: ZoneProfile,
  identity: BuildingIdentity,
  _loc: BuildingLocalization,
): BuildingSupportedFacts {
  const idFacts: BuildingFact[] = [];
  const locFacts: BuildingFact[] = [];
  const ctxFacts: BuildingFact[] = [];
  const mktFacts: BuildingFact[] = [];
  const covFacts: BuildingFact[] = [];
  const srcFacts: BuildingFact[] = [];

  // Identification facts
  idFacts.push(makeFact(
    "id_mode", "Modalità identificazione", identity.building_scope_label,
    identity.identification_mode === "scan_photo" ? "direct" : "contextual",
    identity.identification_mode === "scan_photo" ? "foto_scan" : "geo_backbone",
    td.territorial_identity.geo_level, "elaborated",
  ));

  idFacts.push(makeFact(
    "id_precision", "Precisione", identity.identification_precision,
    "direct", null, td.territorial_identity.geo_level, "elaborated",
  ));

  // Localization facts
  if (input.lat != null && input.lng != null) {
    locFacts.push(makeFact(
      "coordinates", "Coordinate", `${input.lat.toFixed(4)}, ${input.lng.toFixed(4)}`,
      "direct", "gps", "comune", "territorial_verified",
    ));
  }

  locFacts.push(makeFact(
    "territory", "Territorio", td.territorial_identity.geo_label,
    "contextual", "geo_backbone", td.territorial_identity.geo_level,
    td.territorial_datasets.territorial_structure.is_official ? "official" : "elaborated",
  ));

  if (input.address) {
    locFacts.push(makeFact(
      "address_ref", "Indirizzo (riferimento)", input.address,
      "contextual", "input_utente", "comune", "elaborated",
    ));
  }

  // Territorial context facts
  ctxFacts.push(makeFact(
    "geo_path", "Percorso geografico", td.territorial_identity.normalized_path,
    "contextual", "geo_backbone", td.territorial_identity.geo_level, "official",
  ));

  if (zp.zone_positioning.asc_presence) {
    ctxFacts.push(makeFact(
      "sub_municipal", "Supporto sub-comunale", "Presente",
      "contextual", "asc_2021", "sub_comunale", "official",
    ));
  }

  if (zp.zone_positioning.section_presence) {
    ctxFacts.push(makeFact(
      "census_sections", "Sezioni censuarie", "Disponibili",
      "contextual", "census_r03_2021", "sezione_censuaria", "official",
    ));
  }

  // Market linkage facts
  if (zp.zone_market_context.omi_linked) {
    mktFacts.push(makeFact(
      "omi_linkage", "Collegamento OMI",
      zp.zone_market_context.omi_link_precision === "direct" ? "Diretto" : "Via comune",
      "contextual", "omi_quotazioni",
      zp.zone_market_context.omi_link_level ?? "comune",
      "official",
    ));
  }

  // Coverage facts
  const availCount = td.territorial_coverage.available_levels.length;
  covFacts.push(makeFact(
    "coverage_levels", "Livelli con dati", `${availCount}`,
    "contextual", "territorial_backbone", td.territorial_identity.geo_level, "elaborated",
  ));

  covFacts.push(makeFact(
    "precision_score", "Punteggio precisione",
    `${Math.round(td.territorial_coverage.precision_score * 100)}%`,
    "derived", "territorial_backbone", td.territorial_identity.geo_level, "elaborated",
  ));

  // Source facts
  for (const src of td.territorial_sources.slice(0, 4)) {
    srcFacts.push(makeFact(
      `src_${src.source_key}`, src.source_label,
      `${src.record_count} record — ${geoLevelLabel(src.geo_level_supported)}`,
      src.is_official ? "direct" : "derived",
      src.source_key, src.geo_level_supported,
      src.source_type,
    ));
  }

  return {
    identification_facts: idFacts,
    localization_facts: locFacts,
    territorial_context_facts: ctxFacts,
    market_linkage_facts: mktFacts,
    coverage_facts: covFacts,
    source_facts: srcFacts,
  };
}

function buildBounds(
  td: TerritorialDataResult,
  zp: ZoneProfile,
  identity: BuildingIdentity,
): BuildingInferredBounds {
  const canSay: string[] = [];
  const cannotSay: string[] = [];
  const downgrade: string[] = [];

  canSay.push("Contesto territoriale del territorio risolto");
  canSay.push("Livello di precisione della localizzazione");

  if (zp.zone_market_context.omi_linked) {
    canSay.push("Collegamento al mercato immobiliare OMI");
  }
  if (zp.zone_positioning.asc_presence) {
    canSay.push("Struttura sub-comunale del territorio");
  }

  cannotSay.push("Anno di costruzione dell'edificio");
  cannotSay.push("Numero di unità immobiliari");
  cannotSay.push("Numero di piani");
  cannotSay.push("Stato di conservazione");
  cannotSay.push("Dettagli catastali puntuali");
  cannotSay.push("Indirizzo e civico precisi (layer non ancora introdotto)");

  if (!identity.is_building_level_supported) {
    downgrade.push("Identificazione edificio non sufficiente per dati puntuali");
  }
  if (!identity.is_point_specific) {
    downgrade.push("Localizzazione solo territoriale, non puntuale");
  }

  const overprecisionRisk: "low" | "medium" | "high" =
    identity.is_building_level_supported ? "low"
    : identity.is_point_specific ? "medium"
    : "high";

  const falseSpecificity: "low" | "medium" | "high" =
    identity.identification_precision === "high" ? "low"
    : identity.identification_precision === "medium" ? "medium"
    : "high";

  return {
    what_can_be_said: canSay,
    what_cannot_be_said: cannotSay,
    max_supported_claim_level: td.territorial_scope.effective_level,
    min_safe_scope: geoLevelLabel(td.territorial_scope.effective_level),
    overprecision_risk: overprecisionRisk,
    false_specificity_risk: falseSpecificity,
    downgrade_notes: downgrade,
  };
}

function buildQuality(
  td: TerritorialDataResult,
  _zp: ZoneProfile,
  identity: BuildingIdentity,
  localization: BuildingLocalization,
): BuildingDataQuality {
  const tq = td.territorial_quality;

  const idStrength: "strong" | "moderate" | "weak" | "none" =
    identity.identification_precision === "high" ? "strong"
    : identity.identification_precision === "medium" ? "moderate"
    : identity.identification_precision === "low" ? "weak"
    : "none";

  const locStrength: "strong" | "moderate" | "weak" | "none" =
    localization.coordinate_status === "available" ? "moderate"
    : "weak";

  const ctxStrength: "strong" | "moderate" | "weak" | "none" =
    tq.overall_status === "strong" ? "strong"
    : tq.overall_status === "adequate" ? "moderate"
    : tq.overall_status === "limited" ? "weak"
    : "none";

  const chainClarity: "high" | "medium" | "low" =
    tq.data_coherence && tq.warnings.length <= 2 ? "high"
    : tq.data_coherence ? "medium"
    : "low";

  const warnings = [...tq.warnings];
  if (!identity.is_building_level_supported) {
    warnings.push("Identificazione edificio non supportata a livello puntuale");
  }
  if (localization.address_status === "not_introduced_yet") {
    warnings.push("Layer indirizzo/civico non ancora introdotto");
  }

  // Transparency: how clear is the data provenance
  const transparency = td.territorial_sources.length > 0
    ? Math.min(1, td.territorial_sources.filter(s => s.is_official).length / Math.max(td.territorial_sources.length, 1))
    : 0;

  return {
    overall_quality_status: tq.overall_status,
    identification_strength: idStrength,
    localization_strength: locStrength,
    contextual_support_strength: ctxStrength,
    source_chain_clarity: chainClarity,
    fallback_count: tq.fallback_count,
    transparency_score: Math.round(transparency * 100) / 100,
    key_warnings: warnings,
  };
}

function buildLimitations(
  identity: BuildingIdentity,
  localization: BuildingLocalization,
): BuildingLimitations {
  const gaps: string[] = [];
  const notes: string[] = [];

  const missingAddress = localization.address_status !== "available";
  const missingCivic = localization.civic_status === "not_introduced_yet";
  const missingRegistry = true; // No building registry exists yet
  const missingAttributes = true; // No building attributes available
  const missingUnit = true; // No unit-level data

  if (missingAddress) {
    notes.push("Indirizzo preciso non disponibile o approssimativo");
  }
  if (missingCivic) {
    notes.push("Layer via/civico non ancora introdotto nel sistema");
  }
  if (missingRegistry) {
    gaps.push("Registro edifici non ancora attivo");
    notes.push("Non esiste ancora un registro edifici dedicato");
  }
  if (missingAttributes) {
    notes.push("Attributi strutturali edificio (piani, anno, conservazione) non disponibili");
  }
  if (!identity.is_building_level_supported) {
    gaps.push("Identificazione edificio non sufficiente");
  }

  return {
    missing_precise_address: missingAddress,
    missing_civic_link: missingCivic,
    missing_building_registry: missingRegistry,
    missing_building_attributes: missingAttributes,
    missing_unit_level_data: missingUnit,
    blocking_gaps: gaps,
    transparency_notes: notes,
  };
}

function buildSummary(
  identity: BuildingIdentity,
  _loc: BuildingLocalization,
  quality: BuildingDataQuality,
  limitations: BuildingLimitations,
  td: TerritorialDataResult,
): BuildingSummary {
  const territory = td.territorial_identity.geo_label;

  const executive_summary = identity.is_building_level_supported
    ? `Edificio identificato in ${territory}. Contesto territoriale ${qualityStatusLabel(quality.overall_quality_status).toLowerCase()}.`
    : `Posizione in ${territory}. Profilo basato su contesto territoriale (${qualityStatusLabel(quality.overall_quality_status).toLowerCase()}).`;

  const parts: string[] = [];
  parts.push(`Territorio: ${td.territorial_identity.normalized_path}`);
  parts.push(`Identificazione: ${identity.identification_precision}`);
  parts.push(`Modalità: ${identity.building_scope_label}`);
  if (quality.key_warnings.length > 0) {
    parts.push(`Avvisi: ${quality.key_warnings.length}`);
  }
  const analytical_summary = parts.join(". ") + ".";

  let safe_user_summary: string;
  if (identity.is_building_level_supported) {
    safe_user_summary = `L'edificio è stato identificato nel territorio di ${territory}. Le informazioni disponibili derivano principalmente dal contesto territoriale e dalle fonti ufficiali collegate.`;
  } else {
    safe_user_summary = `La posizione è stata localizzata nel territorio di ${territory}. Il profilo è basato esclusivamente sul contesto territoriale disponibile, senza dati specifici sull'edificio.`;
  }

  const next_best_step = limitations.blocking_gaps.length > 0
    ? `Prossimi passi: ${limitations.blocking_gaps.slice(0, 2).join("; ")}.`
    : "Profilo territoriale completo. Layer edificio e via/civico previsti nelle prossime fasi.";

  return { executive_summary, analytical_summary, safe_user_summary, next_best_step };
}

/* ═══════════════════════════════════════════════════════════
   RENDERABILITY — stricter than Phase 3
   ═══════════════════════════════════════════════════════════ */

function computeRenderability(
  identity: BuildingIdentity,
  localization: BuildingLocalization,
  quality: BuildingDataQuality,
  facts: BuildingSupportedFacts,
): BuildingReportRenderability {
  const s = (key: BuildingReportSectionKey, can: boolean, mode: SectionRenderMode, reason: string, source: string | null): [BuildingReportSectionKey, BuildingSectionRenderability] =>
    [key, { can_render: can, render_mode: mode, reason, source_basis: source }];

  const hasId = identity.identification_mode !== "none";
  const hasCoords = localization.coordinate_status === "available";
  const hasContext = facts.territorial_context_facts.length > 0;
  const hasFacts = facts.identification_facts.length + facts.localization_facts.length + facts.territorial_context_facts.length > 2;
  const hasQuality = quality.overall_quality_status !== "insufficient";
  const hasLimitations = quality.key_warnings.length > 0;

  const entries: [BuildingReportSectionKey, BuildingSectionRenderability][] = [
    s("identity", hasId, hasId ? "full" : "hidden",
      hasId ? "Identificazione presente" : "Nessuna identificazione", "building_profile"),

    s("localization", hasId || hasCoords,
      hasCoords ? "full" : hasId ? "partial" : "hidden",
      hasCoords ? "Coordinate disponibili" : "Solo contesto territoriale", "geo_backbone"),

    s("territorial_context", hasContext,
      hasContext ? "full" : "hidden",
      hasContext ? "Contesto territoriale disponibile" : "Nessun contesto", "territorial_backbone"),

    s("supported_facts", hasFacts,
      hasFacts ? (facts.market_linkage_facts.length > 0 ? "full" : "partial") : "hidden",
      hasFacts ? "Fatti supportati presenti" : "Dati insufficienti", "multi_source"),

    s("quality", hasQuality,
      quality.overall_quality_status === "strong" || quality.overall_quality_status === "adequate" ? "full" : "partial",
      `Qualità: ${qualityStatusLabel(quality.overall_quality_status)}`, null),

    s("limitations", hasLimitations || true, // Always show limitations for building profile
      "full", "Limiti sempre rilevanti per profilo edificio", null),

    s("unsupported_claims", true, "full",
      "Trasparenza sulle affermazioni non supportate", null),
  ];

  return {
    sections: Object.fromEntries(entries) as Record<BuildingReportSectionKey, BuildingSectionRenderability>,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAPPER: BuildingProfile → BuildingReportViewModel
   ═══════════════════════════════════════════════════════════ */

function supportBadge(s: FactSupportLevel): ReportBadge {
  switch (s) {
    case "direct": return { label: "Diretto", variant: "official" };
    case "contextual": return { label: "Contestuale", variant: "elaborated" };
    case "derived": return { label: "Derivato", variant: "partial" };
    case "unavailable": return { label: "Non disponibile", variant: "unavailable" };
  }
}

function qualityBadgeVariant(s: OverallQualityStatus): ReportBadge["variant"] {
  switch (s) {
    case "strong": return "official";
    case "adequate": return "elaborated";
    case "limited": return "partial";
    case "insufficient": return "unavailable";
  }
}

function sectionOrNull(
  key: BuildingReportSectionKey,
  title: string,
  rr: BuildingReportRenderability,
  facts: ReportKeyFact[],
  notes: string[],
  badges: ReportBadge[],
): BuildingReportSectionVM | null {
  const r = rr.sections[key];
  if (!r.can_render) return null;
  return { key, title, render_mode: r.render_mode, reason: r.reason, facts, notes, badges };
}

export function buildBuildingReportViewModel(
  profile: BuildingProfile,
  td: TerritorialDataResult,
): BuildingReportViewModel {
  const { building_identity: bi, building_localization: bl, building_context: bc,
    building_supported_facts: bf, building_data_quality: bq,
    building_limitations: blim, building_inferred_bounds: bb } = profile;
  const rr = profile.building_report_renderability;

  const header = {
    title: bi.building_scope_label,
    subtitle: bi.geo_context_path,
    precision_badge: {
      label: bi.identification_precision === "high" ? "Alta precisione"
        : bi.identification_precision === "medium" ? "Precisione media"
        : bi.identification_precision === "low" ? "Bassa precisione"
        : "Non determinato",
      variant: (bi.identification_precision === "high" ? "official"
        : bi.identification_precision === "medium" ? "elaborated"
        : "partial") as ReportBadge["variant"],
    },
  };

  // Identity panel
  const identity_panel = sectionOrNull("identity", "Identità edificio", rr,
    [
      { label: "Modalità", value: bi.building_scope_label },
      { label: "Precisione", value: bi.identification_precision },
      { label: "Livello edificio", value: bi.is_building_level_supported ? "Supportato" : "Non supportato" },
    ],
    [], []);

  // Localization panel
  const locFacts: ReportKeyFact[] = [
    { label: "Livello risolto", value: geoLevelLabel(bl.resolved_geo_level) },
    { label: "Coordinate", value: bl.coordinate_status === "available" ? "Disponibili" : "Non disponibili" },
    { label: "Indirizzo", value: bl.address_status === "not_introduced_yet" ? "Layer non introdotto" : bl.address_status === "approximate" ? "Approssimativo" : "Non disponibile" },
    { label: "Civico", value: "Layer non introdotto" },
  ];
  const localization_panel = sectionOrNull("localization", "Localizzazione", rr,
    locFacts, [], []);

  // Context panel
  const ctxFacts: ReportKeyFact[] = [
    { label: "Profilo zona", value: bc.zone_profile_linked ? "Collegato" : "Non disponibile" },
    { label: "Struttura territoriale", value: bc.territorial_structure_linked ? "Disponibile" : "Non disponibile" },
    { label: "Contesto mercato", value: bc.market_context_linked ? "Collegato" : "Non disponibile" },
    { label: "Sub-comunale", value: bc.sub_municipal_support ? "Supportato" : "Non disponibile" },
    { label: "Scope affidabile", value: bc.nearest_reliable_scope },
  ];
  const context_panel = sectionOrNull("territorial_context", "Contesto territoriale", rr,
    ctxFacts, [], []);

  // Supported facts panel
  const allFacts = [
    ...bf.identification_facts,
    ...bf.localization_facts,
    ...bf.territorial_context_facts,
    ...bf.market_linkage_facts,
  ];
  const factItems: ReportKeyFact[] = allFacts.slice(0, 8).map(f => ({
    label: f.label,
    value: f.value,
    badge: supportBadge(f.support_level),
  }));
  const supported_facts_panel = sectionOrNull("supported_facts", "Fatti supportati", rr,
    factItems, [], []);

  // Quality panel
  const quality_panel = sectionOrNull("quality", "Qualità del dato", rr,
    [
      { label: "Stato complessivo", value: qualityStatusLabel(bq.overall_quality_status) },
      { label: "Identificazione", value: bq.identification_strength },
      { label: "Localizzazione", value: bq.localization_strength },
      { label: "Supporto contestuale", value: bq.contextual_support_strength },
      { label: "Trasparenza", value: `${Math.round(bq.transparency_score * 100)}%` },
    ],
    bq.key_warnings.slice(0, 3),
    [{ label: qualityStatusLabel(bq.overall_quality_status), variant: qualityBadgeVariant(bq.overall_quality_status) }],
  );

  // Limitations panel
  const limFacts: ReportKeyFact[] = [];
  if (blim.missing_precise_address) limFacts.push({ label: "Indirizzo preciso", value: "Mancante" });
  if (blim.missing_civic_link) limFacts.push({ label: "Via/civico", value: "Non introdotto" });
  if (blim.missing_building_registry) limFacts.push({ label: "Registro edifici", value: "Non attivo" });
  if (blim.missing_building_attributes) limFacts.push({ label: "Attributi edificio", value: "Non disponibili" });
  if (blim.missing_unit_level_data) limFacts.push({ label: "Dati unità", value: "Non disponibili" });

  const limitations_panel = sectionOrNull("limitations", "Limiti e trasparenza", rr,
    limFacts, blim.transparency_notes.slice(0, 4), []);

  // Unsupported claims panel
  const unsFacts: ReportKeyFact[] = bb.what_cannot_be_said.slice(0, 6).map(c => ({
    label: c,
    value: "Non supportato",
  }));
  const unsupported_claims_panel = sectionOrNull("unsupported_claims", "Affermazioni non supportate", rr,
    unsFacts,
    [
      `Rischio sovraprecisione: ${bb.overprecision_risk}`,
      `Rischio falsa specificità: ${bb.false_specificity_risk}`,
      ...bb.downgrade_notes,
    ],
    []);

  // Transparency panel
  const transparency_panel = {
    sources: td.territorial_sources.map(s => ({
      label: s.source_label,
      quality: dataQualityLabel(s.source_type),
      level: geoLevelLabel(s.geo_level_supported),
    })),
    fallback_count: bq.fallback_count,
  };

  // Hidden sections
  const hidden_sections: string[] = [];
  for (const [key, val] of Object.entries(rr.sections)) {
    if (!val.can_render) hidden_sections.push(key);
  }

  return {
    header,
    identity_panel,
    localization_panel,
    context_panel,
    supported_facts_panel,
    quality_panel,
    limitations_panel,
    transparency_panel,
    unsupported_claims_panel,
    hidden_sections,
  };
}

/* ═══════════════════════════════════════════════════════════
   CONVENIENCE — Full pipeline
   ═══════════════════════════════════════════════════════════ */

export function buildFullBuildingReport(input: BuildingProfileInput): {
  profile: BuildingProfile;
  viewModel: BuildingReportViewModel;
} {
  const profile = buildBuildingProfile(input);
  const viewModel = buildBuildingReportViewModel(profile, input.territorial_data);
  return { profile, viewModel };
}
