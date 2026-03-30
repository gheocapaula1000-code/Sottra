/**
 * Commercial Bridge — Canonical Payload Schema
 *
 * Defines the typed contract for bidirectional data exchange between
 * Sottra and KeyDraft via Central Core V3.
 *
 * RULES:
 * - No ambiguous fields. Every field has a single clear meaning.
 * - Origin/provenance tracked per-field.
 * - No coupling: each app can function without the other.
 * - Bridge is orchestrated by Central Core V3, not by either app.
 */

/* ═══════════════════════════════════════════════════════════
   BRIDGE IDENTITY
   ═══════════════════════════════════════════════════════════ */

export interface BridgeIdentity {
  trace_id: string;
  run_id: string | null;
  listing_id: string;
  source_app: "sottra" | "keydraft";
  target_app: "sottra" | "keydraft";
  exported_at: string;
  bridge_version: string;
  source_environment?: "production" | "staging" | "development";
}

/* ═══════════════════════════════════════════════════════════
   BRIDGE LOCALIZATION
   ═══════════════════════════════════════════════════════════ */

export interface BridgeLocalization {
  lat: number | null;
  lng: number | null;
  address: string | null;
  street: string | null;
  civic: string | null;
  comune: string | null;
  province: string | null;
  region: string | null;
  geo_confidence: "high" | "medium" | "low" | "unavailable";
  address_confidence: "official" | "partial" | "unavailable";
}

/* ═══════════════════════════════════════════════════════════
   BRIDGE PROPERTY SIGNALS
   ═══════════════════════════════════════════════════════════ */

export interface BridgePropertySignals {
  property_type: string | null;
  facade_signals: "detected" | "partial" | "not_detected" | null;
  building_candidate_status: string | null;
  specificity_strength: "strong" | "medium" | "weak" | "insufficient" | null;
  photo_refs: string[];
  visual_notes: string | null;
  room_count: number | null;       // only if real, never estimated
  surface_sqm: number | null;      // only if real, never estimated
}

/* ═══════════════════════════════════════════════════════════
   BRIDGE SOTTRA CONTEXT
   ═══════════════════════════════════════════════════════════ */

export interface BridgeSottraContext {
  zone_real: string;
  zone_geo_level: string;
  zone_boundaries_status: "available" | "partial" | "unavailable";
  value_per_sqm_min: number | null;
  value_per_sqm_max: number | null;
  value_reliability: "high" | "medium" | "low" | "unavailable";
  renovation_cost_range: string | null;
  outlook_2y: string | null;
  outlook_5y: string | null;
  outlook_10y: string | null;
  attention_area: "high" | "medium" | "low" | "insufficient";
  main_limit: string;
  fallback_weight: "low" | "medium" | "high";
  false_specificity_risk: boolean;
}

/* ═══════════════════════════════════════════════════════════
   BRIDGE KEYDRAFT CONTEXT
   ═══════════════════════════════════════════════════════════ */

export interface BridgeKeydraftContext {
  technical_summary: string | null;
  commercial_summary: string | null;
  materials_features: string[];
  listing_title: string | null;
  listing_body: string | null;
  media_summary: string | null;
  agency_notes: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ORIGIN MAP / SOURCE OF TRUTH
   ═══════════════════════════════════════════════════════════ */

export type FieldProvenance = "direct" | "contextual" | "derived" | "unavailable";
export type FieldSource = "sottra" | "keydraft" | "core_normalized";

export interface FieldOrigin {
  source: FieldSource;
  provenance: FieldProvenance;
}

export type BridgeCanonicalOriginMap = Record<string, FieldOrigin>;

/* ═══════════════════════════════════════════════════════════
   BRIDGE STATES
   ═══════════════════════════════════════════════════════════ */

export type BridgeState =
  | "received"
  | "validated"
  | "transformed"
  | "delivered"
  | "imported"
  | "failed"
  | "duplicate"
  | "blocked";

export interface BridgeStateEntry {
  state: BridgeState;
  timestamp: string;
  source_app: "sottra" | "keydraft" | "core";
  target_app: "sottra" | "keydraft" | "core";
  payload_version: string;
  outcome: "success" | "error" | "skipped";
  warnings: string[];
  failure_reason: string | null;
}

/* ═══════════════════════════════════════════════════════════
   FULL CANONICAL PAYLOAD
   ═══════════════════════════════════════════════════════════ */

export interface CommercialBridgePayload {
  bridge_identity: BridgeIdentity;
  bridge_localization: BridgeLocalization;
  bridge_property_signals: BridgePropertySignals;
  bridge_sottra_context: BridgeSottraContext | null;
  bridge_keydraft_context: BridgeKeydraftContext | null;
  bridge_origin_map: BridgeCanonicalOriginMap;
  bridge_state: BridgeStateEntry;
}

/* ═══════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════ */

export function isValidCommercialBridgePayload(p: unknown): p is CommercialBridgePayload {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;

  // bridge_identity required
  if (!obj.bridge_identity || typeof obj.bridge_identity !== "object") return false;
  const id = obj.bridge_identity as Record<string, unknown>;
  if (typeof id.trace_id !== "string" || !id.trace_id) return false;
  if (typeof id.listing_id !== "string" || !id.listing_id) return false;
  if (typeof id.source_app !== "string" || !id.source_app) return false;
  if (typeof id.target_app !== "string" || !id.target_app) return false;

  // bridge_state required
  if (!obj.bridge_state || typeof obj.bridge_state !== "object") return false;
  const st = obj.bridge_state as Record<string, unknown>;
  if (typeof st.state !== "string") return false;

  // bridge_localization required
  if (!obj.bridge_localization || typeof obj.bridge_localization !== "object") return false;

  // bridge_origin_map required
  if (!obj.bridge_origin_map || typeof obj.bridge_origin_map !== "object") return false;

  return true;
}

/* ═══════════════════════════════════════════════════════════
   BRIDGE VERSION
   ═══════════════════════════════════════════════════════════ */

export const BRIDGE_VERSION = "1.0.0";
