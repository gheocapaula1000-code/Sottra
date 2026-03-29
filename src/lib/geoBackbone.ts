/**
 * Geo Backbone — Sottra
 *
 * Canonical geographic identity, hierarchy, resolution, and coverage.
 * Single source of truth for geographic structure across the entire system.
 *
 * Does NOT touch OMI logic. Does NOT introduce vie/civici.
 */

import {
  MACROZONE_DEFINITIONS,
  getMacrozoneByRegionCode,
  getMacrozoneByRegionName,
  type MacrozoneCode,
  type MacrozoneMatch,
} from "@/lib/macrozoneRegistry";

/* ═══════════════════════════════════════════════════════════
   CANONICAL GEO LEVEL
   ═══════════════════════════════════════════════════════════ */

/**
 * Canonical geographic levels, from finest to coarsest.
 * This is the ONLY geo-level enum to use across the system.
 */
export type CanonicalGeoLevel =
  | "sezione_censuaria"  // ISTAT census section (finest)
  | "zona_omi"           // OMI microzone (reference only, no OMI logic touched)
  | "sub_comunale"       // ASC area
  | "localita"           // ISTAT locality
  | "comune"             // municipality
  | "provincia"          // province
  | "regione"            // region
  | "macrozona"          // 5 macro-areas
  | "nazionale"          // Italy
  | "non_determinato";   // unknown

/** Rank: lower = finer */
const GEO_LEVEL_RANK: Record<CanonicalGeoLevel, number> = {
  sezione_censuaria: 0,
  zona_omi: 1,
  sub_comunale: 2,
  localita: 3,
  comune: 4,
  provincia: 5,
  regione: 6,
  macrozona: 7,
  nazionale: 8,
  non_determinato: 99,
};

const GEO_LEVEL_LABELS: Record<CanonicalGeoLevel, string> = {
  sezione_censuaria: "Sezione censuaria",
  zona_omi: "Zona OMI",
  sub_comunale: "Area sub-comunale (ASC)",
  localita: "Località",
  comune: "Comune",
  provincia: "Provincia",
  regione: "Regione",
  macrozona: "Macrozona",
  nazionale: "Nazionale",
  non_determinato: "Non determinato",
};

export function geoLevelRank(level: CanonicalGeoLevel): number {
  return GEO_LEVEL_RANK[level];
}

export function geoLevelLabel(level: CanonicalGeoLevel): string {
  return GEO_LEVEL_LABELS[level];
}

export function isGeoLevelFinerOrEqual(a: CanonicalGeoLevel, b: CanonicalGeoLevel): boolean {
  return GEO_LEVEL_RANK[a] <= GEO_LEVEL_RANK[b];
}

export function finerOf(a: CanonicalGeoLevel, b: CanonicalGeoLevel): CanonicalGeoLevel {
  return GEO_LEVEL_RANK[a] <= GEO_LEVEL_RANK[b] ? a : b;
}

export function coarserOf(a: CanonicalGeoLevel, b: CanonicalGeoLevel): CanonicalGeoLevel {
  return GEO_LEVEL_RANK[a] >= GEO_LEVEL_RANK[b] ? a : b;
}

/* ═══════════════════════════════════════════════════════════
   SOURCE SYSTEM
   ═══════════════════════════════════════════════════════════ */

export type GeoSourceSystem =
  | "istat"           // ISTAT official data
  | "asc"             // ISTAT ASC sub-municipal
  | "r03"             // R03 census sections
  | "omi"             // OMI (reference only)
  | "territorial_registry" // Backbone registry
  | "derived"         // Computed/aggregated
  | "unknown";

export type GeoDataQuality =
  | "official"        // Institutional/government data
  | "verified"        // Verified by cross-referencing
  | "derived"         // Computed from official sources
  | "unavailable";    // No data

/* ═══════════════════════════════════════════════════════════
   GEO IDENTITY — "What place is this?"
   ═══════════════════════════════════════════════════════════ */

export interface GeoIdentity {
  /** Canonical geographic level */
  geo_level: CanonicalGeoLevel;
  /** Canonical code (ISTAT code, ASC code, section code, etc.) */
  geo_code: string;
  /** Human-readable label */
  geo_label: string;
  /** Parent code (e.g., comune_istat_code for a locality) */
  parent_geo_code: string | null;
  /** ISTAT municipality code when applicable */
  comune_istat_code: string | null;
  /** Province code when applicable */
  provincia_code: string | null;
  /** Region code when applicable */
  regione_code: string | null;
  /** Source system that provided this identity */
  source_system: GeoSourceSystem;
  /** Whether this is an official/institutional record */
  is_official: boolean;
  /** Whether this identity was derived (e.g., via fallback) */
  is_derived: boolean;
}

/* ═══════════════════════════════════════════════════════════
   GEO HIERARCHY — "What's above and below?"
   ═══════════════════════════════════════════════════════════ */

export interface GeoHierarchyNode {
  level: CanonicalGeoLevel;
  code: string;
  label: string;
  source_system: GeoSourceSystem;
}

export interface GeoHierarchy {
  /** Full chain from finest resolved to nazionale */
  chain: GeoHierarchyNode[];
  /** Deepest level in the chain */
  deepest_level: CanonicalGeoLevel;
  /** Whether children (finer levels) are available */
  children_available: {
    sezione_censuaria: boolean;
    sub_comunale: boolean;
    localita: boolean;
  };
}

/* ═══════════════════════════════════════════════════════════
   GEO RESOLUTION — "How did we get here?"
   ═══════════════════════════════════════════════════════════ */

export type MatchMethod =
  | "exact_code"        // Direct code lookup
  | "polygon"           // Point-in-polygon
  | "name_match"        // Fuzzy name matching
  | "parent_lookup"     // Resolved via parent entity
  | "fallback_comune"   // Fell back to municipality
  | "fallback_macrozona" // Fell back to macrozone
  | "fallback_nazionale" // Fell back to national
  | "none";

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface GeoResolution {
  /** Whether resolution succeeded */
  resolved: boolean;
  /** Method used for matching */
  match_method: MatchMethod;
  /** Confidence level */
  match_confidence: MatchConfidence;
  /** Numeric confidence [0-1] */
  confidence_score: number;
  /** Fallback used, if any */
  fallback_used: CanonicalGeoLevel | null;
  /** Original fallback reason */
  fallback_reason: string | null;
  /** Warnings for the consumer */
  warnings: string[];
  /** Debug summary */
  debug_summary: string;
}

/* ═══════════════════════════════════════════════════════════
   GEO COVERAGE — "What data layers exist here?"
   ═══════════════════════════════════════════════════════════ */

export type CoverageStatus = "available" | "partial" | "unavailable" | "unknown";

export interface LayerCoverage {
  status: CoverageStatus;
  record_count: number;
  source_system: GeoSourceSystem;
  data_quality: GeoDataQuality;
  /** Additional detail */
  note: string | null;
}

export interface GeoCoverage {
  /** Coverage for each data layer at this territory */
  sezioni_r03: LayerCoverage;
  asc_areas: LayerCoverage;
  aggregati_r03: LayerCoverage;
  zona_omi: LayerCoverage;
  /** Maximum depth reachable */
  max_depth: CanonicalGeoLevel;
  /** Overall quality assessment */
  quality_score: number; // 0-1
}

/* ═══════════════════════════════════════════════════════════
   GEO QUALITY — "How good is the resolution?"
   ═══════════════════════════════════════════════════════════ */

export interface GeoQuality {
  /** Overall quality tier */
  tier: GeoDataQuality;
  /** Confidence in the resolution */
  confidence: MatchConfidence;
  /** Numeric score 0-1 */
  score: number;
  /** Reason for the quality assessment */
  reason: string;
}

/* ═══════════════════════════════════════════════════════════
   GEO SOURCES — "Where did the data come from?"
   ═══════════════════════════════════════════════════════════ */

export interface GeoSourceEntry {
  source_system: GeoSourceSystem;
  source_label: string;
  data_quality: GeoDataQuality;
  geo_level: CanonicalGeoLevel;
  record_count: number;
}

export interface GeoSources {
  entries: GeoSourceEntry[];
  primary_source: GeoSourceSystem;
}

/* ═══════════════════════════════════════════════════════════
   REPORT CONTRACT — Full backbone output
   ═══════════════════════════════════════════════════════════ */

export interface GeoBackboneResult {
  geo_identity: GeoIdentity;
  geo_hierarchy: GeoHierarchy;
  geo_resolution: GeoResolution;
  geo_coverage: GeoCoverage;
  geo_quality: GeoQuality;
  geo_sources: GeoSources;
}

/* ═══════════════════════════════════════════════════════════
   RESOLVER INPUT
   ═══════════════════════════════════════════════════════════ */

export interface GeoResolverInput {
  /** Latitude for coordinate-based resolution */
  lat?: number;
  /** Longitude for coordinate-based resolution */
  lng?: number;
  /** ISTAT municipality code */
  comune_istat_code?: string;
  /** Municipality name */
  comune_name?: string;
  /** Province name or code */
  provincia?: string;
  /** Region name or code */
  regione?: string;
  /** OMI zone code (reference only) */
  zona_omi?: string;
  /** ASC area code */
  asc_code?: string;
  /** Census section code */
  section_code?: string;
  /** Catastale code */
  codice_catastale?: string;
}

/* ═══════════════════════════════════════════════════════════
   HIERARCHY BUILDER
   ═══════════════════════════════════════════════════════════ */

/** ISTAT region code → name mapping from macrozone registry */
function regionNameByCode(code: string): string | null {
  for (const mz of MACROZONE_DEFINITIONS) {
    for (const r of mz.regioni) {
      if (r.codice_regione === code.padStart(2, "0")) return r.nome_regione;
    }
  }
  return null;
}

function macrozoneForRegionCode(code: string): MacrozoneMatch | null {
  return getMacrozoneByRegionCode(code);
}

/**
 * Builds a complete hierarchy chain from a resolved identity upward.
 */
export function buildHierarchy(
  identity: GeoIdentity,
  extra?: {
    provincia_name?: string;
    regione_name?: string;
    localita_name?: string;
    localita_code?: string;
    asc_name?: string;
    asc_code?: string;
    section_code?: string;
  },
): GeoHierarchy {
  const chain: GeoHierarchyNode[] = [];
  const src = identity.source_system;

  // Add the identity itself if it's below nazionale
  if (identity.geo_level !== "nazionale" && identity.geo_level !== "non_determinato") {
    chain.push({ level: identity.geo_level, code: identity.geo_code, label: identity.geo_label, source_system: src });
  }

  // Walk upward
  const addIfMissing = (level: CanonicalGeoLevel, code: string | null, label: string | null) => {
    if (!code || !label) return;
    if (chain.some(n => n.level === level)) return;
    chain.push({ level, code, label, source_system: src });
  };

  // Section → ASC
  if (identity.geo_level === "sezione_censuaria" && extra?.asc_code) {
    addIfMissing("sub_comunale", extra.asc_code, extra.asc_name ?? extra.asc_code);
  }

  // ASC → Localita (if available)
  if (extra?.localita_code) {
    addIfMissing("localita", extra.localita_code, extra.localita_name ?? extra.localita_code);
  }

  // Always add comune if available
  if (identity.comune_istat_code) {
    const comuneLabel = identity.geo_level === "comune" ? identity.geo_label : (extra?.provincia_name ? `Comune ${identity.comune_istat_code}` : identity.comune_istat_code);
    addIfMissing("comune", identity.comune_istat_code, comuneLabel);
  }

  // Provincia
  if (identity.provincia_code) {
    addIfMissing("provincia", identity.provincia_code, extra?.provincia_name ?? identity.provincia_code);
  }

  // Regione
  if (identity.regione_code) {
    const regionName = extra?.regione_name ?? regionNameByCode(identity.regione_code) ?? identity.regione_code;
    addIfMissing("regione", identity.regione_code, regionName);

    // Macrozona
    const mz = macrozoneForRegionCode(identity.regione_code);
    if (mz) {
      addIfMissing("macrozona", mz.macrozone_code, mz.macrozone_label);
    }
  }

  // Nazionale
  addIfMissing("nazionale", "IT", "Italia");

  // Sort by rank (finest first)
  chain.sort((a, b) => GEO_LEVEL_RANK[a.level] - GEO_LEVEL_RANK[b.level]);

  const deepest = chain.length > 0 ? chain[0].level : "non_determinato";

  return {
    chain,
    deepest_level: deepest,
    children_available: {
      sezione_censuaria: chain.some(n => n.level === "sezione_censuaria"),
      sub_comunale: chain.some(n => n.level === "sub_comunale"),
      localita: chain.some(n => n.level === "localita"),
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   COVERAGE BUILDER
   ═══════════════════════════════════════════════════════════ */

const EMPTY_LAYER: LayerCoverage = {
  status: "unknown",
  record_count: 0,
  source_system: "unknown",
  data_quality: "unavailable",
  note: null,
};

export function buildEmptyCoverage(): GeoCoverage {
  return {
    sezioni_r03: { ...EMPTY_LAYER },
    asc_areas: { ...EMPTY_LAYER },
    aggregati_r03: { ...EMPTY_LAYER },
    zona_omi: { ...EMPTY_LAYER },
    max_depth: "non_determinato",
    quality_score: 0,
  };
}

export function computeCoverageQuality(coverage: GeoCoverage): number {
  let score = 0;
  const layers = [coverage.sezioni_r03, coverage.asc_areas, coverage.aggregati_r03, coverage.zona_omi];
  for (const l of layers) {
    if (l.status === "available") score += 0.25;
    else if (l.status === "partial") score += 0.1;
  }
  return Math.min(1, score);
}

/* ═══════════════════════════════════════════════════════════
   STATIC RESOLVER (no DB, from known data)
   ═══════════════════════════════════════════════════════════ */

/**
 * Resolves geographic identity from static input (no DB queries).
 * This is the synchronous, in-memory resolver for known data.
 */
export function resolveFromInput(input: GeoResolverInput): GeoBackboneResult {
  const warnings: string[] = [];
  let resolved = false;
  let match_method: MatchMethod = "none";
  let confidence_score = 0;
  let fallback_used: CanonicalGeoLevel | null = null;
  let fallback_reason: string | null = null;

  // Determine best geo level from input
  let geo_level: CanonicalGeoLevel = "non_determinato";
  let geo_code = "";
  let geo_label = "";
  let source_system: GeoSourceSystem = "unknown";
  let is_derived = false;

  // Priority: section > ASC > comune > region > macrozona > nazionale
  if (input.section_code) {
    geo_level = "sezione_censuaria";
    geo_code = input.section_code;
    geo_label = `Sezione ${input.section_code}`;
    source_system = "r03";
    match_method = "exact_code";
    confidence_score = 0.95;
    resolved = true;
  } else if (input.asc_code) {
    geo_level = "sub_comunale";
    geo_code = input.asc_code;
    geo_label = `ASC ${input.asc_code}`;
    source_system = "asc";
    match_method = "exact_code";
    confidence_score = 0.9;
    resolved = true;
  } else if (input.comune_istat_code) {
    geo_level = "comune";
    geo_code = input.comune_istat_code;
    geo_label = input.comune_name ?? `Comune ${input.comune_istat_code}`;
    source_system = "istat";
    match_method = "exact_code";
    confidence_score = 0.95;
    resolved = true;
  } else if (input.comune_name) {
    geo_level = "comune";
    geo_code = input.comune_name;
    geo_label = input.comune_name;
    source_system = "istat";
    match_method = "name_match";
    confidence_score = 0.7;
    resolved = true;
    warnings.push("Risoluzione per nome comune — codice ISTAT non disponibile");
  } else if (input.regione) {
    const mz = getMacrozoneByRegionName(input.regione) ?? getMacrozoneByRegionCode(input.regione);
    if (mz) {
      geo_level = "regione";
      geo_code = mz.regione_code;
      geo_label = mz.regione_name;
      source_system = "istat";
      match_method = "exact_code";
      confidence_score = 0.9;
      resolved = true;
      fallback_used = "regione";
      fallback_reason = "Solo livello regionale disponibile";
    }
  } else if (input.lat != null && input.lng != null) {
    // Coordinates without other context — can only flag for DB lookup
    geo_level = "non_determinato";
    geo_code = `${input.lat},${input.lng}`;
    geo_label = `Coordinate (${input.lat.toFixed(4)}, ${input.lng.toFixed(4)})`;
    source_system = "unknown";
    match_method = "none";
    confidence_score = 0;
    resolved = false;
    warnings.push("Coordinate fornite ma serve lookup DB per risoluzione completa");
  }

  // If not resolved, try nazionale fallback
  if (!resolved && !input.lat) {
    geo_level = "nazionale";
    geo_code = "IT";
    geo_label = "Italia";
    source_system = "istat";
    match_method = "fallback_nazionale";
    confidence_score = 0.1;
    fallback_used = "nazionale";
    fallback_reason = "Nessun input geografico sufficiente";
    is_derived = true;
    resolved = true;
    warnings.push("Fallback a livello nazionale — nessun dato territoriale specifico");
  }

  const identity: GeoIdentity = {
    geo_level,
    geo_code,
    geo_label,
    parent_geo_code: input.comune_istat_code ?? null,
    comune_istat_code: input.comune_istat_code ?? null,
    provincia_code: null,
    regione_code: input.regione ? (getMacrozoneByRegionName(input.regione)?.regione_code ?? null) : null,
    source_system,
    is_official: source_system === "istat" || source_system === "r03" || source_system === "asc",
    is_derived,
  };

  const hierarchy = buildHierarchy(identity);

  const match_confidence: MatchConfidence =
    confidence_score >= 0.9 ? "high" :
    confidence_score >= 0.6 ? "medium" :
    confidence_score > 0 ? "low" : "none";

  const resolution: GeoResolution = {
    resolved,
    match_method,
    match_confidence,
    confidence_score,
    fallback_used,
    fallback_reason,
    warnings,
    debug_summary: `${geo_level}/${match_method} → ${geo_label} (${confidence_score.toFixed(2)})${fallback_used ? ` [fallback: ${fallback_used}]` : ""}`,
  };

  const coverage = buildEmptyCoverage();
  coverage.quality_score = computeCoverageQuality(coverage);

  const quality: GeoQuality = {
    tier: identity.is_official ? "official" : is_derived ? "derived" : "unavailable",
    confidence: match_confidence,
    score: confidence_score,
    reason: resolution.debug_summary,
  };

  const sources: GeoSources = {
    entries: [{
      source_system,
      source_label: source_system === "istat" ? "ISTAT" : source_system === "r03" ? "R03 Censimento" : source_system === "asc" ? "ASC ISTAT" : "Sconosciuto",
      data_quality: identity.is_official ? "official" : "unavailable",
      geo_level,
      record_count: resolved ? 1 : 0,
    }],
    primary_source: source_system,
  };

  return {
    geo_identity: identity,
    geo_hierarchy: hierarchy,
    geo_resolution: resolution,
    geo_coverage: coverage,
    geo_quality: quality,
    geo_sources: sources,
  };
}

/* ═══════════════════════════════════════════════════════════
   ENRICHMENT — Merge DB results into a backbone result
   ═══════════════════════════════════════════════════════════ */

export interface DbCoverageData {
  sezioni_count?: number;
  asc_count?: number;
  aggregati_count?: number;
  omi_count?: number;
  has_sezioni?: boolean;
  has_asc?: boolean;
  has_aggregati?: boolean;
  has_omi?: boolean;
}

/**
 * Enriches a GeoBackboneResult with DB-sourced coverage data.
 */
export function enrichWithCoverage(
  result: GeoBackboneResult,
  dbCoverage: DbCoverageData,
): GeoBackboneResult {
  const c = { ...result.geo_coverage };

  if (dbCoverage.has_sezioni || (dbCoverage.sezioni_count && dbCoverage.sezioni_count > 0)) {
    c.sezioni_r03 = {
      status: "available",
      record_count: dbCoverage.sezioni_count ?? 0,
      source_system: "r03",
      data_quality: "official",
      note: null,
    };
  }

  if (dbCoverage.has_asc || (dbCoverage.asc_count && dbCoverage.asc_count > 0)) {
    c.asc_areas = {
      status: "available",
      record_count: dbCoverage.asc_count ?? 0,
      source_system: "asc",
      data_quality: "official",
      note: null,
    };
  }

  if (dbCoverage.has_aggregati || (dbCoverage.aggregati_count && dbCoverage.aggregati_count > 0)) {
    c.aggregati_r03 = {
      status: "available",
      record_count: dbCoverage.aggregati_count ?? 0,
      source_system: "derived",
      data_quality: "derived",
      note: "Aggregato da sezioni R03 verso ASC",
    };
  }

  if (dbCoverage.has_omi || (dbCoverage.omi_count && dbCoverage.omi_count > 0)) {
    c.zona_omi = {
      status: "available",
      record_count: dbCoverage.omi_count ?? 0,
      source_system: "omi",
      data_quality: "official",
      note: null,
    };
  }

  // Compute max depth
  if (c.sezioni_r03.status === "available") c.max_depth = "sezione_censuaria";
  else if (c.zona_omi.status === "available") c.max_depth = "zona_omi";
  else if (c.asc_areas.status === "available") c.max_depth = "sub_comunale";
  else if (result.geo_identity.geo_level === "comune") c.max_depth = "comune";
  else c.max_depth = result.geo_identity.geo_level;

  c.quality_score = computeCoverageQuality(c);

  return { ...result, geo_coverage: c };
}

/* ═══════════════════════════════════════════════════════════
   PARENT CHAIN WALKER
   ═══════════════════════════════════════════════════════════ */

/**
 * Walks up the hierarchy from a given node, returning all ancestors.
 */
export function getAncestors(hierarchy: GeoHierarchy, fromLevel: CanonicalGeoLevel): GeoHierarchyNode[] {
  const rank = GEO_LEVEL_RANK[fromLevel];
  return hierarchy.chain.filter(n => GEO_LEVEL_RANK[n.level] > rank);
}

/**
 * Gets descendants (finer levels) from the hierarchy.
 */
export function getDescendants(hierarchy: GeoHierarchy, fromLevel: CanonicalGeoLevel): GeoHierarchyNode[] {
  const rank = GEO_LEVEL_RANK[fromLevel];
  return hierarchy.chain.filter(n => GEO_LEVEL_RANK[n.level] < rank);
}

/**
 * Checks if a specific child level is available in the hierarchy.
 */
export function hasChildLevel(hierarchy: GeoHierarchy, level: CanonicalGeoLevel): boolean {
  return hierarchy.chain.some(n => n.level === level);
}

/* ═══════════════════════════════════════════════════════════
   NORMALIZED PATH
   ═══════════════════════════════════════════════════════════ */

/**
 * Returns a human-readable normalized path for the hierarchy.
 * e.g. "Sezione 123 → ASC Milano-1 → Milano → MI → Lombardia → Nord-Ovest → Italia"
 */
export function normalizedPath(hierarchy: GeoHierarchy): string {
  return hierarchy.chain.map(n => n.label).join(" → ");
}
