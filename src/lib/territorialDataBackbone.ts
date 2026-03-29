/**
 * Territorial Data Backbone — Sottra Phase 2
 *
 * Central data layer that sits on top of the Geo Backbone (Phase 1).
 * Given a resolved territory, queries available data sources and returns
 * a unified, typed contract with coverage, quality, and source classification.
 *
 * Does NOT touch OMI logic. Does NOT introduce vie/civici.
 * Does NOT invent data — unavailable slots are explicitly marked.
 */

import {
  type GeoBackboneResult,
  type GeoIdentity,
  type GeoHierarchyNode,
  type CanonicalGeoLevel,
  type GeoSourceSystem,
  type GeoDataQuality,
  type CoverageStatus,
  type DbCoverageData,
  resolveFromInput,
  enrichWithCoverage,
  normalizedPath,
  geoLevelRank,
  geoLevelLabel,
  type GeoResolverInput,
} from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   DATA QUALITY TAXONOMY — Single source of truth
   ═══════════════════════════════════════════════════════════ */

/**
 * Unified data quality classification.
 * Maps cleanly to DataBadge tiers and sourceResolver tiers.
 */
export type TerritorialDataQuality =
  | "official"            // Institutional source (ISTAT, OMI, catasto)
  | "territorial_verified" // Verified geospatial (OSM, geocoding)
  | "commercial_verified"  // Verified commercial source
  | "commercial_partial"   // Partial commercial coverage
  | "elaborated"           // Derived/computed from official sources
  | "unavailable";         // No data

const DATA_QUALITY_RANK: Record<TerritorialDataQuality, number> = {
  official: 0,
  territorial_verified: 1,
  commercial_verified: 2,
  commercial_partial: 3,
  elaborated: 4,
  unavailable: 99,
};

const DATA_QUALITY_LABELS: Record<TerritorialDataQuality, string> = {
  official: "Dato ufficiale",
  territorial_verified: "Dato geo verificato",
  commercial_verified: "Mercato verificato",
  commercial_partial: "Mercato parziale",
  elaborated: "Dato elaborato",
  unavailable: "Non disponibile",
};

export function dataQualityLabel(q: TerritorialDataQuality): string {
  return DATA_QUALITY_LABELS[q];
}

export function isQualityBetterOrEqual(a: TerritorialDataQuality, b: TerritorialDataQuality): boolean {
  return DATA_QUALITY_RANK[a] <= DATA_QUALITY_RANK[b];
}

/* ═══════════════════════════════════════════════════════════
   TERRITORIAL DATA CONTRACT
   ═══════════════════════════════════════════════════════════ */

// ── Identity (from geo backbone) ──

export interface TerritorialIdentity {
  geo_level: CanonicalGeoLevel;
  geo_code: string;
  geo_label: string;
  normalized_path: string;
  parent_chain: GeoHierarchyNode[];
}

// ── Scope ──

export interface TerritorialScope {
  /** Level originally requested */
  requested_level: CanonicalGeoLevel | null;
  /** Level resolved by geo backbone */
  resolved_level: CanonicalGeoLevel;
  /** Effective level for data (may differ if data is coarser) */
  effective_level: CanonicalGeoLevel;
  /** Finest detail available in the backbone */
  max_supported_detail: CanonicalGeoLevel;
  /** Whether a fallback was applied */
  fallback_applied: boolean;
  /** Reason for fallback */
  fallback_reason: string | null;
}

// ── Source Entry ──

export interface TerritorialSourceEntry {
  source_key: string;
  source_label: string;
  source_type: TerritorialDataQuality;
  is_official: boolean;
  geo_level_supported: CanonicalGeoLevel;
  coverage_status: CoverageStatus;
  freshness: string | null;
  matched_by: string;
  record_count: number;
  warnings: string[];
}

// ── Dataset Families ──

export type DatasetAvailability = "available" | "partial" | "unavailable" | "not_applicable";

export interface DatasetBlock {
  availability: DatasetAvailability;
  quality: TerritorialDataQuality;
  geo_level: CanonicalGeoLevel;
  record_count: number;
  source_key: string | null;
  source_label: string | null;
  is_official: boolean;
  is_derived: boolean;
  note: string | null;
}

function emptyDatasetBlock(): DatasetBlock {
  return {
    availability: "unavailable",
    quality: "unavailable",
    geo_level: "non_determinato",
    record_count: 0,
    source_key: null,
    source_label: null,
    is_official: false,
    is_derived: false,
    note: null,
  };
}

export interface TerritorialDatasets {
  /** Demographic data (population, families, etc.) */
  demographic: DatasetBlock;
  /** Territorial structure (comuni, province, regioni) */
  territorial_structure: DatasetBlock;
  /** Sub-municipal enrichment (ASC, R03 aggregates) */
  sub_municipal: DatasetBlock;
  /** OMI linkage (reference only, not OMI data itself) */
  omi_linkage: DatasetBlock;
  /** Census sections (R03) */
  census_sections: DatasetBlock;
  /** Placeholder for future environmental data */
  environmental: DatasetBlock;
  /** Placeholder for future services/POI data */
  services: DatasetBlock;
  /** Placeholder for future mobility data */
  mobility: DatasetBlock;
}

// ── Coverage Matrix ──

export interface CoverageMatrixEntry {
  level: CanonicalGeoLevel;
  level_label: string;
  has_data: boolean;
  quality: TerritorialDataQuality;
  source_count: number;
  official_source_count: number;
  derived_source_count: number;
  datasets_available: string[];
}

export interface TerritorialCoverage {
  /** Levels where real data exists */
  available_levels: CanonicalGeoLevel[];
  /** Levels with no data */
  unavailable_levels: CanonicalGeoLevel[];
  /** Levels backed by at least one source */
  source_backed_levels: CanonicalGeoLevel[];
  /** Levels with only derived data */
  derived_levels: CanonicalGeoLevel[];
  /** Precision score [0-1] */
  precision_score: number;
  /** Completeness score [0-1] */
  completeness_score: number;
  /** Coverage matrix by level */
  matrix: CoverageMatrixEntry[];
}

// ── Quality ──

export type OverallQualityStatus = "strong" | "adequate" | "limited" | "insufficient";

export interface TerritorialQuality {
  overall_status: OverallQualityStatus;
  data_coherence: boolean;
  officiality_mix: TerritorialDataQuality;
  fallback_count: number;
  warnings: string[];
  blocking_gaps: string[];
}

// ── Summary ──

export interface TerritorialSummary {
  /** Short human-readable summary */
  short_summary: string;
  /** Structured summary by level */
  by_level: Array<{ level: CanonicalGeoLevel; label: string; summary: string }>;
  /** Key gaps for next phases */
  key_gaps: string[];
}

// ── Full Contract ──

export interface TerritorialDataResult {
  territorial_identity: TerritorialIdentity;
  territorial_scope: TerritorialScope;
  territorial_sources: TerritorialSourceEntry[];
  territorial_datasets: TerritorialDatasets;
  territorial_coverage: TerritorialCoverage;
  territorial_quality: TerritorialQuality;
  territorial_summary: TerritorialSummary;
  /** Underlying geo backbone result */
  geo_backbone: GeoBackboneResult;
}

/* ═══════════════════════════════════════════════════════════
   RESOLVER INPUT
   ═══════════════════════════════════════════════════════════ */

export interface TerritorialResolverInput {
  /** Pre-resolved geo backbone result, or raw input to resolve first */
  geo_result?: GeoBackboneResult;
  /** Raw geo input (used if geo_result not provided) */
  geo_input?: GeoResolverInput;
  /** DB coverage data (pre-fetched counts) */
  db_coverage?: DbCoverageData;
  /** Requested detail level */
  requested_level?: CanonicalGeoLevel;
  /** Include placeholder blocks for future datasets */
  include_placeholders?: boolean;
}

/* ═══════════════════════════════════════════════════════════
   CENTRAL RESOLVER
   ═══════════════════════════════════════════════════════════ */

/**
 * Central resolver for territorial data.
 * Takes a geo-resolved territory and returns the full data contract.
 *
 * Rules:
 * - Never promotes derived data to official
 * - Never claims finer precision than reality
 * - Every block states its actual level and quality
 * - Unavailable blocks are explicit, not hidden
 */
export function resolveTerritorialData(input: TerritorialResolverInput): TerritorialDataResult {
  // Step 1: Resolve geography
  let geo: GeoBackboneResult;
  if (input.geo_result) {
    geo = input.geo_result;
  } else if (input.geo_input) {
    geo = resolveFromInput(input.geo_input);
  } else {
    geo = resolveFromInput({});
  }

  // Step 2: Enrich with DB coverage if provided
  if (input.db_coverage) {
    geo = enrichWithCoverage(geo, input.db_coverage);
  }

  const identity = geo.geo_identity;
  const hierarchy = geo.geo_hierarchy;
  const coverage = geo.geo_coverage;

  // Step 3: Build territorial identity
  const territorial_identity: TerritorialIdentity = {
    geo_level: identity.geo_level,
    geo_code: identity.geo_code,
    geo_label: identity.geo_label,
    normalized_path: normalizedPath(hierarchy),
    parent_chain: hierarchy.chain,
  };

  // Step 4: Build scope
  const resolved_level = identity.geo_level;
  const effective_level = coverage.max_depth !== "non_determinato" ? coverage.max_depth : resolved_level;
  const territorial_scope: TerritorialScope = {
    requested_level: input.requested_level ?? null,
    resolved_level,
    effective_level,
    max_supported_detail: coverage.max_depth,
    fallback_applied: !!geo.geo_resolution.fallback_used,
    fallback_reason: geo.geo_resolution.fallback_reason,
  };

  // Step 5: Build sources list
  const sources: TerritorialSourceEntry[] = [];

  if (coverage.sezioni_r03.status === "available") {
    sources.push({
      source_key: "census_r03_2021",
      source_label: "ISTAT Censimento 2021 — Sezioni",
      source_type: "official",
      is_official: true,
      geo_level_supported: "sezione_censuaria",
      coverage_status: "available",
      freshness: "2021",
      matched_by: "comune_istat_code",
      record_count: coverage.sezioni_r03.record_count,
      warnings: [],
    });
  }

  if (coverage.asc_areas.status === "available") {
    sources.push({
      source_key: "asc_2021",
      source_label: "ISTAT ASC 2021 — Aree Sub-Comunali",
      source_type: "official",
      is_official: true,
      geo_level_supported: "sub_comunale",
      coverage_status: "available",
      freshness: "2021",
      matched_by: "comune_istat_code",
      record_count: coverage.asc_areas.record_count,
      warnings: [],
    });
  }

  if (coverage.aggregati_r03.status === "available") {
    sources.push({
      source_key: "r03_asc_aggregates",
      source_label: "Aggregati R03 → ASC",
      source_type: "elaborated",
      is_official: false,
      geo_level_supported: "sub_comunale",
      coverage_status: "available",
      freshness: "2021",
      matched_by: "comune_istat_code",
      record_count: coverage.aggregati_r03.record_count,
      warnings: ["Dato derivato da aggregazione sezioni censuarie"],
    });
  }

  if (coverage.zona_omi.status === "available") {
    sources.push({
      source_key: "omi_quotazioni",
      source_label: "OMI — Quotazioni Immobiliari",
      source_type: "official",
      is_official: true,
      geo_level_supported: "zona_omi",
      coverage_status: "available",
      freshness: null,
      matched_by: "codice_catastale",
      record_count: coverage.zona_omi.record_count,
      warnings: [],
    });
  }

  // Always add territorial_registry as backbone source
  if (identity.geo_level !== "non_determinato" && identity.geo_level !== "nazionale") {
    sources.push({
      source_key: "territorial_registry",
      source_label: "Registro Territoriale ISTAT",
      source_type: "official",
      is_official: true,
      geo_level_supported: identity.geo_level,
      coverage_status: geo.geo_resolution.resolved ? "available" : "unavailable",
      freshness: null,
      matched_by: geo.geo_resolution.match_method,
      record_count: geo.geo_resolution.resolved ? 1 : 0,
      warnings: [...geo.geo_resolution.warnings],
    });
  }

  // Step 6: Build dataset blocks
  const datasets: TerritorialDatasets = {
    demographic: buildDemographicBlock(coverage, sources),
    territorial_structure: buildTerritorialStructureBlock(identity, geo),
    sub_municipal: buildSubMunicipalBlock(coverage, sources),
    omi_linkage: buildOmiLinkageBlock(coverage),
    census_sections: buildCensusSectionsBlock(coverage),
    environmental: emptyDatasetBlock(),
    services: emptyDatasetBlock(),
    mobility: emptyDatasetBlock(),
  };

  // Mark placeholders
  if (input.include_placeholders !== false) {
    datasets.environmental.note = "Predisposto per fase futura";
    datasets.services.note = "Predisposto per fase futura";
    datasets.mobility.note = "Predisposto per fase futura";
  }

  // Step 7: Build coverage matrix
  const territorial_coverage = buildCoverageMatrix(coverage, datasets, resolved_level);

  // Step 8: Build quality assessment
  const territorial_quality = assessQuality(sources, datasets, geo);

  // Step 9: Build summary
  const territorial_summary = buildSummary(territorial_identity, territorial_scope, territorial_coverage, territorial_quality);

  return {
    territorial_identity,
    territorial_scope,
    territorial_sources: sources,
    territorial_datasets: datasets,
    territorial_coverage,
    territorial_quality,
    territorial_summary,
    geo_backbone: geo,
  };
}

/* ═══════════════════════════════════════════════════════════
   DATASET BLOCK BUILDERS
   ═══════════════════════════════════════════════════════════ */

function buildDemographicBlock(
  coverage: GeoBackboneResult["geo_coverage"],
  sources: TerritorialSourceEntry[],
): DatasetBlock {
  // Demographic data comes from R03 aggregates (sub-municipal) or census sections
  const hasAggregates = coverage.aggregati_r03.status === "available";
  const hasSections = coverage.sezioni_r03.status === "available";

  if (hasAggregates) {
    return {
      availability: "available",
      quality: "elaborated",
      geo_level: "sub_comunale",
      record_count: coverage.aggregati_r03.record_count,
      source_key: "r03_asc_aggregates",
      source_label: "Aggregati R03 → ASC (pop., famiglie, edifici)",
      is_official: false,
      is_derived: true,
      note: "Dati demografici aggregati dalle sezioni censuarie verso le aree sub-comunali",
    };
  }

  if (hasSections) {
    return {
      availability: "available",
      quality: "official",
      geo_level: "sezione_censuaria",
      record_count: coverage.sezioni_r03.record_count,
      source_key: "census_r03_2021",
      source_label: "ISTAT Censimento 2021 — Sezioni",
      is_official: true,
      is_derived: false,
      note: "Dati censuari grezzi a livello sezione",
    };
  }

  return emptyDatasetBlock();
}

function buildTerritorialStructureBlock(
  identity: GeoIdentity,
  geo: GeoBackboneResult,
): DatasetBlock {
  if (!geo.geo_resolution.resolved || identity.geo_level === "non_determinato") {
    return emptyDatasetBlock();
  }

  return {
    availability: "available",
    quality: identity.is_official ? "official" : "elaborated",
    geo_level: identity.geo_level,
    record_count: 1,
    source_key: "territorial_registry",
    source_label: "Registro Territoriale ISTAT",
    is_official: identity.is_official,
    is_derived: identity.is_derived,
    note: null,
  };
}

function buildSubMunicipalBlock(
  coverage: GeoBackboneResult["geo_coverage"],
  _sources: TerritorialSourceEntry[],
): DatasetBlock {
  const hasAsc = coverage.asc_areas.status === "available";
  const hasAggregates = coverage.aggregati_r03.status === "available";

  if (hasAsc && hasAggregates) {
    return {
      availability: "available",
      quality: "elaborated",
      geo_level: "sub_comunale",
      record_count: coverage.asc_areas.record_count + coverage.aggregati_r03.record_count,
      source_key: "asc_2021+r03_aggregates",
      source_label: "ASC 2021 + Aggregati R03",
      is_official: false,
      is_derived: true,
      note: "Layer ASC con arricchimento statistico da aggregazione R03",
    };
  }

  if (hasAsc) {
    return {
      availability: "partial",
      quality: "official",
      geo_level: "sub_comunale",
      record_count: coverage.asc_areas.record_count,
      source_key: "asc_2021",
      source_label: "ISTAT ASC 2021",
      is_official: true,
      is_derived: false,
      note: "Layer ASC senza arricchimento statistico",
    };
  }

  return emptyDatasetBlock();
}

function buildOmiLinkageBlock(
  coverage: GeoBackboneResult["geo_coverage"],
): DatasetBlock {
  if (coverage.zona_omi.status === "available") {
    return {
      availability: "available",
      quality: "official",
      geo_level: "zona_omi",
      record_count: coverage.zona_omi.record_count,
      source_key: "omi_quotazioni",
      source_label: "OMI — Quotazioni (riferimento)",
      is_official: true,
      is_derived: false,
      note: "Linkage di riferimento — il motore OMI non è alterato",
    };
  }

  return {
    ...emptyDatasetBlock(),
    note: "Nessuna quotazione OMI agganciabile per questo territorio",
  };
}

function buildCensusSectionsBlock(
  coverage: GeoBackboneResult["geo_coverage"],
): DatasetBlock {
  if (coverage.sezioni_r03.status === "available") {
    return {
      availability: "available",
      quality: "official",
      geo_level: "sezione_censuaria",
      record_count: coverage.sezioni_r03.record_count,
      source_key: "census_r03_2021",
      source_label: "ISTAT Censimento 2021 — Sezioni",
      is_official: true,
      is_derived: false,
      note: null,
    };
  }

  return emptyDatasetBlock();
}

/* ═══════════════════════════════════════════════════════════
   COVERAGE MATRIX BUILDER
   ═══════════════════════════════════════════════════════════ */

const COVERAGE_LEVELS: CanonicalGeoLevel[] = [
  "sezione_censuaria", "zona_omi", "sub_comunale", "localita",
  "comune", "provincia", "regione", "macrozona", "nazionale",
];

function buildCoverageMatrix(
  coverage: GeoBackboneResult["geo_coverage"],
  datasets: TerritorialDatasets,
  resolvedLevel: CanonicalGeoLevel,
): TerritorialCoverage {
  const matrix: CoverageMatrixEntry[] = [];
  const available_levels: CanonicalGeoLevel[] = [];
  const unavailable_levels: CanonicalGeoLevel[] = [];
  const source_backed_levels: CanonicalGeoLevel[] = [];
  const derived_levels: CanonicalGeoLevel[] = [];

  for (const level of COVERAGE_LEVELS) {
    const entry = buildMatrixEntry(level, coverage, datasets, resolvedLevel);
    matrix.push(entry);

    if (entry.has_data) {
      available_levels.push(level);
      if (entry.official_source_count > 0) {
        source_backed_levels.push(level);
      }
      if (entry.derived_source_count > 0 && entry.official_source_count === 0) {
        derived_levels.push(level);
      }
    } else {
      unavailable_levels.push(level);
    }
  }

  // Precision = how fine we can go (0 = sezione, 1 = nazionale)
  const resolvedRank = geoLevelRank(resolvedLevel);
  const maxRank = 8; // nazionale rank
  const precision_score = Math.max(0, 1 - (resolvedRank / maxRank));

  // Completeness = how many dataset families have data
  const familyBlocks = [
    datasets.demographic, datasets.territorial_structure,
    datasets.sub_municipal, datasets.omi_linkage, datasets.census_sections,
  ];
  const availableCount = familyBlocks.filter(b => b.availability !== "unavailable").length;
  const completeness_score = availableCount / familyBlocks.length;

  return {
    available_levels,
    unavailable_levels,
    source_backed_levels,
    derived_levels,
    precision_score,
    completeness_score,
    matrix,
  };
}

function buildMatrixEntry(
  level: CanonicalGeoLevel,
  coverage: GeoBackboneResult["geo_coverage"],
  datasets: TerritorialDatasets,
  resolvedLevel: CanonicalGeoLevel,
): CoverageMatrixEntry {
  const datasets_available: string[] = [];
  let official = 0;
  let derived = 0;
  let bestQuality: TerritorialDataQuality = "unavailable";

  // Check each dataset against the level
  if (level === "sezione_censuaria" && coverage.sezioni_r03.status === "available") {
    datasets_available.push("census_sections");
    official++;
    bestQuality = "official";
  }
  if (level === "zona_omi" && coverage.zona_omi.status === "available") {
    datasets_available.push("omi_linkage");
    official++;
    if (isQualityBetterOrEqual("official", bestQuality)) bestQuality = "official";
  }
  if (level === "sub_comunale") {
    if (coverage.asc_areas.status === "available") {
      datasets_available.push("asc_areas");
      official++;
      if (isQualityBetterOrEqual("official", bestQuality)) bestQuality = "official";
    }
    if (coverage.aggregati_r03.status === "available") {
      datasets_available.push("r03_aggregates");
      derived++;
      if (bestQuality === "unavailable") bestQuality = "elaborated";
    }
  }
  if (level === "comune" && geoLevelRank(resolvedLevel) <= geoLevelRank("comune")) {
    datasets_available.push("territorial_structure");
    official++;
    if (isQualityBetterOrEqual("official", bestQuality)) bestQuality = "official";
  }
  // Regione, macrozona, nazionale are always structurally available if resolved
  if (
    (level === "regione" || level === "macrozona" || level === "nazionale") &&
    geoLevelRank(resolvedLevel) <= geoLevelRank(level)
  ) {
    datasets_available.push("territorial_structure");
    official++;
    if (isQualityBetterOrEqual("official", bestQuality)) bestQuality = "official";
  }

  return {
    level,
    level_label: geoLevelLabel(level),
    has_data: datasets_available.length > 0,
    quality: bestQuality,
    source_count: official + derived,
    official_source_count: official,
    derived_source_count: derived,
    datasets_available,
  };
}

/* ═══════════════════════════════════════════════════════════
   QUALITY ASSESSMENT
   ═══════════════════════════════════════════════════════════ */

function assessQuality(
  sources: TerritorialSourceEntry[],
  datasets: TerritorialDatasets,
  geo: GeoBackboneResult,
): TerritorialQuality {
  const warnings: string[] = [...geo.geo_resolution.warnings];
  const blocking_gaps: string[] = [];
  let fallback_count = 0;

  if (geo.geo_resolution.fallback_used) fallback_count++;

  // Check for derived-only scenarios
  const officialSources = sources.filter(s => s.is_official);
  const derivedSources = sources.filter(s => s.source_type === "elaborated");

  // Determine best quality across all datasets
  const allBlocks = [
    datasets.demographic, datasets.territorial_structure,
    datasets.sub_municipal, datasets.omi_linkage, datasets.census_sections,
  ];
  const availableBlocks = allBlocks.filter(b => b.availability !== "unavailable");

  let officiality_mix: TerritorialDataQuality = "unavailable";
  for (const b of availableBlocks) {
    if (isQualityBetterOrEqual(b.quality, officiality_mix)) {
      officiality_mix = b.quality;
    }
  }

  // Warnings for gaps
  if (datasets.demographic.availability === "unavailable") {
    warnings.push("Nessun dato demografico disponibile");
  }
  if (datasets.sub_municipal.availability === "unavailable") {
    warnings.push("Nessun dato sub-comunale disponibile");
  }
  if (datasets.omi_linkage.availability === "unavailable") {
    warnings.push("Nessun collegamento OMI disponibile");
  }

  // Blocking gaps
  if (!geo.geo_resolution.resolved) {
    blocking_gaps.push("Territorio non risolto");
  }
  if (availableBlocks.length === 0) {
    blocking_gaps.push("Nessun dataset disponibile");
  }

  // Coherence: do we have structure + at least one data source?
  const data_coherence = datasets.territorial_structure.availability !== "unavailable" &&
    availableBlocks.length >= 2;

  // Overall status
  let overall_status: OverallQualityStatus;
  if (blocking_gaps.length > 0) {
    overall_status = "insufficient";
  } else if (officialSources.length >= 2 && availableBlocks.length >= 3) {
    overall_status = "strong";
  } else if (officialSources.length >= 1 && availableBlocks.length >= 2) {
    overall_status = "adequate";
  } else {
    overall_status = "limited";
  }

  return {
    overall_status,
    data_coherence,
    officiality_mix,
    fallback_count,
    warnings,
    blocking_gaps,
  };
}

/* ═══════════════════════════════════════════════════════════
   SUMMARY BUILDER
   ═══════════════════════════════════════════════════════════ */

function buildSummary(
  identity: TerritorialIdentity,
  scope: TerritorialScope,
  coverage: TerritorialCoverage,
  quality: TerritorialQuality,
): TerritorialSummary {
  const parts: string[] = [];
  parts.push(`${identity.geo_label} (${geoLevelLabel(identity.geo_level)})`);

  if (scope.fallback_applied) {
    parts.push(`fallback da ${geoLevelLabel(scope.resolved_level)}`);
  }

  parts.push(`${coverage.available_levels.length} livelli con dati`);
  parts.push(`qualità: ${quality.overall_status}`);

  const short_summary = parts.join(" — ");

  const by_level = coverage.matrix
    .filter(m => m.has_data)
    .map(m => ({
      level: m.level,
      label: m.level_label,
      summary: `${m.datasets_available.length} dataset${m.official_source_count > 0 ? " (ufficiale)" : m.derived_source_count > 0 ? " (derivato)" : ""}`,
    }));

  const key_gaps: string[] = [];
  if (!coverage.available_levels.includes("sub_comunale")) {
    key_gaps.push("Sub-comunale non disponibile");
  }
  if (!coverage.available_levels.includes("sezione_censuaria")) {
    key_gaps.push("Sezioni censuarie non disponibili");
  }
  if (quality.blocking_gaps.length > 0) {
    key_gaps.push(...quality.blocking_gaps);
  }

  return { short_summary, by_level, key_gaps };
}

/* ═══════════════════════════════════════════════════════════
   CONVENIENCE EXPORTS
   ═══════════════════════════════════════════════════════════ */

/**
 * Quick check: is a dataset family usable for report rendering?
 */
export function isDatasetUsable(block: DatasetBlock): boolean {
  return block.availability === "available" || block.availability === "partial";
}

/**
 * Returns the best quality available across all datasets.
 */
export function bestAvailableQuality(datasets: TerritorialDatasets): TerritorialDataQuality {
  const all = [
    datasets.demographic, datasets.territorial_structure,
    datasets.sub_municipal, datasets.omi_linkage, datasets.census_sections,
  ];
  let best: TerritorialDataQuality = "unavailable";
  for (const b of all) {
    if (b.availability !== "unavailable" && isQualityBetterOrEqual(b.quality, best)) {
      best = b.quality;
    }
  }
  return best;
}

/**
 * Returns the coverage status badge text for admin display.
 */
export function qualityStatusLabel(status: OverallQualityStatus): string {
  switch (status) {
    case "strong": return "Solido";
    case "adequate": return "Adeguato";
    case "limited": return "Limitato";
    case "insufficient": return "Insufficiente";
  }
}

export function qualityStatusColor(status: OverallQualityStatus): string {
  switch (status) {
    case "strong": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "adequate": return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "limited": return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "insufficient": return "bg-destructive/10 text-destructive";
  }
}
