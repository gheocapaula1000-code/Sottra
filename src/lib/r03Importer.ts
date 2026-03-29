/**
 * R03 Lombardia Census Sections Importer
 *
 * Imports ISTAT R03_21 census section data into census_sections_r03_2021.
 * Idempotent via UNIQUE(source_dataset, section_code).
 * Does NOT affect public report pipeline.
 *
 * Expected CSV columns from SEZ_R03_21.csv (ISTAT 2021):
 *   SEZ2021, PRO_COM_T, COD_REG, COD_PRO, P1 (pop), P2 (males),
 *   P14 (families), A2 (occupied dwellings), E3 (buildings)
 *
 * Expected CSV columns from ASC1_R03_21.csv / ASC2_R03_21.csv:
 *   COD_ASC, DEN_ASC, PRO_COM_T, SEZ2021, COD_REG, COD_PRO
 */

import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface R03SectionRecord {
  section_code: string;
  comune_istat_code: string;
  provincia_code: string | null;
  population_2021: number | null;
  males_2021: number | null;
  females_2021: number | null;
  families_2021: number | null;
  dwellings_2021: number | null;
  occupied_dwellings_2021: number | null;
  buildings_2021: number | null;
  residential_buildings_2021: number | null;
  asc1_code: string | null;
  asc2_code: string | null;
  asc3_code: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  polygon_coords: unknown | null;
  metadata_json: Record<string, unknown>;
}

export interface R03ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { index: number; reason: string }[];
  batchId: string;
}

export interface R03ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AscSectionMapping {
  section_code: string;
  asc1_code: string | null;
  asc2_code: string | null;
  asc3_code: string | null;
}

/** Per-level ASC match detail */
export interface AscLevelMatchDetail {
  level: number;
  codesInSections: Set<string>;
  codesInLayer: Set<string>;
  matched: string[];
  unmatchedInSections: string[];
  unmatchedInLayer: string[];
  coveragePct: number;
}

export interface AscValidationReport {
  totalSections: number;
  sectionsWithAsc1: number;
  sectionsWithAsc2: number;
  sectionsWithAsc3: number;
  /** Level-aware match details */
  asc1: AscLevelMatchDetail;
  asc2: AscLevelMatchDetail;
  asc3: AscLevelMatchDetail;
  /** Scoped metrics */
  r03ComuniCovered: number;
  r03ComuniCodes: Set<string>;
  sectionsWithAsc1Pct: number;
  sectionsWithAsc2Pct: number;
  sectionsWithoutAscPct: number;
  warnings: string[];
  /** Legacy compat */
  ascCodesInSections: Set<string>;
  ascCodesInLayer: Set<string>;
  matchedCodes: string[];
  unmatchedInSections: string[];
  unmatchedInLayer: string[];
  matchPercentage: number;
  comuniCovered: number;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export function validateR03Record(r: Partial<R03SectionRecord>): R03ValidationResult {
  const errors: string[] = [];
  if (!r.section_code) errors.push("section_code mancante");
  if (!r.comune_istat_code) errors.push("comune_istat_code mancante");
  if (r.section_code && !/^\d+$/.test(r.section_code)) {
    errors.push(`section_code non numerico: ${r.section_code}`);
  }
  if (r.population_2021 != null && r.population_2021 < 0) {
    errors.push(`population_2021 negativa: ${r.population_2021}`);
  }
  if (r.centroid_lat != null && (r.centroid_lat < 44.5 || r.centroid_lat > 46.7)) {
    errors.push(`centroid_lat fuori Lombardia: ${r.centroid_lat}`);
  }
  if (r.centroid_lng != null && (r.centroid_lng < 8.4 || r.centroid_lng > 11.5)) {
    errors.push(`centroid_lng fuori Lombardia: ${r.centroid_lng}`);
  }
  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing helpers                                                */
/* ------------------------------------------------------------------ */

/** Parse a robust CSV line handling quoted fields */
function parseCsvLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse CSV text into array of objects */
export function parseCsvToRecords(csvText: string): Record<string, string>[] {
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], sep);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i], sep);
    if (vals.length < 2) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = vals[j] ?? "";
    });
    records.push(obj);
  }
  return records;
}

/* ------------------------------------------------------------------ */
/*  R03 CSV → R03SectionRecord mapping                                 */
/* ------------------------------------------------------------------ */

/**
 * Map a parsed CSV row (from SEZ_R03_21.csv) to R03SectionRecord.
 * Uses real ISTAT column names.
 */
export function mapSezCsvRow(
  row: Record<string, string>,
  ascMappings?: Map<string, AscSectionMapping>
): R03SectionRecord {
  const sectionCode = row["SEZ2021"] || row["SEZ"] || row["SEZ2011"] || "";
  const comuneCode = row["PRO_COM_T"] || row["PRO_COM"] || "";

  const mapping = ascMappings?.get(sectionCode);

  return {
    section_code: sectionCode,
    comune_istat_code: comuneCode,
    provincia_code: row["COD_PRO"] || null,
    population_2021: parseIntSafe(row["P1"]),
    males_2021: parseIntSafe(row["P2"]),
    females_2021: parseIntSafe(row["P3"]),
    families_2021: parseIntSafe(row["P14"] || row["ST1"]),
    dwellings_2021: parseIntSafe(row["A1"]),
    occupied_dwellings_2021: parseIntSafe(row["A2"]),
    buildings_2021: parseIntSafe(row["E3"]),
    residential_buildings_2021: parseIntSafe(row["E1"]),
    asc1_code: mapping?.asc1_code || row["COD_ASC1"] || null,
    asc2_code: mapping?.asc2_code || row["COD_ASC2"] || null,
    asc3_code: mapping?.asc3_code || row["COD_ASC3"] || null,
    centroid_lat: null,
    centroid_lng: null,
    polygon_coords: null,
    metadata_json: {},
  };
}

function parseIntSafe(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? null : n;
}

/**
 * Build ASC mappings from ASC1_R03_21.csv / ASC2_R03_21.csv.
 * These CSVs typically link section codes to ASC area codes.
 */
export function buildAscMappings(
  asc1Rows: Record<string, string>[],
  asc2Rows: Record<string, string>[],
  asc3Rows?: Record<string, string>[]
): Map<string, AscSectionMapping> {
  const map = new Map<string, AscSectionMapping>();

  for (const row of asc1Rows) {
    const sez = row["SEZ2021"] || row["SEZ"] || "";
    if (!sez) continue;
    const existing = map.get(sez) || { section_code: sez, asc1_code: null, asc2_code: null, asc3_code: null };
    existing.asc1_code = row["COD_ASC"] || row["COD_ASC1"] || null;
    map.set(sez, existing);
  }

  for (const row of asc2Rows) {
    const sez = row["SEZ2021"] || row["SEZ"] || "";
    if (!sez) continue;
    const existing = map.get(sez) || { section_code: sez, asc1_code: null, asc2_code: null, asc3_code: null };
    existing.asc2_code = row["COD_ASC"] || row["COD_ASC2"] || null;
    map.set(sez, existing);
  }

  if (asc3Rows) {
    for (const row of asc3Rows) {
      const sez = row["SEZ2021"] || row["SEZ"] || "";
      if (!sez) continue;
      const existing = map.get(sez) || { section_code: sez, asc1_code: null, asc2_code: null, asc3_code: null };
      existing.asc3_code = row["COD_ASC"] || row["COD_ASC3"] || null;
      map.set(sez, existing);
    }
  }

  return map;
}

/* ------------------------------------------------------------------ */
/*  Import to DB                                                       */
/* ------------------------------------------------------------------ */

const CHUNK_SIZE = 500;

export async function importR03Sections(
  records: R03SectionRecord[]
): Promise<R03ImportResult> {
  const batchId = `r03_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let imported = 0;
  const errors: { index: number; reason: string }[] = [];

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const rows = chunk
      .map((r, j) => {
        const v = validateR03Record(r);
        if (!v.valid) {
          errors.push({ index: i + j, reason: v.errors.join("; ") });
          return null;
        }
        return {
          source_dataset: "R03_21",
          source_year: 2021,
          source_label: "ISTAT Censimento 2021 — Lombardia",
          regione_code: "03",
          regione_name: "Lombardia",
          provincia_code: r.provincia_code,
          comune_istat_code: r.comune_istat_code,
          comune_name: "",
          section_code: r.section_code,
          asc1_code: r.asc1_code,
          asc2_code: r.asc2_code,
          asc3_code: r.asc3_code,
          population_2021: r.population_2021,
          males_2021: r.males_2021,
          females_2021: r.females_2021,
          families_2021: r.families_2021,
          dwellings_2021: r.dwellings_2021,
          occupied_dwellings_2021: r.occupied_dwellings_2021,
          buildings_2021: r.buildings_2021,
          residential_buildings_2021: r.residential_buildings_2021,
          superficie_kmq: null,
          centroid_lat: r.centroid_lat,
          centroid_lng: r.centroid_lng,
          polygon_coords: r.polygon_coords,
          metadata_json: r.metadata_json ?? {},
          import_batch_id: batchId,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) continue;

    const { error, count } = await supabase
      .from("census_sections_r03_2021" as any)
      .upsert(rows as any[], { onConflict: "source_dataset,section_code" })
      .select("id");

    if (error) {
      rows.forEach((_, j) => errors.push({ index: i + j, reason: error.message }));
    } else {
      imported += count ?? rows.length;
    }
  }

  const skipped = records.length - imported - errors.length;
  return { total: records.length, imported, skipped, errors, batchId };
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function fetchR03Stats() {
  const { data, error } = await supabase
    .from("census_sections_r03_2021" as any)
    .select("section_code, comune_istat_code, asc1_code, asc2_code, asc3_code, population_2021, polygon_coords, centroid_lat");

  if (error || !data) return null;

  const comuniSet = new Set<string>();
  const asc1Set = new Set<string>();
  const asc2Set = new Set<string>();
  const asc3Set = new Set<string>();
  let withGeometry = 0;
  let withCentroid = 0;
  let withPop = 0;
  let totalPop = 0;
  let sectionsWithAsc1 = 0;
  let sectionsWithAsc2 = 0;

  for (const r of data as any[]) {
    if (r.comune_istat_code) comuniSet.add(r.comune_istat_code);
    if (r.asc1_code) { asc1Set.add(r.asc1_code); sectionsWithAsc1++; }
    if (r.asc2_code) { asc2Set.add(r.asc2_code); sectionsWithAsc2++; }
    if (r.asc3_code) asc3Set.add(r.asc3_code);
    if (r.polygon_coords) withGeometry++;
    if (r.centroid_lat != null) withCentroid++;
    if (r.population_2021 != null) { withPop++; totalPop += r.population_2021; }
  }

  return {
    totalSections: data.length,
    comuniDistinti: comuniSet.size,
    asc1Distinti: asc1Set.size,
    asc2Distinti: asc2Set.size,
    asc3Distinti: asc3Set.size,
    sectionsWithAsc1,
    sectionsWithAsc2,
    withGeometry,
    withCentroid,
    withPopulation: withPop,
    totalPopulation: totalPop,
  };
}

/* ------------------------------------------------------------------ */
/*  ASC ↔ Sections Validation                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate coherence between R03 census sections and ASC layer.
 * Level-aware: compares asc1_code with asc_level=1, asc2_code with asc_level=2, etc.
 * Scoped: only considers ASC layer records whose comune_istat_code is in R03 comuni.
 */
export async function validateAscSectionCoherence(): Promise<AscValidationReport | null> {
  // Paginated fetch of sections (bypass 1000-row default limit)
  const PAGE = 5000;
  const allSections: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("census_sections_r03_2021" as any)
      .select("section_code, comune_istat_code, asc1_code, asc2_code, asc3_code")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allSections.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (allSections.length === 0) return null;

  // Paginated fetch of ASC areas
  const allAscAreas: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sub_municipal_areas_2021")
      .select("area_code, asc_level, comune_istat_code")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allAscAreas.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const sectionsList = allSections;
  const ascList = allAscAreas;

  // Collect R03 comuni
  const r03Comuni = new Set<string>();
  const asc1InSections = new Set<string>();
  const asc2InSections = new Set<string>();
  const asc3InSections = new Set<string>();
  let sectionsWithAsc1 = 0;
  let sectionsWithAsc2 = 0;
  let sectionsWithAsc3 = 0;

  for (const s of sectionsList) {
    if (s.comune_istat_code) r03Comuni.add(s.comune_istat_code);
    if (s.asc1_code) { asc1InSections.add(s.asc1_code); sectionsWithAsc1++; }
    if (s.asc2_code) { asc2InSections.add(s.asc2_code); sectionsWithAsc2++; }
    if (s.asc3_code) { asc3InSections.add(s.asc3_code); sectionsWithAsc3++; }
  }

  // Scope ASC layer to R03 comuni only, split by level
  const ascByLevel: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
  for (const a of ascList) {
    if (!a.area_code) continue;
    // Scope: only consider ASC records in comuni that R03 covers
    if (a.comune_istat_code && !r03Comuni.has(a.comune_istat_code)) continue;
    const lvl = a.asc_level ?? 0;
    if (lvl >= 1 && lvl <= 3) ascByLevel[lvl].add(a.area_code);
  }

  function buildLevelDetail(level: number, codesInSections: Set<string>): AscLevelMatchDetail {
    const codesInLayer = ascByLevel[level] || new Set<string>();
    const matched = [...codesInSections].filter(c => codesInLayer.has(c));
    const unmatchedInSections = [...codesInSections].filter(c => !codesInLayer.has(c));
    const unmatchedInLayer = [...codesInLayer].filter(c => !codesInSections.has(c));
    const coveragePct = codesInSections.size > 0 ? (matched.length / codesInSections.size) * 100 : 0;
    return { level, codesInSections, codesInLayer, matched, unmatchedInSections, unmatchedInLayer, coveragePct };
  }

  const asc1 = buildLevelDetail(1, asc1InSections);
  const asc2 = buildLevelDetail(2, asc2InSections);
  const asc3 = buildLevelDetail(3, asc3InSections);

  // Aggregate legacy compat
  const allCodesInSections = new Set([...asc1InSections, ...asc2InSections, ...asc3InSections]);
  const allCodesInLayer = new Set([...ascByLevel[1], ...ascByLevel[2], ...ascByLevel[3]]);
  const allMatched = [...allCodesInSections].filter(c => allCodesInLayer.has(c));
  const allUnmatchedInSections = [...allCodesInSections].filter(c => !allCodesInLayer.has(c));
  const allUnmatchedInLayer = [...allCodesInLayer].filter(c => !allCodesInSections.has(c));
  const totalUnique = new Set([...allCodesInSections, ...allCodesInLayer]).size;
  const matchPercentage = totalUnique > 0 ? (allMatched.length / totalUnique) * 100 : 0;

  const sectionsWithoutAny = sectionsList.filter((s: any) => !s.asc1_code && !s.asc2_code && !s.asc3_code).length;

  const warnings: string[] = [];
  if (ascList.length === 0) warnings.push("Layer ASC vuoto — nessun confronto possibile");
  if (sectionsList.length === 0) warnings.push("Nessuna sezione R03 caricata");
  const scopedAscCount = ascByLevel[1].size + ascByLevel[2].size + ascByLevel[3].size;
  const totalAscCount = ascList.length;
  if (totalAscCount > 0 && scopedAscCount === 0) {
    warnings.push("Nessun record ASC nel layer corrisponde ai comuni R03 — scope vuoto");
  }
  if (asc1.unmatchedInSections.length > 0) {
    warnings.push(`ASC1: ${asc1.unmatchedInSections.length} codici in sezioni non presenti nel layer (scope Lombardia)`);
  }
  if (asc2.unmatchedInSections.length > 0) {
    warnings.push(`ASC2: ${asc2.unmatchedInSections.length} codici in sezioni non presenti nel layer (scope Lombardia)`);
  }

  return {
    totalSections: sectionsList.length,
    sectionsWithAsc1,
    sectionsWithAsc2,
    sectionsWithAsc3,
    asc1,
    asc2,
    asc3,
    r03ComuniCovered: r03Comuni.size,
    r03ComuniCodes: r03Comuni,
    sectionsWithAsc1Pct: sectionsList.length > 0 ? (sectionsWithAsc1 / sectionsList.length) * 100 : 0,
    sectionsWithAsc2Pct: sectionsList.length > 0 ? (sectionsWithAsc2 / sectionsList.length) * 100 : 0,
    sectionsWithoutAscPct: sectionsList.length > 0 ? (sectionsWithoutAny / sectionsList.length) * 100 : 0,
    warnings,
    // Legacy compat
    ascCodesInSections: allCodesInSections,
    ascCodesInLayer: allCodesInLayer,
    matchedCodes: allMatched,
    unmatchedInSections: allUnmatchedInSections,
    unmatchedInLayer: allUnmatchedInLayer,
    matchPercentage,
    comuniCovered: r03Comuni.size,
  };
}

/**
 * Rollback an R03 import batch.
 */
export async function rollbackR03Batch(batchId: string) {
  const { error, count } = await supabase
    .from("census_sections_r03_2021" as any)
    .delete()
    .eq("import_batch_id", batchId);

  return { success: !error, deleted: count ?? 0, error: error?.message };
}
