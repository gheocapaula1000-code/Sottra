/**
 * Map Central Core photoWow / scan/pricing payloads into WowPanel's officialOmi
 * overlay (OmiZoneData). Core 3.4.4 is dual-readable: `{ ok, data }` plus
 * top-level `zona` / `pricing` / official microzona fields.
 *
 * Does not invent scores, catasto, or APE. Missing numbers stay null.
 */

import {
  collectOmiQuotes,
  mergeOmiQuotes,
  pickCivileHeadline,
} from "@/lib/omiQuotes";
import type { OmiZoneData, SectionStatus, SourceType } from "@/types";
import type { PhotoWowImmobile, PhotoWowResponse, PhotoWowScores, PhotoWowZona } from "@/types/photoWow";

const ENVELOPE_KEYS = new Set([
  "ok", "data", "error", "warnings", "debug_id", "status", "message",
]);

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = asFiniteNumber(v);
    if (n != null) return n;
  }
  return null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = asTrimmedString(v);
    if (s) return s;
  }
  return null;
}

/** Merge nested `data` with sibling official fields (zona, pricing, microzona). Nested wins on conflict. */
export function mergeDualReadable(
  nested: Record<string, unknown>,
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...nested };
  for (const [k, v] of Object.entries(envelope)) {
    if (ENVELOPE_KEYS.has(k) || v == null) continue;
    if (merged[k] == null) {
      merged[k] = v;
      continue;
    }
    if (isPlainObject(merged[k]) && isPlainObject(v)) {
      merged[k] = { ...v, ...(merged[k] as Record<string, unknown>) };
    }
  }
  return merged;
}

/** Unwrap `{ ok, data }` while keeping top-level zona/pricing. Returns null if `ok === false`. */
export function unwrapCoreEnvelope(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null;
  if (raw.ok === false) return null;
  const nested = isPlainObject(raw.data) ? raw.data : null;
  if (nested) return mergeDualReadable(nested, raw);
  return raw;
}

function parseOmiCode(label: string | null): string | null {
  if (!label) return null;
  const omi = label.match(/\bOMI\s*[:-]?\s*([A-Z]\d{1,2})\b/i);
  if (omi) return omi[1].toUpperCase();
  const gold = label.match(/^[A-Z]\d{3}-([A-E]\d{1,2})$/i);
  if (gold) return gold[1].toUpperCase();
  const bare = label.match(/\b([A-E]\d{1,2})\b/i);
  return bare ? bare[1].toUpperCase() : null;
}

const HIT_ARRAY_KEYS = [
  "hits", "zones", "omiZones", "omi_zones", "omi_zone_by_point",
  "results", "rows", "matches", "items",
];

/** One official / gold / overlapping zone row from Core omi_zone_by_point. */
export interface OmiZoneHit {
  raw: Record<string, unknown>;
  linkZona: string | null;
  fascia: string | null;
  label: string | null;
  comune: string | null;
  min: number | null;
  max: number | null;
  stato: string | null;
  tipologia: string | null;
  polygonMatch?: boolean;
}

/** Official Agenzia microzona id (PD00000015), not a gold G224-* layer. */
export function isOfficialPdLink(id: string | null | undefined): boolean {
  return !!id && /^PD\d+$/i.test(id.trim());
}

/** Padova gold layer — same B1 as PD00000015, acceptable if quotes are official. */
export function isGoldG224Link(id: string | null | undefined): boolean {
  return !!id && /^G224(?:[-_]?[A-E]\d{1,2})?$/i.test(id.trim());
}

/** Fascia OMI (B1) from zona_omi, G224-B1, or a label. Does not invent. */
export function extractOmiFascia(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = asTrimmedString(v);
    if (!s) continue;
    const parsed = parseOmiCode(s);
    if (parsed) return parsed;
  }
  return null;
}

/** True only for the Padova centro B1 ∩ B2 overlap — never a global B1 bonus. */
export function isB1B2OverlapOnly(fasce: Iterable<string | null | undefined>): boolean {
  const set = new Set<string>();
  for (const f of fasce) {
    if (f) set.add(f);
  }
  if (!set.has("B1") || !set.has("B2")) return false;
  for (const f of set) {
    if (f !== "B1" && f !== "B2") return false;
  }
  return true;
}

export function competingFasceFromHits(hits: OmiZoneHit[]): Set<string> {
  const set = new Set<string>();
  for (const h of hits) {
    if (h.fascia) set.add(h.fascia);
  }
  return set;
}

/**
 * Rank official polygon hits. Official PD* + quotes win.
 * B1 beats B2 only when those two fasce overlap at the same point
 * (San Francesco). Never force B1 over D7 / C3 / other zones.
 */
export function scoreOmiHit(hit: OmiZoneHit, competingFasce?: Iterable<string | null | undefined>): number {
  const fascia = hit.fascia;
  const link = hit.linkZona;
  const hasQuotes = hit.min != null || hit.max != null;
  let score = 0;
  if (hasQuotes) score += 40;
  if (isOfficialPdLink(link)) score += 50;
  if (isGoldG224Link(link) && hasQuotes) score += 20;
  if (hit.polygonMatch) score += 25;
  const overlap = competingFasce ? isB1B2OverlapOnly(competingFasce) : false;
  if (overlap && fascia === "B1") score += 15;
  if (overlap && fascia === "B2") score -= 15;
  if (hit.stato && /normale/i.test(hit.stato)) score += 5;
  return score;
}

export function pickPreferredOmiHit(hits: OmiZoneHit[]): OmiZoneHit | null {
  if (hits.length === 0) return null;
  const fasce = competingFasceFromHits(hits);
  let best = hits[0];
  let bestScore = scoreOmiHit(best, fasce);
  for (let i = 1; i < hits.length; i++) {
    const s = scoreOmiHit(hits[i], fasce);
    if (s > bestScore) {
      best = hits[i];
      bestScore = s;
    }
  }
  return best;
}

function readOmiHit(raw: unknown): OmiZoneHit | null {
  if (!isPlainObject(raw)) return null;
  const explicitLink = firstString(raw.link_zona, raw.linkZona, raw.LinkZona, raw.zone_id, raw.zoneId);
  const idCandidate = firstString(explicitLink, raw.officialMicrozona, raw.id);
  const linkZona = idCandidate && (
    isOfficialPdLink(idCandidate)
    || isGoldG224Link(idCandidate)
    || /^[A-E]\d{1,2}$/i.test(idCandidate)
    || /^[A-Z]\d{3}-[A-E]\d{1,2}$/i.test(idCandidate)
    || /OMI/i.test(idCandidate)
  ) ? idCandidate : explicitLink;

  const fascia = extractOmiFascia(
    raw.zona_omi, raw.zonaOmi, raw.fascia, raw.officialMicrozona, linkZona,
  );
  const label = firstString(
    raw.nomeZonaOmi, raw.zonaOmiLabel, raw.zona_descr, raw.zonaDescr,
    raw.descrizione, raw.label, typeof raw.zona === "string" ? raw.zona : null,
  );
  const comune = firstString(raw.comune_label, raw.comuneLabel, raw.nomeComune, raw.comune);
  const min = firstNumber(
    raw.quotazioneMinResidenziale, raw.quotazione_min, raw.valoreMinOmi,
    raw.prezzoMqMin, raw.compr_min, raw.valore_min,
  );
  const max = firstNumber(
    raw.quotazioneMaxResidenziale, raw.quotazione_max, raw.valoreMaxOmi,
    raw.prezzoMqMax, raw.compr_max, raw.valore_max,
  );
  const stato = firstString(raw.stato_conservazione, raw.statoConservazione, raw.stato);
  const tipologia = firstString(raw.tipologia, raw.descr_tipologia, raw.Descr_Tipologia);
  const polygonMatch = raw.polygonMatch === true || raw.polygon_match === true;
  if (!linkZona && !fascia && !label && min == null && max == null) return null;
  return { raw, linkZona, fascia, label, comune, min, max, stato, tipologia, polygonMatch };
}

function collectFromArray(arr: unknown): OmiZoneHit[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(readOmiHit).filter((h): h is OmiZoneHit => h != null);
}

export function collectOmiHits(root: Record<string, unknown>): OmiZoneHit[] {
  const out: OmiZoneHit[] = [];
  if (Array.isArray(root.data)) out.push(...collectFromArray(root.data));
  for (const key of HIT_ARRAY_KEYS) out.push(...collectFromArray(root[key]));
  if (isPlainObject(root.omi)) {
    const omi = root.omi;
    for (const key of HIT_ARRAY_KEYS) out.push(...collectFromArray(omi[key]));
    if (Array.isArray(omi.data)) out.push(...collectFromArray(omi.data));
  }
  if (Array.isArray(root.zona)) out.push(...collectFromArray(root.zona));
  if (isPlainObject(root.pricing)) {
    for (const key of HIT_ARRAY_KEYS) out.push(...collectFromArray(root.pricing[key]));
  }
  if (isPlainObject(root.data)) {
    const nested = root.data;
    for (const key of HIT_ARRAY_KEYS) out.push(...collectFromArray(nested[key]));
    if (Array.isArray(nested.zona)) out.push(...collectFromArray(nested.zona));
  }
  return out;
}

/** Overlay a preferred omi_zone_by_point hit onto the Core envelope. Does not invent values. */
function applyPreferredHit(
  root: Record<string, unknown>,
  hit: OmiZoneHit,
): Record<string, unknown> {
  const fascia = hit.fascia;
  const existingZonaLabel = typeof root.zona === "string" ? asTrimmedString(root.zona) : null;
  const zonaBag = isPlainObject(root.zona) ? { ...root.zona } : {};
  if (hit.label && zonaBag.nomeZonaOmi == null) zonaBag.nomeZonaOmi = hit.label;
  if (hit.comune && zonaBag.nomeComune == null) zonaBag.nomeComune = hit.comune;
  if (fascia && zonaBag.officialMicrozona == null) zonaBag.officialMicrozona = fascia;
  if (fascia && zonaBag.zonaOmi == null) zonaBag.zonaOmi = fascia;
  if (hit.min != null && zonaBag.valoreMinOmi == null) zonaBag.valoreMinOmi = hit.min;
  if (hit.max != null && zonaBag.valoreMaxOmi == null) zonaBag.valoreMaxOmi = hit.max;

  const preferredLabel = firstString(
    existingZonaLabel,
    root.nomeZonaOmi,
    root.zonaOmiLabel,
    isPlainObject(root.zona) ? (root.zona as Record<string, unknown>).nomeZonaOmi : null,
    hit.label,
  );

  return {
    ...root,
    officialMicrozona: fascia ?? root.officialMicrozona,
    zonaOmi: fascia ?? hit.linkZona ?? root.zonaOmi,
    zonaOmiLabel: preferredLabel,
    nomeZonaOmi: preferredLabel,
    comuneLabel: firstString(root.comuneLabel, root.nomeComune, hit.comune),
    quotazioneMinResidenziale: firstNumber(hit.min, root.quotazioneMinResidenziale, root.prezzoMqMin, root.valoreMinOmi),
    quotazioneMaxResidenziale: firstNumber(hit.max, root.quotazioneMaxResidenziale, root.prezzoMqMax, root.valoreMaxOmi),
    prezzoMqMin: firstNumber(hit.min, root.prezzoMqMin, root.valoreMinOmi),
    prezzoMqMax: firstNumber(hit.max, root.prezzoMqMax, root.valoreMaxOmi),
    valoreMinOmi: firstNumber(hit.min, root.valoreMinOmi),
    valoreMaxOmi: firstNumber(hit.max, root.valoreMaxOmi),
    statoConservazione: firstString(hit.stato, root.statoConservazione),
    tipologia: firstString(hit.tipologia, root.tipologia),
    polygonMatch: true,
    zona: existingZonaLabel
      ? existingZonaLabel
      : (Object.keys(zonaBag).length > 0 ? zonaBag : root.zona),
  };
}

/** Prefer an existing "Centro (OMI B1)" label; otherwise compose from name + code. */
export function formatZonaOmiLabel(nameOrLabel: string | null, code: string | null): string | null {
  if (nameOrLabel && /OMI\s*[A-Z]\d/i.test(nameOrLabel)) return nameOrLabel;
  if (nameOrLabel && code && nameOrLabel.toUpperCase().includes(code.toUpperCase())) return nameOrLabel;
  if (nameOrLabel && code) {
    if (nameOrLabel.toUpperCase() === code.toUpperCase()) return `OMI ${code}`;
    return `${nameOrLabel} (OMI ${code})`;
  }
  if (nameOrLabel) return nameOrLabel;
  if (code) return `OMI ${code}`;
  return null;
}

function asSourceType(v: unknown): SourceType | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim() as SourceType;
}

function readPricingBag(root: Record<string, unknown>): Record<string, unknown> {
  return isPlainObject(root.pricing) ? root.pricing : {};
}

function readZonaBag(zona: unknown): { obj: Record<string, unknown>; asString: string | null } {
  if (typeof zona === "string") return { obj: {}, asString: asTrimmedString(zona) };
  if (isPlainObject(zona)) return { obj: zona, asString: firstString(zona.nomeZonaOmi, zona.zonaOmiLabel, zona.zona, zona.label) };
  return { obj: {}, asString: null };
}

/**
 * Extract official OMI overlay fields from any Core / pro-sources / pricing payload.
 * Returns null when there is nothing official to show (or sourceType is unavailable).
 * When omi_zone_by_point returns overlapping Padova hits, prefers official PD* B1
 * (PD00000015) over a conflicting B2; gold G224-B1 is the same B1.
 */
export function officialOmiFromCore(raw: unknown): OmiZoneData | null {
  if (Array.isArray(raw)) return officialOmiFromCore({ hits: raw });
  const unwrapped = unwrapCoreEnvelope(raw);
  if (!unwrapped) return null;

  const hits = collectOmiHits(unwrapped);
  const preferred = pickPreferredOmiHit(hits);
  const root = preferred ? applyPreferredHit(unwrapped, preferred) : unwrapped;

  const pricing = readPricingBag(root);
  const zona = readZonaBag(root.zona);
  const zonaNested = isPlainObject(root.data) ? readZonaBag((root.data as Record<string, unknown>).zona) : { obj: {}, asString: null };

  const sourceType = asSourceType(
    firstString(root.sourceType, pricing.sourceType, zona.obj.sourceType),
  );
  if (sourceType === "unavailable") return null;

  const officialMicrozona = firstString(
    root.officialMicrozona,
    pricing.officialMicrozona,
    zona.obj.officialMicrozona,
    zona.obj.zonaOmi,
    root.zonaOmi,
    pricing.zonaOmi,
  );

  const rawLabel = firstString(
    zona.asString,
    zona.obj.nomeZonaOmi,
    zona.obj.zonaOmiLabel,
    zonaNested.asString,
    root.nomeZonaOmi,
    root.zonaOmiLabel,
    pricing.zonaOmiLabel,
    pricing.zona,
  );

  const zonaOmi = officialMicrozona ?? parseOmiCode(rawLabel);
  const zonaOmiLabel = formatZonaOmiLabel(rawLabel, zonaOmi);

  const comuneLabel = firstString(
    zona.obj.nomeComune,
    zona.obj.comuneLabel,
    root.nomeComune,
    root.comuneLabel,
    root.comune,
    pricing.comuneLabel,
    pricing.comune,
  );

  const quotazioneMinResidenziale = firstNumber(
    root.quotazioneMinResidenziale,
    root.valoreMinOmi,
    root.prezzoMqMin,
    pricing.quotazioneMinResidenziale,
    pricing.valoreMinOmi,
    pricing.prezzoMqMin,
    zona.obj.quotazioneMinResidenziale,
    zona.obj.valoreMinOmi,
    zona.obj.prezzoMqMin,
  );
  const quotazioneMaxResidenziale = firstNumber(
    root.quotazioneMaxResidenziale,
    root.valoreMaxOmi,
    root.prezzoMqMax,
    pricing.quotazioneMaxResidenziale,
    pricing.valoreMaxOmi,
    pricing.prezzoMqMax,
    zona.obj.quotazioneMaxResidenziale,
    zona.obj.valoreMaxOmi,
    zona.obj.prezzoMqMax,
  );

  const semestre = firstString(root.semestre, pricing.semestre, zona.obj.semestre, root.sourcePeriod, pricing.sourcePeriod);
  const tipologia = firstString(root.tipologia, pricing.tipologia, zona.obj.tipologia);
  const statoConservazione = firstString(root.statoConservazione, pricing.statoConservazione, zona.obj.statoConservazione);

  const polygonMatch = root.polygonMatch === true
    || pricing.polygonMatch === true
    || zona.obj.polygonMatch === true;

  const omiGeoLevel = firstString(root.omiGeoLevel, pricing.omiGeoLevel, zona.obj.omiGeoLevel)
    ?? (polygonMatch ? "microzona_omi" : undefined);
  const matchMethod = firstString(root.matchMethod, pricing.matchMethod, zona.obj.matchMethod);
  const matchConfidence = firstNumber(root.matchConfidence, pricing.matchConfidence, zona.obj.matchConfidence) ?? undefined;

  const preferredLink = preferred?.linkZona
    ?? firstString(root.link_zona, root.linkZona, pricing.link_zona, zona.obj.link_zona);
  const quotes = collectOmiQuotes(root, preferredLink);
  const headline = pickCivileHeadline(quotes);
  const headlineMin = headline.min ?? quotazioneMinResidenziale;
  const headlineMax = headline.max ?? quotazioneMaxResidenziale;
  const headlineTipologia = quotes.find((q) =>
    headline.min != null && q.comprMin === headline.min && q.comprMax === headline.max
      && /civili/i.test(q.tipologia),
  );
  const resolvedTipologia = headlineTipologia?.tipologia ?? tipologia;
  const resolvedStato = headlineTipologia?.stato ?? statoConservazione;

  const hasQuotes = headlineMin != null || headlineMax != null || quotes.length > 0;
  const hasZone = !!(zonaOmiLabel || zonaOmi);
  if (!hasQuotes && !hasZone) return null;

  const resolvedType: SourceType = sourceType
    ?? (hasQuotes ? "official" : "official");

  return {
    zonaOmi,
    zonaOmiLabel,
    comuneLabel,
    quotazioneMinResidenziale: headlineMin,
    quotazioneMaxResidenziale: headlineMax,
    quotes: quotes.length > 0 ? quotes : undefined,
    semestre,
    tipologia: resolvedTipologia,
    statoConservazione: resolvedStato,
    polygonMatch,
    omiGeoLevel: omiGeoLevel as OmiZoneData["omiGeoLevel"],
    matchMethod: matchMethod ?? undefined,
    matchConfidence,
    sourceType: resolvedType,
    sourceProvider: "omi",
    sourceLabel: firstString(root.sourceLabel, pricing.sourceLabel) ?? "OMI / Agenzia delle Entrate",
    sourcePeriod: semestre ?? undefined,
    sourceFreshness: firstString(root.sourceFreshness, pricing.sourceFreshness) ?? undefined,
    sourceCoverageLevel: (firstString(root.sourceCoverageLevel, pricing.sourceCoverageLevel)
      ?? (polygonMatch ? "zone_omi" : undefined)) as OmiZoneData["sourceCoverageLevel"],
    licensingNote: firstString(root.licensingNote, pricing.licensingNote) ?? undefined,
  };
}

export function hasRenderableOfficialOmi(d: OmiZoneData | null | undefined): boolean {
  if (!d || d.sourceType === "unavailable") return false;
  return d.quotazioneMinResidenziale != null
    || d.quotazioneMaxResidenziale != null
    || (d.quotes?.length ?? 0) > 0
    || !!d.zonaOmiLabel
    || !!d.zonaOmi;
}

function omiDataAsHit(d: OmiZoneData): OmiZoneHit {
  return {
    raw: {},
    linkZona: d.zonaOmi ?? null,
    fascia: extractOmiFascia(d.zonaOmi, d.zonaOmiLabel),
    label: d.zonaOmiLabel ?? null,
    comune: d.comuneLabel ?? null,
    min: d.quotazioneMinResidenziale ?? null,
    max: d.quotazioneMaxResidenziale ?? null,
    stato: d.statoConservazione ?? null,
    tipologia: d.tipologia ?? null,
    polygonMatch: d.polygonMatch === true,
  };
}

/** Prefer official PD* / B1 over a conflicting B2 overlap. Fill gaps only. */
export function mergeOfficialOmiData(
  current: OmiZoneData | null | undefined,
  incoming: OmiZoneData,
): OmiZoneData {
  if (!current || current.sourceType === "unavailable") return incoming;
  const fasce = competingFasceFromHits([omiDataAsHit(incoming), omiDataAsHit(current)]);
  const preferred = scoreOmiHit(omiDataAsHit(incoming), fasce) > scoreOmiHit(omiDataAsHit(current), fasce)
    ? incoming
    : current;
  const other = preferred === incoming ? current : incoming;
  const quotes = mergeOmiQuotes(current.quotes, incoming.quotes);
  const headline = pickCivileHeadline(quotes);
  return {
    ...other,
    ...preferred,
    zonaOmi: preferred.zonaOmi ?? other.zonaOmi,
    zonaOmiLabel: preferred.zonaOmiLabel ?? other.zonaOmiLabel,
    comuneLabel: preferred.comuneLabel ?? other.comuneLabel,
    quotazioneMinResidenziale: headline.min
      ?? preferred.quotazioneMinResidenziale
      ?? other.quotazioneMinResidenziale,
    quotazioneMaxResidenziale: headline.max
      ?? preferred.quotazioneMaxResidenziale
      ?? other.quotazioneMaxResidenziale,
    quotes: quotes.length > 0 ? quotes : preferred.quotes ?? other.quotes,
    semestre: preferred.semestre ?? other.semestre,
    tipologia: preferred.tipologia ?? other.tipologia,
    statoConservazione: preferred.statoConservazione ?? other.statoConservazione,
    polygonMatch: preferred.polygonMatch === true || other.polygonMatch === true,
    omiGeoLevel: preferred.omiGeoLevel ?? other.omiGeoLevel,
    matchMethod: preferred.matchMethod ?? other.matchMethod,
    matchConfidence: preferred.matchConfidence ?? other.matchConfidence,
    sourceType: preferred.sourceType === "official" || other.sourceType === "official"
      ? "official"
      : (preferred.sourceType ?? other.sourceType),
    sourceProvider: preferred.sourceProvider ?? other.sourceProvider,
    sourceLabel: preferred.sourceLabel ?? other.sourceLabel,
    sourcePeriod: preferred.sourcePeriod ?? other.sourcePeriod,
    sourceFreshness: preferred.sourceFreshness ?? other.sourceFreshness,
    sourceCoverageLevel: preferred.sourceCoverageLevel ?? other.sourceCoverageLevel,
    licensingNote: preferred.licensingNote ?? other.licensingNote,
  };
}

export interface OfficialOmiSource {
  status?: SectionStatus;
  data?: unknown;
}

export interface ResolvedOfficialOmi {
  status: SectionStatus;
  data: OmiZoneData | null;
}

/** Prefer Core photoWow / pricing official fields; pro-sources omiZone fills gaps. */
export function resolveOfficialOmiOverlay(sources: {
  omiZone?: OfficialOmiSource | null;
  photoWow?: OfficialOmiSource | null;
  pricing?: OfficialOmiSource | null;
}): ResolvedOfficialOmi {
  let data: OmiZoneData | null = null;
  for (const src of [sources.omiZone, sources.photoWow, sources.pricing]) {
    const mapped = officialOmiFromCore(src?.data);
    if (mapped) data = data ? mergeOfficialOmiData(data, mapped) : mapped;
  }

  if (data && hasRenderableOfficialOmi(data)) {
    return { status: "success", data };
  }

  const statuses = [sources.omiZone?.status, sources.photoWow?.status, sources.pricing?.status];
  if (statuses.includes("loading")) return { status: "loading", data: null };
  if (statuses.includes("error")) return { status: "error", data: null };
  return { status: sources.omiZone?.status ?? "idle", data: null };
}

function emptyScores(): PhotoWowScores {
  return { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null };
}

function readScores(raw: unknown): PhotoWowScores {
  if (!isPlainObject(raw)) return emptyScores();
  return {
    vendibilita: asFiniteNumber(raw.vendibilita),
    opportunitaInvestimento: asFiniteNumber(raw.opportunitaInvestimento),
    pressioneEreditaria: asFiniteNumber(raw.pressioneEreditaria),
  };
}

function readImmobile(raw: unknown): PhotoWowImmobile {
  const d = isPlainObject(raw) ? raw : {};
  return {
    tipologiaProbabile: asTrimmedString(d.tipologiaProbabile),
    pianoStimato: asTrimmedString(d.pianoStimato),
    statoApparente: asTrimmedString(d.statoApparente),
    puntiDiForzaVisivi: Array.isArray(d.puntiDiForzaVisivi)
      ? d.puntiDiForzaVisivi.filter((x): x is string => typeof x === "string")
      : [],
    materialePresunto: asTrimmedString(d.materialePresunto),
    annoPresunto: asTrimmedString(d.annoPresunto),
  };
}

function readZonaObject(root: Record<string, unknown>): PhotoWowZona {
  const zona = readZonaBag(root.zona);
  const pricing = readPricingBag(root);
  const officialMicrozona = firstString(root.officialMicrozona, pricing.officialMicrozona, zona.obj.officialMicrozona);
  const nomeZonaOmi = formatZonaOmiLabel(
    firstString(zona.asString, zona.obj.nomeZonaOmi, root.nomeZonaOmi),
    officialMicrozona ?? parseOmiCode(zona.asString),
  );
  return {
    nomeComune: firstString(zona.obj.nomeComune, root.nomeComune, root.comuneLabel, root.comune),
    provincia: firstString(zona.obj.provincia, root.provincia),
    nomeZonaOmi,
    fascia: firstString(zona.obj.fascia, root.fascia),
    valoreMinOmi: firstNumber(zona.obj.valoreMinOmi, root.valoreMinOmi, root.prezzoMqMin, pricing.prezzoMqMin, pricing.valoreMinOmi),
    valoreMaxOmi: firstNumber(zona.obj.valoreMaxOmi, root.valoreMaxOmi, root.prezzoMqMax, pricing.prezzoMqMax, pricing.valoreMaxOmi),
    tendenzaMercato: firstString(zona.obj.tendenzaMercato, root.tendenzaMercato),
    classificazioneZona: firstString(zona.obj.classificazioneZona, officialMicrozona, root.classificazioneZona),
    sentimentResidenti: firstString(zona.obj.sentimentResidenti),
    livelloSentiment: firstString(zona.obj.livelloSentiment),
  };
}

/**
 * Normalize a live Core photoWow payload into PhotoWowResponse.
 * Scores stay null when Core omitted them — never coerced to 0.
 */
export function normalizePhotoWow(raw: unknown): PhotoWowResponse | null {
  const root = unwrapCoreEnvelope(raw);
  if (!root) return null;

  const zona = readZonaObject(root);
  const scores = readScores(root.scores);
  const immobile = readImmobile(root.immobile);

  const hasCinematic = !!(
    zona.nomeComune
    || zona.nomeZonaOmi
    || zona.valoreMinOmi != null
    || root.immobile
    || root.scores
    || root.liveSignals
    || root.qualita
    || root.fontiUsate
  );
  const hasOfficial = officialOmiFromCore(root) != null;
  if (!hasCinematic && !hasOfficial) return null;

  return {
    immobile,
    zona,
    scores,
    liveSignals: Array.isArray(root.liveSignals) ? root.liveSignals as PhotoWowResponse["liveSignals"] : [],
    territorialDocuments: Array.isArray(root.territorialDocuments) ? root.territorialDocuments as PhotoWowResponse["territorialDocuments"] : [],
    zonaIntelligence: (isPlainObject(root.zonaIntelligence)
      ? root.zonaIntelligence
      : { notizieRecenti: [], puntiDiForzaNascosti: [], criticitaEmergenti: [], tendenzaMercato: "" }) as unknown as PhotoWowResponse["zonaIntelligence"],
    vendutoRecente: Array.isArray(root.vendutoRecente) ? root.vendutoRecente as PhotoWowResponse["vendutoRecente"] : [],
    mappaCaloreUrl: typeof root.mappaCaloreUrl === "string" ? root.mappaCaloreUrl : "",
    pianoEsclusiva: (isPlainObject(root.pianoEsclusiva)
      ? root.pianoEsclusiva
      : { argomento: "", puntiChiave: [], obiezioniProbabili: [], stimaRapida: "" }) as unknown as PhotoWowResponse["pianoEsclusiva"],
    qualita: (root.qualita === "ottima" || root.qualita === "buona" || root.qualita === "minima") ? root.qualita : "buona",
    tempoElaborazione: asFiniteNumber(root.tempoElaborazione) ?? 0,
    fontiUsate: Array.isArray(root.fontiUsate) ? root.fontiUsate.filter((x): x is string => typeof x === "string") : [],
  };
}
