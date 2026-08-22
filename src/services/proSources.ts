import { officialOmiFromCore } from "@/lib/officialOmiFromCore";
import { supabase } from "@/integrations/supabase/client";
import type { PoiEnrichmentData, OmiZoneData, IstatDemographicData, SubMunicipalMatchData } from "@/types";

interface ProSourcesResult {
  poi: PoiEnrichmentData | null;
  omi: OmiZoneData | null;
  istat: IstatDemographicData | null;
  subMunicipalMatch: SubMunicipalMatchData | null;
}

/**
 * Forward-geocode a typed Italian address via pro-sources (Nominatim).
 * Fail-closed: returns null on empty input, provider error, or invalid coords.
 * Does not invent a location.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (trimmed.length < 3) return null;

  try {
    const { data, error } = await supabase.functions.invoke("pro-sources", {
      body: { address: trimmed, modules: ["geocode"] },
    });

    if (error || !data || data.ok === false || !data.data) return null;

    const raw = (data.data as Record<string, unknown>).geocode;
    if (!raw || typeof raw !== "object") return null;
    const g = raw as Record<string, unknown>;
    if (g.sourceType === "unavailable") return null;

    const lat = typeof g.lat === "number" ? g.lat : Number(g.lat);
    const lng = typeof g.lng === "number" ? g.lng : Number(g.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch (e) {
    console.warn("[ProSources] geocode exception:", e);
    return null;
  }
}

/**
 * Fetch enrichment data from pro sources (Overpass POI, OMI, ISTAT).
 * Never throws — returns null for failed modules.
 */
export async function fetchProSources(
  lat: number,
  lng: number,
  modules: string[] = ["poi", "omi", "istat"],
  radius = 800,
): Promise<ProSourcesResult> {
  const defaults: ProSourcesResult = { poi: null, omi: null, istat: null, subMunicipalMatch: null };

  try {
    const { data, error } = await supabase.functions.invoke("pro-sources", {
      body: { lat, lng, modules, radius },
    });

    if (error) {
      console.warn("[ProSources] invoke error:", error);
      return defaults;
    }

    if (!data || !data.ok || !data.data) {
      console.warn("[ProSources] invalid response:", data);
      return defaults;
    }

    const results = data.data as Record<string, unknown>;

    return {
      poi: parsePoiResult(results.poi),
      omi: parseOmiResult(results.omi),
      istat: parseIstatResult(results.istat),
      subMunicipalMatch: parseSubMunicipalMatch(data.subMunicipalMatch),
    };
  } catch (e) {
    console.warn("[ProSources] exception:", e);
    return defaults;
  }
}

function parsePoiResult(raw: unknown): PoiEnrichmentData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.sourceType === "unavailable") return null;

  return {
    totalPois: typeof d.totalPois === "number" ? d.totalPois : 0,
    categories: Array.isArray(d.categories) ? d.categories : [],
    pois: Array.isArray(d.pois) ? d.pois : [],
    searchRadius: typeof d.searchRadius === "number" ? d.searchRadius : 800,
    sourceType: (d.sourceType as PoiEnrichmentData["sourceType"]) ?? "verified_geo",
    sourceProvider: (d.sourceProvider as PoiEnrichmentData["sourceProvider"]) ?? "overpass",
    sourceLabel: typeof d.sourceLabel === "string" ? d.sourceLabel : "OpenStreetMap",
    sourceFreshness: typeof d.sourceFreshness === "string" ? d.sourceFreshness : undefined,
    licensingNote: typeof d.licensingNote === "string" ? d.licensingNote : undefined,
    attributionNote: typeof d.attributionNote === "string" ? d.attributionNote : undefined,
  };
}

function parseOmiResult(raw: unknown): OmiZoneData | null {
  return officialOmiFromCore(raw);
}

function parseIstatResult(raw: unknown): IstatDemographicData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.sourceType === "unavailable") return null;

  return {
    popolazione: typeof d.popolazione === "number" ? d.popolazione : null,
    nucleiFamiliari: typeof d.nucleiFamiliari === "number" ? d.nucleiFamiliari : null,
    densita: typeof d.densita === "number" ? d.densita : null,
    indiceVecchiaia: typeof d.indiceVecchiaia === "number" ? d.indiceVecchiaia : null,
    percentualeStranieri: typeof d.percentualeStranieri === "number" ? d.percentualeStranieri : null,
    comuneLabel: typeof d.comuneLabel === "string" ? d.comuneLabel : null,
    annoRilevazione: typeof d.annoRilevazione === "string" ? d.annoRilevazione : null,
    geoLevel: typeof d.geoLevel === "string" ? d.geoLevel as IstatDemographicData["geoLevel"] : null,
    geoLabel: typeof d.geoLabel === "string" ? d.geoLabel : null,
    matchMethod: typeof d.matchMethod === "string" ? d.matchMethod : null,
    matchConfidence: typeof d.matchConfidence === "number" ? d.matchConfidence : null,
    selectionReason: typeof d.selectionReason === "string" ? d.selectionReason : null,
    isOfficial: typeof d.isOfficial === "boolean" ? d.isOfficial : null,
    dataQuality: typeof d.dataQuality === "string" ? d.dataQuality : null,
    sourceType: (d.sourceType as IstatDemographicData["sourceType"]) ?? "official",
    sourceProvider: "istat",
    sourceLabel: typeof d.sourceLabel === "string" ? d.sourceLabel : "ISTAT",
    sourcePeriod: typeof d.annoRilevazione === "string" ? d.annoRilevazione : undefined,
    sourceCoverageLevel: typeof d.sourceCoverageLevel === "string" ? d.sourceCoverageLevel as IstatDemographicData["sourceCoverageLevel"] : undefined,
  };
}

function parseSubMunicipalMatch(raw: unknown): SubMunicipalMatchData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  return {
    available: d.available === true,
    matched: d.matched === true,
    level: typeof d.level === "number" ? d.level : null,
    code: typeof d.code === "string" ? d.code : undefined,
    name: typeof d.name === "string" ? d.name : undefined,
    type: typeof d.type === "string" ? d.type : undefined,
    comune_code: typeof d.comune_code === "string" ? d.comune_code : null,
    comune_name: typeof d.comune_name === "string" ? d.comune_name : undefined,
    source_dataset: typeof d.source_dataset === "string" ? d.source_dataset : undefined,
    source_type: typeof d.source_type === "string" ? d.source_type : undefined,
    match_method: typeof d.match_method === "string" ? d.match_method : undefined,
    match_confidence: typeof d.match_confidence === "string" ? d.match_confidence : undefined,
    coverage_status: (d.coverage_status === "available" || d.coverage_status === "partial") ? d.coverage_status : "unavailable",
    popolazione: typeof d.popolazione === "number" ? d.popolazione : null,
    densita: typeof d.densita === "number" ? d.densita : null,
    eta_media: typeof d.eta_media === "number" ? d.eta_media : null,
    superficie_kmq: typeof d.superficie_kmq === "number" ? d.superficie_kmq : null,
    note: typeof d.note === "string" ? d.note : undefined,
    // ── Località fields — preserve when backend provides them ──
    localita_name: typeof d.localita_name === "string" ? d.localita_name : null,
    localita_type: typeof d.localita_type === "string" ? d.localita_type : null,
    localita_code: typeof d.localita_code === "string" ? d.localita_code : null,
    // ── R03 Lombardia pilot enrichment ──
    r03_enriched: d.r03_enriched === true,
    r03_coverage: typeof d.r03_coverage === "string" ? d.r03_coverage : undefined,
    r03_population: typeof d.r03_population === "number" ? d.r03_population : null,
    r03_families: typeof d.r03_families === "number" ? d.r03_families : null,
    r03_dwellings: typeof d.r03_dwellings === "number" ? d.r03_dwellings : null,
    r03_buildings: typeof d.r03_buildings === "number" ? d.r03_buildings : null,
    r03_density: typeof d.r03_density === "number" ? d.r03_density : null,
    r03_sections_count: typeof d.r03_sections_count === "number" ? d.r03_sections_count : null,
    r03_sections_with_data: typeof d.r03_sections_with_data === "number" ? d.r03_sections_with_data : null,
  };
}
