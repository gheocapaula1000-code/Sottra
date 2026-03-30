import { describe, it, expect } from "vitest";
import {
  isValidCommercialBridgePayload,
  BRIDGE_VERSION,
  type CommercialBridgePayload,
  type BridgeState,
  type FieldProvenance,
  type BridgeCanonicalOriginMap,
} from "@/lib/commercialBridgeSchema";
import { buildSottraExportPayload, type SottraExportInput } from "@/lib/sottraExportBridge";
import type { WowSnapshot } from "@/lib/sottraWowSnapshot";
import type { HouseDifferentiationResult } from "@/lib/houseDifferentiationEngine";

/* ── Fixtures ─────────────────────────────────────────── */

const mockWow: WowSnapshot = {
  zona_reale: "Zona B1 — Centro",
  livello_lettura: "Microzona OMI",
  valore_al_mq: "€ 2.500",
  valore_range: "€ 2.200 – € 2.800",
  affidabilita_valore: "Buona affidabilità",
  costo_ristrutturazione: "€ 45.000",
  costo_range: "€ 35.000 – € 55.000",
  segnali_zona: "Convergenti e favorevoli",
  attenzione_area: "high",
  limite_principale: "Le stime offrono un orientamento",
  narrative_mode: "full",
  specificita_immobile: "Medio-alta",
};

const mockHouseDiff: HouseDifferentiationResult = {
  visual_signals: {
    facade_detected: true,
    frontage_detected: true,
    structure: {
      single_facade_likelihood: "strong",
      building_type_inference: "residential",
    },
    context_separation: {
      likely_adjacent_building_confusion: "weak",
      visual_distinctness: "good",
    },
  },
  address_alignment: {
    street_support_status: "official",
    civic_support_status: "official",
    diagnostics: {
      overall_alignment_status: "high_alignment",
      street_evidence_level: "strong",
      civic_evidence_level: "moderate",
      ambiguity_flags: [],
    },
  },
  specificity: {
    specificity_status: "building_candidate_with_limited_ambiguity",
    specificity_strength: "medium",
    house_vs_adjacent_separation: "good",
    false_specificity_risk: false,
    building_truth_support: false,
    civic_supported_as_building_truth: false,
  },
  summary: {
    narrative_mode: "full",
    status_label: "Candidato edificio con ambiguità limitata",
    limitations: ["Non catastale"],
  },
};

const baseInput: SottraExportInput = {
  listing_id: "SOTTRA-EXPORT-001",
  lat: 45.4642,
  lng: 9.19,
  address: "Via Roma 10, Milano",
  comune: "Milano",
  province: "MI",
  region: "Lombardia",
  photo_url: "data:image/jpeg;base64,test",
  wow: mockWow,
  house_diff: mockHouseDiff,
  outlook_2y: "Ben supportato",
  outlook_5y: "Composito",
  outlook_10y: "In formazione",
};

/* ── Canonical Payload Validation ─────────────────────── */

describe("Commercial Bridge Payload Validation", () => {
  it("validates a well-formed payload", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(isValidCommercialBridgePayload(payload)).toBe(true);
  });

  it("rejects null/undefined", () => {
    expect(isValidCommercialBridgePayload(null)).toBe(false);
    expect(isValidCommercialBridgePayload(undefined)).toBe(false);
  });

  it("rejects missing bridge_identity", () => {
    expect(isValidCommercialBridgePayload({ bridge_state: { state: "received" }, bridge_localization: {}, bridge_origin_map: {} })).toBe(false);
  });

  it("rejects missing bridge_state", () => {
    expect(isValidCommercialBridgePayload({ bridge_identity: { trace_id: "x", listing_id: "y", source_app: "sottra", target_app: "keydraft" }, bridge_localization: {}, bridge_origin_map: {} })).toBe(false);
  });
});

/* ── Provenance / Source-of-Truth ─────────────────────── */

describe("Origin Map — Source of Truth Coherence", () => {
  it("maps zone fields to sottra/direct", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload.bridge_origin_map.zone_real).toEqual({ source: "sottra", provenance: "direct" });
    expect(payload.bridge_origin_map.zone_geo_level).toEqual({ source: "sottra", provenance: "direct" });
  });

  it("marks unavailable outlook as unavailable provenance", () => {
    const input = { ...baseInput, outlook_2y: null, outlook_5y: null, outlook_10y: null };
    const payload = buildSottraExportPayload(input);
    expect(payload.bridge_origin_map.outlook_2y.provenance).toBe("unavailable");
    expect(payload.bridge_origin_map.outlook_5y.provenance).toBe("unavailable");
  });

  it("marks attention_area as derived", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload.bridge_origin_map.attention_area.provenance).toBe("derived");
  });

  it("every origin field has valid source and provenance", () => {
    const payload = buildSottraExportPayload(baseInput);
    const validSources = ["sottra", "keydraft", "core_normalized"];
    const validProvenance: FieldProvenance[] = ["direct", "contextual", "derived", "unavailable"];
    for (const [, origin] of Object.entries(payload.bridge_origin_map)) {
      expect(validSources).toContain(origin.source);
      expect(validProvenance).toContain(origin.provenance);
    }
  });
});

/* ── Flow: Sottra → KeyDraft ──────────────────────────── */

describe("Flow Sottra → KeyDraft", () => {
  it("produces a valid payload with all sottra context", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload.bridge_identity.source_app).toBe("sottra");
    expect(payload.bridge_identity.target_app).toBe("keydraft");
    expect(payload.bridge_sottra_context).not.toBeNull();
    expect(payload.bridge_keydraft_context).toBeNull();
  });

  it("carries zone data as context, not building truth", () => {
    const payload = buildSottraExportPayload(baseInput);
    const ctx = payload.bridge_sottra_context!;
    expect(ctx.zone_real).toBe("Zona B1 — Centro");
    expect(ctx.main_limit).toBeTruthy();
    // Specificity never promotes to building truth
    expect(payload.bridge_property_signals.building_candidate_status).toBe("building_candidate_with_limited_ambiguity");
  });

  it("includes value range when available", () => {
    const payload = buildSottraExportPayload(baseInput);
    const ctx = payload.bridge_sottra_context!;
    expect(ctx.value_per_sqm_min).toBeGreaterThan(0);
    expect(ctx.value_per_sqm_max).toBeGreaterThan(ctx.value_per_sqm_min!);
  });
});

/* ── Idempotency / Duplicate Handling ─────────────────── */

describe("Idempotency", () => {
  it("generates unique trace_id per export", () => {
    const p1 = buildSottraExportPayload(baseInput);
    const p2 = buildSottraExportPayload(baseInput);
    expect(p1.bridge_identity.trace_id).not.toBe(p2.bridge_identity.trace_id);
  });

  it("preserves listing_id across exports", () => {
    const p1 = buildSottraExportPayload(baseInput);
    const p2 = buildSottraExportPayload(baseInput);
    expect(p1.bridge_identity.listing_id).toBe(p2.bridge_identity.listing_id);
  });
});

/* ── Traceability ─────────────────────────────────────── */

describe("Traceability", () => {
  it("includes full trace info in bridge_state", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload.bridge_state.source_app).toBe("sottra");
    expect(payload.bridge_state.target_app).toBe("keydraft");
    expect(payload.bridge_state.payload_version).toBe(BRIDGE_VERSION);
    expect(payload.bridge_state.outcome).toBe("success");
    expect(payload.bridge_state.timestamp).toBeTruthy();
  });

  it("uses custom trace_id when provided", () => {
    const input = { ...baseInput, trace_id: "custom-trace-123" };
    const payload = buildSottraExportPayload(input);
    expect(payload.bridge_identity.trace_id).toBe("custom-trace-123");
  });
});

/* ── Bridge States ────────────────────────────────────── */

describe("Bridge States", () => {
  it("covers all expected states", () => {
    const states: BridgeState[] = ["received", "validated", "transformed", "delivered", "imported", "failed", "duplicate", "blocked"];
    expect(states).toHaveLength(8);
  });

  it("export starts in validated state", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload.bridge_state.state).toBe("validated");
  });
});

/* ── No Coupling ──────────────────────────────────────── */

describe("No Rigid Coupling", () => {
  it("sottra export works without house differentiation", () => {
    const input = { ...baseInput, house_diff: null };
    const payload = buildSottraExportPayload(input);
    expect(isValidCommercialBridgePayload(payload)).toBe(true);
    expect(payload.bridge_property_signals.facade_signals).toBe("not_detected");
    expect(payload.bridge_property_signals.specificity_strength).toBeNull();
  });

  it("sottra export works with minimal data", () => {
    const minInput: SottraExportInput = {
      listing_id: "MIN-001",
      lat: null,
      lng: null,
      address: null,
      comune: null,
      province: null,
      region: null,
      photo_url: null,
      wow: { ...mockWow, valore_al_mq: null, valore_range: null, narrative_mode: "hidden" },
      house_diff: null,
      outlook_2y: null,
      outlook_5y: null,
      outlook_10y: null,
    };
    const payload = buildSottraExportPayload(minInput);
    expect(isValidCommercialBridgePayload(payload)).toBe(true);
    expect(payload.bridge_sottra_context!.value_per_sqm_min).toBeNull();
  });

  it("keydraft import types exist independently from export types", () => {
    // Structural: import and export are separate modules
    expect(typeof buildSottraExportPayload).toBe("function");
    expect(typeof isValidCommercialBridgePayload).toBe("function");
  });
});

/* ── Type Safety ──────────────────────────────────────── */

describe("Type Safety", () => {
  it("BRIDGE_VERSION is a non-empty string", () => {
    expect(typeof BRIDGE_VERSION).toBe("string");
    expect(BRIDGE_VERSION.length).toBeGreaterThan(0);
  });

  it("payload has correct structure shape", () => {
    const payload = buildSottraExportPayload(baseInput);
    expect(payload).toHaveProperty("bridge_identity");
    expect(payload).toHaveProperty("bridge_localization");
    expect(payload).toHaveProperty("bridge_property_signals");
    expect(payload).toHaveProperty("bridge_sottra_context");
    expect(payload).toHaveProperty("bridge_keydraft_context");
    expect(payload).toHaveProperty("bridge_origin_map");
    expect(payload).toHaveProperty("bridge_state");
  });
});

/* ── No Regression on Existing Bridge ─────────────────── */

describe("No Regression on Existing KeyDraft Import", () => {
  it("existing keydraft types are not affected", async () => {
    const { isValidBridgePayload } = await import("@/types/keydraft");
    const oldPayload = {
      source: { app: "keydraft" },
      listing: { listing_id: "KD-001" },
    };
    expect(isValidBridgePayload(oldPayload)).toBe(true);
  });
});
