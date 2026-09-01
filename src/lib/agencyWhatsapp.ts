/**
 * WhatsApp dell'agenzia in cui lavora l'agente.
 * Il report JPEG viene inviato a QUEL numero, mai a una chat generica.
 * Nessun dato inventato nella didascalia: solo via/civico e zona OMI se presenti.
 */

export const AGENCY_WHATSAPP_STORAGE_KEY = "sottra:agency-whatsapp";

/**
 * Normalizza un numero italiano in E.164 (+39...).
 * Ritorna null se non è un cellulare italiano valido (fail-closed).
 */
export function normalizeItalianMobile(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  let raw = input.trim();
  if (!raw) return null;
  // Solo cifre, + iniziale, spazi/punti/trattini/parentesi
  if (!/^[+0-9\s().-]+$/.test(raw)) return null;
  raw = raw.replace(/[\s().-]/g, "");

  let digits: string;
  if (raw.startsWith("+")) {
    digits = raw.slice(1);
    if (!/^\d+$/.test(digits)) return null;
    if (!digits.startsWith("39")) return null; // solo Italia
    digits = digits.slice(2);
  } else if (raw.startsWith("0039")) {
    digits = raw.slice(4);
  } else if (raw.startsWith("39") && raw.length > 11) {
    digits = raw.slice(2);
  } else {
    digits = raw;
  }
  if (!/^\d+$/.test(digits)) return null;
  // Cellulare italiano: prefisso 3, 9 o 10 cifre totali
  if (!/^3\d{8,9}$/.test(digits)) return null;
  return `+39${digits}`;
}

export function isValidAgencyWhatsapp(input: string | null | undefined): boolean {
  return normalizeItalianMobile(input) !== null;
}

/** Formato leggibile: +39 345 678 9012 */
export function formatAgencyWhatsapp(e164: string | null | undefined): string {
  const norm = normalizeItalianMobile(e164);
  if (!norm) return "";
  const d = norm.slice(3);
  return `+39 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
}

export interface ShareCaptionInput {
  street?: string | null;
  houseNumber?: string | null;
  comuneLabel?: string | null;
  zonaOmi?: string | null;
}

const clean = (v?: string | null) => (typeof v === "string" ? v.trim() : "");

/**
 * Didascalia breve. Solo fatti realmente presenti.
 * Mai "vendita", "intero stabile", "successione", mai quotazioni inventate.
 */
export function buildAgencyShareCaption(input: ShareCaptionInput): string {
  const parts: string[] = ["Report Sottra"];
  const street = clean(input.street);
  const civico = clean(input.houseNumber);
  const comune = clean(input.comuneLabel);
  const zona = clean(input.zonaOmi);

  const address = [street, civico].filter(Boolean).join(" ");
  const place = [address, comune].filter(Boolean).join(", ");
  if (place) parts.push(place);
  if (zona) parts.push(`Zona OMI ${zona}`);
  parts.push("sottra.app");
  return parts.join(" — ");
}

/** Link diretto alla chat di QUEL numero. Null se il numero non è valido. */
export function buildAgencyWhatsappUrl(phone: string | null | undefined, caption: string): string | null {
  const norm = normalizeItalianMobile(phone);
  if (!norm) return null;
  const digits = norm.replace("+", "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(caption)}`;
}

export function readCachedAgencyWhatsapp(): string | null {
  try {
    return normalizeItalianMobile(localStorage.getItem(AGENCY_WHATSAPP_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function cacheAgencyWhatsapp(e164: string | null): void {
  try {
    if (e164) localStorage.setItem(AGENCY_WHATSAPP_STORAGE_KEY, e164);
    else localStorage.removeItem(AGENCY_WHATSAPP_STORAGE_KEY);
  } catch {
    /* storage non disponibile: il numero resta sul profilo */
  }
}
