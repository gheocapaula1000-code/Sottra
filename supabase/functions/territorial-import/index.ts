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

/* ── Import processors ── */

const CHUNK = 500;

async function importR03Sez(
  rows: Record<string, string>[],
  ascMappings: Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>,
  batchId: string,
  admin: ReturnType<typeof createClient>,
) {
  let imported = 0;
  const errors: { idx: number; reason: string }[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const dbRows = chunk.map((r, j) => {
      const sez = r["SEZ2021"] || r["SEZ"] || "";
      const com = r["PRO_COM_T"] || r["PRO_COM"] || "";
      if (!sez) { errors.push({ idx: i + j, reason: "SEZ2021 mancante" }); return null; }
      if (!com) { errors.push({ idx: i + j, reason: "PRO_COM_T mancante" }); return null; }
      const m = ascMappings.get(sez);
      return {
        source_dataset: "R03_21",
        source_year: 2021,
        source_label: "ISTAT Censimento 2021 — Lombardia",
        regione_code: "03",
        regione_name: "Lombardia",
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

    if (dbRows.length === 0) continue;
    const { error, count } = await admin.from("census_sections_r03_2021").upsert(dbRows as any[], { onConflict: "source_dataset,section_code" }).select("id");
    if (error) { dbRows.forEach((_, j) => errors.push({ idx: i + j, reason: error.message })); }
    else imported += count ?? dbRows.length;
  }

  return { imported, errors, warnings };
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

  return { imported, errors };
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

    // Admin check
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Admin required" }, 200);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json();
    const { action } = body as { action: string };

    /* ── ACTION: process-csv ── */
    if (action === "process-csv") {
      const { jobId } = body as { jobId: string };
      if (!jobId) return json({ error: "jobId required" }, 200);

      // Get job
      const { data: job, error: jobErr } = await admin.from("territorial_dataset_jobs").select("*").eq("id", jobId).single();
      if (jobErr || !job) return json({ error: "Job not found" }, 200);

      // Update status
      await admin.from("territorial_dataset_jobs").update({ status: "validating", started_at: new Date().toISOString() }).eq("id", jobId);

      // Download file from storage
      const { data: fileData, error: dlErr } = await admin.storage.from("territorial-datasets").download(job.file_path);
      if (dlErr || !fileData) {
        await admin.from("territorial_dataset_jobs").update({ status: "failed", error_log: [{ reason: `Download failed: ${dlErr?.message}` }] }).eq("id", jobId);
        return json({ error: "File download failed" }, 200);
      }

      const csvText = await fileData.text();
      const records = parseCsv(csvText);

      if (records.length === 0) {
        await admin.from("territorial_dataset_jobs").update({ status: "failed", error_log: [{ reason: "CSV vuoto o formato non riconosciuto" }] }).eq("id", jobId);
        return json({ error: "Empty CSV" }, 200);
      }

      log("process-csv", `${records.length} records, type=${job.dataset_type}, headers=${Object.keys(records[0]).slice(0, 10).join(",")}`);

      // Update to importing
      await admin.from("territorial_dataset_jobs").update({
        status: "importing",
        records_total: records.length,
        validation_result: { headers: Object.keys(records[0]), sampleRow: records[0], totalRows: records.length },
      }).eq("id", jobId);

      const batchId = `${job.dataset_type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let result: { imported: number; errors: { idx: number; reason: string }[]; warnings?: string[] };

      if (job.dataset_type === "ASC_2021") {
        result = await importAscCsv(records, batchId, admin);
      } else if (job.dataset_type === "R03_CSV_SEZ") {
        // Check if we have ASC mapping jobs already imported
        const ascMappings = new Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }>();

        // Try to load ASC1/ASC2 from already-imported files in storage
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
                else if (level === "ASC2") existing.asc2 = code;
                else if (level === "ASC3") existing.asc3 = code;
                ascMappings.set(sez, existing);
              }
              log("asc-mapping", `${level}: ${ascRows.length} mappings loaded`);
            }
          }
        }

        result = await importR03Sez(records, ascMappings, batchId, admin);
      } else if (job.dataset_type.startsWith("R03_CSV_ASC")) {
        // ASC mapping CSVs: just store them, they're used during SEZ import
        result = { imported: records.length, errors: [], warnings: [`File mapping ${job.dataset_type} registrato. Verrà usato durante l'import di SEZ_R03_21.csv.`] };
      } else {
        await admin.from("territorial_dataset_jobs").update({ status: "failed", error_log: [{ reason: `Tipo dataset non supportato: ${job.dataset_type}` }] }).eq("id", jobId);
        return json({ error: "Unsupported dataset type" }, 200);
      }

      // Post-import validation
      const validation = await validatePostImport(job.dataset_type, admin);

      const finalStatus = result.errors.length > result.imported ? "failed" : "imported";
      await admin.from("territorial_dataset_jobs").update({
        status: finalStatus,
        records_imported: result.imported,
        records_errors: result.errors.length,
        records_skipped: records.length - result.imported - result.errors.length,
        import_batch_id: batchId,
        error_log: result.errors.slice(0, 100),
        warnings: result.warnings || [],
        stats: validation,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);

      return json({ ok: true, imported: result.imported, errors: result.errors.length, batchId, validation });
    }

    /* ── ACTION: get-stats ── */
    if (action === "get-stats") {
      const validation = await validatePostImport("ASC_2021", admin);
      const r03Val = await validatePostImport("R03_CSV_SEZ", admin);
      return json({ ok: true, asc: (validation as any).asc || null, r03: (r03Val as any).r03 || null });
    }

    /* ── ACTION: list-jobs ── */
    if (action === "list-jobs") {
      const { data, error } = await admin.from("territorial_dataset_jobs").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) return json({ error: error.message }, 200);
      return json({ ok: true, jobs: data });
    }

    return json({ error: `Unknown action: ${action}` }, 200);
  } catch (e) {
    log("FATAL", String(e));
    return json({ error: "Internal error" }, 200);
  }
});
