import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders as getCorsHeaders, handleCors } from "../_shared/cors.ts";

let _req: Request | undefined;
const log = (s: string, d?: string) => console.log(`[territorial-import] ${s}${d ? ` — ${d}` : ""}`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...getCorsHeaders(_req), "Content-Type": "application/json" } });

/* ── CSV parser (robust, handles quotes/BOM/semicolons) ── */

function parseCsvLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) { fields.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsv(text: string): Record<string, string>[] {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const lines = t.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], sep);
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i], sep);
    if (vals.length < 2) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => { obj[h] = vals[j] ?? ""; });
    records.push(obj);
  }
  return records;
}

function intSafe(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) ? null : n;
}

/* ── Region detection helper ── */

const COD_REG_MAP: Record<string, string> = {
  "01": "Piemonte", "02": "Valle d'Aosta", "03": "Lombardia", "04": "Trentino-Alto Adige",
  "05": "Veneto", "06": "Friuli-Venezia Giulia", "07": "Liguria", "08": "Emilia-Romagna",
  "09": "Toscana", "10": "Umbria", "11": "Marche", "12": "Lazio", "13": "Abruzzo",
  "14": "Molise", "15": "Campania", "16": "Puglia", "17": "Basilicata", "18": "Calabria",
  "19": "Sicilia", "20": "Sardegna",
};

interface RegionInfo {
  regioni: string[];
  regioniCount: number;
  isMonoRegione: boolean;
  regioneRilevata: string | null;
  multiRegioneWarning: string | null;
  detectedVia: "DEN_REG" | "REGIONE" | "COD_REG" | "none";
}

function detectRegions(records: Record<string, string>[]): RegionInfo {
  const regSet = new Set<string>();
  let detectedVia: RegionInfo["detectedVia"] = "none";

  for (const r of records) {
    // Priority: DEN_REG > REGIONE > COD_REG (mapped to name)
    const denReg = (r["DEN_REG"] || "").trim();
    const regione = (r["REGIONE"] || "").trim();
    const codReg = (r["COD_REG"] || "").trim();

    if (denReg) { regSet.add(denReg); if (detectedVia === "none") detectedVia = "DEN_REG"; }
    else if (regione) { regSet.add(regione); if (detectedVia === "none") detectedVia = "REGIONE"; }
    else if (codReg) {
      const mapped = COD_REG_MAP[codReg.padStart(2, "0")] || `Regione ${codReg}`;
      regSet.add(mapped);
      if (detectedVia === "none") detectedVia = "COD_REG";
    }
  }

  const regioni = [...regSet].sort();
  const isMonoRegione = regioni.length === 1;
  return {
    regioni,
    regioniCount: regioni.length,
    isMonoRegione,
    regioneRilevata: isMonoRegione ? regioni[0] : null,
    multiRegioneWarning: regioni.length > 1
      ? `File multi-regione: contiene ${regioni.length} regioni (${regioni.join(", ")}). Se intendevi caricare una sola regione, verifica il file.`
      : null,
    detectedVia,
  };
}

/* ── Column mapping helpers ── */

const COMUNI_REQUIRED_COLS = { codice: ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE", "COD_COM"], nome: ["DEN_COM", "DENOMINAZIONE", "COMUNE"] };
const LOCALITA_REQUIRED_COLS = { codice_comune: ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE"], codice_loc: ["COD_LOC", "CODICE_LOCALITA", "LOC"], nome_loc: ["DEN_LOC", "DENOMINAZIONE_LOC", "LOCALITA"] };
const OPTIONAL_COLS = { regione: ["DEN_REG", "REGIONE", "COD_REG"], provincia: ["DEN_PRO", "DEN_PROV", "PROVINCIA", "COD_PRO"], coordinate: ["LAT", "LNG", "LON"] };

function findColumn(headers: string[], candidates: string[]): string | null {
  return candidates.find(c => headers.includes(c)) ?? null;
}

interface DetailedValidation {
  totalRows: number;
  headers: string[];
  headersFound: Record<string, string | null>;
  headersExpected: Record<string, string[]>;
  missingCriticalColumns: string[];
  validRows: number;
  invalidRows: number;
  duplicates: number;
  noCode: number;
  noName: number;
  noRegione: number;
  noCoords: number;
  withCoords: number;
  region: RegionInfo;
  errors: { row: number; reason: string }[];
  preview: Record<string, string>[];
  recordsToImport: number;
  recordsToSkip: number;
  skipReasons: Record<string, number>;
}

function buildDetailedValidation(
  records: Record<string, string>[],
  datasetType: string,
): DetailedValidation {
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const region = detectRegions(records);
  const errors: { row: number; reason: string }[] = [];
  const seenKeys = new Set<string>();
  let valid = 0, noCode = 0, noName = 0, noRegione = 0, noCoords = 0, withCoords = 0, duplicates = 0;
  const skipReasons: Record<string, number> = {};

  const addSkip = (reason: string) => { skipReasons[reason] = (skipReasons[reason] || 0) + 1; };

  // Detect column presence
  const headersFound: Record<string, string | null> = {};
  const headersExpected: Record<string, string[]> = {};
  const missingCriticalColumns: string[] = [];

  if (datasetType === "COMUNI_ITALIA") {
    headersExpected["codice_istat"] = COMUNI_REQUIRED_COLS.codice;
    headersExpected["nome_comune"] = COMUNI_REQUIRED_COLS.nome;
    headersExpected["regione"] = OPTIONAL_COLS.regione;
    headersExpected["provincia"] = OPTIONAL_COLS.provincia;
    headersExpected["coordinate"] = OPTIONAL_COLS.coordinate;

    headersFound["codice_istat"] = findColumn(headers, COMUNI_REQUIRED_COLS.codice);
    headersFound["nome_comune"] = findColumn(headers, COMUNI_REQUIRED_COLS.nome);
    headersFound["regione"] = findColumn(headers, OPTIONAL_COLS.regione);
    headersFound["provincia"] = findColumn(headers, OPTIONAL_COLS.provincia);

    if (!headersFound["codice_istat"]) missingCriticalColumns.push(`Codice ISTAT comune (attesi: ${COMUNI_REQUIRED_COLS.codice.join(" | ")})`);
    if (!headersFound["nome_comune"]) missingCriticalColumns.push(`Nome comune (attesi: ${COMUNI_REQUIRED_COLS.nome.join(" | ")})`);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const code = r["PRO_COM_T"] || r["PRO_COM"] || r["CODICE_COMUNE"] || r["COD_COM"] || "";
      const name = r["DEN_COM"] || r["DENOMINAZIONE"] || r["COMUNE"] || "";
      if (!code) { noCode++; addSkip("codice_istat_mancante"); if (errors.length < 20) errors.push({ row: i + 2, reason: "Codice ISTAT comune mancante" }); continue; }
      if (!name) { noName++; addSkip("nome_mancante"); if (errors.length < 20) errors.push({ row: i + 2, reason: "Nome comune mancante" }); continue; }
      const key = `comune|${code}`;
      if (seenKeys.has(key)) { duplicates++; addSkip("duplicato"); if (errors.length < 20) errors.push({ row: i + 2, reason: `Duplicato: ${code}` }); continue; }
      seenKeys.add(key);
      valid++;
      const reg = r["DEN_REG"] || r["REGIONE"] || "";
      if (!reg) noRegione++;
      if (r["LAT"] && (r["LNG"] || r["LON"])) withCoords++; else noCoords++;
    }
  } else if (datasetType === "LOCALITA_ISTAT") {
    headersExpected["codice_comune"] = LOCALITA_REQUIRED_COLS.codice_comune;
    headersExpected["codice_localita"] = LOCALITA_REQUIRED_COLS.codice_loc;
    headersExpected["nome_localita"] = LOCALITA_REQUIRED_COLS.nome_loc;
    headersExpected["regione"] = OPTIONAL_COLS.regione;
    headersExpected["coordinate"] = OPTIONAL_COLS.coordinate;

    headersFound["codice_comune"] = findColumn(headers, LOCALITA_REQUIRED_COLS.codice_comune);
    headersFound["codice_localita"] = findColumn(headers, LOCALITA_REQUIRED_COLS.codice_loc);
    headersFound["nome_localita"] = findColumn(headers, LOCALITA_REQUIRED_COLS.nome_loc);
    headersFound["regione"] = findColumn(headers, OPTIONAL_COLS.regione);

    if (!headersFound["codice_comune"]) missingCriticalColumns.push(`Codice ISTAT comune (attesi: ${LOCALITA_REQUIRED_COLS.codice_comune.join(" | ")})`);
    if (!headersFound["codice_localita"] && !headersFound["nome_localita"]) missingCriticalColumns.push(`Codice o nome località (attesi: ${[...LOCALITA_REQUIRED_COLS.codice_loc, ...LOCALITA_REQUIRED_COLS.nome_loc].join(" | ")})`);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const code = r["PRO_COM_T"] || r["PRO_COM"] || r["CODICE_COMUNE"] || "";
      const locCode = r["COD_LOC"] || r["CODICE_LOCALITA"] || r["LOC"] || "";
      const locName = r["DEN_LOC"] || r["DENOMINAZIONE_LOC"] || r["LOCALITA"] || "";
      if (!code) { noCode++; addSkip("codice_comune_mancante"); if (errors.length < 20) errors.push({ row: i + 2, reason: "Codice ISTAT comune mancante" }); continue; }
      if (!locCode && !locName) { noName++; addSkip("loc_mancante"); if (errors.length < 20) errors.push({ row: i + 2, reason: "Codice o nome località mancante" }); continue; }
      const key = `loc|${code}|${locCode || locName}`;
      if (seenKeys.has(key)) { duplicates++; addSkip("duplicato"); if (errors.length < 20) errors.push({ row: i + 2, reason: `Duplicato: ${code}/${locCode || locName}` }); continue; }
      seenKeys.add(key);
      valid++;
      const reg = r["DEN_REG"] || "";
      if (!reg) noRegione++;
      if (r["LAT"] && (r["LNG"] || r["LON"])) withCoords++; else noCoords++;
    }
  }

  return {
    totalRows: records.length,
    headers,
    headersFound,
    headersExpected,
    missingCriticalColumns,
    validRows: valid,
    invalidRows: records.length - valid,
    duplicates,
    noCode,
    noName,
    noRegione,
    noCoords,
    withCoords,
    region,
    errors,
    preview: records.slice(0, 20),
    recordsToImport: valid,
    recordsToSkip: records.length - valid,
    skipReasons,
  };
}

/* ── Import processors ── */

const CHUNK = 500;
const R03_SEZ_CHUNK = 1000;
const R03_SEZ_STUCK_TIMEOUT_MINUTES = 20;
const MAX_IMPORT_ERRORS = 100;

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function buildProgressState(params: {
  datasetType: string;
  processedRows: number;
  totalRows: number;
  failedRows: number;
  skippedRows: number;
  chunkIndex: number;
  chunkCount: number;
}) {
  const percentage = params.totalRows > 0
    ? Math.min(100, Math.round((params.processedRows / params.totalRows) * 100))
    : 0;

  return {
    datasetType: params.datasetType,
    processedRows: params.processedRows,
    totalRows: params.totalRows,
    failedRows: params.failedRows,
    skippedRows: params.skippedRows,
    chunkIndex: params.chunkIndex,
    chunkCount: params.chunkCount,
    percentage,
    lastHeartbeatAt: nowIso(),
  };
}

function getJobHeartbeat(job: Record<string, unknown>): string | null {
  const stats = asRecord(job.stats);
  const progress = asRecord(stats.progress);
  const heartbeat = progress.lastHeartbeatAt;

  if (typeof heartbeat === "string" && heartbeat) return heartbeat;
  if (typeof job.updated_at === "string" && job.updated_at) return job.updated_at;
  if (typeof job.started_at === "string" && job.started_at) return job.started_at;
  if (typeof job.created_at === "string" && job.created_at) return job.created_at;
  return null;
}

function isStaleImportingJob(job: Record<string, unknown>) {
  if (job.status !== "importing") return false;

  const heartbeat = getJobHeartbeat(job);
  if (!heartbeat) return false;

  const heartbeatMs = new Date(heartbeat).getTime();
  if (Number.isNaN(heartbeatMs)) return false;

  return Date.now() - heartbeatMs > R03_SEZ_STUCK_TIMEOUT_MINUTES * 60 * 1000;
}

async function recoverStuckJobs(
  admin: ReturnType<typeof createClient>,
  logStep?: (step: string, payload?: Record<string, unknown>) => void,
) {
  const { data, error } = await admin
    .from("territorial_dataset_jobs")
    .select("id, dataset_type, status, created_at, started_at, updated_at, records_total, records_imported, records_errors, records_skipped, stats, error_log, warnings")
    .eq("status", "importing")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data?.length) {
    if (error) logStep?.("job_recovery_query_failed", { error: error.message });
    return { recovered: 0, jobIds: [] as string[] };
  }

  const staleJobs = (data as Record<string, unknown>[]).filter(isStaleImportingJob);
  if (staleJobs.length === 0) return { recovered: 0, jobIds: [] as string[] };

  const recoveredIds: string[] = [];
  for (const staleJob of staleJobs) {
    const stats = asRecord(staleJob.stats);
    const progress = asRecord(stats.progress);
    const heartbeat = getJobHeartbeat(staleJob);
    const staleForMinutes = heartbeat
      ? Math.max(1, Math.round((Date.now() - new Date(heartbeat).getTime()) / 60000))
      : R03_SEZ_STUCK_TIMEOUT_MINUTES;
    const reason = `timeout_or_stuck_job: nessun heartbeat da ${staleForMinutes} minuti`;
    const errorLog = asArray(staleJob.error_log);
    const warnings = asArray(staleJob.warnings);

    const { error: updateError } = await admin
      .from("territorial_dataset_jobs")
      .update({
        status: "failed",
        completed_at: nowIso(),
        updated_at: nowIso(),
        error_log: [...errorLog, { reason }].slice(-MAX_IMPORT_ERRORS),
        warnings: [...warnings, "Job recuperato automaticamente come stale import"].slice(-MAX_IMPORT_ERRORS),
        stats: {
          ...stats,
          progress: {
            ...progress,
            stale: true,
            staleLabel: "failed_stale",
            staleForMinutes,
            lastHeartbeatAt: heartbeat,
          },
          recovery: {
            reason: "timeout_or_stuck_job",
            recoveredAt: nowIso(),
            staleForMinutes,
            timeoutMinutes: R03_SEZ_STUCK_TIMEOUT_MINUTES,
            label: "failed_stale",
          },
        },
      })
      .eq("id", staleJob.id as string);

    if (!updateError) {
      recoveredIds.push(staleJob.id as string);
      logStep?.("job_marked_failed", {
        jobId: staleJob.id,
        reason: "timeout_or_stuck_job",
        staleForMinutes,
      });
    }
  }

  return { recovered: recoveredIds.length, jobIds: recoveredIds };
}

/* ── COMUNI_ITALIA import ── */

async function importComuniItalia(
  rows: Record<string, string>[],
  batchId: string,
  admin: ReturnType<typeof createClient>,
) {
  let processed = 0, skipped = 0, failed = 0;
  const errors: { idx: number; reason: string }[] = [];
  const warnings: string[] = [];
  const seenKeys = new Set<string>();

  // Pre-count existing comuni to distinguish new vs updated
  const { count: existingBefore } = await admin.from("territorial_registry")
    .select("id", { count: "exact", head: true })
    .eq("geographic_level", "comune");
  const countBefore = existingBefore ?? 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const dbRows = chunk.map((r, j) => {
      const istatCode = r["PRO_COM_T"] || r["PRO_COM"] || r["CODICE_COMUNE"] || r["COD_COM"] || "";
      const comuneName = r["DEN_COM"] || r["DENOMINAZIONE"] || r["COMUNE"] || "";
      if (!istatCode) { errors.push({ idx: i + j, reason: "Codice ISTAT comune mancante" }); skipped++; return null; }
      if (!comuneName) { errors.push({ idx: i + j, reason: "Nome comune mancante" }); skipped++; return null; }
      const key = `comune|${istatCode}`;
      if (seenKeys.has(key)) { skipped++; return null; }
      seenKeys.add(key);
      return {
        comune_istat_code: istatCode,
        comune_name: comuneName,
        provincia_code: r["COD_PRO"] || r["COD_PROV"] || null,
        provincia_name: r["DEN_PRO"] || r["DEN_PROV"] || r["PROVINCIA"] || null,
        regione_code: r["COD_REG"] || null,
        regione_name: r["DEN_REG"] || r["REGIONE"] || null,
        geographic_level: "comune",
        source_key: "istat_comuni",
        source_label: "ISTAT — Anagrafe Comuni",
        source_year: intSafe(r["ANNO"]) || 2024,
        dataset_status: "active",
        coverage_status: "available",
        centroid_lat: r["LAT"] ? parseFloat(r["LAT"]) || null : null,
        centroid_lng: r["LNG"] || r["LON"] ? parseFloat(r["LNG"] || r["LON"]) || null : null,
        metadata_json: {},
        localita_code: "",
        asc_code: "",
        import_batch_id: batchId,
      };
    }).filter(Boolean);

    if (dbRows.length === 0) continue;
    const { error, count } = await admin.from("territorial_registry")
      .upsert(dbRows as any[], { onConflict: "comune_istat_code,geographic_level,localita_code,asc_code" })
      .select("id");
    if (error) {
      log("comuni upsert error", error.message);
      dbRows.forEach((_, j) => errors.push({ idx: i + j, reason: error.message }));
      failed += dbRows.length;
    } else {
      processed += count ?? dbRows.length;
    }
  }

  // Post-count to derive inserted vs updated
  const { count: existingAfter } = await admin.from("territorial_registry")
    .select("id", { count: "exact", head: true })
    .eq("geographic_level", "comune");
  const countAfter = existingAfter ?? 0;
  const inserted = countAfter - countBefore;
  const updated = processed - inserted;

  return { inserted: Math.max(inserted, 0), updated: Math.max(updated, 0), processed, skipped, failed, errors, warnings };
}

/* ── LOCALITA_ISTAT import ── */

async function importLocalitaIstat(
  rows: Record<string, string>[],
  batchId: string,
  admin: ReturnType<typeof createClient>,
) {
  let processed = 0, skipped = 0, failed = 0;
  const errors: { idx: number; reason: string }[] = [];
  const warnings: string[] = [];
  const seenKeys = new Set<string>();

  // Pre-count existing località
  const { count: existingBefore } = await admin.from("territorial_registry")
    .select("id", { count: "exact", head: true })
    .eq("geographic_level", "localita");
  const countBefore = existingBefore ?? 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const dbRows = chunk.map((r, j) => {
      const istatCode = r["PRO_COM_T"] || r["PRO_COM"] || r["CODICE_COMUNE"] || "";
      const locCode = r["COD_LOC"] || r["CODICE_LOCALITA"] || r["LOC"] || "";
      const locName = r["DEN_LOC"] || r["DENOMINAZIONE_LOC"] || r["LOCALITA"] || "";
      if (!istatCode) { errors.push({ idx: i + j, reason: "Codice ISTAT comune mancante" }); skipped++; return null; }
      if (!locCode && !locName) { errors.push({ idx: i + j, reason: "Codice o nome località mancante" }); skipped++; return null; }
      const key = `loc|${istatCode}|${locCode || locName}`;
      if (seenKeys.has(key)) { skipped++; return null; }
      seenKeys.add(key);
      const locType = r["TIPO_LOC"] || r["TIPO"] || (r["CAPOLUOGO"] === "1" ? "capoluogo" : "localita");
      return {
        comune_istat_code: istatCode,
        comune_name: r["DEN_COM"] || r["COMUNE"] || "",
        provincia_code: r["COD_PRO"] || null,
        provincia_name: r["DEN_PRO"] || r["DEN_PROV"] || null,
        regione_code: r["COD_REG"] || null,
        regione_name: r["DEN_REG"] || null,
        localita_code: locCode || locName,
        localita_name: locName || locCode,
        localita_type: locType,
        asc_code: "",
        geographic_level: "localita",
        source_key: "istat_localita",
        source_label: "ISTAT — Località abitate",
        source_year: intSafe(r["ANNO"]) || 2021,
        dataset_status: "active",
        coverage_status: "available",
        centroid_lat: r["LAT"] ? parseFloat(r["LAT"]) || null : null,
        centroid_lng: r["LNG"] || r["LON"] ? parseFloat(r["LNG"] || r["LON"]) || null : null,
        metadata_json: {},
        import_batch_id: batchId,
      };
    }).filter(Boolean);

    if (dbRows.length === 0) continue;
    const { error, count } = await admin.from("territorial_registry")
      .upsert(dbRows as any[], { onConflict: "comune_istat_code,geographic_level,localita_code,asc_code" })
      .select("id");
    if (error) {
      log("localita upsert error", error.message);
      dbRows.forEach((_, j) => errors.push({ idx: i + j, reason: error.message }));
      failed += dbRows.length;
    } else {
      processed += count ?? dbRows.length;
    }
  }

  // Post-count to derive inserted vs updated
  const { count: existingAfter } = await admin.from("territorial_registry")
    .select("id", { count: "exact", head: true })
    .eq("geographic_level", "localita");
  const countAfter = existingAfter ?? 0;
  const inserted = countAfter - countBefore;
  const updated = processed - inserted;

  return { inserted: Math.max(inserted, 0), updated: Math.max(updated, 0), processed, skipped, failed, errors, warnings };
}

async function importR03Sez(
  rows: Record<string, string>[],
  ascMappings: Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>,
  batchId: string,
  admin: ReturnType<typeof createClient>,
  jobId: string,
  logStep: (step: string, payload?: Record<string, unknown>) => void,
  regionInfo: RegionInfo,
) {
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { idx: number; reason: string }[] = [];
  const warnings: string[] = [];
  const totalRows = rows.length;
  const chunkCount = Math.ceil(totalRows / R03_SEZ_CHUNK);

  // Derive region label from detected region (no more hardcoded Lombardia)
  const detectedRegionName = regionInfo.regioneRilevata ?? null;
  const detectedRegionCode = detectedRegionName
    ? Object.entries(COD_REG_MAP).find(([_, v]) => v === detectedRegionName)?.[0] ?? null
    : null;
  const sourceLabel = detectedRegionName
    ? `ISTAT Censimento 2021 — ${detectedRegionName}`
    : "ISTAT Censimento 2021";

  logStep("r03_region_detected", {
    regionName: detectedRegionName,
    regionCode: detectedRegionCode,
    isMonoRegione: regionInfo.isMonoRegione,
    regioniCount: regionInfo.regioniCount,
  });

  for (let i = 0; i < rows.length; i += R03_SEZ_CHUNK) {
    const chunk = rows.slice(i, i + R03_SEZ_CHUNK);
    const chunkIndex = Math.floor(i / R03_SEZ_CHUNK) + 1;
    const dbRows = chunk.map((r, j) => {
      const sez = r["SEZ2021"] || r["SEZ"] || "";
      const com = r["PRO_COM_T"] || r["PRO_COM"] || "";
      if (!sez) {
        failed++;
        if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: i + j, reason: "SEZ2021 mancante" });
        return null;
      }
      if (!com) {
        failed++;
        if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: i + j, reason: "PRO_COM_T mancante" });
        return null;
      }
      const m = ascMappings.get(sez);
      // Per-row region: use row-level COD_REG/DEN_REG if available, fall back to file-level detection
      const rowRegCode = r["COD_REG"] || detectedRegionCode || null;
      const rowRegName = r["DEN_REG"] || r["REGIONE"] || detectedRegionName || null;
      return {
        source_dataset: "R03_21",
        source_year: 2021,
        source_label: sourceLabel,
        regione_code: rowRegCode,
        regione_name: rowRegName,
        provincia_code: r["COD_PRO"] || null,
        comune_istat_code: com,
        comune_name: r["DEN_COM"] || "",
        section_code: sez,
        asc1_code: m?.asc1 || r["COD_ASC1"] || null,
        asc2_code: m?.asc2 || r["COD_ASC2"] || null,
        asc3_code: m?.asc3 || r["COD_ASC3"] || null,
        population_2021: intSafe(r["P1"]),
        males_2021: intSafe(r["P2"]),
        females_2021: intSafe(r["P3"]),
        families_2021: intSafe(r["P14"] || r["ST1"]),
        dwellings_2021: intSafe(r["A1"]),
        occupied_dwellings_2021: intSafe(r["A2"]),
        buildings_2021: intSafe(r["E3"]),
        residential_buildings_2021: intSafe(r["E1"]),
        superficie_kmq: null,
        centroid_lat: null,
        centroid_lng: null,
        polygon_coords: null,
        metadata_json: {},
        import_batch_id: batchId,
      };
    }).filter(Boolean);

    // Deduplicate within batch by section_code (last-wins)
    const dedupMap = new Map<string, (typeof dbRows)[0]>();
    for (const row of dbRows) {
      if (row) dedupMap.set(row.section_code, row);
    }
    const uniqueRows = [...dedupMap.values()];
    const batchDuplicatesDropped = dbRows.length - uniqueRows.length;
    if (batchDuplicatesDropped > 0) skipped += batchDuplicatesDropped;

    logStep("batch_started", {
      chunkIndex,
      chunkCount,
      chunkRows: chunk.length,
      rowsReady: uniqueRows.length,
      batchDuplicatesDropped,
    });

    if (uniqueRows.length === 0) {
      skipped += chunk.length;
      const progress = buildProgressState({
        datasetType: "R03_CSV_SEZ",
        processedRows: imported,
        totalRows,
        failedRows: failed,
        skippedRows: skipped,
        chunkIndex,
        chunkCount,
      });

      await admin.from("territorial_dataset_jobs").update({
        records_total: totalRows,
        records_imported: imported,
        records_errors: failed,
        records_skipped: skipped,
        updated_at: nowIso(),
        stats: { progress },
      }).eq("id", jobId);

      logStep("batch_progress", {
        chunkIndex,
        chunkCount,
        processedRows: imported,
        totalRows,
        failedRows: failed,
        skippedRows: skipped,
        percentage: progress.percentage,
      });
      continue;
    }

    const { error } = await admin
      .from("census_sections_r03_2021")
      .upsert(uniqueRows as any[], { onConflict: "source_dataset,section_code" });

    if (error) {
      failed += uniqueRows.length;
      if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: i, reason: `Batch ${chunkIndex}: ${error.message}` });
      logStep("job_marked_failed", {
        chunkIndex,
        chunkCount,
        reason: error.message,
      });
      throw new Error(`R03_CSV_SEZ batch ${chunkIndex}/${chunkCount} failed: ${error.message}`);
    }

    imported += uniqueRows.length;

    const progress = buildProgressState({
      datasetType: "R03_CSV_SEZ",
      processedRows: imported,
      totalRows,
      failedRows: failed,
      skippedRows: skipped,
      chunkIndex,
      chunkCount,
    });

    await admin.from("territorial_dataset_jobs").update({
      records_total: totalRows,
      records_imported: imported,
      records_errors: failed,
      records_skipped: skipped,
      updated_at: nowIso(),
      stats: { progress },
    }).eq("id", jobId);

    logStep("batch_progress", {
      chunkIndex,
      chunkCount,
      processedRows: imported,
      totalRows,
      failedRows: failed,
      skippedRows: skipped,
      percentage: progress.percentage,
    });
  }

  logStep("batch_completed", {
    processedRows: imported,
    totalRows,
    failedRows: failed,
    skippedRows: skipped,
    chunkCount,
  });

  return { inserted: imported, updated: 0, processed: imported, skipped, failed, errors, warnings };
}

async function importAscCsv(
  rows: Record<string, string>[],
  batchId: string,
  admin: ReturnType<typeof createClient>,
) {
  let imported = 0;
  const errors: { idx: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const dbRows = chunk.map((r, j) => {
      const areaCode = r["COD_ASC"] || r["AREA_CODE"] || "";
      const areaName = r["DEN_ASC"] || r["AREA_NAME"] || "";
      const comCode = r["PRO_COM_T"] || r["PRO_COM"] || "";
      const ascLevel = intSafe(r["LIVELLO"] || r["ASC_LEVEL"]);
      if (!areaCode) { errors.push({ idx: i + j, reason: "COD_ASC mancante" }); return null; }
      return {
        source_dataset: "ASC_21",
        source_year: 2021,
        source_label: "ISTAT Aree Sub Comunali 2021",
        area_code: areaCode,
        area_name: areaName || areaCode,
        area_type: "area_sub_comunale",
        asc_level: ascLevel,
        comune_istat_code: comCode || null,
        comune_name: r["DEN_COM"] || "",
        provincia_code: r["COD_PRO"] || null,
        provincia_name: r["DEN_PRO"] || r["DEN_PROV"] || null,
        regione_code: r["COD_REG"] || null,
        regione_name: r["DEN_REG"] || null,
        popolazione: intSafe(r["POP_RES"]),
        nuclei_familiari: intSafe(r["FAM"]),
        densita: null,
        eta_media: null,
        superficie_kmq: null,
        centroid_lat: null,
        centroid_lng: null,
        polygon_coords: null,
        metadata_json: {},
        import_batch_id: batchId,
      };
    }).filter(Boolean);

    if (dbRows.length === 0) continue;
    const { error, count } = await admin.from("sub_municipal_areas_2021").upsert(dbRows as any[], { onConflict: "source_dataset,asc_level,area_code" }).select("id");
    if (error) { dbRows.forEach((_, j) => errors.push({ idx: i + j, reason: error.message })); }
    else imported += count ?? dbRows.length;
  }

  return { inserted: imported, updated: 0, skipped: 0, failed: errors.length, errors };
}

/* ── Post-import validation ── */

async function validatePostImport(datasetType: string, admin: ReturnType<typeof createClient>) {
  const result: Record<string, unknown> = { datasetType, timestamp: new Date().toISOString() };

  if (datasetType.startsWith("R03") || datasetType === "R03_CSV_SEZ") {
    const { data, error } = await admin.from("census_sections_r03_2021")
      .select("section_code, comune_istat_code, asc1_code, asc2_code, population_2021");
    if (!error && data) {
      const comuni = new Set(data.map((r: any) => r.comune_istat_code).filter(Boolean));
      const withPop = data.filter((r: any) => r.population_2021 != null).length;
      const withAsc1 = data.filter((r: any) => r.asc1_code).length;
      const withAsc2 = data.filter((r: any) => r.asc2_code).length;
      result.r03 = { sections: data.length, comuni: comuni.size, withPopulation: withPop, withAsc1, withAsc2 };
    }
  }

  if (datasetType === "ASC_2021") {
    const { data, error } = await admin.from("sub_municipal_areas_2021")
      .select("area_code, asc_level, regione_name, comune_name, polygon_coords, centroid_lat, popolazione");
    if (!error && data) {
      const byLevel: Record<string, number> = {};
      const byRegione: Record<string, number> = {};
      let withGeom = 0, withPop = 0;
      const comuni = new Set<string>();
      for (const r of data as any[]) {
        const lvl = String(r.asc_level ?? "n/a");
        byLevel[lvl] = (byLevel[lvl] || 0) + 1;
        if (r.regione_name) byRegione[r.regione_name] = (byRegione[r.regione_name] || 0) + 1;
        if (r.polygon_coords) withGeom++;
        if (r.popolazione != null) withPop++;
        if (r.comune_name) comuni.add(r.comune_name);
      }
      result.asc = { total: data.length, byLevel, byRegione, comuni: comuni.size, withGeometry: withGeom, withPopolazione: withPop };
    }
  }

  if (datasetType === "COMUNI_ITALIA") {
    const { data, error } = await admin.from("territorial_registry")
      .select("comune_istat_code, regione_name")
      .eq("geographic_level", "comune");
    if (!error && data) {
      const regioni = new Set<string>();
      for (const r of data as any[]) { if (r.regione_name) regioni.add(r.regione_name); }
      result.comuni = { total: data.length, regioni: regioni.size, regioniList: [...regioni].sort() };
    }
  }

  if (datasetType === "LOCALITA_ISTAT") {
    const { data, error } = await admin.from("territorial_registry")
      .select("comune_istat_code, localita_code, localita_type, regione_name")
      .eq("geographic_level", "localita");
    if (!error && data) {
      const comuni = new Set<string>();
      const regioni = new Set<string>();
      const byType: Record<string, number> = {};
      for (const r of data as any[]) {
        if (r.comune_istat_code) comuni.add(r.comune_istat_code);
        if (r.regione_name) regioni.add(r.regione_name);
        const t = r.localita_type || "sconosciuto";
        byType[t] = (byType[t] || 0) + 1;
      }
      result.localita = { total: data.length, comuni: comuni.size, regioni: regioni.size, byType };
    }
  }

  return result;
}

/* ── Main handler ── */

serve(async (req) => {
  _req = req;
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing auth" }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: u, error: ue } = await supabase.auth.getUser(token);
    if (ue || !u?.user) return json({ error: "Auth failed" }, 200);

    // Admin OR Owner check
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    const { data: ownerData } = await supabase.from("owner_access").select("id").eq("user_id", u.user.id).maybeSingle();
    if (!roleData && !ownerData) return json({ error: "Admin or owner required" }, 200);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json();
    const { action } = body as { action: string };

    /* ── ACTION: validate-csv (dry-run) ── */
    if (action === "validate-csv") {
      await recoverStuckJobs(admin);
      const { jobId } = body as { jobId: string };
      if (!jobId) return json({ error: "jobId required" }, 200);

      const { data: job, error: jobErr } = await admin.from("territorial_dataset_jobs").select("*").eq("id", jobId).single();
      if (jobErr || !job) return json({ error: "Job not found" }, 200);

      const { data: fileData, error: dlErr } = await admin.storage.from("territorial-datasets").download(job.file_path);
      if (dlErr || !fileData) return json({ error: `File download failed: ${dlErr?.message ?? "unknown"}` }, 200);

      const csvText = await fileData.text();
      const records = parseCsv(csvText);

      if (records.length === 0) {
        await admin.from("territorial_dataset_jobs").update({
          status: "failed",
          error_log: [{ reason: "CSV vuoto o formato non riconosciuto — verifica separatore (virgola o punto e virgola) e intestazioni" }],
        }).eq("id", jobId);
        return json({ error: "CSV vuoto o formato non riconosciuto" }, 200);
      }

      const dt = job.dataset_type as string;

      // Full detailed validation for COMUNI_ITALIA and LOCALITA_ISTAT
      if (dt === "COMUNI_ITALIA" || dt === "LOCALITA_ISTAT") {
        const validation = buildDetailedValidation(records, dt);

        // If critical columns are missing, mark as failed
        if (validation.missingCriticalColumns.length > 0) {
          const failReason = `Colonne critiche mancanti: ${validation.missingCriticalColumns.join("; ")}. Colonne trovate: ${validation.headers.join(", ")}`;
          await admin.from("territorial_dataset_jobs").update({
            status: "failed",
            records_total: records.length,
            validation_result: validation,
            error_log: [{ reason: failReason }],
          }).eq("id", jobId);
          return json({ ok: false, error: failReason, validation });
        }

        // Save validation
        await admin.from("territorial_dataset_jobs").update({
          status: "validated",
          records_total: records.length,
          validation_result: validation,
          warnings: validation.region.multiRegioneWarning ? [validation.region.multiRegioneWarning] : [],
        }).eq("id", jobId);

        return json({ ok: true, validation });
      }

      // Generic validation for other types (R03, ASC)
      const headers = Object.keys(records[0]);
      const genericValidation: Record<string, unknown> = {
        totalRows: records.length,
        headers,
        sampleRows: records.slice(0, 3),
        region: detectRegions(records),
      };

      await admin.from("territorial_dataset_jobs").update({
        status: "validated",
        records_total: records.length,
        validation_result: genericValidation,
      }).eq("id", jobId);

      return json({ ok: true, validation: genericValidation });
    }

    /* ── ACTION: process-csv ── */
    if (action === "process-csv") {
      const { jobId } = body as { jobId: string };
      if (!jobId) return json({ error: "jobId required" }, 200);

      const logStep = (step: string, payload?: Record<string, unknown>) => {
        console.log(JSON.stringify({
          scope: "territorial-import",
          ts: nowIso(),
          action: "process-csv",
          jobId,
          step,
          ...(payload ?? {}),
        }));
      };

      await recoverStuckJobs(admin, logStep);

      const { data: job, error: jobErr } = await admin.from("territorial_dataset_jobs").select("*").eq("id", jobId).single();
      if (jobErr || !job) return json({ error: "Job not found" }, 200);

      // Update status to importing
      await admin.from("territorial_dataset_jobs").update({
        status: "importing",
        started_at: nowIso(),
        updated_at: nowIso(),
      }).eq("id", jobId);

      logStep("job_loaded", {
        datasetType: job.dataset_type,
        fileName: job.file_name,
        filePath: job.file_path,
      });

      // ── FAIL-SAFE: wrap entire import in try/finally so job NEVER stays stuck in "importing" ──
      let finalStatus = "failed";
      let finalError = "Import interrotto da errore imprevisto";
      let finalResult: { inserted: number; updated: number; processed?: number; skipped: number; failed: number; errors: { idx: number; reason: string }[]; warnings?: string[] } | null = null;
      let finalBatchId = "";
      let finalRegion: RegionInfo | null = null;
      let finalValidation: Record<string, unknown> = {};

      try {
        // Download file from storage
        logStep("file_downloading");
        const { data: fileData, error: dlErr } = await admin.storage.from("territorial-datasets").download(job.file_path);
        if (dlErr || !fileData) {
          finalError = `Download failed: ${dlErr?.message ?? "unknown"}`;
          logStep("file_download_failed", { error: finalError });
          return json({ error: "File download failed" }, 200);
        }
        logStep("file_downloaded");

        const csvText = await fileData.text();
        const records = parseCsv(csvText);
        logStep("csv_parsed", `${records.length} rows`);

        if (records.length === 0) {
          finalError = "CSV vuoto o formato non riconosciuto";
          logStep("csv_empty");
          return json({ error: "Empty CSV" }, 200);
        }

        logStep("rows_counted", `${records.length} records, type=${job.dataset_type}, headers=${Object.keys(records[0]).slice(0, 10).join(",")}`);

        const region = detectRegions(records);
        finalRegion = region;

        // Update to importing with region info
        await admin.from("territorial_dataset_jobs").update({
          status: "importing",
          records_total: records.length,
          records_imported: 0,
          records_errors: 0,
          records_skipped: 0,
          updated_at: nowIso(),
          validation_result: {
            headers: Object.keys(records[0]),
            sampleRow: records[0],
            totalRows: records.length,
            region,
          },
          stats: {
            progress: buildProgressState({
              datasetType: job.dataset_type,
              processedRows: 0,
              totalRows: records.length,
              failedRows: 0,
              skippedRows: 0,
              chunkIndex: 0,
              chunkCount: job.dataset_type === "R03_CSV_SEZ" ? Math.ceil(records.length / R03_SEZ_CHUNK) : Math.ceil(records.length / CHUNK),
            }),
          },
        }).eq("id", jobId);

        const batchId = `${job.dataset_type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        finalBatchId = batchId;
        let result: typeof finalResult;

        if (job.dataset_type === "ASC_2021") {
          result = await importAscCsv(records, batchId, admin);
        } else if (job.dataset_type === "R03_CSV_SEZ") {
          logStep("asc_mapping_loading");
          const ascMappings = new Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>();
          let asc2MappingsCount = 0;
          for (const level of ["ASC1", "ASC2", "ASC3"]) {
            const ascType = `R03_CSV_${level}`;
            const { data: ascJob } = await admin.from("territorial_dataset_jobs")
              .select("file_path").eq("dataset_type", ascType).eq("status", "imported").order("completed_at", { ascending: false }).limit(1).maybeSingle();
            if (ascJob?.file_path) {
              const { data: ascFile } = await admin.storage.from("territorial-datasets").download(ascJob.file_path);
              if (ascFile) {
                const ascCsv = await ascFile.text();
                const ascRows = parseCsv(ascCsv);
                for (const row of ascRows) {
                  const sez = row["SEZ2021"] || row["SEZ"] || "";
                  if (!sez) continue;
                  const existing = ascMappings.get(sez) || { asc1: null, asc2: null, asc3: null };
                  const code = row["COD_ASC"] || null;
                  if (level === "ASC1") existing.asc1 = code;
                  else if (level === "ASC2") {
                    existing.asc2 = code;
                    asc2MappingsCount++;
                  }
                  else if (level === "ASC3") existing.asc3 = code;
                  ascMappings.set(sez, existing);
                }
                logStep(level === "ASC2" ? "asc2_mapping_loaded" : "asc_mapping_loaded", {
                  level,
                  rows: ascRows.length,
                });
              }
            }
          }
          logStep("batch_started", {
            sections: records.length,
            ascMappings: ascMappings.size,
            asc2Mappings: asc2MappingsCount,
            chunkSize: R03_SEZ_CHUNK,
          });
          result = await importR03Sez(records, ascMappings, batchId, admin, jobId, logStep);
        } else if (job.dataset_type.startsWith("R03_CSV_ASC")) {
          result = { inserted: records.length, updated: 0, skipped: 0, failed: 0, errors: [], warnings: [`File mapping ${job.dataset_type} registrato. Verrà usato durante l'import di SEZ_R03_21.csv.`] };
        } else if (job.dataset_type === "COMUNI_ITALIA") {
          result = await importComuniItalia(records, batchId, admin);
        } else if (job.dataset_type === "LOCALITA_ISTAT") {
          result = await importLocalitaIstat(records, batchId, admin);
        } else {
          finalError = `Tipo dataset non supportato: ${job.dataset_type}`;
          return json({ error: "Unsupported dataset type" }, 200);
        }

        finalResult = result;

        // Post-import validation
        finalValidation = await validatePostImport(job.dataset_type, admin);

        const totalFailed = result.failed;
        const totalProcessed = result.processed ?? (result.inserted + result.updated);
        finalStatus = totalFailed > totalProcessed && totalProcessed === 0 ? "failed" : "imported";
        finalError = "";
        logStep(finalStatus === "imported" ? "job_marked_imported" : "job_marked_failed", {
          processed: totalProcessed,
          failed: totalFailed,
        });

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logStep("job_error_caught", { error: errMsg });
        finalStatus = "failed";
        finalError = `Errore imprevisto: ${errMsg}`;
      } finally {
        // ── GUARANTEED STATUS UPDATE: no job stays stuck in "importing" ──
        logStep("job_finalizing", { status: finalStatus });
        const updatePayload: Record<string, unknown> = {
          status: finalStatus,
          completed_at: nowIso(),
          updated_at: nowIso(),
        };
        if (finalResult) {
          const totalProcessed = finalResult.processed ?? (finalResult.inserted + finalResult.updated);
          updatePayload.records_imported = totalProcessed;
          updatePayload.records_errors = finalResult.failed;
          updatePayload.records_skipped = finalResult.skipped;
          updatePayload.import_batch_id = finalBatchId;
          updatePayload.error_log = finalResult.errors.slice(0, MAX_IMPORT_ERRORS);
          updatePayload.warnings = [
            ...(finalResult.warnings || []),
            ...(finalRegion?.multiRegioneWarning ? [finalRegion.multiRegioneWarning] : []),
          ];
          updatePayload.stats = {
            ...finalValidation,
            importResult: { processed: totalProcessed, inserted: finalResult.inserted, updated: finalResult.updated, skipped: finalResult.skipped, failed: finalResult.failed },
            progress: buildProgressState({
              datasetType: job.dataset_type,
              processedRows: totalProcessed,
              totalRows: Number(job.records_total || totalProcessed),
              failedRows: finalResult.failed,
              skippedRows: finalResult.skipped,
              chunkIndex: finalStatus === "imported"
                ? (job.dataset_type === "R03_CSV_SEZ" ? Math.ceil(Number(job.records_total || totalProcessed) / R03_SEZ_CHUNK) : 1)
                : 0,
              chunkCount: job.dataset_type === "R03_CSV_SEZ"
                ? Math.ceil(Number(job.records_total || totalProcessed) / R03_SEZ_CHUNK)
                : 1,
            }),
          };
        } else {
          // No result means early failure — save the error
          updatePayload.error_log = [{ reason: finalError }];
        }
        await admin.from("territorial_dataset_jobs").update(updatePayload).eq("id", jobId);
        logStep("job_finalized", { status: finalStatus });
      }

      return json({
        ok: finalStatus === "imported",
        status: finalStatus,
        inserted: finalResult?.inserted ?? 0,
        updated: finalResult?.updated ?? 0,
        skipped: finalResult?.skipped ?? 0,
        failed: finalResult?.failed ?? 0,
        errors: finalResult?.errors?.length ?? 0,
        batchId: finalBatchId,
        region: finalRegion,
        validation: finalValidation,
        ...(finalError ? { error: finalError } : {}),
      });
    }

    /* ── ACTION: aggregate-r03 ── */
    if (action === "aggregate-r03") {
      log("aggregate-r03", "starting R03→ASC aggregation");
      const batchId = `agg_r03_${Date.now()}`;

      const { data: sections, error: secErr } = await admin.from("census_sections_r03_2021")
        .select("section_code, comune_istat_code, comune_name, asc1_code, asc2_code, asc3_code, population_2021, families_2021, dwellings_2021, occupied_dwellings_2021, buildings_2021, residential_buildings_2021");
      if (secErr || !sections || sections.length === 0) {
        return json({ ok: false, error: "No R03 sections found", detail: secErr?.message });
      }

      const r03Comuni = new Set((sections as any[]).map((s: any) => s.comune_istat_code).filter(Boolean));
      const { data: ascAreas } = await admin.from("sub_municipal_areas_2021")
        .select("area_code, asc_level, area_name, comune_istat_code, superficie_kmq");

      const ascNames = new Map<string, { name: string; superficie_kmq: number | null }>();
      if (ascAreas) {
        for (const a of ascAreas as any[]) {
          if (a.comune_istat_code && r03Comuni.has(a.comune_istat_code)) {
            ascNames.set(`${a.asc_level}_${a.area_code}`, { name: a.area_name, superficie_kmq: a.superficie_kmq });
          }
        }
      }

      type AggKey = string;
      interface AggBucket {
        comune_istat_code: string; comune_name: string;
        asc_level: number; asc_code: string;
        pop: number; fam: number; dwell: number; occ_dwell: number; build: number; res_build: number;
        count: number; with_data: number;
      }
      const buckets = new Map<AggKey, AggBucket>();

      for (const s of sections as any[]) {
        for (const [lvl, field] of [[1, "asc1_code"], [2, "asc2_code"], [3, "asc3_code"]] as [number, string][]) {
          const code = s[field];
          if (!code) continue;
          const key = `${lvl}_${code}_${s.comune_istat_code}`;
          const b = buckets.get(key) || {
            comune_istat_code: s.comune_istat_code || "", comune_name: s.comune_name || "",
            asc_level: lvl, asc_code: code,
            pop: 0, fam: 0, dwell: 0, occ_dwell: 0, build: 0, res_build: 0,
            count: 0, with_data: 0,
          };
          b.count++;
          if (s.population_2021 != null) { b.pop += s.population_2021; b.with_data++; }
          if (s.families_2021 != null) b.fam += s.families_2021;
          if (s.dwellings_2021 != null) b.dwell += s.dwellings_2021;
          if (s.occupied_dwellings_2021 != null) b.occ_dwell += s.occupied_dwellings_2021;
          if (s.buildings_2021 != null) b.build += s.buildings_2021;
          if (s.residential_buildings_2021 != null) b.res_build += s.residential_buildings_2021;
          buckets.set(key, b);
        }
      }

      const rows = [...buckets.values()].map(b => {
        const ascInfo = ascNames.get(`${b.asc_level}_${b.asc_code}`);
        const coverageRatio = b.count > 0 ? b.with_data / b.count : 0;
        const coverage = coverageRatio >= 0.8 ? "available" : coverageRatio > 0 ? "partial" : "unavailable";
        const sup = ascInfo?.superficie_kmq ?? null;
        const density = (sup && sup > 0 && b.pop > 0) ? Math.round(b.pop / sup) : null;
        const notes: string[] = [];
        if (coverageRatio < 1) notes.push(`${b.with_data}/${b.count} sezioni con dato popolazione`);
        if (!ascInfo) notes.push("Nome ASC non trovato nel layer");

        return {
          source_dataset: "R03_21", source_year: 2021,
          comune_istat_code: b.comune_istat_code, comune_name: b.comune_name,
          asc_level: b.asc_level, asc_code: b.asc_code,
          asc_name: ascInfo?.name || null,
          population_2021: b.pop || null, families_2021: b.fam || null,
          dwellings_2021: b.dwell || null, occupied_dwellings_2021: b.occ_dwell || null,
          buildings_2021: b.build || null, residential_buildings_2021: b.res_build || null,
          sections_count: b.count, sections_with_data: b.with_data,
          superficie_kmq: sup, density_pop_per_kmq: density,
          coverage_status: coverage, derivation_notes: notes.join("; ") || null,
          import_batch_id: batchId,
        };
      });

      let imported = 0;
      const importErrors: string[] = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error, count } = await admin.from("r03_asc_aggregates_2021")
          .upsert(chunk, { onConflict: "source_dataset,comune_istat_code,asc_level,asc_code" })
          .select("id");
        if (error) importErrors.push(error.message);
        else imported += count ?? chunk.length;
      }

      const comuni = new Set(rows.map(r => r.comune_istat_code));
      const byLevel: Record<number, number> = {};
      for (const r of rows) byLevel[r.asc_level] = (byLevel[r.asc_level] || 0) + 1;

      return json({
        ok: true, imported, total: rows.length, errors: importErrors,
        stats: { comuni: comuni.size, byLevel, batchId },
      });
    }

    /* ── ACTION: get-aggregation-stats ── */
    if (action === "get-aggregation-stats") {
      const { data, error } = await admin.from("r03_asc_aggregates_2021")
        .select("asc_level, asc_code, asc_name, comune_istat_code, comune_name, coverage_status, population_2021, sections_count, sections_with_data, density_pop_per_kmq");
      if (error) return json({ error: error.message }, 200);
      if (!data || data.length === 0) return json({ ok: true, aggregates: 0, stats: null });

      const byLevel: Record<number, number> = {};
      const comuni = new Set<string>();
      let available = 0, partial = 0, unavailable = 0;
      for (const r of data as any[]) {
        byLevel[r.asc_level] = (byLevel[r.asc_level] || 0) + 1;
        if (r.comune_istat_code) comuni.add(r.comune_istat_code);
        if (r.coverage_status === "available") available++;
        else if (r.coverage_status === "partial") partial++;
        else unavailable++;
      }

      return json({
        ok: true, aggregates: data.length,
        stats: { byLevel, comuni: comuni.size, available, partial, unavailable },
        sample: (data as any[]).slice(0, 5),
      });
    }

    /* ── ACTION: get-stats ── */
    if (action === "get-stats") {
      const validation = await validatePostImport("ASC_2021", admin);
      const r03Val = await validatePostImport("R03_CSV_SEZ", admin);
      return json({ ok: true, asc: (validation as any).asc || null, r03: (r03Val as any).r03 || null });
    }

    /* ── ACTION: list-jobs ── */
    if (action === "list-jobs") {
      const recovered = await recoverStuckJobs(admin);
      const { data, error } = await admin.from("territorial_dataset_jobs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) return json({ error: error.message }, 200);
      return json({ ok: true, jobs: data, recovered });
    }

    if (action === "recover-stuck-jobs") {
      const recovered = await recoverStuckJobs(admin);
      return json({ ok: true, recovered });
    }

    return json({ error: `Unknown action: ${action}` }, 200);
  } catch (e) {
    log("FATAL", String(e));
    return json({ error: "Internal error" }, 200);
  }
});
