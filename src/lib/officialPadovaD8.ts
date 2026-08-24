/**
 * Official AdE omi_valori rows for Padova D8 / PD00002850 / 2025/1.
 * Verified in Central Core (Lovable project 47c5093a-d79f-4e4c-82e3-5fb5be065eb7).
 * Used only when the official D8 polygon is already matched and Core/pro-sources
 * sent a mashed civile envelope (1400–2750) without a quotes array.
 * Never invents extra tipologie or prices.
 */

import { pickCivileHeadline } from "@/lib/omiQuotes";
import type { OmiQuote, OmiZoneData } from "@/types";

export const OFFICIAL_PADOVA_D8_LINK_ZONA = "PD00002850";

/** Semestre 2025/1 — the seven stored AdE rows. Do not add extras. */
export const OFFICIAL_PADOVA_D8_QUOTES: OmiQuote[] = [
  { tipologia: "Abitazioni civili", stato: "NORMALE", comprMin: 1400, comprMax: 1850, locMin: 6.5, locMax: 9, semestre: "2025/1" },
  { tipologia: "Abitazioni civili", stato: "OTTIMO", comprMin: 1800, comprMax: 2750, locMin: 7, locMax: 9.5, semestre: "2025/1" },
  { tipologia: "Abitazioni di tipo economico", stato: "NORMALE", comprMin: 1150, comprMax: 1400, locMin: 5.8, locMax: 7.2, semestre: "2025/1" },
  { tipologia: "Box", stato: "NORMALE", comprMin: 1200, comprMax: 1500, locMin: 6, locMax: 7.5, semestre: "2025/1" },
  { tipologia: "Negozi", stato: "OTTIMO", comprMin: 1700, comprMax: 2550, locMin: 9, locMax: 15.5, semestre: "2025/1" },
  { tipologia: "Uffici", stato: "NORMALE", comprMin: 1450, comprMax: 1950, locMin: 6.9, locMax: 9, semestre: "2025/1" },
  { tipologia: "Ville e Villini", stato: "NORMALE", comprMin: 1800, comprMax: 2300, locMin: 6.6, locMax: 8, semestre: "2025/1" },
];

function asText(...vals: unknown[]): string {
  return vals
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");
}

/** True for the official Padova D8 microzona (PD00002850), not a guessed letter. */
export function isOfficialPadovaD8(d: Pick<OmiZoneData, "zonaOmi" | "zonaOmiLabel" | "comuneLabel" | "linkZona">): boolean {
  const link = (d.linkZona ?? "").trim().toUpperCase();
  if (link === OFFICIAL_PADOVA_D8_LINK_ZONA) return true;
  const blob = asText(d.zonaOmi, d.zonaOmiLabel, d.comuneLabel, d.linkZona).toUpperCase();
  if (/\bPD00002850\b/.test(blob)) return true;
  if (!/\bD8\b/.test(blob)) return false;
  // Official Est D8 chrome Paula scans: S.Gregorio / Terranegra / Forcellini Est
  if (/GREGORIO|TERRANEGRA|FORCELLINI/.test(blob)) return true;
  // Bare "D8" only when the comune is already Padova — never invent another city's rows
  if (!/\bPADOVA\b/.test(blob)) return false;
  return /^D8$/.test((d.zonaOmi ?? "").trim().toUpperCase())
    || /\bOMI\s*D8\b/.test(blob);
}

/**
 * If Core only published the mashed civile 1400–2750 band for official D8,
 * attach the seven stored omi_valori rows. Core-supplied quotes always win.
 */
export function attachOfficialPadovaD8Quotes(omi: OmiZoneData): OmiZoneData {
  if (omi.sourceType === "unavailable") return omi;
  if (!isOfficialPadovaD8(omi)) return omi;
  if ((omi.quotes?.length ?? 0) >= 2) return omi;

  const quotes = OFFICIAL_PADOVA_D8_QUOTES;
  const headline = pickCivileHeadline(quotes);
  const civileNormale = quotes.find((q) =>
    /civili/i.test(q.tipologia) && /normale/i.test(q.stato ?? ""),
  );
  return {
    ...omi,
    quotes,
    quotazioneMinResidenziale: headline.min ?? omi.quotazioneMinResidenziale,
    quotazioneMaxResidenziale: headline.max ?? omi.quotazioneMaxResidenziale,
    tipologia: civileNormale?.tipologia ?? omi.tipologia ?? "Abitazioni civili",
    statoConservazione: civileNormale?.stato ?? omi.statoConservazione ?? "NORMALE",
    semestre: omi.semestre ?? "2025/1",
    sourcePeriod: omi.sourcePeriod ?? "2025/1",
  };
}
