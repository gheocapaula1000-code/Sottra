/**
 * Sottra → KeyDraft Export Bridge
 *
 * Composes a CommercialBridgePayload from Sottra's scan result data
 * so that KeyDraft can receive territorial context for property listings.
 *
 * RULES:
 * - Zone data arrives as context, never as building truth.
 * - Limits remain visible.
 * - No invented data.
 * - No coupling: export is optional and Sottra works without it.
 */

import type {
  CommercialBridgePayload,
  BridgeLocalization,
  BridgeSottraContext,
  BridgePropertySignals,
  BridgeCanonicalOriginMap,
} from "./commercialBridgeSchema";
import { BRIDGE_VERSION } from "./commercialBridgeSchema";
import type { WowSnapshot } from "./sottraWowSnapshot";
import type { HouseDifferentiationResult } from "./houseDifferentiationEngine";

/* ═══════════════════════════════════════════════════════════
   INPUT CONTRACT
   ═══════════════════════════════════════════════════════════ */

export interface SottraExportInput {
  listing_id: string;
  trace_id?: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  comune: string | null;
  province: string | null;
  region: string | null;
  photo_url: string | null;
  wow: WowSnapshot;
  house_diff: HouseDifferentiationResult | null;
  outlook_2y: string | null;
  outlook_5y: string | null;
  outlook_10y: string | null;
  geo_confidence?: "high" | "medium" | "low" | "unavailable";
  address_confidence?: "official" | "partial" | "unavailable";
  fallback_weight?: "low" | "medium" | "high";
}

/* ═══════════════════════════════════════════════════════════
   EXPORT BUILDER
   ═══════════════════════════════════════════════════════════ */

export function buildSottraExportPayload(input: SottraExportInput): CommercialBridgePayload {
  const traceId = input.trace_id ?? `sottra-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const localization: BridgeLocalization = {
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    street: null,
    civic: null,
    comune: input.comune,
    province: input.province,
    region: input.region,
    geo_confidence: input.geo_confidence ?? "medium",
    address_confidence: input.address_confidence ?? "partial",
  };

  const attentionMap: Record<string, "high" | "medium" | "low" | "insufficient"> = {
    high: "high",
    medium: "medium",
    low: "low",
    insufficient: "insufficient",
  };

  const sottraCtx: BridgeSottraContext = {
    zone_real: input.wow.zona_reale,
    zone_geo_level: input.wow.livello_lettura,
    zone_boundaries_status: "partial",
    value_per_sqm_min: null,
    value_per_sqm_max: null,
    value_reliability: mapReliability(input.wow.affidabilita_valore),
    renovation_cost_range: input.wow.costo_range,
    outlook_2y: input.outlook_2y,
    outlook_5y: input.outlook_5y,
    outlook_10y: input.outlook_10y,
    attention_area: attentionMap[input.wow.attenzione_area] ?? "insufficient",
    main_limit: input.wow.limite_principale,
    fallback_weight: input.fallback_weight ?? "medium",
    false_specificity_risk: input.house_diff?.specificity.false_specificity_risk ?? false,
  };

  // Parse value range from wow snapshot
  if (input.wow.valore_range) {
    const parts = input.wow.valore_range.split("–").map(s => parseFloat(s.replace(/[^\d,.-]/g, "").replace(",", ".")));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      sottraCtx.value_per_sqm_min = parts[0];
      sottraCtx.value_per_sqm_max = parts[1];
    }
  }

  const propertySignals: BridgePropertySignals = {
    property_type: null,
    facade_signals: input.house_diff?.visual_signals.facade_detected ? "detected" : "not_detected",
    building_candidate_status: input.house_diff?.specificity.specificity_status ?? null,
    specificity_strength: input.house_diff?.specificity.specificity_strength ?? null,
    photo_refs: input.photo_url ? [input.photo_url] : [],
    visual_notes: null,
    room_count: null,
    surface_sqm: null,
  };

  const originMap: BridgeCanonicalOriginMap = {
    zone_real: { source: "sottra", provenance: "direct" },
    zone_geo_level: { source: "sottra", provenance: "direct" },
    value_per_sqm_min: { source: "sottra", provenance: sottraCtx.value_per_sqm_min != null ? "direct" : "unavailable" },
    value_per_sqm_max: { source: "sottra", provenance: sottraCtx.value_per_sqm_max != null ? "direct" : "unavailable" },
    value_reliability: { source: "sottra", provenance: "direct" },
    attention_area: { source: "sottra", provenance: "derived" },
    main_limit: { source: "sottra", provenance: "direct" },
    outlook_2y: { source: "sottra", provenance: input.outlook_2y ? "contextual" : "unavailable" },
    outlook_5y: { source: "sottra", provenance: input.outlook_5y ? "contextual" : "unavailable" },
    outlook_10y: { source: "sottra", provenance: input.outlook_10y ? "contextual" : "unavailable" },
    facade_signals: { source: "sottra", provenance: input.house_diff ? "derived" : "unavailable" },
    specificity_strength: { source: "sottra", provenance: input.house_diff ? "derived" : "unavailable" },
    address: { source: "sottra", provenance: input.address ? "direct" : "unavailable" },
    lat: { source: "sottra", provenance: input.lat != null ? "direct" : "unavailable" },
    lng: { source: "sottra", provenance: input.lng != null ? "direct" : "unavailable" },
  };

  return {
    bridge_identity: {
      trace_id: traceId,
      run_id: null,
      listing_id: input.listing_id,
      source_app: "sottra",
      target_app: "keydraft",
      exported_at: new Date().toISOString(),
      bridge_version: BRIDGE_VERSION,
    },
    bridge_localization: localization,
    bridge_property_signals: propertySignals,
    bridge_sottra_context: sottraCtx,
    bridge_keydraft_context: null,
    bridge_origin_map: originMap,
    bridge_state: {
      state: "validated",
      timestamp: new Date().toISOString(),
      source_app: "sottra",
      target_app: "keydraft",
      payload_version: BRIDGE_VERSION,
      outcome: "success",
      warnings: [],
      failure_reason: null,
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function mapReliability(label: string): "high" | "medium" | "low" | "unavailable" {
  const l = label.toLowerCase();
  if (l.includes("buona") || l.includes("alta")) return "high";
  if (l.includes("intermedia") || l.includes("media")) return "medium";
  if (l.includes("contestualizzare") || l.includes("bassa") || l.includes("limitata")) return "low";
  return "unavailable";
}
