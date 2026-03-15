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

/* ──────────────────────────────────────────────
   SHA-256 hash for idempotency
   ────────────────────────────────────────────── */
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ──────────────────────────────────────────────
   Robust KML Parser — Polygon + MultiPolygon
   ────────────────────────────────────────────── */
interface ParsedPlacemark {
  codice_comune_catastale: string;
  zona_omi: string;
  comune_label: string;
  polygons: number[][][]; // array of rings, each ring = [lng, lat][]
}

function parseCoordinateBlock(coordText: string): number[][] {
  const ring: number[][] = [];
  const points = coordText.trim().split(/\s+/).filter((s) => s.includes(","));
  for (const point of points) {
    const parts = point.split(",");
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lng) && !isNaN(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        ring.push([lng, lat]);
      }
    }
  }
  return ring;
}

function extractPolygons(content: string): number[][][] {
  const polygons: number[][][] = [];

  // Handle both <Polygon> and <MultiGeometry> containing multiple <Polygon>
  const polygonRegex = /<Polygon>([\s\S]*?)<\/Polygon>/gi;
  let polyMatch;

  while ((polyMatch = polygonRegex.exec(content)) !== null) {
    const polyContent = polyMatch[1];

    // Extract outer boundary
    const outerMatch = polyContent.match(
      /<outerBoundaryIs>\s*<LinearRing>\s*<coordinates>\s*([\s\S]*?)\s*<\/coordinates>\s*<\/LinearRing>\s*<\/outerBoundaryIs>/i
    );
    if (outerMatch) {
      const ring = parseCoordinateBlock(outerMatch[1]);
      if (ring.length >= 3) {
        polygons.push(ring);
      }
    }
  }

  // Fallback: if no <Polygon> tags found, try raw <coordinates> blocks (simple KML)
  if (polygons.length === 0) {
    const coordsRegex = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/gi;
    let coordMatch;
    while ((coordMatch = coordsRegex.exec(content)) !== null) {
      const ring = parseCoordinateBlock(coordMatch[1]);
      if (ring.length >= 3) {
        polygons.push(ring);
      }
    }
  }

  return polygons;
}

function parseKml(kmlText: string): ParsedPlacemark[] {
  const results: ParsedPlacemark[] = [];
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/gi;
  let pmMatch;

  while ((pmMatch = placemarkRegex.exec(kmlText)) !== null) {
    const pmContent = pmMatch[1];

    // Extract CODCOM/CODZONA from ExtendedData or SimpleData
    let codcom: string | null = null;
    let codzona: string | null = null;

    // Try <Data name="CODCOM"><value>...</value>
    const codcomData = pmContent.match(/<Data\s+name="CODCOM"[\s\S]*?<value>(.*?)<\/value>/i);
    const codzonaData = pmContent.match(/<Data\s+name="CODZONA"[\s\S]*?<value>(.*?)<\/value>/i);

    if (codcomData) codcom = codcomData[1].trim();
    if (codzonaData) codzona = codzonaData[1].trim();

    // Try <SimpleData name="CODCOM">...</SimpleData>
    if (!codcom) {
      const codcomSimple = pmContent.match(/<SimpleData\s+name="CODCOM">(.*?)<\/SimpleData>/i);
      if (codcomSimple) codcom = codcomSimple[1].trim();
    }
    if (!codzona) {
      const codzonaSimple = pmContent.match(/<SimpleData\s+name="CODZONA">(.*?)<\/SimpleData>/i);
      if (codzonaSimple) codzona = codzonaSimple[1].trim();
    }

    if (!codcom || !codzona) continue;

    // Extract comune label from <name>
    const nameMatch = pmContent.match(/<name>(.*?)<\/name>/i);
    const comuneLabel = nameMatch
      ? nameMatch[1].replace(/\s*-\s*Zona OMI.*$/i, "").trim()
      : "";

    // Extract polygons (Polygon, MultiPolygon, raw coordinates)
    const polygons = extractPolygons(pmContent);

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

/* ──────────────────────────────────────────────
   Serve
   ────────────────────────────────────────────── */
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
    const {
      kmlData,
      fileName = "unknown.kml",
      anno = 2025,
      semestre = 1,
      batchId = "",
    } = body as {
      kmlData: string;
      fileName?: string;
      anno?: number;
      semestre?: number;
      batchId?: string;
    };

    if (!kmlData || typeof kmlData !== "string") {
      return json({ ok: false, error: "kmlData string required" }, 400);
    }

    // Compute content hash for idempotency
    const contentHash = await sha256(kmlData);

    console.log(
      `[omi-kml-ingest] file=${fileName}, hash=${contentHash.slice(0, 12)}, size=${kmlData.length}, anno=${anno}, sem=${semestre}`
    );

    // Use service role for upserts
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Check if this exact file was already imported (hash-based idempotency)
    const { data: existingRows } = await adminClient
      .from("omi_polygons")
      .select("id", { count: "exact", head: false })
      .eq("source_hash", contentHash)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      console.log(`[omi-kml-ingest] SKIP — file already imported (hash=${contentHash.slice(0, 12)})`);
      return json({
        ok: true,
        skipped: true,
        reason: "already_imported",
        fileName,
        contentHash: contentHash.slice(0, 12),
        ingest: { placemarksParsed: 0, rowsUpserted: 0, errors: 0 },
      });
    }

    // Parse KML
    const parsed = parseKml(kmlData);
    console.log(`[omi-kml-ingest] Parsed ${parsed.length} placemarks from ${fileName}`);

    if (parsed.length === 0) {
      return json({
        ok: true,
        fileName,
        ingest: { placemarksParsed: 0, rowsUpserted: 0, errors: 0, warnings: ["No valid placemarks found in file"] },
      });
    }

    let rowsUpserted = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Batch upsert in groups of 50 for efficiency
    const BATCH_SIZE = 50;
    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const batch = parsed.slice(i, i + BATCH_SIZE).map((pm) => ({
        codice_comune_catastale: pm.codice_comune_catastale,
        zona_omi: pm.zona_omi,
        comune_label: pm.comune_label,
        polygon_coords: pm.polygons,
        anno,
        semestre,
        source_file: fileName,
        source_hash: contentHash,
        imported_at: new Date().toISOString(),
        import_batch_id: batchId,
      }));

      const { error: upsertError } = await adminClient
        .from("omi_polygons")
        .upsert(batch, { onConflict: "codice_comune_catastale,zona_omi,anno,semestre" });

      if (upsertError) {
        errors += batch.length;
        errorDetails.push(`batch ${i}-${i + batch.length}: ${upsertError.message}`);
      } else {
        rowsUpserted += batch.length;
      }
    }

    // Count total polygons in DB
    const { count } = await adminClient
      .from("omi_polygons")
      .select("*", { count: "exact", head: true });

    console.log(
      `[omi-kml-ingest] Done: file=${fileName}, upserted=${rowsUpserted}, errors=${errors}, totalInDb=${count}`
    );

    return json({
      ok: true,
      fileName,
      contentHash: contentHash.slice(0, 12),
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
