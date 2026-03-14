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

    // Parse request
    const body = await req.json();
    const { csvData, anno, semestre, provincia } = body as {
      csvData: string;
      anno: number;
      semestre: number;
      provincia?: string;
    };

    if (!csvData || !anno || !semestre) {
      return json({
        error: "Required fields: csvData, anno, semestre",
        format: {
          description: "OMI CSV from Agenzia delle Entrate, semicolon-separated",
          expectedColumns: [
            "Area_territoriale", "Regione", "Prov",
            "Comune_ISTAT", "Comune_catastale", "Comune_amm",
            "Sez", "Zona", "LinkZona",
            "Cod_Tip", "Descr_Tipologia", "Stato_conservativo",
            "Compr_min", "Compr_max", "Sup_NL",
            "Loc_min", "Loc_max",
          ],
        },
      }, 400);
    }

    if (semestre !== 1 && semestre !== 2) {
      return json({ error: "semestre must be 1 or 2" }, 400);
    }

    // Parse CSV
    const lines = csvData.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      return json({ error: "CSV has no data rows" }, 400);
    }

    const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
    console.log("[omi-ingest] CSV headers:", headers.join(", "));

    // Map column names (handle variations in OMI CSV format)
    const colIdx = {
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

    // Validate minimum required columns
    if (colIdx.comuneCatastale === -1 && colIdx.comuneIstat === -1) {
      return json({
        error: "Cannot find Comune_catastale or Comune_ISTAT column",
        detectedHeaders: headers,
      }, 400);
    }

    if (colIdx.comprMin === -1 || colIdx.comprMax === -1) {
      return json({
        error: "Cannot find Compr_min / Compr_max columns",
        detectedHeaders: headers,
      }, 400);
    }

    // Parse rows
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(";").map(v => v.trim().replace(/^"|"$/g, ""));

      const codCatastale = colIdx.comuneCatastale >= 0 ? vals[colIdx.comuneCatastale] : null;
      const codIstat = colIdx.comuneIstat >= 0 ? vals[colIdx.comuneIstat] : null;
      const comuneAmm = colIdx.comuneAmm >= 0 ? vals[colIdx.comuneAmm] : "";
      const provLabel = colIdx.prov >= 0 ? vals[colIdx.prov] : (provincia ?? "");
      const zona = colIdx.zona >= 0 ? vals[colIdx.zona] : "";
      const zonaLabel = colIdx.linkZona >= 0 ? vals[colIdx.linkZona] : "";
      const tipologia = colIdx.descrTipologia >= 0 ? vals[colIdx.descrTipologia] : "Abitazioni civili";
      const statoConservativo = colIdx.statoConservativo >= 0 ? vals[colIdx.statoConservativo] : "NORMALE";

      // Parse prices (handle both . and , as decimal separators)
      const rawMin = vals[colIdx.comprMin]?.replace(",", ".") ?? "";
      const rawMax = vals[colIdx.comprMax]?.replace(",", ".") ?? "";
      const comprMin = parseFloat(rawMin);
      const comprMax = parseFloat(rawMax);
      const supNl = colIdx.supNl >= 0 ? vals[colIdx.supNl] : "L";

      if (!codCatastale && !codIstat) { skipped++; continue; }
      if (isNaN(comprMin) || isNaN(comprMax)) { skipped++; continue; }
      if (comprMin <= 0 || comprMax <= 0) { skipped++; continue; }
      if (!zona) { skipped++; continue; }

      // Filter by tipologia — only residential for now
      const tipLower = tipologia.toLowerCase();
      if (!tipLower.includes("abitazion") && !tipLower.includes("residen") && !tipLower.includes("civili") && !tipLower.includes("economic")) {
        continue; // Skip non-residential
      }

      rows.push({
        codice_comune_catastale: codCatastale ?? "",
        codice_comune_istat: codIstat,
        comune_label: comuneAmm,
        provincia: provLabel,
        zona_omi: zona,
        zona_omi_label: zonaLabel || zona,
        tipologia: tipologia || "Abitazioni civili",
        stato_conservazione: statoConservativo || "NORMALE",
        quotazione_min: comprMin,
        quotazione_max: comprMax,
        superficie_ref: supNl || "L",
        semestre,
        anno,
      });
    }

    console.log(`[omi-ingest] Parsed ${rows.length} residential rows, skipped ${skipped}`);

    if (rows.length === 0) {
      return json({ error: "No valid residential rows found", skipped }, 400);
    }

    // Use service role for upsert (admin already verified)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Batch upsert in chunks of 100
    const BATCH_SIZE = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabaseAdmin
        .from("omi_quotazioni")
        .upsert(batch, {
          onConflict: "codice_comune_catastale,zona_omi,tipologia,stato_conservazione,semestre,anno",
        });

      if (upsertError) {
        console.error(`[omi-ingest] Batch ${i / BATCH_SIZE} error:`, upsertError.message);
        errors++;
      } else {
        inserted += batch.length;
      }
    }

    return json({
      ok: true,
      inserted,
      errors,
      skipped,
      totalParsed: rows.length,
      anno,
      semestre,
      provincia: provincia ?? "all",
    });
  } catch (e) {
    console.error("[omi-ingest] Fatal:", e);
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});
