import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * OMI Ingest Edge Function — handles both VALORI and ZONE CSV imports.
 *
 * POST /omi-ingest
 * Body: { csvData: "...", anno: 2025, semestre: 1, mode: "valori"|"zone" }
 */

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/* ── CSV Parsing — VALORI ────────────────────────────── */

interface ValoriIndex {
  comuneIstat: number;
  comuneCat: number;   // OMI internal code (e.g. A1AA) — NOT the standard Belfiore code
  comuneAmm: number;   // Standard Belfiore catastale code (e.g. A001, L219)
  prov: number;
  zona: number;
  linkZona: number;
  descrTipologia: number;
  codTip: number;
  stato: number;
  comprMin: number;
  comprMax: number;
  supNl: number;
}

function detectValoriColumns(headers: string[]): { idx: ValoriIndex; missing: string[] } {
  const find = (pattern: RegExp) => headers.findIndex(h => pattern.test(h));

  const idx: ValoriIndex = {
    comuneIstat: find(/comune.?istat/i),
    comuneCat: find(/comune.?cat/i),
    comuneAmm: find(/comune.?amm/i),
    prov: find(/^prov$/i),
    zona: find(/^zona$/i),
    linkZona: find(/link.?zona/i),
    descrTipologia: find(/descr.?tipolog/i),
    codTip: find(/cod.?tip/i),
    stato: find(/^stato$/i),
    comprMin: find(/compr.?min/i),
    comprMax: find(/compr.?max/i),
    supNl: find(/sup.?nl/i),
  };

  const missing: string[] = [];
  if (idx.comuneCat === -1 && idx.comuneIstat === -1) missing.push("Comune_cat or Comune_ISTAT");
  if (idx.comprMin === -1) missing.push("Compr_min");
  if (idx.comprMax === -1) missing.push("Compr_max");
  if (idx.zona === -1) missing.push("Zona");

  return { idx, missing };
}

function parseDecimal(raw: string | undefined): number {
  if (!raw) return NaN;
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned);
}

type SkipReason =
  | "missing_identifier"
  | "invalid_price_min"
  | "invalid_price_max"
  | "non_positive_price"
  | "missing_zona"
  | "non_residential"
  | "malformed_row";

interface ParsedValoriRow {
  codice_comune_catastale: string;
  codice_comune_istat: string | null;
  comune_label: string;
  provincia: string;
  zona_omi: string;
  zona_omi_label: string;
  tipologia: string;
  stato_conservazione: string;
  quotazione_min: number;
  quotazione_max: number;
  superficie_ref: string;
  semestre: number;
  anno: number;
}

function isResidential(tipologia: string): boolean {
  const t = tipologia.toLowerCase();
  return (
    t.includes("abitazion") ||
    t.includes("residen") ||
    t.includes("civili") ||
    t.includes("economic") ||
    t.includes("ville") ||
    t.includes("villini") ||
    t.includes("signorili")
  );
}

function parseValoriRows(
  lines: string[],
  idx: ValoriIndex,
  anno: number,
  semestre: number,
): { rows: ParsedValoriRow[]; skipped: number; skipReasons: Record<SkipReason, number> } {
  const rows: ParsedValoriRow[] = [];
  let skipped = 0;
  const skipReasons: Record<SkipReason, number> = {
    missing_identifier: 0, invalid_price_min: 0, invalid_price_max: 0,
    non_positive_price: 0, missing_zona: 0, non_residential: 0, malformed_row: 0,
  };
  const skip = (r: SkipReason) => { skipped++; skipReasons[r]++; };

  for (const line of lines) {
    try {
      const vals = line.split(";").map(v => v.trim().replace(/^"|"$/g, ""));

      const codCat = idx.comuneCat >= 0 ? (vals[idx.comuneCat] || "") : "";
      const codIstat = idx.comuneIstat >= 0 ? (vals[idx.comuneIstat] || null) : null;
      if (!codCat && !codIstat) { skip("missing_identifier"); continue; }

      const zona = idx.zona >= 0 ? (vals[idx.zona] || "") : "";
      if (!zona) { skip("missing_zona"); continue; }

      const tipologia = idx.descrTipologia >= 0 ? (vals[idx.descrTipologia] || "") : "";
      if (!isResidential(tipologia)) { skip("non_residential"); continue; }

      const comprMin = parseDecimal(idx.comprMin >= 0 ? vals[idx.comprMin] : undefined);
      const comprMax = parseDecimal(idx.comprMax >= 0 ? vals[idx.comprMax] : undefined);
      if (isNaN(comprMin)) { skip("invalid_price_min"); continue; }
      if (isNaN(comprMax)) { skip("invalid_price_max"); continue; }
      if (comprMin <= 0 || comprMax <= 0) { skip("non_positive_price"); continue; }

      // CRITICAL: In OMI CSVs, Comune_amm = standard Belfiore catastale code (A001, L219)
      // Comune_cat = OMI internal code (A1AA, S1AF) — NOT the join key
      const comuneAmm = idx.comuneAmm >= 0 ? (vals[idx.comuneAmm] || "") : "";
      const belfioreCode = comuneAmm || codCat; // prefer Comune_amm (real Belfiore code)
      const prov = idx.prov >= 0 ? (vals[idx.prov] || "") : "";
      const linkZona = idx.linkZona >= 0 ? (vals[idx.linkZona] || zona) : zona;
      const stato = idx.stato >= 0 ? (vals[idx.stato] || "NORMALE") : "NORMALE";
      const supNl = idx.supNl >= 0 ? (vals[idx.supNl] || "L") : "L";

      rows.push({
        codice_comune_catastale: belfioreCode,
        codice_comune_istat: codIstat,
        comune_label: "", // will be enriched from omi_polygons or left empty
        provincia: prov,
        zona_omi: zona,
        zona_omi_label: linkZona,
        tipologia,
        stato_conservazione: stato,
        quotazione_min: comprMin,
        quotazione_max: comprMax,
        superficie_ref: supNl,
        semestre,
        anno,
      });
    } catch {
      skip("malformed_row");
    }
  }

  return { rows, skipped, skipReasons };
}

/* ── CSV Parsing — ZONE ──────────────────────────────── */

interface ZoneIndex {
  comuneIstat: number;
  comuneCat: number;
  comuneAmm: number;
  comuneDescr: number;
  prov: number;
  fascia: number;
  zona: number;
  zonaDescr: number;
  linkZona: number;
  codTipPrev: number;
  descrTipPrev: number;
  statoPrev: number;
  microzona: number;
}

function detectZoneColumns(headers: string[]): { idx: ZoneIndex; missing: string[] } {
  const find = (pattern: RegExp) => headers.findIndex(h => pattern.test(h));

  const idx: ZoneIndex = {
    comuneIstat: find(/comune.?istat/i),
    comuneCat: find(/comune.?cat/i),
    comuneAmm: find(/comune.?amm/i),
    comuneDescr: find(/comune.?descri/i),
    prov: find(/^prov$/i),
    fascia: find(/^fascia$/i),
    zona: find(/^zona$/i),
    zonaDescr: find(/zona.?descr/i),
    linkZona: find(/link.?zona/i),
    codTipPrev: find(/cod.?tip.?prev/i),
    descrTipPrev: find(/descr.?tip.?prev/i),
    statoPrev: find(/stato.?prev/i),
    microzona: find(/^microzona$/i),
  };

  const missing: string[] = [];
  if (idx.comuneCat === -1 && idx.comuneIstat === -1) missing.push("Comune_cat or Comune_ISTAT");
  if (idx.zona === -1) missing.push("Zona");

  return { idx, missing };
}

interface ParsedZoneRow {
  codice_comune_catastale: string;
  codice_comune_istat: string | null;
  comune_label: string;
  provincia: string;
  fascia: string;
  zona_omi: string;
  zona_descr: string;
  link_zona: string;
  tipologia_prevalente: string;
  microzona: number;
  semestre: number;
  anno: number;
}

function parseZoneRows(
  lines: string[],
  idx: ZoneIndex,
  anno: number,
  semestre: number,
): { rows: ParsedZoneRow[]; skipped: number } {
  const rows: ParsedZoneRow[] = [];
  let skipped = 0;

  for (const line of lines) {
    try {
      const vals = line.split(";").map(v => v.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));

      const codCat = idx.comuneCat >= 0 ? (vals[idx.comuneCat] || "") : "";
      const codIstat = idx.comuneIstat >= 0 ? (vals[idx.comuneIstat] || null) : null;
      if (!codCat && !codIstat) { skipped++; continue; }

      const zona = idx.zona >= 0 ? (vals[idx.zona] || "") : "";
      if (!zona) { skipped++; continue; }

      // CRITICAL: Comune_amm = real Belfiore catastale code, Comune_cat = OMI internal
      const comuneAmm = idx.comuneAmm >= 0 ? (vals[idx.comuneAmm] || "") : "";
      const belfioreCode = comuneAmm || codCat;
      const comuneDescr = idx.comuneDescr >= 0 ? (vals[idx.comuneDescr] || "") : "";

      rows.push({
        codice_comune_catastale: belfioreCode,
        codice_comune_istat: codIstat,
        comune_label: comuneDescr, // Use Comune_descr for human-readable name
        provincia: idx.prov >= 0 ? (vals[idx.prov] || "") : "",
        fascia: idx.fascia >= 0 ? (vals[idx.fascia] || "") : "",
        zona_omi: zona,
        zona_descr: idx.zonaDescr >= 0 ? (vals[idx.zonaDescr] || "") : "",
        link_zona: idx.linkZona >= 0 ? (vals[idx.linkZona] || "") : "",
        tipologia_prevalente: idx.descrTipPrev >= 0 ? (vals[idx.descrTipPrev] || "") : "",
        microzona: idx.microzona >= 0 ? parseInt(vals[idx.microzona] || "0", 10) || 0 : 0,
        semestre,
        anno,
      });
    } catch {
      skipped++;
    }
  }

  return { rows, skipped };
}

/* ── Utility: strip title line ───────────────────────── */

function stripTitleLine(rawLines: string[]): string[] {
  // OMI CSVs often have a title on line 1 like "Quotazioni Immobiliari : ..."
  // The real header contains semicolons as separators
  if (rawLines.length > 0 && rawLines[0].split(";").length < 5) {
    return rawLines.slice(1);
  }
  return rawLines;
}

/* ── Main Handler ─────────────────────────────────────── */

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Auth failed" }, 401);
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return json({ error: "Admin access required" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const mode = (body.mode as string) || "valori";
    const csvData = body.csvData as string;
    const anno = body.anno as number;
    const semestre = body.semestre as number;

    if (!csvData || typeof csvData !== "string") {
      return json({ error: "Required: csvData (string)" }, 400);
    }
    if (!anno || typeof anno !== "number" || anno < 2000 || anno > 2100) {
      return json({ error: "Required: anno (2000–2100)" }, 400);
    }
    if (semestre !== 1 && semestre !== 2) {
      return json({ error: "Required: semestre (1 or 2)" }, 400);
    }

    // Parse CSV lines, strip title if present
    let lines = csvData.split("\n").filter(l => l.trim());
    lines = stripTitleLine(lines);

    if (lines.length < 2) {
      return json({ error: "CSV has no data rows" }, 400);
    }

    const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
    const dataLines = lines.slice(1);

    console.log(`[omi-ingest] mode=${mode}, headers=${headers.length}, dataLines=${dataLines.length}`);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (mode === "zone") {
      return await handleZoneIngest(headers, dataLines, anno, semestre, supabaseAdmin);
    } else {
      return await handleValoriIngest(headers, dataLines, anno, semestre, supabaseAdmin);
    }
  } catch (e) {
    console.error("[omi-ingest] Fatal:", e);
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});

/* ── VALORI ingest handler ───────────────────────────── */

async function handleValoriIngest(
  headers: string[],
  dataLines: string[],
  anno: number,
  semestre: number,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { idx, missing } = detectValoriColumns(headers);
  if (missing.length > 0) {
    return json({ error: `Missing columns: ${missing.join(", ")}`, detectedHeaders: headers }, 400);
  }

  const { rows, skipped, skipReasons } = parseValoriRows(dataLines, idx, anno, semestre);
  console.log(`[omi-ingest] VALORI: parsed ${rows.length} residential rows, skipped ${skipped}`);

  if (rows.length === 0) {
    return json({ ok: false, error: "No valid residential rows", skipped, skipReasons }, 400);
  }

  const BATCH = 500;
  let inserted = 0;
  let batchErrors = 0;
  const errorDetails: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("omi_quotazioni")
      .upsert(batch, {
        onConflict: "codice_comune_catastale,zona_omi,tipologia,stato_conservazione,semestre,anno",
      });

    if (error) {
      console.error(`[omi-ingest] batch ${Math.floor(i / BATCH)} error: ${error.message}`);
      batchErrors++;
      errorDetails.push(error.message);
    } else {
      inserted += batch.length;
    }
  }

  const { count } = await supabaseAdmin
    .from("omi_quotazioni")
    .select("*", { count: "exact", head: true });

  return json({
    ok: true,
    mode: "valori",
    ingest: {
      linesRead: dataLines.length,
      rowsParsed: rows.length,
      rowsInserted: inserted,
      rowsSkipped: skipped,
      skipReasons,
      batchErrors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      anno,
      semestre,
    },
    database: { totalRows: count ?? 0 },
  });
}

/* ── ZONE ingest handler ─────────────────────────────── */

async function handleZoneIngest(
  headers: string[],
  dataLines: string[],
  anno: number,
  semestre: number,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { idx, missing } = detectZoneColumns(headers);
  if (missing.length > 0) {
    return json({ error: `Missing columns: ${missing.join(", ")}`, detectedHeaders: headers }, 400);
  }

  const { rows, skipped } = parseZoneRows(dataLines, idx, anno, semestre);
  console.log(`[omi-ingest] ZONE: parsed ${rows.length} rows, skipped ${skipped}`);

  if (rows.length === 0) {
    return json({ ok: false, error: "No valid zone rows", skipped }, 400);
  }

  const BATCH = 500;
  let inserted = 0;
  let batchErrors = 0;
  const errorDetails: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("omi_zone")
      .upsert(batch, {
        onConflict: "codice_comune_catastale,zona_omi,semestre,anno",
      });

    if (error) {
      console.error(`[omi-ingest] zone batch error: ${error.message}`);
      batchErrors++;
      errorDetails.push(error.message);
    } else {
      inserted += batch.length;
    }
  }

  const { count } = await supabaseAdmin
    .from("omi_zone")
    .select("*", { count: "exact", head: true });

  return json({
    ok: true,
    mode: "zone",
    ingest: {
      linesRead: dataLines.length,
      rowsParsed: rows.length,
      rowsInserted: inserted,
      rowsSkipped: skipped,
      batchErrors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      anno,
      semestre,
    },
    database: { totalZoneRows: count ?? 0 },
  });
}
