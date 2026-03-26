/**
 * Point-in-polygon utility for sub-municipal area matching.
 * 
 * NOT active in public Sottra report pipeline.
 * Ready for internal/admin use when real ASC datasets are loaded.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Ray-casting algorithm for point-in-polygon test.
 * Works with GeoJSON-style coordinates [lng, lat].
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; // [lng, lat]
    const [xj, yj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Test point against a GeoJSON geometry (Polygon or MultiPolygon).
 */
export function isPointInGeoJSON(
  lat: number,
  lng: number,
  geometry: { type?: string; coordinates?: unknown }
): boolean {
  if (!geometry?.type || !geometry?.coordinates) return false;

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as number[][][];
    if (!rings[0]) return false;
    return isPointInPolygon(lat, lng, rings[0]);
  }

  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates as number[][][][];
    return polys.some((rings) => rings[0] && isPointInPolygon(lat, lng, rings[0]));
  }

  return false;
}

export interface SubMunicipalMatch {
  asc_level: number | null;
  area_code: string;
  area_name: string;
  area_type: string;
  comune_catastale_code: string | null;
  comune_name: string;
  source_dataset: string;
  match_method: "polygon";
  match_confidence: "polygon";
  source_type: "official_data";
  popolazione: number | null;
  densita: number | null;
  eta_media: number | null;
  superficie_kmq: number | null;
}

/**
 * Find the sub-municipal area containing a given point.
 * Queries sub_municipal_areas_2021 with centroid pre-filter then polygon test.
 * 
 * NOT used in public report pipeline — internal/admin only.
 */
export async function findSubMunicipalArea(
  lat: number,
  lng: number,
  options?: { ascLevel?: number; comuneCatastale?: string }
): Promise<SubMunicipalMatch | null> {
  // Pre-filter by bounding box (rough ~0.5° radius)
  let query = supabase
    .from("sub_municipal_areas_2021")
    .select("asc_level, area_code, area_name, area_type, comune_catastale_code, comune_name, source_dataset, polygon_coords, popolazione, densita, eta_media, superficie_kmq")
    .not("polygon_coords", "is", null)
    .gte("centroid_lat", lat - 0.5)
    .lte("centroid_lat", lat + 0.5)
    .gte("centroid_lng", lng - 0.5)
    .lte("centroid_lng", lng + 0.5);

  if (options?.ascLevel != null) {
    query = query.eq("asc_level", options.ascLevel);
  }
  if (options?.comuneCatastale) {
    query = query.eq("comune_catastale_code", options.comuneCatastale);
  }

  const { data, error } = await query.limit(200);
  if (error || !data?.length) return null;

  for (const row of data) {
    const geom = row.polygon_coords as { type?: string; coordinates?: unknown } | null;
    if (!geom) continue;
    if (isPointInGeoJSON(lat, lng, geom)) {
      return {
        asc_level: row.asc_level,
        area_code: row.area_code,
        area_name: row.area_name,
        area_type: row.area_type,
        comune_catastale_code: row.comune_catastale_code,
        comune_name: row.comune_name,
        source_dataset: row.source_dataset,
        match_method: "polygon",
        match_confidence: "polygon",
        source_type: "official_data",
        popolazione: row.popolazione,
        densita: row.densita,
        eta_media: row.eta_media,
        superficie_kmq: row.superficie_kmq,
      };
    }
  }

  return null;
}
