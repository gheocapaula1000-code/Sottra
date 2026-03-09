/**
 * Dati legali centralizzati — Pi.Gi Service di Gheoca Paula
 * Profilo comune + dati specifici per app Sottra (sottra.app)
 */

/* ── Dati societari comuni ── */
export const LEGAL_ENTITY = {
  companyName: "Pi.Gi Service di Gheoca Paula",
  address: "Via Guido Reni, 8",
  city: "Padova",
  province: "PD",
  cap: "35133",
  country: "Italia",
  vatNumber: "05770260288",
  fiscalCode: "GHCPLA75E63Z129I",
  pec: "paulagheoca@pec.it",
  jurisdiction: "Foro di Padova",
  applicableLaw: "Legge italiana",
} as const;

/* ── Dati specifici app corrente (sottra.app) ── */
export const APP_BRAND = {
  name: "Sottra",
  domain: "sottra.app",
  infoEmail: "info@sottra.app",
  supportEmail: "supporto@sottra.app",
} as const;

/** Helper: mostra il valore o "[da compilare]" se vuoto */
export const val = (v: string) => (v ? v : "[da compilare]");
