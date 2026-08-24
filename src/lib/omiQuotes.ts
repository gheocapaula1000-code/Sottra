/**
 * Official AdE OMI quote rows (tipologia × stato) for one link_zona.
 * Never invents prices. A mashed civile envelope (e.g. 1400–2750) is not
 * a substitute for the official rows already stored in omi_valori.
 */

import type { OmiQuote } from "@/types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const QUOTE_ARRAY_KEYS = [
  "quotes", "omiQuotes", "omi_quotes", "omi_valori", "valori", "quoteRows",
];

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

export function isCivileTipologia(tipologia: string | null | undefined): boolean {
  return !!tipologia && /abitazioni\s+civili/i.test(tipologia);
}

export function isNormaleStato(stato: string | null | undefined): boolean {
  return !!stato && /normale/i.test(stato);
}

export function isOttimoStato(stato: string | null | undefined): boolean {
  return !!stato && /ottimo/i.test(stato);
}

export function quoteKey(q: Pick<OmiQuote, "tipologia" | "stato">): string {
  return `${(q.tipologia ?? "").trim().toLowerCase()}|${(q.stato ?? "").trim().toLowerCase()}`;
}

export function readOmiQuote(raw: unknown): OmiQuote | null {
  if (!isPlainObject(raw)) return null;
  const tipologia = firstString(
    raw.tipologia, raw.descr_tipologia, raw.Descr_Tipologia, raw.descrTipologia,
  );
  const stato = firstString(
    raw.stato, raw.stato_conservazione, raw.statoConservazione,
  );
  const comprMin = firstNumber(
    raw.comprMin, raw.compr_min, raw.quotazioneMinResidenziale,
    raw.quotazione_min, raw.valoreMinOmi, raw.prezzoMqMin, raw.valore_min,
  );
  const comprMax = firstNumber(
    raw.comprMax, raw.compr_max, raw.quotazioneMaxResidenziale,
    raw.quotazione_max, raw.valoreMaxOmi, raw.prezzoMqMax, raw.valore_max,
  );
  const locMin = firstNumber(
    raw.locMin, raw.loc_min, raw.locazioneMqMin, raw.locazione_min,
  );
  const locMax = firstNumber(
    raw.locMax, raw.loc_max, raw.locazioneMqMax, raw.locazione_max,
  );
  const semestre = firstString(raw.semestre, raw.sourcePeriod);
  if (!tipologia && comprMin == null && comprMax == null) return null;
  return {
    tipologia: tipologia ?? "",
    stato: stato ?? null,
    comprMin,
    comprMax,
    locMin,
    locMax,
    semestre: semestre ?? null,
  };
}

function collectFromArray(arr: unknown): OmiQuote[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(readOmiQuote).filter((q): q is OmiQuote => q != null);
}

function collectQuoteArraysFromBag(bag: Record<string, unknown>): OmiQuote[] {
  const out: OmiQuote[] = [];
  for (const key of QUOTE_ARRAY_KEYS) out.push(...collectFromArray(bag[key]));
  return out;
}

/** Deduplicate official rows. Keep first occurrence of tipologia+stato. */
export function dedupeOmiQuotes(quotes: OmiQuote[]): OmiQuote[] {
  const seen = new Set<string>();
  const out: OmiQuote[] = [];
  for (const q of quotes) {
    const key = quoteKey(q);
    if (!key || key === "|") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

export function sortOmiQuotes(quotes: OmiQuote[]): OmiQuote[] {
  return [...quotes].sort((a, b) => {
    const aCiv = isCivileTipologia(a.tipologia) ? 0 : 1;
    const bCiv = isCivileTipologia(b.tipologia) ? 0 : 1;
    if (aCiv !== bCiv) return aCiv - bCiv;
    const aNorm = isNormaleStato(a.stato) ? 0 : isOttimoStato(a.stato) ? 1 : 2;
    const bNorm = isNormaleStato(b.stato) ? 0 : isOttimoStato(b.stato) ? 1 : 2;
    if (aNorm !== bNorm) return aNorm - bNorm;
    const tip = (a.tipologia ?? "").localeCompare(b.tipologia ?? "", "it");
    if (tip !== 0) return tip;
    return (a.stato ?? "").localeCompare(b.stato ?? "", "it");
  });
}

/**
 * Headline civile band for the Wow strip.
 * Prefer Abitazioni civili NORMALE (Padova D8: 1400–1850), never the mashed
 * NORMALE+OTTIMO envelope (1400–2750).
 */
export function pickCivileHeadline(quotes: OmiQuote[]): { min: number | null; max: number | null } {
  const civile = quotes.filter((q) => isCivileTipologia(q.tipologia));
  const normale = civile.find((q) => isNormaleStato(q.stato));
  const row = normale ?? civile[0];
  if (!row) return { min: null, max: null };
  return { min: row.comprMin ?? null, max: row.comprMax ?? null };
}

export function mergeOmiQuotes(
  current: OmiQuote[] | null | undefined,
  incoming: OmiQuote[] | null | undefined,
): OmiQuote[] {
  return sortOmiQuotes(dedupeOmiQuotes([...(current ?? []), ...(incoming ?? [])]));
}

/**
 * Collect official quote rows from a Core / pro-sources payload.
 * Does not invent rows. Hits that share the preferred official link_zona
 * and carry tipologia become quotes; an explicit `quotes` array wins first.
 */
export function collectOmiQuotes(
  root: Record<string, unknown>,
  preferredLinkZona?: string | null,
): OmiQuote[] {
  const out: OmiQuote[] = [];
  out.push(...collectQuoteArraysFromBag(root));
  if (isPlainObject(root.pricing)) out.push(...collectQuoteArraysFromBag(root.pricing));
  if (isPlainObject(root.omi)) out.push(...collectQuoteArraysFromBag(root.omi));
  if (isPlainObject(root.data)) out.push(...collectQuoteArraysFromBag(root.data));
  if (isPlainObject(root.zona)) out.push(...collectQuoteArraysFromBag(root.zona));

  const link = preferredLinkZona?.trim();
  const hitBags: unknown[] = [];
  for (const key of ["hits", "zones", "omiZones", "omi_zones", "omi_zone_by_point", "results", "rows", "matches", "items"]) {
    if (Array.isArray(root[key])) hitBags.push(...(root[key] as unknown[]));
    if (isPlainObject(root.data) && Array.isArray((root.data as Record<string, unknown>)[key])) {
      hitBags.push(...((root.data as Record<string, unknown>)[key] as unknown[]));
    }
  }
  for (const raw of hitBags) {
    if (!isPlainObject(raw)) continue;
    const rowLink = firstString(raw.link_zona, raw.linkZona, raw.LinkZona);
    if (link && rowLink && rowLink.toUpperCase() !== link.toUpperCase()) continue;
    const tipologia = firstString(raw.tipologia, raw.descr_tipologia, raw.Descr_Tipologia);
    if (!tipologia) continue;
    const q = readOmiQuote(raw);
    if (q) out.push(q);
  }

  return sortOmiQuotes(dedupeOmiQuotes(out));
}

export function formatOmiSaleRange(q: OmiQuote): string | null {
  if (q.comprMin == null && q.comprMax == null) return null;
  if (q.comprMin != null && q.comprMax != null) return `${q.comprMin} – ${q.comprMax}`;
  if (q.comprMin != null) return `${q.comprMin}`;
  return `${q.comprMax}`;
}

export function formatOmiRentRange(q: OmiQuote): string | null {
  if (q.locMin == null && q.locMax == null) return null;
  if (q.locMin != null && q.locMax != null) return `${q.locMin} – ${q.locMax}`;
  if (q.locMin != null) return `${q.locMin}`;
  return `${q.locMax}`;
}

/** True when the only published sale figure is a mashed civile envelope. */
export function isMashedCivileEnvelope(
  quotes: OmiQuote[],
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min == null || max == null || quotes.length < 2) return false;
  const civile = quotes.filter((q) => isCivileTipologia(q.tipologia));
  if (civile.length < 2) return false;
  const mins = civile.map((q) => q.comprMin).filter((n): n is number => n != null);
  const maxs = civile.map((q) => q.comprMax).filter((n): n is number => n != null);
  if (mins.length === 0 || maxs.length === 0) return false;
  return min === Math.min(...mins) && max === Math.max(...maxs);
}
