import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders as getCorsHeaders, handleCors } from "../_shared/cors.ts";

let _currentReq: Request | undefined;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(_currentReq), "Content-Type": "application/json" },
  });
}

/* ── Validation helpers ─────────────────────────────── */

interface DemographicRecord {
  codice_comune_catastale: string;
  zona_key: string;
  zona_label: string;
  zona_type: string;
  coverage_level: string;
  data_quality: string;
  is_official: boolean;
  source_label: string;
  source_type: string;
  anno_rilevazione?: string | null;
  codice_comune_istat?: string | null;
  comune_label?: string;
  zona_omi?: string | null;
  polygon_coords?: unknown | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  popolazione?: number | null;
  nuclei_familiari?: number | null;
  densita?: number | null;
  eta_media?: number | null;
  indice_vecchiaia?: number | null;
  percentuale_stranieri?: number | null;
  percentuale_giovani?: number | null;
  percentuale_famiglie?: number | null;
  flusso_residenti_12m?: number | null;
  notes?: string | null;
  source_file?: string | null;
  import_batch_id?: string | null;
}

const VALID_ZONA_TYPES = ["microzona_omi", "quartiere", "sezione_censuaria", "circoscrizione", "zona_statistica", "altro"];
const VALID_COVERAGE = ["zona", "quartiere", "comune", "microzona", "sezione_censimento", "area_subcomunale"];
const VALID_QUALITY = ["alto", "standard", "basso"];
const VALID_SOURCE_TYPES = ["official", "elaborated", "estimate", "community"];

interface ValidationError {
  index: number;
  zona_key: string;
  errors: string[];
}

/**
 * Apply field mapping: renames source keys to target keys before validation.
 */
function applyFieldMapping(record: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) return record;
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const targetKey = mapping[key] ?? key;
    mapped[targetKey] = value;
  }
  return mapped;
}

function validateRecord(r: Record<string, unknown>, idx: number): { valid: DemographicRecord | null; error: ValidationError | null } {
  const errors: string[] = [];

  const codice = typeof r.codice_comune_catastale === "string" ? r.codice_comune_catastale.trim() : "";
  if (!codice || codice.length < 3) errors.push("codice_comune_catastale mancante o invalido");

  const zonaKey = typeof r.zona_key === "string" ? r.zona_key.trim() : "";
  if (!zonaKey) errors.push("zona_key mancante");

  const zonaLabel = typeof r.zona_label === "string" ? r.zona_label.trim() : "";
  if (!zonaLabel) errors.push("zona_label mancante");

  const zonaType = typeof r.zona_type === "string" ? r.zona_type.trim() : "quartiere";
  if (!VALID_ZONA_TYPES.includes(zonaType)) errors.push(`zona_type invalido: ${zonaType}`);

  const coverage = typeof r.coverage_level === "string" ? r.coverage_level.trim() : "zona";
  if (!VALID_COVERAGE.includes(coverage)) errors.push(`coverage_level invalido: ${coverage}`);

  const quality = typeof r.data_quality === "string" ? r.data_quality.trim() : "standard";
  if (!VALID_QUALITY.includes(quality)) errors.push(`data_quality invalido: ${quality}`);

  const sourceType = typeof r.source_type === "string" ? r.source_type.trim() : "official";
  if (!VALID_SOURCE_TYPES.includes(sourceType)) errors.push(`source_type invalido: ${sourceType}`);

  const sourceLabel = typeof r.source_label === "string" ? r.source_label.trim() : "";
  if (!sourceLabel) errors.push("source_label mancante");

  const annoRilevazione = typeof r.anno_rilevazione === "string" ? r.anno_rilevazione.trim()
    : typeof r.anno_rilevazione === "number" ? String(r.anno_rilevazione)
    : "0000";

  // Validate polygon_coords if present
  let polygonCoords = r.polygon_coords ?? null;
  if (polygonCoords != null) {
    if (typeof polygonCoords === "string") {
      try { polygonCoords = JSON.parse(polygonCoords); } catch { errors.push("polygon_coords non è un JSON valido"); polygonCoords = null; }
    }
    if (polygonCoords != null && !Array.isArray(polygonCoords)) {
      const geo = polygonCoords as Record<string, unknown>;
      if (geo.type === "Polygon" && Array.isArray(geo.coordinates)) {
        polygonCoords = geo.coordinates;
      } else if (geo.type === "MultiPolygon" && Array.isArray(geo.coordinates)) {
        polygonCoords = (geo.coordinates as unknown[][][]).flat();
      } else {
        errors.push("polygon_coords deve essere un array di coordinate o un GeoJSON Polygon/MultiPolygon");
        polygonCoords = null;
      }
    }
  }

  // Auto-calculate centroid if missing
  let centroidLat = typeof r.centroid_lat === "number" ? r.centroid_lat : null;
  let centroidLng = typeof r.centroid_lng === "number" ? r.centroid_lng : null;

  if (centroidLat == null && centroidLng == null && polygonCoords != null && Array.isArray(polygonCoords)) {
    const computed = computeCentroid(polygonCoords as number[][][]);
    if (computed) {
      centroidLat = computed.lat;
      centroidLng = computed.lng;
    }
  }

  if (errors.length > 0) {
    return { valid: null, error: { index: idx, zona_key: zonaKey || `record_${idx}`, errors } };
  }

  return {
    valid: {
      codice_comune_catastale: codice,
      zona_key: zonaKey,
      zona_label: zonaLabel,
      zona_type: zonaType,
      coverage_level: coverage,
      data_quality: quality,
      is_official: r.is_official === true || r.is_official === "true",
      source_label: sourceLabel,
      source_type: sourceType,
      anno_rilevazione: annoRilevazione,
      codice_comune_istat: typeof r.codice_comune_istat === "string" ? r.codice_comune_istat : null,
      comune_label: typeof r.comune_label === "string" ? r.comune_label : "",
      zona_omi: typeof r.zona_omi === "string" ? r.zona_omi : null,
      polygon_coords: polygonCoords,
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      popolazione: typeof r.popolazione === "number" ? r.popolazione : null,
      nuclei_familiari: typeof r.nuclei_familiari === "number" ? r.nuclei_familiari : null,
      densita: typeof r.densita === "number" ? r.densita : null,
      eta_media: typeof r.eta_media === "number" ? r.eta_media : null,
      indice_vecchiaia: typeof r.indice_vecchiaia === "number" ? r.indice_vecchiaia : null,
      percentuale_stranieri: typeof r.percentuale_stranieri === "number" ? r.percentuale_stranieri : null,
      percentuale_giovani: typeof r.percentuale_giovani === "number" ? r.percentuale_giovani : null,
      percentuale_famiglie: typeof r.percentuale_famiglie === "number" ? r.percentuale_famiglie : null,
      flusso_residenti_12m: typeof r.flusso_residenti_12m === "number" ? r.flusso_residenti_12m : null,
      notes: typeof r.notes === "string" ? r.notes : null,
      source_file: typeof r.source_file === "string" ? r.source_file : null,
      import_batch_id: typeof r.import_batch_id === "string" ? r.import_batch_id : null,
    },
    error: null,
  };
}

function computeCentroid(rings: number[][][]): { lat: number; lng: number } | null {
  let totalLat = 0, totalLng = 0, count = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring)) continue;
    for (const point of ring) {
      if (Array.isArray(point) && point.length >= 2) {
        totalLng += point[0];
        totalLat += point[1];
        count++;
      }
    }
  }
  if (count === 0) return null;
  return { lat: totalLat / count, lng: totalLng / count };
}

/* ── GeoJSON parser ─────────────────────────────────── */

function parseGeoJSON(input: unknown): Record<string, unknown>[] {
  const geo = input as Record<string, unknown>;
  if (!geo || typeof geo !== "object") return [];

  let features: unknown[] = [];
  if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
    features = geo.features;
  } else if (geo.type === "Feature") {
    features = [geo];
  } else {
    return [];
  }

  return features.map((f: unknown) => {
    const feat = f as Record<string, unknown>;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const geom = feat.geometry as Record<string, unknown> | undefined;
    return {
      ...props,
      polygon_coords: geom ?? null,
    };
  });
}

/* ── Dedup key helper ───────────────────────────────── */
function dedupKey(r: DemographicRecord): string {
  return `${r.zona_key}|${r.codice_comune_catastale}|${r.anno_rilevazione ?? "0000"}|${r.source_label}`;
}

/* ── Main handler ───────────────────────────────────── */

serve(async (req) => {
  _currentReq = req;
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Verify user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Auth failed" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .limit(1);

    const { data: ownerData } = await adminClient
      .from("owner_access")
      .select("id")
      .eq("user_id", userData.user.id)
      .limit(1);

    if ((!roleData || roleData.length === 0) && (!ownerData || ownerData.length === 0)) {
      return json({ error: "Forbidden — admin or owner required" }, 403);
    }

    const body = await req.json();
    const { action, fieldMapping } = body as { action: string; fieldMapping?: Record<string, string> };

    // ── ACTION: validate ──
    if (action === "validate") {
      const { records: rawRecords, format, defaults } = body as {
        records: unknown; format?: string;
        defaults?: Record<string, unknown>;
      };
      let records: Record<string, unknown>[] = [];

      if (format === "geojson" && rawRecords && typeof rawRecords === "object") {
        records = parseGeoJSON(rawRecords);
      } else if (Array.isArray(rawRecords)) {
        records = rawRecords as Record<string, unknown>[];
      }

      // Apply field mapping + defaults
      records = records.map(r => {
        let mapped = fieldMapping ? applyFieldMapping(r, fieldMapping) : r;
        if (defaults) mapped = { ...defaults, ...mapped };
        return mapped;
      });

      const valid: DemographicRecord[] = [];
      const invalid: ValidationError[] = [];

      // Detect source columns for mapping assistance
      const sourceColumns = records.length > 0 ? Object.keys(records[0]) : [];

      for (let i = 0; i < records.length; i++) {
        const result = validateRecord(records[i], i);
        if (result.valid) valid.push(result.valid);
        if (result.error) invalid.push(result.error);
      }

      // Compute distinct comuni & coverage levels & anni
      const comuniSet = new Set<string>();
      const coverageSet = new Set<string>();
      const anniSet = new Set<string>();
      for (const r of valid) {
        comuniSet.add(r.codice_comune_catastale);
        coverageSet.add(r.coverage_level);
        if (r.anno_rilevazione) anniSet.add(r.anno_rilevazione);
      }

      // Count records with polygon/centroid
      const withPolygon = valid.filter(r => r.polygon_coords != null).length;
      const withCentroid = valid.filter(r => r.centroid_lat != null).length;
      const withZonaOmi = valid.filter(r => r.zona_omi != null && r.zona_omi !== "").length;

      return json({
        ok: true,
        action: "validate",
        totalRecords: records.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        invalidDetails: invalid.slice(0, 50),
        sourceColumns,
        distinctComuni: comuniSet.size,
        coverageLevels: Array.from(coverageSet),
        anniRilevazione: Array.from(anniSet),
        withPolygon,
        withCentroid,
        withZonaOmi,
        preview: valid.slice(0, 10).map(r => ({
          zona_key: r.zona_key,
          zona_label: r.zona_label,
          zona_type: r.zona_type,
          codice_comune_catastale: r.codice_comune_catastale,
          comune_label: r.comune_label,
          coverage_level: r.coverage_level,
          anno_rilevazione: r.anno_rilevazione,
          popolazione: r.popolazione,
          hasCentroid: r.centroid_lat != null,
          hasPolygon: r.polygon_coords != null,
          hasZonaOmi: r.zona_omi != null && r.zona_omi !== "",
        })),
      });
    }

    // ── ACTION: import ──
    if (action === "import") {
      const { records: rawRecords, format, batchId, defaults } = body as {
        records: unknown; format?: string; batchId?: string;
        defaults?: Record<string, unknown>;
      };

      const importBatchId = batchId || crypto.randomUUID();
      let records: Record<string, unknown>[] = [];

      if (format === "geojson" && rawRecords && typeof rawRecords === "object") {
        records = parseGeoJSON(rawRecords);
      } else if (Array.isArray(rawRecords)) {
        records = rawRecords as Record<string, unknown>[];
      }

      // Apply field mapping + defaults
      records = records.map(r => {
        let mapped = fieldMapping ? applyFieldMapping(r, fieldMapping) : r;
        if (defaults) mapped = { ...defaults, ...mapped };
        return mapped;
      });

      const valid: DemographicRecord[] = [];
      const invalid: ValidationError[] = [];
      const seenKeys = new Set<string>();
      let duplicatesInBatch = 0;

      for (let i = 0; i < records.length; i++) {
        const result = validateRecord(records[i], i);
        if (result.valid) {
          const dk = dedupKey(result.valid);
          if (seenKeys.has(dk)) {
            duplicatesInBatch++;
            // Keep the later record (overwrites)
          }
          seenKeys.add(dk);
          result.valid.import_batch_id = importBatchId;
          valid.push(result.valid);
        }
        if (result.error) invalid.push(result.error);
      }

      // Deduplicate: keep last occurrence per key within same batch
      const dedupMap = new Map<string, DemographicRecord>();
      for (const r of valid) {
        dedupMap.set(dedupKey(r), r);
      }
      const dedupedValid = Array.from(dedupMap.values());

      if (dedupedValid.length === 0) {
        return json({ ok: false, error: "Nessun record valido da importare", invalidCount: invalid.length, invalidDetails: invalid.slice(0, 20) });
      }

      // Upsert in chunks of 500 (idempotent via zona_key + codice_comune_catastale)
      const CHUNK_SIZE = 500;
      let inserted = 0;
      const upsertErrors: string[] = [];

      for (let i = 0; i < dedupedValid.length; i += CHUNK_SIZE) {
        const chunk = dedupedValid.slice(i, i + CHUNK_SIZE);

        const { data: upsertData, error: upsertError } = await adminClient
          .from("demographic_zones")
          .upsert(
            chunk.map(r => ({ ...r, updated_at: new Date().toISOString() })),
            { onConflict: "zona_key,codice_comune_catastale,anno_rilevazione,source_label", ignoreDuplicates: false },
          )
          .select("id");

        if (upsertError) {
          upsertErrors.push(`Chunk ${Math.floor(i / CHUNK_SIZE)}: ${upsertError.message}`);
        } else {
          const count = upsertData?.length ?? chunk.length;
          inserted += count;
        }
      }

      return json({
        ok: upsertErrors.length === 0,
        action: "import",
        batchId: importBatchId,
        totalRecords: records.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        duplicatesInBatch,
        dedupedCount: dedupedValid.length,
        insertedOrUpdated: inserted,
        errors: upsertErrors.length > 0 ? upsertErrors : undefined,
        invalidDetails: invalid.slice(0, 20),
      });
    }

    // ── ACTION: rollback ──
    if (action === "rollback") {
      const { batchId } = body as { batchId: string };
      if (!batchId) return json({ error: "batchId required" }, 400);

      const { data: deleted, error: delError } = await adminClient
        .from("demographic_zones")
        .delete()
        .eq("import_batch_id", batchId)
        .select("id");

      if (delError) {
        return json({ ok: false, error: delError.message });
      }

      return json({ ok: true, action: "rollback", batchId, deletedCount: deleted?.length ?? 0 });
    }

    // ── ACTION: list-batches ──
    if (action === "list-batches") {
      const { data, error } = await adminClient
        .from("demographic_zones")
        .select("import_batch_id, codice_comune_catastale, anno_rilevazione, source_label, is_official, coverage_level, created_at")
        .not("import_batch_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) return json({ ok: false, error: error.message });

      // Group by batch
      const batches = new Map<string, {
        count: number; comuni: Set<string>; sources: Set<string>;
        coverages: Set<string>; anni: Set<string>; firstCreated: string;
      }>();
      for (const row of data ?? []) {
        const bid = row.import_batch_id;
        if (!bid) continue;
        if (!batches.has(bid)) batches.set(bid, {
          count: 0, comuni: new Set(), sources: new Set(),
          coverages: new Set(), anni: new Set(), firstCreated: row.created_at ?? "",
        });
        const b = batches.get(bid)!;
        b.count++;
        if (row.codice_comune_catastale) b.comuni.add(row.codice_comune_catastale);
        if (row.source_label) b.sources.add(row.source_label);
        if (row.coverage_level) b.coverages.add(row.coverage_level);
        if (row.anno_rilevazione) b.anni.add(row.anno_rilevazione);
        if (!b.firstCreated && row.created_at) b.firstCreated = row.created_at;
      }

      return json({
        ok: true,
        batches: Array.from(batches.entries()).map(([id, b]) => ({
          batchId: id,
          recordCount: b.count,
          comuniCount: b.comuni.size,
          sources: Array.from(b.sources),
          coverageLevels: Array.from(b.coverages),
          anni: Array.from(b.anni),
          createdAt: b.firstCreated,
        })),
      });
    }

    // ── ACTION: stats ──
    if (action === "stats") {
      const { comune, anno, coverage, sourceLabel, isOfficial } = body as {
        comune?: string; anno?: string; coverage?: string;
        sourceLabel?: string; isOfficial?: boolean;
      };

      // Fetch all records (up to limit) for aggregation
      let query = adminClient.from("demographic_zones")
        .select("codice_comune_catastale, anno_rilevazione, coverage_level, is_official, source_label, zona_omi, polygon_coords, centroid_lat, centroid_lng", { count: "exact" });
      if (comune) query = query.eq("codice_comune_catastale", comune);
      if (anno) query = query.eq("anno_rilevazione", anno);
      if (coverage) query = query.eq("coverage_level", coverage);
      if (sourceLabel) query = query.eq("source_label", sourceLabel);
      if (isOfficial !== undefined) query = query.eq("is_official", isOfficial);

      const { data, count, error } = await query.limit(5000);
      if (error) return json({ ok: false, error: error.message });

      const rows = data ?? [];
      const comuniSet = new Set<string>();
      const coverageBreakdown: Record<string, number> = {};
      const annoBreakdown: Record<string, number> = {};
      const officialBreakdown = { official: 0, nonOfficial: 0 };
      const sourceBreakdown: Record<string, number> = {};
      let withPolygon = 0, withCentroid = 0, withZonaOmi = 0;

      for (const r of rows) {
        comuniSet.add(r.codice_comune_catastale);
        coverageBreakdown[r.coverage_level] = (coverageBreakdown[r.coverage_level] ?? 0) + 1;
        if (r.anno_rilevazione) annoBreakdown[r.anno_rilevazione] = (annoBreakdown[r.anno_rilevazione] ?? 0) + 1;
        if (r.is_official) officialBreakdown.official++; else officialBreakdown.nonOfficial++;
        sourceBreakdown[r.source_label] = (sourceBreakdown[r.source_label] ?? 0) + 1;
        if (r.polygon_coords != null) withPolygon++;
        if (r.centroid_lat != null) withCentroid++;
        if (r.zona_omi != null && r.zona_omi !== "") withZonaOmi++;
      }

      return json({
        ok: true,
        action: "stats",
        totalRecords: count ?? rows.length,
        distinctComuni: comuniSet.size,
        coverageBreakdown,
        annoBreakdown,
        officialBreakdown,
        sourceBreakdown,
        withPolygon,
        withPolygonPct: rows.length > 0 ? Math.round((withPolygon / rows.length) * 100) : 0,
        withCentroid,
        withCentroidPct: rows.length > 0 ? Math.round((withCentroid / rows.length) * 100) : 0,
        matchableViaZonaOmi: withZonaOmi,
        matchableViaPolygon: withPolygon,
        comuniWithoutSubMunicipal: 0, // Would need cross-reference with all managed comuni
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[demographic-import] FATAL:", e);
    return json({ ok: false, error: "Internal error" }, 500);
  }
});
