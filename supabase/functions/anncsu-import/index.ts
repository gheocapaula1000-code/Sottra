import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders as getCorsHeaders, handleCors } from "../_shared/cors.ts";

let _req: Request | undefined;
const log = (s: string) => console.log(`[anncsu-import] ${s}`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...getCorsHeaders(_req), "Content-Type": "application/json" } });

/* ── CSV parser (same robust logic as territorial-import) ── */

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

/* ── Street type normalization ── */

const STREET_TYPE_MAP: Record<string, string> = {
  "via": "Via", "v.": "Via", "viale": "Viale", "v.le": "Viale",
  "corso": "Corso", "c.so": "Corso", "piazza": "Piazza",
  "p.za": "Piazza", "p.zza": "Piazza", "piazzale": "Piazzale",
  "p.le": "Piazzale", "largo": "Largo", "vicolo": "Vicolo",
  "strada": "Strada", "str.": "Strada", "contrada": "Contrada",
  "c.da": "Contrada", "località": "Località", "loc.": "Località",
  "frazione": "Frazione", "fraz.": "Frazione",
  "lungotevere": "Lungotevere", "lungomare": "Lungomare",
  "lungarno": "Lungarno", "fondamenta": "Fondamenta", "calle": "Calle",
};

function normalizeStreetType(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return t ? (STREET_TYPE_MAP[t.toLowerCase()] ?? t) : null;
}

function normalizeCivic(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^0+/, "");
  return (t && t !== "0") ? t : null;
}

function normalizeEsp(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  return t || null;
}

function resolveIstat(raw: Record<string, string>): string | null {
  const c = (raw["COD_COM"] || "").trim();
  if (c && /^\d+$/.test(c)) return c.padStart(6, "0");
  const p = (raw["PROCOM"] || "").trim();
  if (p && /^\d+$/.test(p)) return p.padStart(6, "0");
  return null;
}

/* ── Normalization for DB insert ── */

interface NormalizedRow {
  comune_istat_code: string;
  regione_code: string | null;
  provincia_code: string | null;
  comune_label: string | null;
  cod_strada: string | null;
  street_type: string | null;
  street_name: string;
  street_full_name: string | null;
  civic_normalized: string | null;
  esponente: string | null;
  barrato: string | null;
  civic_full_label: string | null;
  localita_code: string | null;
  sezione_censuaria: string | null;
  street_status: string;
  civic_status: string;
  ingest_readiness: string;
  ambiguity_flags: string[];
  warnings: string[];
  raw_completeness: number;
}

function normalizeRow(raw: Record<string, string>): { ok: true; row: NormalizedRow } | { ok: false; reason: string } {
  const istat = resolveIstat(raw);
  if (!istat) return { ok: false, reason: "no_geo_anchor" };

  const streetNameRaw = (raw["DENOM_STRADA"] || "").trim();
  if (!streetNameRaw) return { ok: false, reason: "no_street_name" };

  const streetTypeRaw = (raw["SPECIE"] || "").trim() || null;
  const streetType = normalizeStreetType(streetTypeRaw);
  const streetFull = streetType ? `${streetType} ${streetNameRaw}` : streetNameRaw;
  const streetStatus = streetType && streetNameRaw ? "complete" : streetNameRaw ? "name_only" : "missing";

  const civic = normalizeCivic((raw["CIVICO"] || "").trim() || null);
  const esp = normalizeEsp((raw["ESPONENTE"] || "").trim() || null);
  const barrato = (raw["BARRATO"] || "").trim() || null;
  const civicLabel = civic ? (esp ? `${civic}/${esp}` : civic) : null;
  const civicStatus = !civic ? "missing" : (!/^\d+$/.test(civic) ? "malformed" : (esp ? "present_with_esponente" : "present"));

  const flags: string[] = [];
  if (!streetType) flags.push("street_type_missing");
  if (!civic) flags.push("civic_missing");

  const regCode = (raw["COD_REG"] || "").trim() || null;
  const provCode = (raw["COD_PROV"] || "").trim() || null;
  if (!regCode) flags.push("regione_code_missing");

  const fields = [regCode, provCode, istat, raw["DENOM_COM"], streetTypeRaw, streetNameRaw, raw["CIVICO"]];
  const filled = fields.filter(f => f && f.trim()).length;
  const completeness = Math.round((filled / fields.length) * 100) / 100;

  const warnings: string[] = [];
  if (completeness < 0.5) warnings.push("low_completeness");
  if (flags.length > 2) warnings.push("high_ambiguity");

  let readiness = "ready";
  if (flags.length > 3) readiness = "review_needed";
  else if (warnings.length > 0 || flags.length > 0) readiness = "ready_with_warnings";

  return {
    ok: true,
    row: {
      comune_istat_code: istat,
      regione_code: regCode ? regCode.padStart(2, "0") : null,
      provincia_code: provCode ? provCode.padStart(3, "0") : null,
      comune_label: (raw["DENOM_COM"] || "").trim() || null,
      cod_strada: (raw["COD_STRADA"] || "").trim() || null,
      street_type: streetType,
      street_name: streetNameRaw,
      street_full_name: streetFull,
      civic_normalized: civic,
      esponente: esp,
      barrato,
      civic_full_label: civicLabel,
      localita_code: (raw["COD_LOC"] || "").trim() || null,
      sezione_censuaria: (raw["SEZ_CENSUARIA"] || "").trim() || null,
      street_status: streetStatus,
      civic_status: civicStatus,
      ingest_readiness: readiness,
      ambiguity_flags: flags,
      warnings,
      raw_completeness: completeness,
    },
  };
}

/* ── Main handler ── */

serve(async (req) => {
  _req = req;
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { action, job_id, offset, source_version, source_date } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    /* ── VALIDATE: dry-run parse from storage ── */
    if (action === "validate") {
      if (!job_id) return json({ ok: false, error: "job_id required" }, 400);

      const { data: job } = await supabase.from("territorial_dataset_jobs").select("*").eq("id", job_id).single();
      if (!job) return json({ ok: false, error: "job not found" }, 404);

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("territorial-datasets").download(job.file_path);
      if (dlErr || !fileData) return json({ ok: false, error: `download failed: ${dlErr?.message}` }, 500);

      const text = await fileData.text();
      const records = parseCsv(text);
      if (records.length === 0) return json({ ok: false, error: "empty or unparseable CSV" }, 400);

      let ready = 0, warnings = 0, blocked = 0, review = 0;
      const flagCounts = new Map<string, number>();
      const blockReasons = new Map<string, number>();

      for (const r of records) {
        const result = normalizeRow(r);
        if (!result.ok) {
          blocked++;
          blockReasons.set(result.reason, (blockReasons.get(result.reason) ?? 0) + 1);
        } else {
          const rd = result.row.ingest_readiness;
          if (rd === "ready") ready++;
          else if (rd === "ready_with_warnings") warnings++;
          else if (rd === "review_needed") review++;
          for (const f of result.row.ambiguity_flags) {
            flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
          }
        }
      }

      // Mark job validated
      await supabase.from("territorial_dataset_jobs").update({
        status: "validated",
        records_total: records.length,
        validation_result: {
          ready, warnings, blocked, review,
          top_flags: [...flagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
          block_reasons: [...blockReasons.entries()].sort((a, b) => b[1] - a[1]),
        },
      }).eq("id", job_id);

      return json({
        ok: true,
        total: records.length,
        ready, warnings, blocked, review,
        ingest_eligible: ready + warnings,
        top_flags: [...flagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
        block_reasons: [...blockReasons.entries()],
      });
    }

    /* ── IMPORT: chunked insert with resume ── */
    if (action === "import") {
      if (!job_id) return json({ ok: false, error: "job_id required" }, 400);

      const { data: job } = await supabase.from("territorial_dataset_jobs").select("*").eq("id", job_id).single();
      if (!job) return json({ ok: false, error: "job not found" }, 404);

      // Download and parse
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("territorial-datasets").download(job.file_path);
      if (dlErr || !fileData) return json({ ok: false, error: `download failed: ${dlErr?.message}` }, 500);

      const text = await fileData.text();
      const records = parseCsv(text);

      const startOffset = offset ?? (job.stats as Record<string, unknown>)?.last_offset ?? 0;
      const batchId = job.import_batch_id ?? `anncsu_${job_id}_${Date.now()}`;
      const CHUNK_SIZE = 100;
      const TIME_BUDGET_MS = 12_000;
      const startTime = Date.now();

      let inserted = 0, updated = 0, duplicates = 0, blocked = 0, errors = 0;
      let currentOffset = startOffset;

      // Mark importing
      if (startOffset === 0) {
        await supabase.from("territorial_dataset_jobs").update({
          status: "importing",
          started_at: new Date().toISOString(),
          import_batch_id: batchId,
          records_total: records.length,
        }).eq("id", job_id);
      }

      while (currentOffset < records.length) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          // Save checkpoint
          await supabase.from("territorial_dataset_jobs").update({
            status: "pending_next_chunk",
            records_imported: (job.records_imported ?? 0) + inserted + updated,
            records_skipped: (job.records_skipped ?? 0) + duplicates,
            records_errors: (job.records_errors ?? 0) + blocked + errors,
            stats: {
              last_offset: currentOffset,
              chunk_inserted: inserted,
              chunk_updated: updated,
              chunk_blocked: blocked,
              chunk_errors: errors,
            },
            updated_at: new Date().toISOString(),
          }).eq("id", job_id);

          return json({
            ok: true,
            status: "pending_next_chunk",
            offset: currentOffset,
            total: records.length,
            chunk: { inserted, updated, duplicates, blocked, errors },
          });
        }

        const chunk = records.slice(currentOffset, currentOffset + CHUNK_SIZE);
        const rows: Record<string, unknown>[] = [];

        for (const raw of chunk) {
          const result = normalizeRow(raw);
          if (!result.ok) { blocked++; continue; }
          rows.push({
            ...result.row,
            source_version: source_version ?? null,
            source_date: source_date ?? null,
            import_batch_id: batchId,
            import_job_id: job_id,
          });
        }

        if (rows.length > 0) {
          // Upsert with dedup key — handled by unique index, use ON CONFLICT
          const { error: upsertErr, count } = await supabase
            .from("anncsu_streets")
            .upsert(rows, {
              onConflict: "comune_istat_code,COALESCE(cod_strada,''),street_name,COALESCE(civic_normalized,''),COALESCE(esponente,'')",
              count: "exact",
            });

          if (upsertErr) {
            // Fallback: insert one by one
            log(`bulk upsert error: ${upsertErr.message}, falling back to single inserts`);
            for (const row of rows) {
              const { error: singleErr } = await supabase.from("anncsu_streets").upsert(row, {
                onConflict: "comune_istat_code,COALESCE(cod_strada,''),street_name,COALESCE(civic_normalized,''),COALESCE(esponente,'')",
              });
              if (singleErr) {
                if (singleErr.code === "23505") duplicates++;
                else { errors++; log(`row error: ${singleErr.message}`); }
              } else {
                inserted++;
              }
            }
          } else {
            inserted += count ?? rows.length;
          }
        }

        currentOffset += CHUNK_SIZE;
      }

      // Mark completed
      const totalInserted = (job.records_imported ?? 0) + inserted + updated;
      const totalSkipped = (job.records_skipped ?? 0) + duplicates;
      const totalErrors = (job.records_errors ?? 0) + blocked + errors;

      await supabase.from("territorial_dataset_jobs").update({
        status: "imported",
        completed_at: new Date().toISOString(),
        records_imported: totalInserted,
        records_skipped: totalSkipped,
        records_errors: totalErrors,
        stats: {
          last_offset: currentOffset,
          final_inserted: totalInserted,
          final_skipped: totalSkipped,
          final_errors: totalErrors,
        },
      }).eq("id", job_id);

      return json({
        ok: true,
        status: "imported",
        total: records.length,
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: totalErrors,
      });
    }

    /* ── SUMMARY: query stored data stats ── */
    if (action === "summary") {
      const { data: total } = await supabase.from("anncsu_streets").select("id", { count: "exact", head: true });
      const { data: comuni } = await supabase.rpc("count_anncsu_comuni" as never);

      // Get per-readiness counts
      const { data: readyCount } = await supabase.from("anncsu_streets")
        .select("id", { count: "exact", head: true }).eq("ingest_readiness", "ready");
      const { data: warnCount } = await supabase.from("anncsu_streets")
        .select("id", { count: "exact", head: true }).eq("ingest_readiness", "ready_with_warnings");

      return json({
        ok: true,
        total_records: (total as unknown as { count: number })?.count ?? 0,
        ready: (readyCount as unknown as { count: number })?.count ?? 0,
        ready_with_warnings: (warnCount as unknown as { count: number })?.count ?? 0,
      });
    }

    /* ── QUERY: internal lookup helpers ── */
    if (action === "query_streets") {
      const { comune_istat_code, street_name, limit: lim } = await req.json().catch(() => ({})) as Record<string, string>;
      if (!comune_istat_code) return json({ ok: false, error: "comune_istat_code required" }, 400);

      let query = supabase.from("anncsu_streets")
        .select("*")
        .eq("comune_istat_code", comune_istat_code)
        .limit(Number(lim) || 50);

      if (street_name) {
        query = query.ilike("street_name", `%${street_name}%`);
      }

      const { data, error } = await query;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, records: data });
    }

    return json({ ok: false, error: `unknown action: ${action}` }, 400);
  } catch (e) {
    log(`unhandled: ${e}`);
    return json({ ok: false, error: String(e) }, 500);
  }
});
