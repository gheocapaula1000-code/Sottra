/**
 * ANNCSU Schema & Normalizer — Sottra P1 Readiness
 *
 * Canonical data contract for ANNCSU (Archivio Nazionale dei Numeri Civici
 * e delle Strade Urbane), the official Italian street/civic registry.
 *
 * This module defines:
 * - Raw source shape (as received from ISTAT CSV export)
 * - Normalized internal shape (canonical for Sottra backbone)
 * - Mapping raw → normalized with quality gates
 * - Promotion policy flags (all locked to false in this phase)
 *
 * CRITICAL INVARIANTS:
 * - No data is invented; missing fields stay null
 * - civic_supported_as_building_truth is NEVER set to true
 * - Normalization is traceable, not destructive
 * - Quality gates block records that would raise false precision
 */

/* ═══════════════════════════════════════════════════════════
   RAW SOURCE SHAPE
   ═══════════════════════════════════════════════════════════ */

/**
 * Shape of a raw ANNCSU record as exported from ISTAT CSV.
 * Field names follow the ISTAT naming convention.
 * All fields optional because real CSV files may be incomplete.
 */
export interface AnncsuRawRecord {
  /** Codice regione ISTAT */
  COD_REG?: string;
  /** Codice provincia ISTAT */
  COD_PROV?: string;
  /** Codice comune ISTAT (full 6-digit) */
  COD_COM?: string;
  /** Codice comune format PROCOM */
  PROCOM?: string;
  /** Denominazione comune */
  DENOM_COM?: string;
  /** Codice località ISTAT */
  COD_LOC?: string;
  /** Denominazione località */
  DENOM_LOC?: string;
  /** Specie della via/strada (Via, Corso, Piazza, etc.) */
  SPECIE?: string;
  /** Denominazione via/strada */
  DENOM_STRADA?: string;
  /** Codice strada (identificativo univoco comunale) */
  COD_STRADA?: string;
  /** Numero civico */
  CIVICO?: string;
  /** Esponente del civico (bis, ter, A, B, etc.) */
  ESPONENTE?: string;
  /** Barrato (sub-civic) */
  BARRATO?: string;
  /** Codice sezione censuaria */
  SEZ_CENSUARIA?: string;
  /** Codice località tipo */
  TIPO_LOC?: string;
  /** Any additional raw fields */
  [key: string]: string | undefined;
}

/* ═══════════════════════════════════════════════════════════
   NORMALIZED CANONICAL SHAPE
   ═══════════════════════════════════════════════════════════ */

export interface AnncsuIdentity {
  source_name: "ANNCSU";
  source_version: string | null;
  source_scope: "national";
  source_officiality: "official_institutional";
  source_date: string | null;
}

export interface AnncsuGeo {
  regione_code: string | null;
  provincia_code: string | null;
  comune_istat_code: string | null;
  comune_label: string | null;
  localita_code: string | null;
  localita_label: string | null;
  localita_type: string | null;
  sezione_censuaria: string | null;
  /** Composite path for backbone alignment */
  normalized_geo_path: string | null;
}

export interface AnncsuStreet {
  street_id: string | null;
  street_name_raw: string | null;
  street_name_normalized: string | null;
  street_type_raw: string | null;
  street_type_normalized: string | null;
  street_full_name: string | null;
  street_status: AnncsuStreetStatus;
  street_uniqueness_status: AnncsuUniquenessStatus;
}

export type AnncsuStreetStatus =
  | "complete"
  | "name_only"
  | "type_only"
  | "missing"
  | "ambiguous";

export type AnncsuUniquenessStatus =
  | "unique_in_comune"
  | "ambiguous_in_comune"
  | "not_determinable";

export interface AnncsuCivic {
  civic_raw: string | null;
  civic_normalized: string | null;
  esponente_raw: string | null;
  esponente_normalized: string | null;
  barrato_raw: string | null;
  civic_full_label: string | null;
  civic_status: AnncsuCivicStatus;
  civic_uniqueness_status: AnncsuUniquenessStatus;
}

export type AnncsuCivicStatus =
  | "present"
  | "present_with_esponente"
  | "present_with_barrato"
  | "missing"
  | "malformed"
  | "ambiguous";

export interface AnncsuQuality {
  raw_completeness: number;
  normalization_status: "clean" | "normalized" | "partial" | "failed";
  geo_link_status: "linked" | "partial_link" | "unlinked";
  ambiguity_flags: string[];
  warnings: string[];
  ingest_readiness: AnncsuIngestReadiness;
}

export type AnncsuIngestReadiness =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "partial_only"
  | "review_needed";

/** Promotion policy — all locked false in P1 readiness phase */
export interface AnncsuPromotionPolicy {
  /** Whether this record qualifies for precise-location status in a future phase */
  qualifies_for_precise_location: false;
  /** Whether this record qualifies for building-truth status — ALWAYS false */
  qualifies_for_building_truth: false;
  /** Reasons this record cannot be promoted */
  blocking_reasons: string[];
  /** Human-readable policy summary */
  policy_summary: string;
}

/** Fully normalized ANNCSU record */
export interface AnncsuNormalizedRecord {
  identity: AnncsuIdentity;
  geo: AnncsuGeo;
  street: AnncsuStreet;
  civic: AnncsuCivic;
  quality: AnncsuQuality;
  promotion_policy: AnncsuPromotionPolicy;
  /** Transformations applied during normalization */
  normalization_trace: string[];
}

/* ═══════════════════════════════════════════════════════════
   STREET TYPE NORMALIZATION (Italian)
   ═══════════════════════════════════════════════════════════ */

const STREET_TYPE_MAP: Record<string, string> = {
  "via": "Via",
  "v.": "Via",
  "viale": "Viale",
  "v.le": "Viale",
  "corso": "Corso",
  "c.so": "Corso",
  "piazza": "Piazza",
  "p.za": "Piazza",
  "p.zza": "Piazza",
  "piazzale": "Piazzale",
  "p.le": "Piazzale",
  "largo": "Largo",
  "vicolo": "Vicolo",
  "strada": "Strada",
  "str.": "Strada",
  "contrada": "Contrada",
  "c.da": "Contrada",
  "borgata": "Borgata",
  "traversa": "Traversa",
  "salita": "Salita",
  "discesa": "Discesa",
  "rampa": "Rampa",
  "galleria": "Galleria",
  "lungomare": "Lungomare",
  "lungotevere": "Lungotevere",
  "lungarno": "Lungarno",
  "fondamenta": "Fondamenta",
  "calle": "Calle",
  "rua": "Rua",
  "ronco": "Ronco",
  "rione": "Rione",
  "località": "Località",
  "loc.": "Località",
  "frazione": "Frazione",
  "fraz.": "Frazione",
  "regione": "Regione",
  "reg.": "Regione",
  "stradone": "Stradone",
  "passaggio": "Passaggio",
  "sottopasso": "Sottopasso",
  "sovrappasso": "Sovrappasso",
};

export function normalizeStreetType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return STREET_TYPE_MAP[trimmed.toLowerCase()] ?? trimmed;
}

/* ═══════════════════════════════════════════════════════════
   NORMALIZATION: RAW → CANONICAL
   ═══════════════════════════════════════════════════════════ */

function normalizeStreetName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed;
}

function normalizeCivic(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^0+/, "");
  if (!trimmed || trimmed === "0") return null;
  return trimmed;
}

function normalizeEsponente(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return trimmed || null;
}

function buildCivicFullLabel(civic: string | null, esponente: string | null, barrato: string | null): string | null {
  if (!civic) return null;
  let label = civic;
  if (esponente) label += `/${esponente}`;
  if (barrato) label += ` (${barrato})`;
  return label;
}

function resolveIstatCode(raw: AnncsuRawRecord): string | null {
  if (raw.COD_COM) {
    const code = raw.COD_COM.trim().padStart(6, "0");
    if (/^\d{6}$/.test(code)) return code;
  }
  if (raw.PROCOM) {
    const code = raw.PROCOM.trim().padStart(6, "0");
    if (/^\d{6}$/.test(code)) return code;
  }
  return null;
}

function buildGeoPath(geo: AnncsuGeo): string | null {
  const parts: string[] = [];
  if (geo.regione_code) parts.push(`R${geo.regione_code}`);
  if (geo.provincia_code) parts.push(`P${geo.provincia_code}`);
  if (geo.comune_istat_code) parts.push(`C${geo.comune_istat_code}`);
  return parts.length > 0 ? parts.join("/") : null;
}

function computeCompleteness(raw: AnncsuRawRecord): number {
  const fields = [
    raw.COD_REG, raw.COD_PROV, raw.COD_COM ?? raw.PROCOM,
    raw.DENOM_COM, raw.SPECIE, raw.DENOM_STRADA, raw.CIVICO,
  ];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100) / 100;
}

function classifyStreetStatus(street: { street_name_normalized: string | null; street_type_normalized: string | null }): AnncsuStreetStatus {
  if (street.street_name_normalized && street.street_type_normalized) return "complete";
  if (street.street_name_normalized) return "name_only";
  if (street.street_type_normalized) return "type_only";
  return "missing";
}

function classifyCivicStatus(civic: string | null, esponente: string | null, barrato: string | null): AnncsuCivicStatus {
  if (!civic) return "missing";
  if (!/^\d+$/.test(civic)) return "malformed";
  if (barrato) return "present_with_barrato";
  if (esponente) return "present_with_esponente";
  return "present";
}

function classifyGeoLinkStatus(geo: AnncsuGeo): "linked" | "partial_link" | "unlinked" {
  if (geo.comune_istat_code && geo.regione_code && geo.provincia_code) return "linked";
  if (geo.comune_istat_code) return "partial_link";
  return "unlinked";
}

function computeAmbiguityFlags(raw: AnncsuRawRecord, street: AnncsuStreet, civic: AnncsuCivic, geo: AnncsuGeo): string[] {
  const flags: string[] = [];
  if (street.street_status === "missing") flags.push("street_missing");
  if (street.street_status === "name_only") flags.push("street_type_missing");
  if (civic.civic_status === "missing") flags.push("civic_missing");
  if (civic.civic_status === "malformed") flags.push("civic_malformed");
  if (!geo.comune_istat_code) flags.push("comune_code_missing");
  if (geo.comune_istat_code && !geo.regione_code) flags.push("regione_code_missing");
  return flags;
}

function computeWarnings(quality: { raw_completeness: number; geo_link_status: string; ambiguity_flags: string[] }): string[] {
  const warnings: string[] = [];
  if (quality.raw_completeness < 0.5) warnings.push("low_completeness");
  if (quality.geo_link_status === "unlinked") warnings.push("no_geo_anchor");
  if (quality.ambiguity_flags.length > 2) warnings.push("high_ambiguity");
  return warnings;
}

function computeIngestReadiness(quality: { raw_completeness: number; geo_link_status: string; normalization_status: string; ambiguity_flags: string[]; warnings: string[] }): AnncsuIngestReadiness {
  if (quality.geo_link_status === "unlinked") return "blocked";
  if (quality.normalization_status === "failed") return "blocked";
  if (quality.raw_completeness < 0.3) return "blocked";
  if (quality.warnings.length > 0 || quality.ambiguity_flags.length > 0) {
    if (quality.ambiguity_flags.length > 3) return "review_needed";
    return "ready_with_warnings";
  }
  return "ready";
}

function buildPromotionPolicy(quality: AnncsuQuality): AnncsuPromotionPolicy {
  const reasons: string[] = [
    "P1_readiness_phase_only",
    "no_cross_validation_with_building_registry",
    "no_geocoding_confirmation",
  ];
  if (quality.ingest_readiness !== "ready") {
    reasons.push(`ingest_readiness_is_${quality.ingest_readiness}`);
  }
  if (quality.ambiguity_flags.length > 0) {
    reasons.push("ambiguity_flags_present");
  }
  return {
    qualifies_for_precise_location: false as const,
    qualifies_for_building_truth: false as const,
    blocking_reasons: reasons,
    policy_summary:
      "ANNCSU presence alone does NOT qualify for building truth. " +
      "Future promotion requires: exact geo-consistent official record + " +
      "unambiguous match + coherence with resolved comune + zero ambiguity flags + " +
      "cross-validation with building registry (not yet available).",
  };
}

/**
 * Normalize a raw ANNCSU record into the canonical internal shape.
 *
 * This function is traceable: every meaningful transformation is logged
 * in `normalization_trace`. It does NOT invent data.
 */
export function normalizeAnncsuRecord(
  raw: AnncsuRawRecord,
  options?: { source_version?: string; source_date?: string },
): AnncsuNormalizedRecord {
  const trace: string[] = [];

  // Identity
  const identity: AnncsuIdentity = {
    source_name: "ANNCSU",
    source_version: options?.source_version ?? null,
    source_scope: "national",
    source_officiality: "official_institutional",
    source_date: options?.source_date ?? null,
  };

  // Geo
  const comune_istat = resolveIstatCode(raw);
  if (raw.PROCOM && !raw.COD_COM) trace.push("istat_code_from_PROCOM");
  const regione_code = raw.COD_REG?.trim().padStart(2, "0") ?? null;
  const provincia_code = raw.COD_PROV?.trim().padStart(3, "0") ?? null;
  const geo: AnncsuGeo = {
    regione_code,
    provincia_code,
    comune_istat_code: comune_istat,
    comune_label: raw.DENOM_COM?.trim() ?? null,
    localita_code: raw.COD_LOC?.trim() ?? null,
    localita_label: raw.DENOM_LOC?.trim() ?? null,
    localita_type: raw.TIPO_LOC?.trim() ?? null,
    sezione_censuaria: raw.SEZ_CENSUARIA?.trim() ?? null,
    normalized_geo_path: null,
  };
  geo.normalized_geo_path = buildGeoPath(geo);

  // Street
  const streetTypeRaw = raw.SPECIE?.trim() ?? null;
  const streetTypeNorm = normalizeStreetType(streetTypeRaw);
  if (streetTypeRaw && streetTypeNorm !== streetTypeRaw) {
    trace.push(`street_type_normalized: ${streetTypeRaw} → ${streetTypeNorm}`);
  }
  const streetNameRaw = raw.DENOM_STRADA?.trim() ?? null;
  const streetNameNorm = normalizeStreetName(streetNameRaw);
  const streetFull = streetTypeNorm && streetNameNorm
    ? `${streetTypeNorm} ${streetNameNorm}`
    : streetNameNorm ?? streetTypeNorm;

  const street: AnncsuStreet = {
    street_id: raw.COD_STRADA?.trim() ?? null,
    street_name_raw: streetNameRaw,
    street_name_normalized: streetNameNorm,
    street_type_raw: streetTypeRaw,
    street_type_normalized: streetTypeNorm,
    street_full_name: streetFull,
    street_status: "missing",
    street_uniqueness_status: raw.COD_STRADA ? "unique_in_comune" : "not_determinable",
  };
  street.street_status = classifyStreetStatus(street);

  // Civic
  const civicNorm = normalizeCivic(raw.CIVICO);
  const esponenteNorm = normalizeEsponente(raw.ESPONENTE);
  const barratoRaw = raw.BARRATO?.trim() || null;
  const civic: AnncsuCivic = {
    civic_raw: raw.CIVICO?.trim() ?? null,
    civic_normalized: civicNorm,
    esponente_raw: raw.ESPONENTE?.trim() ?? null,
    esponente_normalized: esponenteNorm,
    barrato_raw: barratoRaw,
    civic_full_label: buildCivicFullLabel(civicNorm, esponenteNorm, barratoRaw),
    civic_status: classifyCivicStatus(civicNorm, esponenteNorm, barratoRaw),
    civic_uniqueness_status: "not_determinable",
  };
  if (raw.CIVICO && !civicNorm) trace.push("civic_stripped_to_null");

  // Quality
  const completeness = computeCompleteness(raw);
  const normStatus = street.street_status === "missing" && civic.civic_status === "missing"
    ? "partial" : street.street_status !== "missing" ? "clean" : "normalized";
  const geoLink = classifyGeoLinkStatus(geo);
  const ambiguity = computeAmbiguityFlags(raw, street, civic, geo);
  const warnings = computeWarnings({ raw_completeness: completeness, geo_link_status: geoLink, ambiguity_flags: ambiguity });
  const readiness = computeIngestReadiness({
    raw_completeness: completeness,
    geo_link_status: geoLink,
    normalization_status: normStatus,
    ambiguity_flags: ambiguity,
    warnings,
  });

  const quality: AnncsuQuality = {
    raw_completeness: completeness,
    normalization_status: normStatus,
    geo_link_status: geoLink,
    ambiguity_flags: ambiguity,
    warnings,
    ingest_readiness: readiness,
  };

  return {
    identity,
    geo,
    street,
    civic,
    quality,
    promotion_policy: buildPromotionPolicy(quality),
    normalization_trace: trace,
  };
}

/* ═══════════════════════════════════════════════════════════
   BATCH QUALITY SUMMARY
   ═══════════════════════════════════════════════════════════ */

export interface AnncsuBatchSummary {
  total_records: number;
  ready: number;
  ready_with_warnings: number;
  blocked: number;
  partial_only: number;
  review_needed: number;
  completeness_avg: number;
  geo_linked_pct: number;
  street_complete_pct: number;
  civic_present_pct: number;
  top_ambiguity_flags: { flag: string; count: number }[];
  top_warnings: { warning: string; count: number }[];
  ingest_eligible_pct: number;
}

export function summarizeAnncsuBatch(records: AnncsuNormalizedRecord[]): AnncsuBatchSummary {
  if (records.length === 0) {
    return {
      total_records: 0, ready: 0, ready_with_warnings: 0, blocked: 0,
      partial_only: 0, review_needed: 0, completeness_avg: 0,
      geo_linked_pct: 0, street_complete_pct: 0, civic_present_pct: 0,
      top_ambiguity_flags: [], top_warnings: [], ingest_eligible_pct: 0,
    };
  }

  const counts: Record<AnncsuIngestReadiness, number> = {
    ready: 0, ready_with_warnings: 0, blocked: 0, partial_only: 0, review_needed: 0,
  };
  let completenessSum = 0;
  let geoLinked = 0;
  let streetComplete = 0;
  let civicPresent = 0;
  const flagCounts = new Map<string, number>();
  const warnCounts = new Map<string, number>();

  for (const r of records) {
    counts[r.quality.ingest_readiness]++;
    completenessSum += r.quality.raw_completeness;
    if (r.quality.geo_link_status === "linked") geoLinked++;
    if (r.street.street_status === "complete") streetComplete++;
    if (r.civic.civic_status !== "missing") civicPresent++;
    for (const f of r.quality.ambiguity_flags) {
      flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
    }
    for (const w of r.quality.warnings) {
      warnCounts.set(w, (warnCounts.get(w) ?? 0) + 1);
    }
  }

  const n = records.length;
  const eligible = counts.ready + counts.ready_with_warnings;
  return {
    total_records: n,
    ready: counts.ready,
    ready_with_warnings: counts.ready_with_warnings,
    blocked: counts.blocked,
    partial_only: counts.partial_only,
    review_needed: counts.review_needed,
    completeness_avg: Math.round((completenessSum / n) * 100) / 100,
    geo_linked_pct: Math.round((geoLinked / n) * 100 * 10) / 10,
    street_complete_pct: Math.round((streetComplete / n) * 100 * 10) / 10,
    civic_present_pct: Math.round((civicPresent / n) * 100 * 10) / 10,
    top_ambiguity_flags: [...flagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flag, count]) => ({ flag, count })),
    top_warnings: [...warnCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([warning, count]) => ({ warning, count })),
    ingest_eligible_pct: Math.round((eligible / n) * 100 * 10) / 10,
  };
}
