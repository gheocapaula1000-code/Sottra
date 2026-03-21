/**
 * KeyDraft Bridge Payload Types
 *
 * Canonical schema for data arriving from KeyDraft via Central Core V3 bridge.
 * Sottra consumes this payload to create an editable agency draft.
 *
 * IMPORTANT: Sottra has NO direct dependency on KeyDraft.
 * All data flows through the Central Core V3 bridge endpoint.
 */

/* ── Data origin taxonomy ──────────────────────────────── */

/**
 * Tracks where each piece of data originated.
 * Used throughout the UI to distinguish provenance clearly.
 */
export type KeyDraftDataOrigin =
  | "photo_derived"       // Detected automatically from photos
  | "agent_supplied"      // Manually entered by the agent in KeyDraft
  | "generated_text"      // AI-generated text content from KeyDraft
  | "completed_in_sottra" // Added or corrected inside Sottra by agency
  | "bridge_metadata";    // System/bridge metadata

/* ── Source block ──────────────────────────────────────── */

export interface BridgeSource {
  app: string;          // e.g. "keydraft"
  version?: string;
  bridge_version?: string;
  timestamp?: string;
}

/* ── Listing identification ───────────────────────────── */

export interface BridgeListing {
  listing_id: string;
  run_id?: string;
  created_at?: string;
}

/* ── Property data from photo analysis ────────────────── */

export interface BridgeProperty {
  property_type?: string;
  rooms_estimated?: number;
  bathrooms_estimated?: number;
  photo_count?: number;
  materials_detected?: string[];
  features_detected?: string[];
  condition_estimated?: string;
  floors_estimated?: number;
}

/* ── Photo-derived data ───────────────────────────────── */

export interface BridgePhotoDerived {
  confidence_flags?: Record<string, number>;
  exterior_notes?: string;
  interior_notes?: string;
  photo_urls?: string[];
}

/* ── Agent-supplied data ──────────────────────────────── */

export interface BridgeAgentSupplied {
  agent_features_structured?: Record<string, string | number | boolean>;
  agent_notes_freeform?: string;
  address?: string;
  surface_sqm?: number;
  floor?: string;
  elevator?: boolean;
  price_asked?: number;
  expenses_monthly?: number;
  energy_class?: string;
  availability?: string;
  commercial_notes?: string;
}

/* ── Generated text content ───────────────────────────── */

export interface BridgeSocialVariant {
  platform: string;
  text: string;
}

export interface BridgeGeneratedText {
  primary_listing_text?: string;
  listing_text_long?: string;
  listing_text_short?: string;
  listing_social_variants?: BridgeSocialVariant[];
  whatsapp_ready_summary?: string;
}

/* ── Sharing / export status ──────────────────────────── */

export interface BridgeSharing {
  portals_exported?: string[];
  social_shared?: string[];
  export_timestamp?: string;
}

/* ── Origin map for provenance tracking ───────────────── */

export type BridgeOriginMap = Record<string, KeyDraftDataOrigin>;

/* ── Bridge status ────────────────────────────────────── */

export interface BridgeStatus {
  status: "complete" | "partial" | "error";
  warnings?: string[];
  trace_id?: string;
}

/* ── Full canonical payload ───────────────────────────── */

export interface KeyDraftBridgePayload {
  source: BridgeSource;
  listing: BridgeListing;
  property?: BridgeProperty;
  photo_derived?: BridgePhotoDerived;
  agent_supplied?: BridgeAgentSupplied;
  generated_text?: BridgeGeneratedText;
  sharing?: BridgeSharing;
  origin_map?: BridgeOriginMap;
  bridge_status?: BridgeStatus;
}

/* ── Stored draft in Sottra ───────────────────────────── */

export type ImportDraftStatus =
  | "importata"          // Just arrived from bridge
  | "in_lavorazione"     // Agency is working on it
  | "completata"         // Agency marked as complete
  | "archiviata";        // Archived

/** Fields that can be completed/overridden in Sottra */
export interface SottraCompletionFields {
  indirizzo_completo?: string;
  superficie_mq?: number;
  piano?: string;
  ascensore?: boolean;
  prezzo_richiesto?: number;
  spese_mensili?: number;
  classe_energetica?: string;
  disponibilita?: string;
  note_commerciali?: string;
  note_documentali?: string;
  [key: string]: string | number | boolean | undefined;
}

/** Full import record as stored in DB and used in frontend */
export interface KeyDraftImportRecord {
  id: string;
  user_id: string;
  listing_id: string;
  run_id: string | null;
  status: ImportDraftStatus;
  source_app: string;
  bridge_payload: KeyDraftBridgePayload;
  sottra_completions: SottraCompletionFields;
  origin_map: BridgeOriginMap;
  created_at: string;
  updated_at: string;
}

/* ── Validation helpers ───────────────────────────────── */

export function isValidBridgePayload(p: unknown): p is KeyDraftBridgePayload {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;

  // source and listing are required
  if (!obj.source || typeof obj.source !== "object") return false;
  if (!obj.listing || typeof obj.listing !== "object") return false;

  const source = obj.source as Record<string, unknown>;
  const listing = obj.listing as Record<string, unknown>;

  if (typeof source.app !== "string" || !source.app) return false;
  if (typeof listing.listing_id !== "string" || !listing.listing_id) return false;

  return true;
}
