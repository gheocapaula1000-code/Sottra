/**
 * Share text for a KeyDraft-imported agency draft.
 * Only real fields from the payload / Sottra completions — never visura, APE, or invented OMI.
 */

import type { KeyDraftImportRecord } from "@/types/keydraft";

const clean = (v?: string | null) => (typeof v === "string" ? v.trim() : "");

export function buildImportedDraftShareTitle(record: KeyDraftImportRecord): string {
  const address =
    clean(record.sottra_completions?.indirizzo_completo)
    || clean(record.bridge_payload.agent_supplied?.address);
  if (address) return `Sottra · ${address}`;
  const listing = clean(record.listing_id);
  if (listing) return `Sottra · ${listing}`;
  return "Sottra";
}

/**
 * Prefer KeyDraft's WhatsApp summary when present (agent/generated, not invented here).
 * Otherwise compose a short factual line from fields that actually exist.
 */
export function buildImportedDraftShareText(record: KeyDraftImportRecord): string {
  const generated = record.bridge_payload.generated_text;
  const ready = clean(generated?.whatsapp_ready_summary);
  if (ready) return ready;
  const short = clean(generated?.listing_text_short);
  if (short) return short;

  const parts: string[] = ["Scheda Sottra"];
  const address =
    clean(record.sottra_completions?.indirizzo_completo)
    || clean(record.bridge_payload.agent_supplied?.address);
  if (address) parts.push(address);

  const surface =
    record.sottra_completions?.superficie_mq
    ?? record.bridge_payload.agent_supplied?.surface_sqm;
  if (typeof surface === "number" && Number.isFinite(surface)) {
    parts.push(`${surface} m²`);
  }

  const rooms = record.bridge_payload.property?.rooms_estimated;
  if (typeof rooms === "number" && Number.isFinite(rooms)) {
    parts.push(`${rooms} ${rooms === 1 ? "locale" : "locali"}`);
  }

  const floor =
    clean(record.sottra_completions?.piano)
    || clean(record.bridge_payload.agent_supplied?.floor);
  if (floor) parts.push(`Piano ${floor}`);

  parts.push("sottra.app");
  return parts.join(" — ");
}
