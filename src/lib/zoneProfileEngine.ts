/**
 * Zone Profile Engine — Sottra Phase 3
 *
 * Takes a TerritorialDataResult (Phase 2) and produces a ZoneProfile
 * and TerritorialReportViewModel for UI rendering.
 *
 * Does NOT touch OMI logic. Does NOT introduce vie/civici.
 * Does NOT invent data — weak sections are hidden, not decorated.
 */

import type {
  TerritorialDataResult,
  TerritorialDataQuality,
  DatasetBlock,
  DatasetAvailability,
  OverallQualityStatus,
  TerritorialDatasets,
} from "@/lib/territorialDataBackbone";
import {
  dataQualityLabel,
  isDatasetUsable,
  qualityStatusLabel,
} from "@/lib/territorialDataBackbone";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel, geoLevelRank } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   ZONE PROFILE CONTRACT
   ═══════════════════════════════════════════════════════════ */

export interface ZoneIdentity {
  geo_level: CanonicalGeoLevel;
  geo_code: string;
  geo_label: string;
  normalized_path: string;
  precision_label: string;
  effective_scope_label: string;
}

export type UrbanClassification =
  | "supported"
  | "partially_supported"
  | "not_determinable";

export interface ZonePositioning {
  urban_classification: UrbanClassification;
  centrality_hint: string | null;
  territorial_granularity: CanonicalGeoLevel;
  microzone_presence: boolean;
  asc_presence: boolean;
  section_presence: boolean;
  omi_linkage_status: "direct" | "fallback" | "unavailable";
}

export interface ZoneStructure {
  sub_municipal_support: boolean;
  max_depth: CanonicalGeoLevel;
  admin_structure_available: boolean;
  sections_coverage: DatasetAvailability;
  asc_coverage: DatasetAvailability;
  aggregates_present: boolean;
  hierarchy_quality: "complete" | "partial" | "minimal";
}

export interface ZoneMarketContext {
  omi_linked: boolean;
  omi_link_level: CanonicalGeoLevel | null;
  omi_link_precision: "direct" | "fallback_comune" | "unavailable";
  omi_link_confidence: number;
  market_context_available: boolean;
  market_quality: TerritorialDataQuality;
}

export interface ZoneDataQuality {
  overall_quality_status: OverallQualityStatus;
  officiality_mix: TerritorialDataQuality;
  coverage_strength: "strong" | "moderate" | "weak" | "none";
  explainability_strength: "high" | "medium" | "low";
  fallback_count: number;
  key_warnings: string[];
  confidence_note: string;
}

export interface ZoneLimitations {
  missing_layers: string[];
  downgraded_precision: string[];
  unavailable_sections: string[];
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface ZoneSummary {
  executive_summary: string;
  analytical_summary: string;
  user_facing_summary: string;
  next_best_step: string;
}

export type SectionRenderMode = "full" | "partial" | "hidden";

export interface SectionRenderability {
  can_render: boolean;
  render_mode: SectionRenderMode;
  reason: string;
  source_basis: string | null;
}

export type ZoneReportSectionKey =
  | "territorial_identity"
  | "precision_level"
  | "territorial_structure"
  | "sub_municipal_coverage"
  | "market_context"
  | "data_quality"
  | "limitations";

export interface ReportRenderability {
  sections: Record<ZoneReportSectionKey, SectionRenderability>;
}

export interface ZoneProfile {
  zone_identity: ZoneIdentity;
  zone_positioning: ZonePositioning;
  zone_structure: ZoneStructure;
  zone_market_context: ZoneMarketContext;
  zone_data_quality: ZoneDataQuality;
  zone_limitations: ZoneLimitations;
  zone_summary: ZoneSummary;
  report_renderability: ReportRenderability;
}

/* ═══════════════════════════════════════════════════════════
   TERRITORIAL REPORT VIEW MODEL
   ═══════════════════════════════════════════════════════════ */

export interface ReportBadge {
  label: string;
  variant: "official" | "elaborated" | "partial" | "unavailable" | "info";
  tooltip?: string;
}

export interface ReportKeyFact {
  label: string;
  value: string;
  badge?: ReportBadge;
}

export interface ReportSectionVM {
  key: ZoneReportSectionKey;
  title: string;
  render_mode: SectionRenderMode;
  reason: string;
  facts: ReportKeyFact[];
  notes: string[];
  badges: ReportBadge[];
}

export interface TerritorialReportViewModel {
  header: {
    title: string;
    subtitle: string;
    geo_level_label: string;
    precision_badge: ReportBadge;
  };
  badges: ReportBadge[];
  key_facts: ReportKeyFact[];
  sections: ReportSectionVM[];
  data_quality_footer: {
    status_label: string;
    status_variant: "official" | "elaborated" | "partial" | "unavailable";
    confidence_note: string;
    warnings: string[];
  };
  transparency_panel: {
    sources: Array<{ label: string; quality: string; level: string }>;
    fallback_count: number;
    blocking_gaps: string[];
  };
  unsupported_sections: string[];
}

/* ═══════════════════════════════════════════════════════════
   ENGINE: Build ZoneProfile from TerritorialDataResult
   ═══════════════════════════════════════════════════════════ */

export function buildZoneProfile(data: TerritorialDataResult): ZoneProfile {
  const { territorial_identity: id, territorial_scope: scope, territorial_datasets: ds, territorial_coverage: cov, territorial_quality: qual, territorial_summary: sum } = data;

  const zone_identity: ZoneIdentity = {
    geo_level: id.geo_level,
    geo_code: id.geo_code,
    geo_label: id.geo_label,
    normalized_path: id.normalized_path,
    precision_label: geoLevelLabel(scope.effective_level),
    effective_scope_label: scope.fallback_applied
      ? `${geoLevelLabel(scope.resolved_level)} → ${geoLevelLabel(scope.effective_level)}`
      : geoLevelLabel(scope.effective_level),
  };

  const zone_positioning = buildPositioning(ds, cov, scope);
  const zone_structure = buildStructure(ds, cov, scope);
  const zone_market_context = buildMarketContext(ds);
  const zone_data_quality = buildDataQuality(qual, cov);
  const zone_limitations = buildLimitations(ds, qual, scope);
  const zone_summary = buildSummaryBlock(zone_identity, zone_positioning, zone_data_quality, zone_limitations, sum);
  const report_renderability = computeRenderability(ds, qual, zone_positioning);

  return {
    zone_identity,
    zone_positioning,
    zone_structure,
    zone_market_context,
    zone_data_quality,
    zone_limitations,
    zone_summary,
    report_renderability,
  };
}

/* ═══════════════════════════════════════════════════════════
   INTERNAL BUILDERS
   ═══════════════════════════════════════════════════════════ */

function buildPositioning(
  ds: TerritorialDatasets,
  cov: TerritorialDataResult["territorial_coverage"],
  scope: TerritorialDataResult["territorial_scope"],
): ZonePositioning {
  const hasSections = isDatasetUsable(ds.census_sections);
  const hasAsc = isDatasetUsable(ds.sub_municipal);
  const hasOmi = isDatasetUsable(ds.omi_linkage);

  // Urban classification: only if we have enough signals
  let urban_classification: UrbanClassification = "not_determinable";
  if (hasSections && hasAsc) {
    urban_classification = "supported";
  } else if (hasSections || hasAsc) {
    urban_classification = "partially_supported";
  }

  let omi_linkage_status: "direct" | "fallback" | "unavailable" = "unavailable";
  if (hasOmi) {
    omi_linkage_status = ds.omi_linkage.geo_level === "zona_omi" ? "direct" : "fallback";
  }

  return {
    urban_classification,
    centrality_hint: null, // Not enough signals yet
    territorial_granularity: scope.effective_level,
    microzone_presence: cov.available_levels.includes("zona_omi"),
    asc_presence: hasAsc,
    section_presence: hasSections,
    omi_linkage_status,
  };
}

function buildStructure(
  ds: TerritorialDatasets,
  cov: TerritorialDataResult["territorial_coverage"],
  scope: TerritorialDataResult["territorial_scope"],
): ZoneStructure {
  const hasSections = isDatasetUsable(ds.census_sections);
  const hasAsc = isDatasetUsable(ds.sub_municipal);
  const hasAggregates = ds.sub_municipal.is_derived && isDatasetUsable(ds.sub_municipal);
  const hasStructure = isDatasetUsable(ds.territorial_structure);

  let hierarchy_quality: "complete" | "partial" | "minimal" = "minimal";
  if (hasSections && hasAsc && hasStructure) {
    hierarchy_quality = "complete";
  } else if (hasStructure && (hasSections || hasAsc)) {
    hierarchy_quality = "partial";
  }

  return {
    sub_municipal_support: hasAsc || hasSections,
    max_depth: scope.max_supported_detail,
    admin_structure_available: hasStructure,
    sections_coverage: ds.census_sections.availability,
    asc_coverage: ds.sub_municipal.availability,
    aggregates_present: hasAggregates,
    hierarchy_quality,
  };
}

function buildMarketContext(ds: TerritorialDatasets): ZoneMarketContext {
  const omi = ds.omi_linkage;
  const linked = isDatasetUsable(omi);

  return {
    omi_linked: linked,
    omi_link_level: linked ? omi.geo_level : null,
    omi_link_precision: linked
      ? (omi.geo_level === "zona_omi" ? "direct" : "fallback_comune")
      : "unavailable",
    omi_link_confidence: linked ? 0.85 : 0,
    market_context_available: linked,
    market_quality: linked ? omi.quality : "unavailable",
  };
}

function buildDataQuality(
  qual: TerritorialDataResult["territorial_quality"],
  cov: TerritorialDataResult["territorial_coverage"],
): ZoneDataQuality {
  let coverage_strength: "strong" | "moderate" | "weak" | "none" = "none";
  if (cov.completeness_score >= 0.7) coverage_strength = "strong";
  else if (cov.completeness_score >= 0.4) coverage_strength = "moderate";
  else if (cov.completeness_score > 0) coverage_strength = "weak";

  let explainability: "high" | "medium" | "low" = "low";
  if (qual.data_coherence && qual.warnings.length <= 2) explainability = "high";
  else if (qual.data_coherence) explainability = "medium";

  const confidence_note = qual.overall_status === "strong"
    ? "Base dati solida con fonti ufficiali multiple"
    : qual.overall_status === "adequate"
      ? "Base dati adeguata, alcune limitazioni"
      : qual.overall_status === "limited"
        ? "Copertura limitata, dati parziali"
        : "Dati insufficienti per un'analisi affidabile";

  return {
    overall_quality_status: qual.overall_status,
    officiality_mix: qual.officiality_mix,
    coverage_strength,
    explainability_strength: explainability,
    fallback_count: qual.fallback_count,
    key_warnings: [...qual.warnings],
    confidence_note,
  };
}

function buildLimitations(
  ds: TerritorialDatasets,
  qual: TerritorialDataResult["territorial_quality"],
  scope: TerritorialDataResult["territorial_scope"],
): ZoneLimitations {
  const missing_layers: string[] = [];
  const downgraded_precision: string[] = [];
  const unavailable_sections: string[] = [];
  const transparency_notes: string[] = [];

  const checkBlock = (block: DatasetBlock, name: string) => {
    if (block.availability === "unavailable") {
      missing_layers.push(name);
    } else if (block.availability === "partial") {
      downgraded_precision.push(`${name}: copertura parziale`);
    }
    if (block.is_derived && block.availability !== "unavailable") {
      transparency_notes.push(`${name}: dato derivato, non ufficiale diretto`);
    }
  };

  checkBlock(ds.demographic, "Dati demografici");
  checkBlock(ds.sub_municipal, "Dati sub-comunali");
  checkBlock(ds.omi_linkage, "Collegamento OMI");
  checkBlock(ds.census_sections, "Sezioni censuarie");
  checkBlock(ds.environmental, "Dati ambientali");
  checkBlock(ds.services, "Servizi e POI");
  checkBlock(ds.mobility, "Mobilità");

  if (scope.fallback_applied && scope.fallback_reason) {
    transparency_notes.push(`Fallback applicato: ${scope.fallback_reason}`);
  }

  return {
    missing_layers,
    downgraded_precision,
    unavailable_sections: [...qual.blocking_gaps],
    blocking_gaps: [...qual.blocking_gaps],
    transparency_notes,
  };
}

function buildSummaryBlock(
  identity: ZoneIdentity,
  positioning: ZonePositioning,
  quality: ZoneDataQuality,
  limitations: ZoneLimitations,
  backboneSummary: TerritorialDataResult["territorial_summary"],
): ZoneSummary {
  const executive_summary = `${identity.geo_label}: livello ${identity.precision_label}, qualità ${qualityStatusLabel(quality.overall_quality_status).toLowerCase()}.`;

  const parts: string[] = [];
  parts.push(`Territorio risolto: ${identity.normalized_path}`);
  parts.push(`Profondità massima: ${geoLevelLabel(positioning.territorial_granularity)}`);
  if (positioning.asc_presence) parts.push("Supporto sub-comunale presente");
  if (positioning.section_presence) parts.push("Sezioni censuarie disponibili");
  if (positioning.omi_linkage_status !== "unavailable") {
    parts.push(`OMI: collegamento ${positioning.omi_linkage_status === "direct" ? "diretto" : "via comune"}`);
  }
  if (quality.key_warnings.length > 0) {
    parts.push(`Avvisi: ${quality.key_warnings.length}`);
  }
  const analytical_summary = parts.join(". ") + ".";

  let user_facing_summary: string;
  if (quality.overall_quality_status === "strong") {
    user_facing_summary = `Per ${identity.geo_label} disponiamo di una base dati solida con fonti ufficiali, che permette un'analisi territoriale affidabile.`;
  } else if (quality.overall_quality_status === "adequate") {
    user_facing_summary = `Per ${identity.geo_label} la base dati è adeguata. Alcune informazioni sono disponibili solo a livello aggregato.`;
  } else if (quality.overall_quality_status === "limited") {
    user_facing_summary = `Per ${identity.geo_label} la copertura dati è limitata. L'analisi territoriale è parziale.`;
  } else {
    user_facing_summary = `Per ${identity.geo_label} i dati disponibili sono insufficienti per un profilo zona completo.`;
  }

  const next_best_step = limitations.missing_layers.length > 0
    ? `Dati mancanti: ${limitations.missing_layers.slice(0, 3).join(", ")}. Previsti nelle prossime fasi.`
    : backboneSummary.key_gaps.length > 0
      ? backboneSummary.key_gaps[0]
      : "Profilo pronto per arricchimento edificio (Fase 4).";

  return { executive_summary, analytical_summary, user_facing_summary, next_best_step };
}

/* ═══════════════════════════════════════════════════════════
   RENDERABILITY — "render only if justified"
   ═══════════════════════════════════════════════════════════ */

function computeRenderability(
  ds: TerritorialDatasets,
  qual: TerritorialDataResult["territorial_quality"],
  pos: ZonePositioning,
): ReportRenderability {
  const s = (key: ZoneReportSectionKey, canRender: boolean, mode: SectionRenderMode, reason: string, source: string | null): [ZoneReportSectionKey, SectionRenderability] =>
    [key, { can_render: canRender, render_mode: mode, reason, source_basis: source }];

  const structureUsable = isDatasetUsable(ds.territorial_structure);
  const subMunUsable = isDatasetUsable(ds.sub_municipal);
  const omiUsable = isDatasetUsable(ds.omi_linkage);
  const sectionsUsable = isDatasetUsable(ds.census_sections);
  const demoUsable = isDatasetUsable(ds.demographic);

  const entries: [ZoneReportSectionKey, SectionRenderability][] = [
    // Identity: always show if resolved
    s("territorial_identity", structureUsable, structureUsable ? "full" : "hidden", structureUsable ? "Territorio risolto" : "Territorio non risolto", "territorial_structure"),

    // Precision level: show if resolved
    s("precision_level", structureUsable, structureUsable ? "full" : "hidden", structureUsable ? "Livello determinato" : "Non determinabile", "geo_backbone"),

    // Territorial structure: show if we have sub-municipal or sections
    s("territorial_structure",
      structureUsable && (subMunUsable || sectionsUsable),
      (subMunUsable && sectionsUsable) ? "full" : (subMunUsable || sectionsUsable) ? "partial" : "hidden",
      subMunUsable ? "Struttura sub-comunale disponibile" : sectionsUsable ? "Solo sezioni censuarie" : "Struttura non dettagliata",
      subMunUsable ? ds.sub_municipal.source_key : sectionsUsable ? ds.census_sections.source_key : null,
    ),

    // Sub-municipal coverage: only if truly available
    s("sub_municipal_coverage",
      subMunUsable || demoUsable,
      subMunUsable ? "full" : demoUsable ? "partial" : "hidden",
      subMunUsable ? "Copertura sub-comunale presente" : demoUsable ? "Solo dati demografici aggregati" : "Non disponibile",
      subMunUsable ? ds.sub_municipal.source_key : demoUsable ? ds.demographic.source_key : null,
    ),

    // Market context: only if OMI linked
    s("market_context",
      omiUsable,
      omiUsable ? (pos.omi_linkage_status === "direct" ? "full" : "partial") : "hidden",
      omiUsable ? `OMI collegato (${pos.omi_linkage_status})` : "Nessun collegamento OMI",
      omiUsable ? ds.omi_linkage.source_key : null,
    ),

    // Data quality: always show if anything available
    s("data_quality",
      qual.overall_status !== "insufficient",
      qual.overall_status === "strong" ? "full" : qual.overall_status === "adequate" ? "full" : "partial",
      `Qualità: ${qualityStatusLabel(qual.overall_status)}`,
      null,
    ),

    // Limitations: show if there are real limitations to communicate
    s("limitations",
      qual.warnings.length > 0 || qual.blocking_gaps.length > 0,
      "full",
      qual.blocking_gaps.length > 0 ? "Limiti bloccanti presenti" : "Limiti non bloccanti",
      null,
    ),
  ];

  return {
    sections: Object.fromEntries(entries) as Record<ZoneReportSectionKey, SectionRenderability>,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAPPER: ZoneProfile → TerritorialReportViewModel
   ═══════════════════════════════════════════════════════════ */

function qualityVariant(q: TerritorialDataQuality): ReportBadge["variant"] {
  switch (q) {
    case "official": return "official";
    case "territorial_verified": return "official";
    case "commercial_verified": return "official";
    case "commercial_partial": return "partial";
    case "elaborated": return "elaborated";
    case "unavailable": return "unavailable";
  }
}

function statusVariant(s: OverallQualityStatus): ReportBadge["variant"] {
  switch (s) {
    case "strong": return "official";
    case "adequate": return "elaborated";
    case "limited": return "partial";
    case "insufficient": return "unavailable";
  }
}

export function buildReportViewModel(
  profile: ZoneProfile,
  data: TerritorialDataResult,
): TerritorialReportViewModel {
  const { zone_identity: zi, zone_positioning: zp, zone_structure: zs, zone_market_context: zm, zone_data_quality: zq, zone_limitations: zl } = profile;

  // Header
  const header = {
    title: zi.geo_label,
    subtitle: zi.normalized_path,
    geo_level_label: zi.precision_label,
    precision_badge: {
      label: zi.precision_label,
      variant: geoLevelRank(zi.geo_level) <= geoLevelRank("comune") ? "official" as const : "partial" as const,
      tooltip: zi.effective_scope_label,
    },
  };

  // Top badges
  const badges: ReportBadge[] = [
    { label: qualityStatusLabel(zq.overall_quality_status), variant: statusVariant(zq.overall_quality_status), tooltip: zq.confidence_note },
    { label: dataQualityLabel(zq.officiality_mix), variant: qualityVariant(zq.officiality_mix) },
  ];
  if (zp.omi_linkage_status !== "unavailable") {
    badges.push({ label: "OMI collegato", variant: zp.omi_linkage_status === "direct" ? "official" : "partial" });
  }
  if (zp.section_presence) {
    badges.push({ label: "Sezioni R03", variant: "official" });
  }
  if (zp.asc_presence) {
    badges.push({ label: "Sub-comunale", variant: "elaborated" });
  }

  // Key facts
  const key_facts: ReportKeyFact[] = [
    { label: "Livello", value: zi.precision_label },
    { label: "Copertura", value: `${data.territorial_coverage.available_levels.length} livelli` },
    { label: "Fonti", value: `${data.territorial_sources.length}` },
    { label: "Qualità", value: qualityStatusLabel(zq.overall_quality_status) },
  ];

  // Sections
  const sections: ReportSectionVM[] = [];
  const rr = profile.report_renderability.sections;
  const unsupported: string[] = [];

  // Territorial identity
  if (rr.territorial_identity.can_render) {
    sections.push({
      key: "territorial_identity",
      title: "Identità territoriale",
      render_mode: rr.territorial_identity.render_mode,
      reason: rr.territorial_identity.reason,
      facts: [
        { label: "Territorio", value: zi.geo_label },
        { label: "Percorso", value: zi.normalized_path },
        { label: "Livello effettivo", value: zi.effective_scope_label },
      ],
      notes: [],
      badges: [{ label: zi.precision_label, variant: "info" }],
    });
  } else {
    unsupported.push("Identità territoriale");
  }

  // Precision level
  if (rr.precision_level.can_render) {
    const precFacts: ReportKeyFact[] = [
      { label: "Granularità", value: geoLevelLabel(zp.territorial_granularity) },
      { label: "Gerarchia", value: zs.hierarchy_quality === "complete" ? "Completa" : zs.hierarchy_quality === "partial" ? "Parziale" : "Minima" },
    ];
    if (zp.section_presence) precFacts.push({ label: "Sezioni censuarie", value: "Disponibili" });
    if (zp.asc_presence) precFacts.push({ label: "Aree sub-comunali", value: "Disponibili" });

    sections.push({
      key: "precision_level",
      title: "Livello di precisione",
      render_mode: rr.precision_level.render_mode,
      reason: rr.precision_level.reason,
      facts: precFacts,
      notes: [],
      badges: [],
    });
  } else {
    unsupported.push("Livello di precisione");
  }

  // Territorial structure
  if (rr.territorial_structure.can_render) {
    const structFacts: ReportKeyFact[] = [
      { label: "Profondità massima", value: geoLevelLabel(zs.max_depth) },
      { label: "Sezioni", value: availabilityLabel(zs.sections_coverage) },
      { label: "ASC", value: availabilityLabel(zs.asc_coverage) },
    ];
    if (zs.aggregates_present) structFacts.push({ label: "Aggregati ASC", value: "Presenti" });

    sections.push({
      key: "territorial_structure",
      title: "Struttura territoriale",
      render_mode: rr.territorial_structure.render_mode,
      reason: rr.territorial_structure.reason,
      facts: structFacts,
      notes: rr.territorial_structure.render_mode === "partial" ? ["Copertura sub-comunale parziale"] : [],
      badges: [],
    });
  } else {
    unsupported.push("Struttura territoriale");
  }

  // Sub-municipal coverage
  if (rr.sub_municipal_coverage.can_render) {
    const subFacts: ReportKeyFact[] = [];
    const ds = data.territorial_datasets;
    if (isDatasetUsable(ds.demographic)) {
      subFacts.push({
        label: "Demografico",
        value: ds.demographic.source_label ?? "Disponibile",
        badge: { label: dataQualityLabel(ds.demographic.quality), variant: qualityVariant(ds.demographic.quality) },
      });
    }
    if (isDatasetUsable(ds.sub_municipal)) {
      subFacts.push({
        label: "Sub-comunale",
        value: ds.sub_municipal.source_label ?? "Disponibile",
        badge: { label: dataQualityLabel(ds.sub_municipal.quality), variant: qualityVariant(ds.sub_municipal.quality) },
      });
    }
    if (isDatasetUsable(ds.census_sections)) {
      subFacts.push({
        label: "Sezioni censuarie",
        value: `${ds.census_sections.record_count} record`,
        badge: { label: dataQualityLabel(ds.census_sections.quality), variant: qualityVariant(ds.census_sections.quality) },
      });
    }

    sections.push({
      key: "sub_municipal_coverage",
      title: "Copertura sub-comunale",
      render_mode: rr.sub_municipal_coverage.render_mode,
      reason: rr.sub_municipal_coverage.reason,
      facts: subFacts,
      notes: ds.sub_municipal.note ? [ds.sub_municipal.note] : [],
      badges: [],
    });
  } else {
    unsupported.push("Copertura sub-comunale");
  }

  // Market context
  if (rr.market_context.can_render) {
    const mFacts: ReportKeyFact[] = [
      { label: "OMI", value: zm.omi_linked ? "Collegato" : "Non disponibile" },
    ];
    if (zm.omi_linked && zm.omi_link_level) {
      mFacts.push({ label: "Livello collegamento", value: geoLevelLabel(zm.omi_link_level) });
      mFacts.push({ label: "Precisione", value: zm.omi_link_precision === "direct" ? "Diretto" : "Fallback comunale" });
    }

    sections.push({
      key: "market_context",
      title: "Contesto di mercato",
      render_mode: rr.market_context.render_mode,
      reason: rr.market_context.reason,
      facts: mFacts,
      notes: zm.omi_link_precision === "fallback_comune" ? ["Il collegamento OMI è a livello comunale, non di microzona"] : [],
      badges: [{ label: dataQualityLabel(zm.market_quality), variant: qualityVariant(zm.market_quality) }],
    });
  } else {
    unsupported.push("Contesto di mercato");
  }

  // Data quality
  if (rr.data_quality.can_render) {
    sections.push({
      key: "data_quality",
      title: "Qualità del dato",
      render_mode: rr.data_quality.render_mode,
      reason: rr.data_quality.reason,
      facts: [
        { label: "Stato complessivo", value: qualityStatusLabel(zq.overall_quality_status) },
        { label: "Copertura", value: zq.coverage_strength === "strong" ? "Forte" : zq.coverage_strength === "moderate" ? "Moderata" : zq.coverage_strength === "weak" ? "Debole" : "Assente" },
        { label: "Fallback", value: zq.fallback_count > 0 ? `${zq.fallback_count}` : "Nessuno" },
      ],
      notes: zq.key_warnings.slice(0, 3),
      badges: [{ label: qualityStatusLabel(zq.overall_quality_status), variant: statusVariant(zq.overall_quality_status) }],
    });
  }

  // Limitations
  if (rr.limitations.can_render) {
    const limFacts: ReportKeyFact[] = [];
    if (zl.missing_layers.length > 0) {
      limFacts.push({ label: "Layer mancanti", value: zl.missing_layers.join(", ") });
    }
    if (zl.blocking_gaps.length > 0) {
      limFacts.push({ label: "Blocchi critici", value: zl.blocking_gaps.join(", ") });
    }

    sections.push({
      key: "limitations",
      title: "Limiti e trasparenza",
      render_mode: rr.limitations.render_mode,
      reason: rr.limitations.reason,
      facts: limFacts,
      notes: [...zl.transparency_notes, ...zl.downgraded_precision].slice(0, 5),
      badges: [],
    });
  }

  // Footer
  const data_quality_footer = {
    status_label: qualityStatusLabel(zq.overall_quality_status),
    status_variant: statusVariant(zq.overall_quality_status) as "official" | "elaborated" | "partial" | "unavailable",
    confidence_note: zq.confidence_note,
    warnings: zq.key_warnings,
  };

  // Transparency panel
  const transparency_panel = {
    sources: data.territorial_sources.map(s => ({
      label: s.source_label,
      quality: dataQualityLabel(s.source_type),
      level: geoLevelLabel(s.geo_level_supported),
    })),
    fallback_count: zq.fallback_count,
    blocking_gaps: zl.blocking_gaps,
  };

  return {
    header,
    badges,
    key_facts,
    sections,
    data_quality_footer,
    transparency_panel,
    unsupported_sections: unsupported,
  };
}

/* ═══════════════════════════════════════════════════════════
   CONVENIENCE
   ═══════════════════════════════════════════════════════════ */

function availabilityLabel(a: DatasetAvailability): string {
  switch (a) {
    case "available": return "Disponibile";
    case "partial": return "Parziale";
    case "unavailable": return "Non disponibile";
    case "not_applicable": return "Non applicabile";
  }
}

/**
 * Full pipeline: TerritorialDataResult → ZoneProfile → ReportViewModel
 */
export function buildTerritorialReport(data: TerritorialDataResult): {
  profile: ZoneProfile;
  viewModel: TerritorialReportViewModel;
} {
  const profile = buildZoneProfile(data);
  const viewModel = buildReportViewModel(profile, data);
  return { profile, viewModel };
}
