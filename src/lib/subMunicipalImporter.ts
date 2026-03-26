/**
 * Sub-Municipal Areas Importer — Abstract module
 * 
 * Ready to receive real ISTAT ASC_21 / R03_21 datasets.
 * NOT active in public report pipeline.
 * 
 * Expected ASC_21 fields (from ISTAT documentation):
 *   PRO_COM_T, COD_REG, COD_PRO, DEN_PROV, DEN_REG, DEN_COM, 
 *   COD_ASC (area code), DEN_ASC (area name), POP_RES, geometry
 * 
 * Expected R03_21 section fields:
 *   SEZ2011, PRO_COM, COD_REG, POP_RES, FAM, geometry
 */

import { supabase } from "@/integrations/supabase/client";

export interface SubMunicipalRecord {
  source_dataset: string;
  source_year: number;
  source_label: string;
  asc_level: number | null;
  area_code: string;
  area_name: string;
  area_type: string;
  comune_istat_code: string | null;
  comune_catastale_code: string | null;
  comune_name: string;
  provincia_code: string | null;
  provincia_name: string | null;
  regione_code: string | null;
  regione_name: string | null;
  popolazione: number | null;
  nuclei_familiari: number | null;
  densita: number | null;
  eta_media: number | null;
  superficie_kmq: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  bbox: number[] | null;
  polygon_coords: unknown | null;
  metadata_json: Record<string, unknown>;
  import_batch_id: string | null;
}

/** Validate a single record before import */
export function validateRecord(r: Partial<SubMunicipalRecord>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!r.source_dataset) errors.push("source_dataset mancante");
  if (!r.area_code) errors.push("area_code mancante");
  if (!r.comune_name && !r.comune_istat_code) errors.push("comune non identificabile");
  if (r.centroid_lat != null && (r.centroid_lat < 35 || r.centroid_lat > 48)) {
    errors.push(`centroid_lat fuori Italia: ${r.centroid_lat}`);
  }
  if (r.centroid_lng != null && (r.centroid_lng < 6 || r.centroid_lng > 19)) {
    errors.push(`centroid_lng fuori Italia: ${r.centroid_lng}`);
  }
  return { valid: errors.length === 0, errors };
}

/** Calculate centroid from GeoJSON polygon if not provided */
export function calculateCentroid(polygon: unknown): { lat: number; lng: number } | null {
  try {
    const geom = polygon as { type?: string; coordinates?: number[][][] };
    if (!geom?.coordinates?.[0]) return null;
    const ring = geom.coordinates[0];
    let latSum = 0, lngSum = 0;
    for (const [lng, lat] of ring) {
      latSum += lat;
      lngSum += lng;
    }
    return {
      lat: latSum / ring.length,
      lng: lngSum / ring.length,
    };
  } catch {
    return null;
  }
}

/** Calculate bounding box from GeoJSON polygon */
export function calculateBBox(polygon: unknown): [number, number, number, number] | null {
  try {
    const geom = polygon as { coordinates?: number[][][] };
    if (!geom?.coordinates?.[0]) return null;
    const ring = geom.coordinates[0];
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    return [minLng, minLat, maxLng, maxLat];
  } catch {
    return null;
  }
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { index: number; reason: string }[];
  batchId: string;
}

const CHUNK_SIZE = 500;

/**
 * Import records into sub_municipal_areas_2021.
 * Idempotent via UNIQUE(source_dataset, asc_level, area_code).
 * NOT connected to public report pipeline.
 */
export async function importSubMunicipalRecords(
  records: SubMunicipalRecord[]
): Promise<ImportResult> {
  const batchId = `sma_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let imported = 0;
  let skipped = 0;
  const errors: { index: number; reason: string }[] = [];

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const rows = chunk.map((r, j) => {
      const v = validateRecord(r);
      if (!v.valid) {
        errors.push({ index: i + j, reason: v.errors.join("; ") });
        return null;
      }

      // Auto-calculate centroid/bbox if polygon present but centroid missing
      let { centroid_lat, centroid_lng } = r;
      let bbox = r.bbox;
      if (r.polygon_coords && centroid_lat == null) {
        const c = calculateCentroid(r.polygon_coords);
        if (c) { centroid_lat = c.lat; centroid_lng = c.lng; }
      }
      if (r.polygon_coords && !bbox) {
        bbox = calculateBBox(r.polygon_coords) as number[] | null;
      }

      return {
        source_dataset: r.source_dataset,
        source_year: r.source_year,
        source_label: r.source_label,
        asc_level: r.asc_level,
        area_code: r.area_code,
        area_name: r.area_name,
        area_type: r.area_type,
        comune_istat_code: r.comune_istat_code,
        comune_catastale_code: r.comune_catastale_code,
        comune_name: r.comune_name,
        provincia_code: r.provincia_code,
        provincia_name: r.provincia_name,
        regione_code: r.regione_code,
        regione_name: r.regione_name,
        popolazione: r.popolazione,
        nuclei_familiari: r.nuclei_familiari,
        densita: r.densita,
        eta_media: r.eta_media,
        superficie_kmq: r.superficie_kmq,
        centroid_lat,
        centroid_lng,
        bbox,
        polygon_coords: r.polygon_coords,
        metadata_json: r.metadata_json ?? {},
        import_batch_id: batchId,
      };
    }).filter(Boolean);

    if (rows.length === 0) continue;

    const { error, count } = await supabase
      .from("sub_municipal_areas_2021")
      .upsert(rows as any[], { onConflict: "source_dataset,asc_level,area_code" })
      .select("id");

    if (error) {
      rows.forEach((_, j) => errors.push({ index: i + j, reason: error.message }));
    } else {
      imported += count ?? rows.length;
    }
  }

  skipped = records.length - imported - errors.length;

  return { total: records.length, imported, skipped, errors, batchId };
}

/**
 * Fetch import stats from sub_municipal_areas_2021.
 */
export async function fetchSubMunicipalStats() {
  const { data, error } = await supabase
    .from("sub_municipal_areas_2021")
    .select("source_dataset, asc_level, regione_code, regione_name, comune_catastale_code, popolazione, centroid_lat, polygon_coords");

  if (error || !data) return null;

  const byDataset: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const byRegione: Record<string, number> = {};
  let withGeometry = 0;
  let withCentroid = 0;
  let withPop = 0;
  const comuniSet = new Set<string>();

  for (const r of data) {
    byDataset[r.source_dataset] = (byDataset[r.source_dataset] || 0) + 1;
    const lvl = String(r.asc_level ?? "sezione");
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    if (r.regione_name) byRegione[r.regione_name] = (byRegione[r.regione_name] || 0) + 1;
    if (r.polygon_coords) withGeometry++;
    if (r.centroid_lat != null) withCentroid++;
    if (r.popolazione != null) withPop++;
    if (r.comune_catastale_code) comuniSet.add(r.comune_catastale_code);
  }

  return {
    totalRecords: data.length,
    byDataset,
    byLevel,
    byRegione,
    comuniDistinti: comuniSet.size,
    withGeometry,
    withCentroid,
    withPopolazione: withPop,
  };
}

/**
 * Rollback an import batch.
 */
export async function rollbackSubMunicipalBatch(batchId: string) {
  const { error, count } = await supabase
    .from("sub_municipal_areas_2021")
    .delete()
    .eq("import_batch_id", batchId);

  return { success: !error, deleted: count ?? 0, error: error?.message };
}
