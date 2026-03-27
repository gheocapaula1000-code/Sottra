/**
 * Macrozone Registry — Sottra
 *
 * Central, canonical mapping of Italian regions to 5 macrozones.
 * Single source of truth — no hardcoding in other files.
 *
 * Macrozones: Nord-Ovest, Nord-Est, Centro, Sud, Isole
 */

/* ── Types ────────────────────────────────────────────────── */

export type MacrozoneCode = "nord_ovest" | "nord_est" | "centro" | "sud" | "isole";

export interface MacrozoneDefinition {
  code: MacrozoneCode;
  label: string;
  regioni: RegionEntry[];
}

export interface RegionEntry {
  codice_regione: string;   // ISTAT code (e.g. "01" for Piemonte)
  nome_regione: string;
}

export interface MacrozoneMatch {
  macrozone_code: MacrozoneCode;
  macrozone_label: string;
  regione_code: string;
  regione_name: string;
}

/* ── Canonical Mapping ────────────────────────────────────── */

export const MACROZONE_DEFINITIONS: MacrozoneDefinition[] = [
  {
    code: "nord_ovest",
    label: "Nord-Ovest",
    regioni: [
      { codice_regione: "01", nome_regione: "Piemonte" },
      { codice_regione: "02", nome_regione: "Valle d'Aosta" },
      { codice_regione: "03", nome_regione: "Lombardia" },
      { codice_regione: "07", nome_regione: "Liguria" },
    ],
  },
  {
    code: "nord_est",
    label: "Nord-Est",
    regioni: [
      { codice_regione: "04", nome_regione: "Trentino-Alto Adige" },
      { codice_regione: "05", nome_regione: "Veneto" },
      { codice_regione: "06", nome_regione: "Friuli-Venezia Giulia" },
      { codice_regione: "08", nome_regione: "Emilia-Romagna" },
    ],
  },
  {
    code: "centro",
    label: "Centro",
    regioni: [
      { codice_regione: "09", nome_regione: "Toscana" },
      { codice_regione: "10", nome_regione: "Umbria" },
      { codice_regione: "11", nome_regione: "Marche" },
      { codice_regione: "12", nome_regione: "Lazio" },
    ],
  },
  {
    code: "sud",
    label: "Sud",
    regioni: [
      { codice_regione: "13", nome_regione: "Abruzzo" },
      { codice_regione: "14", nome_regione: "Molise" },
      { codice_regione: "15", nome_regione: "Campania" },
      { codice_regione: "16", nome_regione: "Puglia" },
      { codice_regione: "17", nome_regione: "Basilicata" },
      { codice_regione: "18", nome_regione: "Calabria" },
    ],
  },
  {
    code: "isole",
    label: "Isole",
    regioni: [
      { codice_regione: "19", nome_regione: "Sicilia" },
      { codice_regione: "20", nome_regione: "Sardegna" },
    ],
  },
];

/* ── Lookup indexes (built once) ──────────────────────────── */

const _byRegionCode = new Map<string, MacrozoneMatch>();
const _byRegionName = new Map<string, MacrozoneMatch>();

for (const mz of MACROZONE_DEFINITIONS) {
  for (const r of mz.regioni) {
    const entry: MacrozoneMatch = {
      macrozone_code: mz.code,
      macrozone_label: mz.label,
      regione_code: r.codice_regione,
      regione_name: r.nome_regione,
    };
    _byRegionCode.set(r.codice_regione, entry);
    _byRegionName.set(r.nome_regione.toLowerCase(), entry);
  }
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Resolves macrozone from ISTAT region code (e.g. "03" → Nord-Ovest).
 */
export function getMacrozoneByRegionCode(codiceRegione: string): MacrozoneMatch | null {
  // Normalize: "3" → "03"
  const normalized = codiceRegione.padStart(2, "0");
  return _byRegionCode.get(normalized) ?? null;
}

/**
 * Resolves macrozone from region name (case-insensitive).
 */
export function getMacrozoneByRegionName(nomeRegione: string): MacrozoneMatch | null {
  return _byRegionName.get(nomeRegione.toLowerCase()) ?? null;
}

/**
 * Returns macrozone label for display.
 */
export function getMacrozoneLabel(code: MacrozoneCode): string {
  return MACROZONE_DEFINITIONS.find(m => m.code === code)?.label ?? code;
}

/**
 * Returns all macrozone codes.
 */
export function getAllMacrozoneCodes(): MacrozoneCode[] {
  return MACROZONE_DEFINITIONS.map(m => m.code);
}

/**
 * Returns all regions for a given macrozone.
 */
export function getRegionsForMacrozone(code: MacrozoneCode): RegionEntry[] {
  return MACROZONE_DEFINITIONS.find(m => m.code === code)?.regioni ?? [];
}

/**
 * Returns all region codes for a macrozone (useful for DB queries).
 */
export function getRegionCodesForMacrozone(code: MacrozoneCode): string[] {
  return getRegionsForMacrozone(code).map(r => r.codice_regione);
}

/* ── Geographic Level Hierarchy ───────────────────────────── */

/**
 * Extended geographic level hierarchy including macrozone.
 * Lower rank = finer granularity = higher priority.
 */
export type ExtendedGeoLevel =
  | "sub_comunale"   // ASC, sezione censuaria
  | "localita"       // ISTAT locality
  | "comunale"       // comune
  | "provinciale"    // provincia
  | "regionale"      // regione
  | "macrozonale"    // macrozona (5 aree)
  | "nazionale"      // italia intera
  | "non_determinato";

const EXTENDED_GEO_RANK: Record<ExtendedGeoLevel, number> = {
  sub_comunale: 0,
  localita: 1,
  comunale: 2,
  provinciale: 3,
  regionale: 4,
  macrozonale: 5,
  nazionale: 6,
  non_determinato: 99,
};

/**
 * Returns true if `candidate` is at least as fine as `required`.
 */
export function isGeoLevelAtLeast(candidate: ExtendedGeoLevel, required: ExtendedGeoLevel): boolean {
  return EXTENDED_GEO_RANK[candidate] <= EXTENDED_GEO_RANK[required];
}

/**
 * Returns the finer of two geo levels.
 */
export function finerGeoLevel(a: ExtendedGeoLevel, b: ExtendedGeoLevel): ExtendedGeoLevel {
  return EXTENDED_GEO_RANK[a] <= EXTENDED_GEO_RANK[b] ? a : b;
}

/**
 * Human-readable label for extended geo level.
 */
export function extendedGeoLevelLabel(level: ExtendedGeoLevel): string {
  switch (level) {
    case "sub_comunale": return "Sub-comunale";
    case "comunale": return "Comunale";
    case "provinciale": return "Provinciale";
    case "regionale": return "Regionale";
    case "macrozonale": return "Macrozona";
    case "nazionale": return "Nazionale";
    case "non_determinato": return "Non determinato";
  }
}
