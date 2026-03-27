/**
 * Data Backbone — Sottra
 *
 * Central engine for source registry, coverage evaluation,
 * and report section exposure policy.
 *
 * Replaces scattered if/else logic with a unified, data-driven
 * decision system for what appears in the public report.
 */

import type { ScanResult, SubMunicipalMatchData } from "@/types";
import type { ReportGeoLevel, AvailabilityStatus, ReportSourceType } from "@/types/report";

/* ── Source Registry Types ─────────────────────────────── */

export interface DataSourceEntry {
  source_key: string;
  source_label: string;
  source_type: string;
  source_family: string;
  source_year: number | null;
  provider_label: string;
  officiality_level: string;
  geographic_level_supported: string;
  geographic_scope: string;
  regions_supported: string[];
  report_sections_supported: string[];
  dataset_status: "active" | "pilot" | "inactive" | "deprecated";
  ingestion_mode: string;
  refresh_mode: string;
  last_imported_at: string | null;
  last_validated_at: string | null;
  current_coverage_status: "available" | "partial" | "unavailable" | "not_determinable";
  record_count: number;
  coverage_comuni: number;
  coverage_regioni: number;
  notes: string | null;
}

/* ── Exposure Decision Types ───────────────────────────── */

export type DisplayDecision = "shown" | "hidden" | "reduced";

export interface ExposureDecision {
  decision: DisplayDecision;
  reason: string;
  source_key: string | null;
  geographic_level: ReportGeoLevel;
  coverage_status: AvailabilityStatus;
  source_type: ReportSourceType;
  confidence: number;
}

/* ── Report Section Keys ───────────────────────────────── */

export type ReportSectionKey =
  | "profiloRapido"
  | "immobileFacciata"
  | "contestoVicinato"
  | "posizionamentoCommerciale"
  | "profiloArea"
  | "scenarioTemporale"
  | "sintesiFinale"
  | "prioritaCriticita";

/* ── Section Requirements ──────────────────────────────── */

/** Defines what each section needs to be renderable */
interface SectionRequirement {
  /** Minimum data sources that must be available */
  requiredSources: string[];
  /** At least one of these must be available */
  anySources?: string[];
  /** ScanResult keys that must have success status */
  requiredModules: (keyof ScanResult)[];
  /** At least one of these modules */
  anyModules?: (keyof ScanResult)[];
}

const SECTION_REQUIREMENTS: Record<ReportSectionKey, SectionRequirement> = {
  profiloRapido: {
    requiredSources: [],
    requiredModules: ["identify"],
  },
  immobileFacciata: {
    requiredSources: [],
    requiredModules: ["identify"],
  },
  contestoVicinato: {
    requiredSources: [],
    requiredModules: ["poiEnrichment"],
  },
  posizionamentoCommerciale: {
    requiredSources: [],
    anyModules: ["pricing", "omiZone"],
    requiredModules: [],
  },
  profiloArea: {
    requiredSources: [],
    anyModules: ["poiEnrichment", "rischioZona", "istatDemographic"],
    requiredModules: [],
  },
  scenarioTemporale: {
    requiredSources: [],
    requiredModules: ["timeView"],
  },
  sintesiFinale: {
    requiredSources: [],
    anyModules: ["opportunity", "convergenzaTerritoriale"],
    requiredModules: [],
  },
  prioritaCriticita: {
    requiredSources: [],
    requiredModules: ["identify"],
  },
};

/* ── Exposure Policy Engine ────────────────────────────── */

function isModuleAvailable(result: ScanResult, key: keyof ScanResult): boolean {
  const section = result[key];
  if (!section || typeof section !== "object") return false;
  return (section as { status: string; data: unknown }).status === "success"
    && (section as { data: unknown }).data != null;
}

/**
 * Evaluates whether a report section should be shown, hidden, or reduced.
 * This is the central policy engine — replaces scattered conditionals.
 */
export function evaluateSectionExposure(
  sectionKey: ReportSectionKey,
  result: ScanResult,
  _registry?: DataSourceEntry[],
): ExposureDecision {
  const req = SECTION_REQUIREMENTS[sectionKey];

  // Check required modules
  for (const mod of req.requiredModules) {
    if (!isModuleAvailable(result, mod)) {
      return {
        decision: "hidden",
        reason: `required_module_missing:${mod}`,
        source_key: null,
        geographic_level: "non_determinato",
        coverage_status: "unavailable",
        source_type: "unavailable",
        confidence: 0,
      };
    }
  }

  // Check anyModules — at least one must be available
  if (req.anyModules && req.anyModules.length > 0) {
    const hasAny = req.anyModules.some(mod => isModuleAvailable(result, mod));
    if (!hasAny) {
      return {
        decision: "hidden",
        reason: `no_alternative_module_available:${req.anyModules.join(",")}`,
        source_key: null,
        geographic_level: "non_determinato",
        coverage_status: "unavailable",
        source_type: "unavailable",
        confidence: 0,
      };
    }
  }

  // Determine geographic level and source type based on section
  const geoLevel = inferSectionGeoLevel(sectionKey, result);
  const isMunicipal = geoLevel === "comune" || geoLevel === "non_determinato";

  // Section-specific exposure refinements
  const decision: DisplayDecision = isMunicipal && sectionKey === "profiloArea" ? "reduced" : "shown";
  const sourceType = inferPrimarySectionSourceType(sectionKey);

  return {
    decision,
    reason: decision === "reduced" ? "municipal_level_only" : "all_requirements_met",
    source_key: inferPrimarySourceKey(sectionKey),
    geographic_level: geoLevel,
    coverage_status: isMunicipal ? "partial" : "available",
    source_type: sourceType,
    confidence: isMunicipal ? 0.6 : 0.85,
  };
}

function inferSectionGeoLevel(sectionKey: ReportSectionKey, result: ScanResult): ReportGeoLevel {
  // OMI-based sections
  if (sectionKey === "profiloRapido" || sectionKey === "posizionamentoCommerciale") {
    const omi = result.omiZone;
    if (omi?.status === "success" && omi.data) {
      const d = omi.data;
      if (d.omiGeoLevel) return d.omiGeoLevel;
      return d.polygonMatch ? "microzona_omi" : "comune";
    }
    return "non_determinato";
  }

  // ISTAT-based
  if (sectionKey === "profiloArea") {
    const istat = result.istatDemographic;
    if (istat?.status === "success" && istat.data?.geoLevel) {
      const gl = istat.data.geoLevel;
      if (gl === "microzona") return "microzona_omi";
      if (gl === "quartiere") return "quartiere";
      if (gl === "zona") return "zona_specifica";
    }
    return "comune";
  }

  return "non_determinato";
}

function inferPrimarySectionSourceType(key: ReportSectionKey): ReportSourceType {
  switch (key) {
    case "profiloRapido": return "territorial_verified";
    case "immobileFacciata": return "image_detected";
    case "contestoVicinato": return "territorial_verified";
    case "posizionamentoCommerciale": return "official_data";
    case "profiloArea": return "official_data";
    case "scenarioTemporale": return "forecast_scenario";
    case "sintesiFinale": return "territorial_verified";
    case "prioritaCriticita": return "territorial_verified";
  }
}

function inferPrimarySourceKey(key: ReportSectionKey): string {
  switch (key) {
    case "profiloRapido": return "core_identify";
    case "immobileFacciata": return "core_identify";
    case "contestoVicinato": return "poi_overpass";
    case "posizionamentoCommerciale": return "omi_quotazioni";
    case "profiloArea": return "istat_sdmx_pop";
    case "scenarioTemporale": return "core_timeview";
    case "sintesiFinale": return "core_convergenza";
    case "prioritaCriticita": return "core_identify";
  }
}

/* ── Sub-municipal Exposure Gating ─────────────────────── */

export interface SubMunicipalGateResult {
  showR03Block: boolean;
  showAscBlock: boolean;
  reason: string;
  region: string | null;
  coverageStatus: AvailabilityStatus;
}

/**
 * Data-driven gating for sub-municipal enrichment.
 * Replaces hardcoded "if Lombardia" checks with registry-driven logic.
 */
export function evaluateSubMunicipalGate(
  ascMatch: SubMunicipalMatchData | null,
  registry?: DataSourceEntry[],
): SubMunicipalGateResult {
  const noShow: SubMunicipalGateResult = {
    showR03Block: false,
    showAscBlock: false,
    reason: "no_match",
    region: null,
    coverageStatus: "unavailable",
  };

  if (!ascMatch || !ascMatch.matched) return noShow;

  // ASC block: show if matched and available
  const showAsc = ascMatch.coverage_status === "available" && !!ascMatch.name;

  // R03 block: show only if R03 enrichment is truly present
  const isR03Enriched = ascMatch.r03_enriched === true;
  const r03Coverage = ascMatch.r03_coverage;
  const showR03 = isR03Enriched && (r03Coverage === "available" || r03Coverage === "partial")
    && ascMatch.r03_population != null && ascMatch.r03_population > 0;

  // Determine region from registry or data
  let region: string | null = null;
  if (registry) {
    const r03Source = registry.find(s => s.source_key === "r03_lombardia_2021");
    if (r03Source && r03Source.dataset_status !== "inactive") {
      region = r03Source.regions_supported?.[0] ?? "Lombardia";
    }
  }
  if (!region && showR03) region = "Lombardia";

  return {
    showR03Block: showR03,
    showAscBlock: showAsc,
    reason: showR03 ? "r03_enriched" : showAsc ? "asc_only" : "no_data",
    region,
    coverageStatus: showR03
      ? (r03Coverage === "available" ? "available" : "partial")
      : showAsc ? "available" : "unavailable",
  };
}

/* ── Full Report Exposure Map ──────────────────────────── */

export type ReportExposureMap = Record<ReportSectionKey, ExposureDecision>;

/**
 * Generates the complete exposure map for all report sections.
 * Used by admin diagnostics and by the mapper to make decisions.
 */
export function buildReportExposureMap(
  result: ScanResult,
  registry?: DataSourceEntry[],
): ReportExposureMap {
  const sections: ReportSectionKey[] = [
    "profiloRapido", "immobileFacciata", "contestoVicinato",
    "posizionamentoCommerciale", "profiloArea", "scenarioTemporale",
    "sintesiFinale", "prioritaCriticita",
  ];

  const map = {} as ReportExposureMap;
  for (const key of sections) {
    map[key] = evaluateSectionExposure(key, result, registry);
  }
  return map;
}

/* ── Registry Helpers ──────────────────────────────────── */

/**
 * Computes a summary of the registry state for admin display.
 */
export function summarizeRegistry(entries: DataSourceEntry[]): {
  total: number;
  active: number;
  pilot: number;
  inactive: number;
  byFamily: Record<string, number>;
  byStatus: Record<string, number>;
  byCoverage: Record<string, number>;
} {
  const byFamily: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCoverage: Record<string, number> = {};
  let active = 0, pilot = 0, inactive = 0;

  for (const e of entries) {
    byFamily[e.source_family] = (byFamily[e.source_family] || 0) + 1;
    byStatus[e.dataset_status] = (byStatus[e.dataset_status] || 0) + 1;
    byCoverage[e.current_coverage_status] = (byCoverage[e.current_coverage_status] || 0) + 1;
    if (e.dataset_status === "active") active++;
    else if (e.dataset_status === "pilot") pilot++;
    else inactive++;
  }

  return { total: entries.length, active, pilot, inactive, byFamily, byStatus, byCoverage };
}

/**
 * Checks if a source is ready for public exposure in the report.
 */
export function isSourcePublishable(entry: DataSourceEntry): boolean {
  return (entry.dataset_status === "active" || entry.dataset_status === "pilot")
    && entry.current_coverage_status !== "unavailable";
}

/**
 * Returns the list of report sections a source can feed.
 */
export function getSourceSections(entry: DataSourceEntry): ReportSectionKey[] {
  return entry.report_sections_supported.filter(
    s => SECTION_REQUIREMENTS[s as ReportSectionKey] != null
  ) as ReportSectionKey[];
}
