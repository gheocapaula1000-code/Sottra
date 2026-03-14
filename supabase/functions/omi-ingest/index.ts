import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * OMI Ingest Edge Function
 *
 * Admin-only endpoint to upload real OMI quotation data from
 * Agenzia delle Entrate CSV files into the omi_quotazioni table.
 *
 * Expected CSV format (semicolon-separated, from OMI official downloads):
 * Area_territoriale;Regione;Prov;Comune_ISTAT;Comune_catastale;Comune_amm;
 * Sez;Zona;LinkZona;Cod_Tip;Descr_Tipologia;Stato_conservativo;
 * Compr_min;Compr_max;Sup_NL;Loc_min;Loc_max
 *
 * Usage:
 * POST /omi-ingest
 * Body: { csvData: "...", anno: 2024, semestre: 1, provincia: "MI" }
 *
 * The function parses the CSV and upserts rows into omi_quotazioni.
 * It is idempotent: re-uploading the same semestre+anno overwrites existing data.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── CSV Parsing Helpers ──────────────────────────────── */

interface ColumnIndex {
  comuneIstat: number;
  comuneCatastale: number;
  comuneAmm: number;
  prov: number;
  zona: number;
  linkZona: number;
  descrTipologia: number;
  codTip: number;
  statoConservativo: number;
  comprMin: number;
  comprMax: number;
  supNl: number;
}

function detectColumns(headers: string[]): { idx: ColumnIndex; missing: string[] } {
  const idx: ColumnIndex = {
    comuneIstat: headers.findIndex(h => /comune.?istat/i.test(h)),
    comuneCatastale: headers.findIndex(h => /comune.?catast/i.test(h)),
    comuneAmm: headers.findIndex(h => /comune.?amm/i.test(h)),
    prov: headers.findIndex(h => /^prov$/i.test(h)),
    zona: headers.findIndex(h => /^zona$/i.test(h)),
    linkZona: headers.findIndex(h => /link.?zona/i.test(h)),
    descrTipologia: headers.findIndex(h => /descr.?tipolog/i.test(h)),
    codTip: headers.findIndex(h => /cod.?tip/i.test(h)),
    statoConservativo: headers.findIndex(h => /stato.?conserv/i.test(h)),
    comprMin: headers.findIndex(h => /compr.?min/i.test(h)),
    comprMax: headers.findIndex(h => /compr.?max/i.test(h)),
    supNl: headers.findIndex(h => /sup.?nl/i.test(h)),
  };

  const missing: string[] = [];
  if (idx.comuneCatastale === -1 && idx.comuneIstat === -1) missing.push("Comune_catastale or Comune_ISTAT");
  if (idx.comprMin === -1) missing.push("Compr_min");
  if (idx.comprMax === -1) missing.push("Compr_max");
  if (idx.zona === -1) missing.push("Zona");

  return { idx, missing };
}

function parseDecimal(raw: string | undefined): number {
  if (!raw) return NaN;
  // Handle Italian decimal separator (comma) and thousands separator (dot)
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

interface ParsedRow {
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

interface ParseResult {
  rows: ParsedRow[];
  skipped: number;
  skipReasons: Record<SkipReason, number>;
}

function parseCsvRows(
  lines: string[],
  idx: ColumnIndex,
  anno: number,
  semestre: number,
  provinciaFallback: string,
): ParseResult {
  const rows: ParsedRow[] = [];
  let skipped = 0;
  const skipReasons: Record<SkipReason, number> = {
    missing_identifier: 0,
    invalid_price_min: 0,
    invalid_price_max: 0,
    non_positive_price: 0,
    missing_zona: 0,
    non_residential: 0,
    malformed_row: 0,
  };

  const skip = (reason: SkipReason) => { skipped++; skipReasons[reason]++; };

  for (let i = 0; i < lines.length; i++) {
    // Safely parse each row — never crash
    try {
      const vals = lines[i].split(";").map(v => v.trim().replace(/^"|"$/g, ""));

      const codCatastale = idx.comuneCatastale >= 0 ? (vals[idx.comuneCatastale] || "") : "";
      const codIstat = idx.comuneIstat >= 0 ? (vals[idx.comuneIstat] || null) : null;

      if (!codCatastale && !codIstat) { skip("missing_identifier"); continue; }

      const zona = idx.zona >= 0 ? (vals[idx.zona] || "") : "";
      if (!zona) { skip("missing_zona"); continue; }

      const rawMin = idx.comprMin >= 0 ? vals[idx.comprMin] : undefined;
      const rawMax = idx.comprMax >= 0 ? vals[idx.comprMax] : undefined;
      const comprMin = parseDecimal(rawMin);
      const comprMax = parseDecimal(rawMax);

      if (isNaN(comprMin)) { skip("invalid_price_min"); continue; }
      if (isNaN(comprMax)) { skip("invalid_price_max"); continue; }
      if (comprMin <= 0 || comprMax <= 0) { skip("non_positive_price"); continue; }

      const tipologia = idx.descrTipologia >= 0 ? (vals[idx.descrTipologia] || "Abitazioni civili") : "Abitazioni civili";
      const tipLower = tipologia.toLowerCase();
      if (!tipLower.includes("abitazion") && !tipLower.includes("residen") && !tipLower.includes("civili") && !tipLower.includes("economic")) {
        skip("non_residential"); continue;
      }

      const comuneAmm = idx.comuneAmm >= 0 ? (vals[idx.comuneAmm] || "") : "";
      const provLabel = idx.prov >= 0 ? (vals[idx.prov] || provinciaFallback) : provinciaFallback;
      const zonaLabel = idx.linkZona >= 0 ? (vals[idx.linkZona] || zona) : zona;
      const statoConservativo = idx.statoConservativo >= 0 ? (vals[idx.statoConservativo] || "NORMALE") : "NORMALE";
      const supNl = idx.supNl >= 0 ? (vals[idx.supNl] || "L") : "L";

      rows.push({
        codice_comune_catastale: codCatastale,
        codice_comune_istat: codIstat,
        comune_label: comuneAmm,
        provincia: provLabel,
        zona_omi: zona,
        zona_omi_label: zonaLabel,
        tipologia,
        stato_conservazione: statoConservativo,
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

/* ── Main Handler ─────────────────────────────────────── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: admin only
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

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { csvData, anno, semestre, provincia } = body as {
      csvData: string;
      anno: number;
      semestre: number;
      provincia?: string;
    };

    // Validate required fields
    if (!csvData || typeof csvData !== "string") {
      return json({ error: "Required field: csvData (string)" }, 400);
    }
    if (!anno || typeof anno !== "number" || anno < 2000 || anno > 2100) {
      return json({ error: "Required field: anno (number, 2000–2100)" }, 400);
    }
    if (semestre !== 1 && semestre !== 2) {
      return json({ error: "Required field: semestre (1 or 2)" }, 400);
    }

    // Parse CSV
    const lines = csvData.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      return json({ error: "CSV has no data rows (need header + at least 1 row)" }, 400);
    }

    const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
    console.log(`[omi-ingest] CSV headers (${headers.length}): ${headers.join(", ")}`);

    const { idx, missing } = detectColumns(headers);
    if (missing.length > 0) {
      return json({
        error: `Missing required columns: ${missing.join(", ")}`,
        detectedHeaders: headers,
        format: {
          description: "OMI CSV from Agenzia delle Entrate, semicolon-separated",
          requiredColumns: ["Comune_catastale or Comune_ISTAT", "Zona", "Compr_min", "Compr_max"],
          optionalColumns: ["Comune_amm", "Prov", "LinkZona", "Descr_Tipologia", "Stato_conservativo", "Sup_NL"],
        },
      }, 400);
    }

    // Parse data rows (skip header at lines[0])
    const dataLines = lines.slice(1);
    const { rows, skipped, skipReasons } = parseCsvRows(dataLines, idx, anno, semestre, provincia ?? "");

    console.log(`[omi-ingest] Parsed ${rows.length} residential rows, skipped ${skipped}`);

    if (rows.length === 0) {
      return json({
        ok: false,
        error: "No valid residential rows found after parsing",
        linesRead: dataLines.length,
        skipped,
        skipReasons,
      }, 400);
    }

    // Use service role for upsert (admin already verified)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Batch upsert in chunks of 200 (idempotent via onConflict)
    const BATCH_SIZE = 200;
    let inserted = 0;
    let batchErrors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabaseAdmin
        .from("omi_quotazioni")
        .upsert(batch, {
          onConflict: "codice_comune_catastale,zona_omi,tipologia,stato_conservazione,semestre,anno",
        });

      if (upsertError) {
        console.error(`[omi-ingest] Batch ${Math.floor(i / BATCH_SIZE)} error: ${upsertError.message}`);
        batchErrors++;
        errorDetails.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${upsertError.message}`);
      } else {
        inserted += batch.length;
      }
    }

    // Post-ingest stats
    const { count: totalRows } = await supabaseAdmin
      .from("omi_quotazioni")
      .select("*", { count: "exact", head: true });

    const { data: coverageData } = await supabaseAdmin
      .from("omi_quotazioni")
      .select("codice_comune_catastale, anno, semestre")
      .limit(1000);

    const distinctComuni = new Set(coverageData?.map((r: Record<string, unknown>) => r.codice_comune_catastale)).size;
    const distinctPeriods = new Set(coverageData?.map((r: Record<string, unknown>) => `${r.anno}-S${r.semestre}`)).size;

    return json({
      ok: true,
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
        provincia: provincia ?? "all",
        idempotent: true,
      },
      database: {
        totalRows: totalRows ?? 0,
        distinctComuni,
        distinctPeriods,
      },
    });
  } catch (e) {
    console.error("[omi-ingest] Fatal:", e);
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});
