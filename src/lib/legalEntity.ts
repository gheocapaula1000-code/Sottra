/**
 * Dati legali centralizzati — Pi.Gi Service di Gheoca Paula
 */

/* ── Dati societari comuni ── */
export const LEGAL_ENTITY = {
  companyName: "Pi.Gi Service di Gheoca Paula",
  address: "Via Guidi Reni, 8",
  city: "Padova",
  province: "PD",
  cap: "35133",
  country: "Italia",
  vatNumber: "05770260288",
  pec: "paulagheoca@pec.it",
  jurisdiction: "Foro di Padova",
  applicableLaw: "Legge italiana",
} as const;

/* ── Dati specifici app corrente ── */
export const APP_BRAND = {
  name: "Pi.Gi Service",
  domain: "pigiservice.com",
  infoEmail: "info@pigiservice.com",
  supportEmail: "supporto@pigiservice.com",
} as const;

/** Helper: mostra il valore o "[da compilare]" se vuoto */
export const val = (v: string) => (v ? v : "[da compilare]");
