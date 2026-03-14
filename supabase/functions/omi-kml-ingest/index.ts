import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

/** Parse KML text and extract polygons with CODCOM/CODZONA metadata */
function parseKml(kmlText: string): Array<{
  codice_comune_catastale: string;
  zona_omi: string;
  comune_label: string;
  polygons: number[][][]; // array of rings, each ring = array of [lng, lat]
}> {
  const results: Array<{
    codice_comune_catastale: string;
    zona_omi: string;
    comune_label: string;
    polygons: number[][][];
  }> = [];

  // Extract Placemarks using regex (Deno edge functions don't have DOMParser)
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/gi;
  let pmMatch;

  while ((pmMatch = placemarkRegex.exec(kmlText)) !== null) {
    const pmContent = pmMatch[1];

    // Extract CODCOM from ExtendedData
    const codcomMatch = pmContent.match(/<Data\s+name="CODCOM"[\s\S]*?<value>(.*?)<\/value>/i);
    const codzonaMatch = pmContent.match(/<Data\s+name="CODZONA"[\s\S]*?<value>(.*?)<\/value>/i);

    if (!codcomMatch || !codzonaMatch) continue;

    const codcom = codcomMatch[1].trim();
    const codzona = codzonaMatch[1].trim();

    if (!codcom || !codzona) continue;

    // Extract comune label from <name> tag
    const nameMatch = pmContent.match(/<name>(.*?)<\/name>/i);
    const comuneLabel = nameMatch
      ? nameMatch[1].replace(/\s*-\s*Zona OMI.*$/i, "").trim()
      : "";

    // Extract all coordinate blocks
    const coordsRegex = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/gi;
    const polygons: number[][][] = [];
    let coordMatch;

    while ((coordMatch = coordsRegex.exec(pmContent)) !== null) {
      const coordText = coordMatch[1].trim();
      if (!coordText) continue;

      const ring: number[][] = [];
      // Coordinates are "lng,lat,alt lng,lat,alt ..." or newline-separated
      const points = coordText.split(/\s+/).filter(s => s.includes(","));

      for (const point of points) {
        const parts = point.split(",");
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lng) && !isNaN(lat)) {
            ring.push([lng, lat]);
          }
        }
      }

      if (ring.length >= 3) {
        polygons.push(ring);
      }
    }

    if (polygons.length > 0) {
      results.push({
        codice_comune_catastale: codcom,
        zona_omi: codzona,
        comune_label: comuneLabel,
        polygons,
      });
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Verify user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Auth failed" }, 401);
    }

    const { data: roleData } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (!roleData) {
      return json({ ok: false, error: "Admin access required" }, 403);
    }

    // Parse request body
    const body = await req.json();
    const { kmlData, anno = 2025, semestre = 1 } = body as {
      kmlData: string;
      anno?: number;
      semestre?: number;
    };

    if (!kmlData || typeof kmlData !== "string") {
      return json({ ok: false, error: "kmlData string required" }, 400);
    }

    console.log(`[omi-kml-ingest] Parsing KML, anno=${anno}, semestre=${semestre}, size=${kmlData.length}`);

    // Parse KML
    const parsed = parseKml(kmlData);
    console.log(`[omi-kml-ingest] Parsed ${parsed.length} placemarks`);

    if (parsed.length === 0) {
      return json({
        ok: true,
        ingest: { placemarksParsed: 0, rowsUpserted: 0, errors: 0 },
      });
    }

    // Upsert into omi_polygons using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let rowsUpserted = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const pm of parsed) {
      try {
        const { error: upsertError } = await adminClient
          .from("omi_polygons")
          .upsert(
            {
              codice_comune_catastale: pm.codice_comune_catastale,
              zona_omi: pm.zona_omi,
              comune_label: pm.comune_label,
              polygon_coords: pm.polygons,
              anno,
              semestre,
            },
            { onConflict: "codice_comune_catastale,zona_omi,anno,semestre" }
          );

        if (upsertError) {
          errors++;
          errorDetails.push(`${pm.codice_comune_catastale}/${pm.zona_omi}: ${upsertError.message}`);
        } else {
          rowsUpserted++;
        }
      } catch (e) {
        errors++;
        errorDetails.push(`${pm.codice_comune_catastale}/${pm.zona_omi}: ${String(e)}`);
      }
    }

    // Count total polygons in DB
    const { count } = await adminClient
      .from("omi_polygons")
      .select("*", { count: "exact", head: true });

    console.log(`[omi-kml-ingest] Done: upserted=${rowsUpserted}, errors=${errors}, totalInDb=${count}`);

    return json({
      ok: true,
      ingest: {
        placemarksParsed: parsed.length,
        rowsUpserted,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
      },
      database: {
        totalPolygons: count ?? 0,
      },
    });
  } catch (e) {
    console.error("[omi-kml-ingest] FATAL:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
