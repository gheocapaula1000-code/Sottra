import type { IstatDemographicData, IstatSubMunicipalArea } from "@/types";

export const PADOVA_ISTAT_CODE = "028060";
/** Broken `istat_comuni.popolazione` for Padova — never display this as the comune total. */
export const PADOVA_BROKEN_COMUNI_POP = 11185;
export const ISTAT_SUB_MUNICIPAL_SOURCE_LABEL = "ISTAT 2021 / area sub-comunale";

const EST_PLACE_HINTS = ["forcellini", "terranegra", "gregorio"];

export function normalizeIstatComuneCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  const digits = String(code).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(6, "0");
}

export function isPadovaComune(
  code?: string | null,
  name?: string | null,
): boolean {
  if (normalizeIstatComuneCode(code) === PADOVA_ISTAT_CODE) return true;
  const label = (name ?? "").trim().toLowerCase();
  return label === "padova" || label === "comune di padova";
}

/**
 * Keep the live comunale figure (e.g. Padova 208.202 from SDMX).
 * Drop the known-wrong istat_comuni 11.185 for Padova.
 */
export function sanitizeComunalePopolazione(
  popolazione: number | null | undefined,
  comuneCode?: string | null,
  comuneLabel?: string | null,
): number | null {
  if (typeof popolazione !== "number" || !Number.isFinite(popolazione) || popolazione <= 0) {
    return null;
  }
  if (isPadovaComune(comuneCode, comuneLabel) && popolazione === PADOVA_BROKEN_COMUNI_POP) {
    return null;
  }
  return Math.round(popolazione);
}

function readAreaName(row: Record<string, unknown>): string {
  if (typeof row.name === "string") return row.name.trim();
  if (typeof row.area_name === "string") return row.area_name.trim();
  return "";
}

function readAreaPop(row: Record<string, unknown>): number | null {
  if (typeof row.popolazione === "number" && Number.isFinite(row.popolazione)) return row.popolazione;
  if (typeof row.population === "number" && Number.isFinite(row.population)) return row.population;
  return null;
}

function readAreaFamilies(row: Record<string, unknown>): number | null {
  if (typeof row.nucleiFamiliari === "number" && Number.isFinite(row.nucleiFamiliari)) return row.nucleiFamiliari;
  if (typeof row.nuclei_familiari === "number" && Number.isFinite(row.nuclei_familiari)) return row.nuclei_familiari;
  if (typeof row.famiglie === "number" && Number.isFinite(row.famiglie)) return row.famiglie;
  return null;
}

function readAreaComuneCode(row: Record<string, unknown>): string | null {
  if (typeof row.comuneIstatCode === "string") return normalizeIstatComuneCode(row.comuneIstatCode);
  if (typeof row.comune_istat_code === "string") return normalizeIstatComuneCode(row.comune_istat_code);
  return null;
}

/**
 * Map official ISTAT 2021 sub-municipal rows. Never invents Padova areas
 * for another comune: rows tagged with a different `comune_istat_code` are dropped.
 */
export function mapOfficialSubMunicipalAreas(
  rows: unknown,
  comuneIstatCode?: string | null,
): IstatSubMunicipalArea[] {
  if (!Array.isArray(rows)) return [];
  const want = normalizeIstatComuneCode(comuneIstatCode);
  const areas: IstatSubMunicipalArea[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const rowCode = readAreaComuneCode(row);
    if (want && rowCode && rowCode !== want) continue;

    const name = readAreaName(row);
    if (!name) continue;
    const popolazione = readAreaPop(row);
    const nucleiFamiliari = readAreaFamilies(row);
    if (popolazione == null && nucleiFamiliari == null) continue;

    const densita = typeof row.densita === "number" && Number.isFinite(row.densita) ? row.densita : null;
    const etaMedia = typeof row.etaMedia === "number" && Number.isFinite(row.etaMedia)
      ? row.etaMedia
      : typeof row.eta_media === "number" && Number.isFinite(row.eta_media)
        ? row.eta_media
        : null;

    areas.push({
      name,
      code: typeof row.code === "string" ? row.code : typeof row.area_code === "string" ? row.area_code : null,
      popolazione,
      nucleiFamiliari,
      densita,
      etaMedia,
      sourceLabel: typeof row.sourceLabel === "string"
        ? row.sourceLabel
        : typeof row.source_label === "string"
          ? row.source_label
          : ISTAT_SUB_MUNICIPAL_SOURCE_LABEL,
      sourceYear: typeof row.sourceYear === "number"
        ? row.sourceYear
        : typeof row.source_year === "number"
          ? row.source_year
          : 2021,
      comuneIstatCode: rowCode,
    });
  }

  return sortOfficialAreas(areas);
}

const PADOVA_AREA_ORDER = ["Centro", "Est", "Nord", "Ovest", "Sud-Est", "Sud-Ovest"];

function sortOfficialAreas(areas: IstatSubMunicipalArea[]): IstatSubMunicipalArea[] {
  return [...areas].sort((a, b) => {
    const ia = PADOVA_AREA_ORDER.findIndex((n) => n.toLowerCase() === a.name.toLowerCase());
    const ib = PADOVA_AREA_ORDER.findIndex((n) => n.toLowerCase() === b.name.toLowerCase());
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.name.localeCompare(b.name, "it");
  });
}

/** Token "Est", not the suffix inside "Ovest". */
export function omiLabelSuggestsEstArea(omiZoneLabel: string | null | undefined): boolean {
  if (!omiZoneLabel || typeof omiZoneLabel !== "string") return false;
  const n = omiZoneLabel.toLowerCase();
  if (EST_PLACE_HINTS.some((hint) => n.includes(hint))) return true;
  return /(?:^|[^a-zàèéìòù])est(?:[^a-zàèéìòù]|$)/i.test(omiZoneLabel);
}

export const OMI_NAME_ONLY_SUGGESTION_NOTE =
  "Suggerimento nominale dalla zona OMI — non è un match poligonale. Le aree ISTAT 2021 non hanno geometria in anagrafe.";

export function applyOmiNameOnlySuggestion(
  areas: IstatSubMunicipalArea[],
  omiZoneLabel: string | null | undefined,
): IstatSubMunicipalArea[] {
  const suggestEst = omiLabelSuggestsEstArea(omiZoneLabel);
  return areas.map((area) => ({
    ...area,
    suggestedNameOnly: suggestEst && /^est$/i.test(area.name.trim()),
  }));
}

export function hasRenderableIstatAreas(
  areas: IstatSubMunicipalArea[] | null | undefined,
): boolean {
  return Array.isArray(areas) && areas.length > 0;
}

export function isIstatDemographicsRenderable(
  data: IstatDemographicData | null | undefined,
): boolean {
  if (!data || data.sourceType === "unavailable") return false;
  const pop = sanitizeComunalePopolazione(data.popolazione, data.comuneIstatCode, data.comuneLabel);
  return pop != null || hasRenderableIstatAreas(data.areas);
}
