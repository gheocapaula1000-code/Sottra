import { supabase } from "@/integrations/supabase/client";
import type { PoiEnrichmentData, OmiZoneData, IstatDemographicData, SubMunicipalMatchData } from "@/types";

interface ProSourcesResult {
  poi: PoiEnrichmentData | null;
  omi: OmiZoneData | null;
  istat: IstatDemographicData | null;
  subMunicipalMatch: SubMunicipalMatchData | null;
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
  const defaults: ProSourcesResult = { poi: null, omi: null, istat: null };

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
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.sourceType === "unavailable") return null;

  return {
    zonaOmi: typeof d.zonaOmi === "string" ? d.zonaOmi : null,
    zonaOmiLabel: typeof d.zonaOmiLabel === "string" ? d.zonaOmiLabel : null,
    comuneLabel: typeof d.comuneLabel === "string" ? d.comuneLabel : null,
    quotazioneMinResidenziale: typeof d.quotazioneMinResidenziale === "number" ? d.quotazioneMinResidenziale : null,
    quotazioneMaxResidenziale: typeof d.quotazioneMaxResidenziale === "number" ? d.quotazioneMaxResidenziale : null,
    semestre: typeof d.semestre === "string" ? d.semestre : null,
    tipologia: typeof d.tipologia === "string" ? d.tipologia : null,
    statoConservazione: typeof d.statoConservazione === "string" ? d.statoConservazione : null,
    sourceType: (d.sourceType as OmiZoneData["sourceType"]) ?? "official",
    sourceProvider: "omi",
    sourceLabel: typeof d.sourceLabel === "string" ? d.sourceLabel : "OMI / Agenzia delle Entrate",
    sourcePeriod: typeof d.semestre === "string" ? d.semestre : undefined,
  };
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
