/**
 * Dati legali centralizzati — Pi.Gi Service di Gheoca Paula.
 * Compilare i valori prima del go-live o settare le env vars VITE_LEGAL_*.
 */
const env = (key: string, fallback: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, string | undefined>)[key];
    if (val && val.trim()) return val.trim();
  }
  return fallback;
};

export const LEGAL_ENTITY = {
  companyName: env("VITE_LEGAL_COMPANY_NAME", "Pi.Gi Service di Gheoca Paula"),
  address: env("VITE_LEGAL_ADDRESS", "Via Guido Reni, 8"),
  city: env("VITE_LEGAL_CITY", "Padova"),
  province: env("VITE_LEGAL_PROVINCE", "PD"),
  cap: env("VITE_LEGAL_CAP", "35133"),
  vatNumber: env("VITE_LEGAL_VAT", "05770260288"),
  fiscalCode: env("VITE_LEGAL_CF", "GHCPLA75E63Z129I"),
  email: env("VITE_LEGAL_EMAIL", "gheocapaula@gmail.com"),
  pec: env("VITE_LEGAL_PEC", "paulagheoca@pec.it"),
  phone: env("VITE_LEGAL_PHONE", "+39 3476373956"),
} as const;

/** Helper: mostra il valore o "[da compilare]" se vuoto */
export const val = (v: string) => (v ? v : "[da compilare]");
