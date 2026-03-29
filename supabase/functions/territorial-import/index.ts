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
const R03_SEZ_CHUNK = 100; // Small chunks for aggressive checkpoint/heartbeat
const R03_SEZ_STUCK_TIMEOUT_MINUTES = 20;
const MAX_IMPORT_ERRORS = 100;

// Time budget for general imports
const TIME_BUDGET_MS = 45_000;
const TIME_BUDGET_RESERVE_MS = 8_000;

// Aggressive time budget for R03_CSV_SEZ: exit after ~12s to guarantee checkpoint
const R03_SEZ_TIME_BUDGET_MS = 12_000;

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

interface Checkpoint {
  lineOffset: number; // byte offset into the CSV text where we left off (after header)
  globalRowIdx: number;
  imported: number;
  skipped: number;
  failed: number;
  skipByReason: Record<string, number>;
  regionsFound: string[];
  errors: { idx: number; reason: string }[];
  warnings: string[];
  chunkIndex: number;
  passNumber: number;
}

async function persistPendingNextChunkJob(params: {
  admin: ReturnType<typeof createClient>;
  jobId: string;
  batchId: string;
  checkpoint: Checkpoint;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  skippedRows: number;
  skipByReason: Record<string, number>;
  logStep: (step: string, payload?: Record<string, unknown>) => void;
}) {
  const chunkCount = Math.ceil(params.totalRows / R03_SEZ_CHUNK);
  const progress = buildProgressState({
    datasetType: "R03_CSV_SEZ",
    processedRows: params.processedRows,
    totalRows: params.totalRows,
    failedRows: params.failedRows,
    skippedRows: params.skippedRows,
    chunkIndex: params.checkpoint.chunkIndex,
    chunkCount,
  });

  const updatePayload = {
    status: "pending_next_chunk",
    import_batch_id: params.batchId,
    records_total: params.totalRows,
    records_imported: params.processedRows,
    records_errors: params.failedRows,
    records_skipped: params.skippedRows,
    updated_at: nowIso(),
    stats: {
      progress,
      skipByReason: params.skipByReason,
      checkpoint: params.checkpoint,
      passNumber: params.checkpoint.passNumber,
    },
  };

  const { data, error } = await params.admin
    .from("territorial_dataset_jobs")
    .update(updatePayload)
    .select("id, status, stats")
    .eq("id", params.jobId);

  if (error) {
    params.logStep("checkpoint_persist_failed", {
      error: error.message,
      checkpointRow: params.checkpoint.globalRowIdx,
      passNumber: params.checkpoint.passNumber,
    });
    throw new Error(`checkpoint_persist_failed: ${error.message}`);
  }

  const persistedJob = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  const persistedStats = asRecord(persistedJob?.stats);
  const persistedCheckpoint = asRecord(persistedStats.checkpoint);
  if (persistedJob?.status !== "pending_next_chunk" || Number(persistedCheckpoint.globalRowIdx ?? -1) !== params.checkpoint.globalRowIdx) {
    params.logStep("checkpoint_persist_mismatch", {
      persistedStatus: persistedJob?.status ?? null,
      persistedCheckpointRow: persistedCheckpoint.globalRowIdx ?? null,
      expectedCheckpointRow: params.checkpoint.globalRowIdx,
      passNumber: params.checkpoint.passNumber,
    });
    throw new Error("checkpoint_persist_mismatch");
  }

  params.logStep("checkpoint_saved", {
    checkpointRow: params.checkpoint.globalRowIdx,
    checkpointOffset: params.checkpoint.lineOffset,
    passNumber: params.checkpoint.passNumber,
    processedRows: params.processedRows,
    totalRows: params.totalRows,
  });
  params.logStep("status_set_pending_next_chunk", {
    status: "pending_next_chunk",
    checkpointRow: params.checkpoint.globalRowIdx,
    checkpointOffset: params.checkpoint.lineOffset,
    passNumber: params.checkpoint.passNumber,
  });
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
  // Don't mark pending_next_chunk as stale — they're waiting for the next invocation
  if (job.status === "pending_next_chunk") return false;
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

  const { count: existingAfter } = await admin.from("territorial_registry")
    .select("id", { count: "exact", head: true })
    .eq("geographic_level", "localita");
  const countAfter = existingAfter ?? 0;
  const inserted = countAfter - countBefore;
  const updated = processed - inserted;

  return { inserted: Math.max(inserted, 0), updated: Math.max(updated, 0), processed, skipped, failed, errors, warnings };
}

/**
 * Streaming R03_CSV_SEZ import with CHECKPOINT/RESUME support.
 * Processes CSV line-by-line in chunks, saves checkpoint when time budget runs out,
 * and resumes from the saved offset on next invocation.
 */
async function importR03SezStreaming(
  rawText: string,
  ascMappings: Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>,
  batchId: string,
  admin: ReturnType<typeof createClient>,
  jobId: string,
  logStep: (step: string, payload?: Record<string, unknown>) => void,
  checkpoint: Checkpoint | null,
  startTimeMs: number,
): Promise<{ inserted: number; updated: number; processed: number; skipped: number; failed: number; errors: { idx: number; reason: string }[]; warnings: string[]; regionsFound: Set<string>; skipByReason: Record<string, number>; paused: boolean; checkpoint: Checkpoint | null }> {
  // Resume counters from checkpoint
  let imported = checkpoint?.imported ?? 0;
  let skipped = checkpoint?.skipped ?? 0;
  let failed = checkpoint?.failed ?? 0;
  const errors: { idx: number; reason: string }[] = checkpoint?.errors ?? [];
  const warnings: string[] = checkpoint?.warnings ?? [];
  const regionsFound = new Set<string>(checkpoint?.regionsFound ?? []);
  const skipByReason: Record<string, number> = checkpoint?.skipByReason ?? {};
  const addSkip = (reason: string) => { skipByReason[reason] = (skipByReason[reason] || 0) + 1; skipped++; };

  // Parse header
  let text = rawText;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let headerEnd = text.indexOf('\n');
  if (headerEnd === -1) {
    return { inserted: 0, updated: 0, processed: 0, skipped: 0, failed: 0, errors: [{ idx: 0, reason: "No header line" }], warnings: [], regionsFound: new Set<string>(), skipByReason: {}, paused: false, checkpoint: null };
  }
  let headerLine = text.substring(0, headerEnd);
  if (headerLine.endsWith('\r')) headerLine = headerLine.slice(0, -1);
  const sep = headerLine.includes(";") ? ";" : ",";
  const headers = parseCsvLine(headerLine, sep);

  // Count total lines for progress (fast scan)
  let totalLines = 0;
  for (let i = headerEnd + 1; i < text.length; i++) {
    if (text[i] === '\n') totalLines++;
  }
  if (text.length > headerEnd + 1 && text[text.length - 1] !== '\n') totalLines++;

  const chunkCount = Math.ceil(totalLines / R03_SEZ_CHUNK);
  const passNumber = (checkpoint?.passNumber ?? 0) + 1;

  // Resume: skip to checkpoint offset
  const resumeLineOffset = checkpoint?.lineOffset ?? (headerEnd + 1);
  let globalRowIdx = checkpoint?.globalRowIdx ?? 0;
  let chunkIndex = checkpoint?.chunkIndex ?? 0;

  logStep("streaming_import_start", {
    totalLines, chunkCount, passNumber,
    resumingFrom: checkpoint ? globalRowIdx : 0,
    headers: headers.slice(0, 10),
  });

  // Process line by line in chunks
  let lineStart = resumeLineOffset;
  let chunkRows: Record<string, string>[] = [];
  let paused = false;
  let pauseCheckpoint: Checkpoint | null = null;

  const flushChunk = async () => {
    if (chunkRows.length === 0) return;
    chunkIndex++;

    const dbRows: any[] = [];
    for (let j = 0; j < chunkRows.length; j++) {
      const r = chunkRows[j];
      const sez = r["SEZ2021"] || r["SEZ"] || "";
      const com = r["PRO_COM_T"] || r["PRO_COM"] || "";
      if (!sez) {
        failed++;
        if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: globalRowIdx - chunkRows.length + j, reason: "SEZ2021 mancante" });
        skipByReason["sez_mancante"] = (skipByReason["sez_mancante"] || 0) + 1;
        continue;
      }
      if (!com) {
        failed++;
        if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: globalRowIdx - chunkRows.length + j, reason: "PRO_COM_T mancante" });
        skipByReason["com_mancante"] = (skipByReason["com_mancante"] || 0) + 1;
        continue;
      }

      const codReg = (r["COD_REG"] || "").trim();
      const denReg = (r["DEN_REG"] || r["REGIONE"] || "").trim();
      let rowRegName = denReg || null;
      let rowRegCode = codReg || null;
      if (!rowRegName && codReg) {
        rowRegName = COD_REG_MAP[codReg.padStart(2, "0")] || null;
      }
      if (rowRegName) regionsFound.add(rowRegName);

      const m = ascMappings.get(sez);
      dbRows.push({
        source_dataset: "R03_21",
        source_year: 2021,
        source_label: rowRegName ? `ISTAT Censimento 2021 — ${rowRegName}` : "ISTAT Censimento 2021",
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
      });
    }

    // Deduplicate within chunk by section_code (last-wins)
    const dedupMap = new Map<string, any>();
    for (const row of dbRows) {
      dedupMap.set(row.section_code, row);
    }
    const uniqueRows = [...dedupMap.values()];
    const batchDuplicatesDropped = dbRows.length - uniqueRows.length;
    if (batchDuplicatesDropped > 0) {
      addSkip("duplicato_intra_batch");
      skipByReason["duplicato_intra_batch"] += (batchDuplicatesDropped - 1);
      skipped += (batchDuplicatesDropped - 1);
    }

    if (uniqueRows.length === 0) {
      await admin.from("territorial_dataset_jobs").update({
        updated_at: nowIso(),
        stats: { progress: buildProgressState({ datasetType: "R03_CSV_SEZ", processedRows: imported, totalRows: totalLines, failedRows: failed, skippedRows: skipped, chunkIndex, chunkCount }), skipByReason },
      }).eq("id", jobId).eq("status", "importing");
      chunkRows = [];
      return;
    }

    const { error } = await admin
      .from("census_sections_r03_2021")
      .upsert(uniqueRows as any[], { onConflict: "source_dataset,section_code" });

    if (error) {
      failed += uniqueRows.length;
      if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: globalRowIdx - chunkRows.length, reason: `Batch ${chunkIndex}: ${error.message}` });
      warnings.push(`Batch ${chunkIndex}/${chunkCount} fallito: ${error.message}`);
      skipByReason["batch_error"] = (skipByReason["batch_error"] || 0) + uniqueRows.length;
      logStep("batch_error_continuing", { chunkIndex, chunkCount, reason: error.message });
    } else {
      imported += uniqueRows.length;
    }

    // Heartbeat + progress
    const progress = buildProgressState({
      datasetType: "R03_CSV_SEZ",
      processedRows: imported,
      totalRows: totalLines,
      failedRows: failed,
      skippedRows: skipped,
      chunkIndex,
      chunkCount,
    });

    await admin.from("territorial_dataset_jobs").update({
      records_total: totalLines,
      records_imported: imported,
      records_errors: failed,
      records_skipped: skipped,
      updated_at: nowIso(),
      stats: { progress, skipByReason, passNumber },
    }).eq("id", jobId).eq("status", "importing");

    logStep("batch_progress", {
      chunkIndex, chunkCount, passNumber,
      processedRows: imported, totalRows: totalLines,
      failedRows: failed, skippedRows: skipped,
      batchDuplicatesDropped,
      percentage: progress.percentage,
    });

    chunkRows = [];
  };

  // Stream through lines from resume offset
  for (let i = lineStart; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      let line = text.substring(lineStart, i);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      lineStart = i + 1;

      if (!line.trim()) continue;

      try {
        const vals = parseCsvLine(line, sep);
        if (vals.length < 2) {
          addSkip("riga_troppo_corta");
          if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: globalRowIdx, reason: "Riga con meno di 2 campi" });
          globalRowIdx++;
          continue;
        }
        const obj: Record<string, string> = {};
        headers.forEach((h, j) => { obj[h] = vals[j] ?? ""; });
        chunkRows.push(obj);
      } catch {
        addSkip("errore_parsing");
        if (errors.length < MAX_IMPORT_ERRORS) errors.push({ idx: globalRowIdx, reason: "Errore parsing riga" });
      }

      globalRowIdx++;

      if (chunkRows.length >= R03_SEZ_CHUNK) {
        await flushChunk();

        // ── AGGRESSIVE TIME BUDGET CHECK after each flushed chunk ──
        const elapsed = Date.now() - startTimeMs;
        if (elapsed > R03_SEZ_TIME_BUDGET_MS) {
          // Save checkpoint and pause — exit well before platform limit
          paused = true;
          pauseCheckpoint = {
            lineOffset: lineStart,
            globalRowIdx,
            imported,
            skipped,
            failed,
            skipByReason: { ...skipByReason },
            regionsFound: [...regionsFound],
            errors: errors.slice(-20),
            warnings: [...warnings],
            chunkIndex,
            passNumber,
          };
          logStep("time_budget_pause", {
            elapsedMs: elapsed,
            budgetMs: R03_SEZ_TIME_BUDGET_MS,
            rowsProcessedThisPass: globalRowIdx - (checkpoint?.globalRowIdx ?? 0),
            totalRowsProcessed: globalRowIdx,
            totalLines,
            passNumber,
          });
          await persistPendingNextChunkJob({
            admin,
            jobId,
            batchId,
            checkpoint: pauseCheckpoint,
            totalRows: totalLines,
            processedRows: imported,
            failedRows: failed,
            skippedRows: skipped,
            skipByReason: { ...skipByReason },
            logStep,
          });
          break;
        }
      }
    }
  }

  // Flush remaining if not paused
  if (!paused && chunkRows.length > 0) {
    await flushChunk();
  }

  // Multi-region warnings
  if (regionsFound.size > 1) {
    warnings.push(`File multi-regione: ${regionsFound.size} regioni rilevate (${[...regionsFound].sort().join(", ")})`);
  }

  if (!paused) {
    logStep("streaming_import_complete", {
      imported, skipped, failed,
      totalLines, chunkCount, passNumber,
      regionsFound: [...regionsFound].sort(),
      regionsCount: regionsFound.size,
      ascMappingsUsed: ascMappings.size,
      skipByReason,
    });
  }

  return {
    inserted: imported,
    updated: 0,
    processed: imported,
    skipped,
    failed,
    errors,
    warnings,
    regionsFound,
    skipByReason,
    paused,
    checkpoint: pauseCheckpoint,
  };
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
      result.localita = { total: data.length, comuni: comuni.size, regioni: regioni.size, regioniList: [...regioni].sort(), byType };
    }
  }

  return result;
}

/* ── Main handler ── */

serve(async (req) => {
  _req = req;
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const requestStartMs = Date.now();

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

      const dt = job.dataset_type as string;

      const useLightValidation = dt === "R03_CSV_SEZ" || dt === "ASC_2021" || dt.startsWith("R03_CSV_ASC");

      try {
        const { data: fileData, error: dlErr } = await admin.storage.from("territorial-datasets").download(job.file_path);
        if (dlErr || !fileData) return json({ ok: false, error: `File download failed: ${dlErr?.message ?? "unknown"}`, code: "DOWNLOAD_FAILED" }, 200);

        if (useLightValidation) {
          const PREVIEW_LIMIT = 100;
          const MAX_SAMPLE_ERRORS = 20;

          const rawText = await fileData.text();
          let totalLines = 0;
          let headerLine = "";
          const previewLines: string[] = [];
          let pastBom = false;

          let codRegIdx = -1;
          let denRegIdx = -1;
          let regioneIdx = -1;
          const regionCodesFound = new Set<string>();
          const regionNamesFound = new Set<string>();

          let lineStart = 0;
          for (let i = 0; i <= rawText.length; i++) {
            if (i === rawText.length || rawText[i] === '\n') {
              let line = rawText.substring(lineStart, i);
              if (line.endsWith('\r')) line = line.slice(0, -1);
              lineStart = i + 1;

              if (!pastBom) {
                if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
                pastBom = true;
              }

              if (!line.trim()) continue;

              if (!headerLine) {
                headerLine = line;
                const sep0 = headerLine.includes(";") ? ";" : ",";
                const hdr = parseCsvLine(headerLine, sep0);
                codRegIdx = hdr.indexOf("COD_REG");
                denRegIdx = hdr.indexOf("DEN_REG");
                regioneIdx = hdr.indexOf("REGIONE");
                continue;
              }

              totalLines++;
              if (previewLines.length < PREVIEW_LIMIT) previewLines.push(line);

              if (codRegIdx >= 0 || denRegIdx >= 0 || regioneIdx >= 0) {
                const sep0 = headerLine.includes(";") ? ";" : ",";
                const vals = line.split(sep0);
                if (denRegIdx >= 0 && vals[denRegIdx]) {
                  const v = vals[denRegIdx].trim().replace(/^"|"$/g, "");
                  if (v) regionNamesFound.add(v);
                } else if (regioneIdx >= 0 && vals[regioneIdx]) {
                  const v = vals[regioneIdx].trim().replace(/^"|"$/g, "");
                  if (v) regionNamesFound.add(v);
                } else if (codRegIdx >= 0 && vals[codRegIdx]) {
                  const v = vals[codRegIdx].trim().replace(/^"|"$/g, "");
                  if (v) regionCodesFound.add(v);
                }
              }
            }
          }

          if (totalLines === 0 || !headerLine) {
            await admin.from("territorial_dataset_jobs").update({
              status: "failed",
              error_log: [{ reason: "CSV vuoto o formato non riconosciuto" }],
            }).eq("id", jobId);
            return json({ ok: false, error: "CSV vuoto o formato non riconosciuto", code: "EMPTY_CSV" }, 200);
          }

          const sep = headerLine.includes(";") ? ";" : ",";
          const headers = parseCsvLine(headerLine, sep);

          const regSet = new Set<string>();
          let regionDetectedVia: RegionInfo["detectedVia"] = "none";
          if (regionNamesFound.size > 0) {
            for (const n of regionNamesFound) regSet.add(n);
            regionDetectedVia = denRegIdx >= 0 ? "DEN_REG" : "REGIONE";
          } else if (regionCodesFound.size > 0) {
            for (const c of regionCodesFound) {
              const mapped = COD_REG_MAP[c.padStart(2, "0")] || `Regione ${c}`;
              regSet.add(mapped);
            }
            regionDetectedVia = "COD_REG";
          }
          const regioni = [...regSet].sort();
          const region: RegionInfo = {
            regioni,
            regioniCount: regioni.length,
            isMonoRegione: regioni.length === 1,
            regioneRilevata: regioni.length === 1 ? regioni[0] : null,
            multiRegioneWarning: regioni.length > 1
              ? `File multi-regione: contiene ${regioni.length} regioni (${regioni.join(", ")}). Se intendevi caricare una sola regione, verifica il file.`
              : null,
            detectedVia: regionDetectedVia,
          };

          const previewRecords: Record<string, string>[] = [];
          const sampleErrors: { row: number; reason: string }[] = [];
          for (let i = 0; i < previewLines.length; i++) {
            try {
              const vals = parseCsvLine(previewLines[i], sep);
              if (vals.length < 2) {
                if (sampleErrors.length < MAX_SAMPLE_ERRORS) sampleErrors.push({ row: i + 2, reason: "Riga con meno di 2 campi" });
                continue;
              }
              const obj: Record<string, string> = {};
              headers.forEach((h, j) => { obj[h] = vals[j] ?? ""; });
              previewRecords.push(obj);
            } catch {
              if (sampleErrors.length < MAX_SAMPLE_ERRORS) sampleErrors.push({ row: i + 2, reason: "Errore parsing riga" });
            }
          }

          const missingCritical: string[] = [];
          if (dt === "R03_CSV_SEZ") {
            const hasSez = headers.some(h => ["SEZ2021", "SEZ", "SEZ2011"].includes(h));
            const hasCom = headers.some(h => ["PRO_COM_T", "PRO_COM"].includes(h));
            if (!hasSez) missingCritical.push("Colonna sezione (SEZ2021 | SEZ)");
            if (!hasCom) missingCritical.push("Colonna comune (PRO_COM_T | PRO_COM)");
          } else if (dt === "ASC_2021" || dt.startsWith("R03_CSV_ASC")) {
            const hasAsc = headers.some(h => ["COD_ASC", "AREA_CODE", "COD_ASC2"].includes(h));
            if (!hasAsc) missingCritical.push("Colonna area (COD_ASC | AREA_CODE | COD_ASC2)");
          }

          const lightValidation: Record<string, unknown> = {
            totalRows: totalLines,
            headers,
            headersFound: { sez: findColumn(headers, ["SEZ2021", "SEZ"]), com: findColumn(headers, ["PRO_COM_T", "PRO_COM"]), reg: findColumn(headers, ["DEN_REG", "REGIONE", "COD_REG"]) },
            missingCriticalColumns: missingCritical,
            region,
            preview: previewRecords.slice(0, 20),
            sampleErrors,
            validationMode: "light_streaming_fullscan_region",
            previewRowsAnalyzed: previewRecords.length,
            regionScanMode: "full_file",
          };

          if (missingCritical.length > 0) {
            const failReason = `Colonne critiche mancanti: ${missingCritical.join("; ")}. Colonne trovate: ${headers.join(", ")}`;
            await admin.from("territorial_dataset_jobs").update({
              status: "failed",
              records_total: totalLines,
              validation_result: lightValidation,
              error_log: [{ reason: failReason }],
            }).eq("id", jobId);
            return json({ ok: false, error: failReason, code: "MISSING_COLUMNS", validation: lightValidation }, 200);
          }

          await admin.from("territorial_dataset_jobs").update({
            status: "validated",
            records_total: totalLines,
            validation_result: lightValidation,
            warnings: region.multiRegioneWarning ? [region.multiRegioneWarning] : [],
          }).eq("id", jobId);

          return json({ ok: true, validation: lightValidation });

        } else {
          const csvText = await fileData.text();
          const records = parseCsv(csvText);

          if (records.length === 0) {
            await admin.from("territorial_dataset_jobs").update({
              status: "failed",
              error_log: [{ reason: "CSV vuoto o formato non riconosciuto — verifica separatore (virgola o punto e virgola) e intestazioni" }],
            }).eq("id", jobId);
            return json({ ok: false, error: "CSV vuoto o formato non riconosciuto", code: "EMPTY_CSV" }, 200);
          }

          const validation = buildDetailedValidation(records, dt);

          if (validation.missingCriticalColumns.length > 0) {
            const failReason = `Colonne critiche mancanti: ${validation.missingCriticalColumns.join("; ")}. Colonne trovate: ${validation.headers.join(", ")}`;
            await admin.from("territorial_dataset_jobs").update({
              status: "failed",
              records_total: records.length,
              validation_result: validation,
              error_log: [{ reason: failReason }],
            }).eq("id", jobId);
            return json({ ok: false, error: failReason, code: "MISSING_COLUMNS", validation });
          }

          await admin.from("territorial_dataset_jobs").update({
            status: "validated",
            records_total: records.length,
            validation_result: validation,
            warnings: validation.region.multiRegioneWarning ? [validation.region.multiRegioneWarning] : [],
          }).eq("id", jobId);

          return json({ ok: true, validation });
        }
      } catch (validateErr: unknown) {
        const errMsg = validateErr instanceof Error ? validateErr.message : String(validateErr);
        log("validate-csv error", errMsg);
        try {
          await admin.from("territorial_dataset_jobs").update({
            status: "failed",
            error_log: [{ reason: `Errore interno validazione: ${errMsg}` }],
            updated_at: nowIso(),
          }).eq("id", jobId);
        } catch { /* best effort */ }
        return json({ ok: false, error: `Errore interno validazione: ${errMsg}`, code: "VALIDATE_INTERNAL_ERROR" }, 200);
      }
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

      // Check if this is a resume from pending_next_chunk
      const isResume = job.status === "pending_next_chunk";
      const existingCheckpoint: Checkpoint | null = isResume
        ? (asRecord(job.stats) as any)?.checkpoint ?? null
        : null;

      // Update status to importing (preserve batch_id on resume)
      const importingUpdate: Record<string, unknown> = {
        status: "importing",
        updated_at: nowIso(),
      };
      if (!isResume) {
        importingUpdate.started_at = nowIso();
      }
      await admin.from("territorial_dataset_jobs").update(importingUpdate).eq("id", jobId);
      logStep("status_set_importing", {
        isResume,
        checkpointRow: existingCheckpoint?.globalRowIdx ?? 0,
        checkpointPass: existingCheckpoint?.passNumber ?? 0,
      });

      logStep("job_loaded", {
        datasetType: job.dataset_type,
        fileName: job.file_name,
        filePath: job.file_path,
        isResume,
        checkpointPass: existingCheckpoint?.passNumber ?? 0,
        checkpointRow: existingCheckpoint?.globalRowIdx ?? 0,
      });

      // ── FAIL-SAFE: wrap entire import in try/finally ──
      let finalStatus = "failed";
      let finalError = "Import interrotto da errore imprevisto";
      let finalResult: { inserted: number; updated: number; processed?: number; skipped: number; failed: number; errors: { idx: number; reason: string }[]; warnings?: string[] } | null = null;
      let finalBatchId = isResume ? (job.import_batch_id || "") : "";
      let finalRegion: RegionInfo | null = null;
      let finalValidation: Record<string, unknown> = {};
      let finalCheckpoint: Checkpoint | null = null;
      let isPaused = false;

      try {
        logStep("file_downloading");
        const { data: fileData, error: dlErr } = await admin.storage.from("territorial-datasets").download(job.file_path);
        if (dlErr || !fileData) {
          finalError = `Download failed: ${dlErr?.message ?? "unknown"}`;
          logStep("file_download_failed", { error: finalError });
          return json({ error: "File download failed" }, 200);
        }
        logStep("file_downloaded");

        const csvText = await fileData.text();

        const batchId = isResume && finalBatchId
          ? finalBatchId
          : `${job.dataset_type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        finalBatchId = batchId;
        let result: typeof finalResult & { paused?: boolean; checkpoint?: Checkpoint | null };

        // R03_CSV_SEZ uses STREAMING import with CHECKPOINT/RESUME
        if (job.dataset_type === "R03_CSV_SEZ") {
          logStep("asc_mapping_loading");
          const ascMappings = new Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>();
          let asc2MappingsCount = 0;
          const ascLevelsFound: string[] = [];
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
                  else if (level === "ASC2") { existing.asc2 = code; asc2MappingsCount++; }
                  else if (level === "ASC3") existing.asc3 = code;
                  ascMappings.set(sez, existing);
                }
                ascLevelsFound.push(level);
                logStep("asc_mapping_loaded", { level, rows: ascRows.length });
              }
            } else {
              logStep("asc_mapping_not_found", { level, note: "Nessun job importato trovato — sezioni senza questo livello ASC avranno campo null" });
            }
          }
          logStep("asc_mapping_summary", {
            ascMappings: ascMappings.size,
            asc2Mappings: asc2MappingsCount,
            levelsFound: ascLevelsFound,
            chunkSize: R03_SEZ_CHUNK,
          });

          // STREAMING import with checkpoint/resume
          const streamResult = await importR03SezStreaming(
            csvText, ascMappings, batchId, admin, jobId, logStep,
            existingCheckpoint, requestStartMs,
          );
          result = streamResult;
          isPaused = streamResult.paused;
          finalCheckpoint = streamResult.checkpoint;

          // Build region info from streaming result
          const regArr = [...streamResult.regionsFound].sort();
          finalRegion = {
            regioni: regArr,
            regioniCount: regArr.length,
            isMonoRegione: regArr.length === 1,
            regioneRilevata: regArr.length === 1 ? regArr[0] : null,
            multiRegioneWarning: regArr.length > 1
              ? `File multi-regione: contiene ${regArr.length} regioni (${regArr.join(", ")})`
              : null,
            detectedVia: "COD_REG",
          };
        } else {
          // Non-streaming path for smaller datasets
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
                chunkCount: Math.ceil(records.length / CHUNK),
              }),
            },
          }).eq("id", jobId);

          if (job.dataset_type === "ASC_2021") {
            result = await importAscCsv(records, batchId, admin);
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
        }

        finalResult = result;

        if (!isPaused) {
          // Full completion — run post-import validation
          finalValidation = await validatePostImport(job.dataset_type, admin);
          const totalFailed = result.failed;
          const totalProcessed = result.processed ?? (result.inserted + result.updated);
          finalStatus = totalFailed > totalProcessed && totalProcessed === 0 ? "failed" : "imported";
          finalError = "";
        } else {
          // Paused — status is pending_next_chunk
          finalStatus = "pending_next_chunk";
          finalError = "";
        }

        logStep(finalStatus === "imported" ? "job_marked_imported" : finalStatus === "pending_next_chunk" ? "job_paused_checkpoint" : "job_marked_failed", {
          processed: finalResult?.processed ?? 0,
          failed: finalResult?.failed ?? 0,
          paused: isPaused,
          passNumber: finalCheckpoint?.passNumber ?? existingCheckpoint?.passNumber ?? 1,
        });

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logStep("job_error_caught", { error: errMsg });
        finalStatus = "failed";
        finalError = `Errore imprevisto: ${errMsg}`;
      } finally {
        // ── GUARANTEED STATUS UPDATE ──
        logStep("job_finalizing", { status: finalStatus, paused: isPaused });
        const updatePayload: Record<string, unknown> = {
          status: finalStatus,
          updated_at: nowIso(),
        };

        if (finalStatus !== "pending_next_chunk") {
          updatePayload.completed_at = nowIso();
        }

        if (finalResult) {
          const totalProcessed = finalResult.processed ?? (finalResult.inserted + finalResult.updated);
          const totalRows = Math.max(Number(job.records_total || 0), totalProcessed);
          updatePayload.records_imported = totalProcessed;
          updatePayload.records_errors = finalResult.failed;
          updatePayload.records_skipped = finalResult.skipped;
          updatePayload.import_batch_id = finalBatchId;
          updatePayload.error_log = finalResult.errors.slice(0, MAX_IMPORT_ERRORS);
          updatePayload.warnings = [
            ...(finalResult.warnings || []),
            ...(finalRegion?.multiRegioneWarning ? [finalRegion.multiRegioneWarning] : []),
          ];

          const statsPayload: Record<string, unknown> = {
            ...finalValidation,
            importResult: { processed: totalProcessed, inserted: finalResult.inserted, updated: finalResult.updated, skipped: finalResult.skipped, failed: finalResult.failed },
            skipByReason: (finalResult as any).skipByReason || {},
            progress: buildProgressState({
              datasetType: job.dataset_type,
              processedRows: totalProcessed,
              totalRows,
              failedRows: finalResult.failed,
              skippedRows: finalResult.skipped,
              chunkIndex: finalStatus === "pending_next_chunk"
                ? (finalCheckpoint?.chunkIndex ?? 0)
                : finalStatus === "imported"
                  ? (job.dataset_type === "R03_CSV_SEZ" ? Math.ceil(totalRows / R03_SEZ_CHUNK) : 1)
                  : 0,
              chunkCount: job.dataset_type === "R03_CSV_SEZ"
                ? Math.ceil(totalRows / R03_SEZ_CHUNK)
                : 1,
            }),
          };

          // Save checkpoint for resumable jobs
          if (isPaused && finalCheckpoint) {
            statsPayload.checkpoint = finalCheckpoint;
            statsPayload.passNumber = finalCheckpoint.passNumber;
          } else {
            // Clear checkpoint on completion
            statsPayload.checkpoint = null;
          }

          updatePayload.stats = statsPayload;
        } else {
          updatePayload.error_log = [{ reason: finalError }];
        }
        const { error: finalizeError } = await admin.from("territorial_dataset_jobs").update(updatePayload).eq("id", jobId);
        if (finalizeError) {
          logStep("job_finalize_update_failed", { status: finalStatus, error: finalizeError.message });
        } else {
          logStep("job_finalized", { status: finalStatus });
        }
      }

      return json({
        ok: finalStatus === "imported",
        status: finalStatus,
        paused: isPaused,
        inserted: finalResult?.inserted ?? 0,
        updated: finalResult?.updated ?? 0,
        skipped: finalResult?.skipped ?? 0,
        failed: finalResult?.failed ?? 0,
        errors: finalResult?.errors?.length ?? 0,
        batchId: finalBatchId,
        region: finalRegion,
        validation: finalValidation,
        checkpoint: isPaused ? { passNumber: finalCheckpoint?.passNumber, globalRowIdx: finalCheckpoint?.globalRowIdx, totalRows: job.records_total } : null,
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
