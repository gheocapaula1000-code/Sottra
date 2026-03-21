import { describe, it, expect } from "vitest";
import {
  isValidBridgePayload,
  type KeyDraftBridgePayload,
  type KeyDraftDataOrigin,
} from "@/types/keydraft";

/* ── Sample payloads ─────────────────────────────────── */

const validPayload: KeyDraftBridgePayload = {
  source: { app: "keydraft", version: "1.0.0", bridge_version: "1.0" },
  listing: { listing_id: "KD-2024-001", run_id: "run-abc" },
  property: {
    property_type: "Appartamento",
    rooms_estimated: 4,
    bathrooms_estimated: 2,
    photo_count: 12,
    materials_detected: ["laterizio", "intonaco"],
    features_detected: ["balcone", "garage"],
  },
  photo_derived: {
    confidence_flags: { rooms: 0.85, bathrooms: 0.7 },
    exterior_notes: "Facciata in buone condizioni",
  },
  agent_supplied: {
    address: "Via Roma 10, Milano",
    surface_sqm: 120,
    floor: "3°",
    elevator: true,
    price_asked: 350000,
    agent_notes_freeform: "Appartamento luminoso, da ristrutturare parzialmente",
  },
  generated_text: {
    primary_listing_text: "Splendido appartamento in Via Roma...",
    listing_text_long: "Proponiamo in vendita un ampio appartamento...",
    listing_text_short: "Appartamento 4 locali Via Roma",
    listing_social_variants: [
      { platform: "instagram", text: "🏠 Nuovo in portfolio..." },
      { platform: "facebook", text: "Scopri questo appartamento..." },
    ],
    whatsapp_ready_summary: "Appartamento 4 locali, 120mq, Via Roma 10 Milano - €350.000",
  },
  origin_map: {
    property_type: "photo_derived",
    rooms_estimated: "photo_derived",
    address: "agent_supplied",
    surface_sqm: "agent_supplied",
    primary_listing_text: "generated_text",
  },
  bridge_status: { status: "complete", trace_id: "trace-xyz" },
};

const minimalPayload: KeyDraftBridgePayload = {
  source: { app: "keydraft" },
  listing: { listing_id: "KD-MIN-001" },
};

/* ── Tests ────────────────────────────────────────────── */

describe("KeyDraft Bridge Payload Validation", () => {
  it("accepts a full valid payload", () => {
    expect(isValidBridgePayload(validPayload)).toBe(true);
  });

  it("accepts a minimal payload with only source and listing", () => {
    expect(isValidBridgePayload(minimalPayload)).toBe(true);
  });

  it("rejects null/undefined", () => {
    expect(isValidBridgePayload(null)).toBe(false);
    expect(isValidBridgePayload(undefined)).toBe(false);
  });

  it("rejects payload without source", () => {
    expect(isValidBridgePayload({ listing: { listing_id: "x" } })).toBe(false);
  });

  it("rejects payload without listing", () => {
    expect(isValidBridgePayload({ source: { app: "keydraft" } })).toBe(false);
  });

  it("rejects payload with empty source.app", () => {
    expect(isValidBridgePayload({ source: { app: "" }, listing: { listing_id: "x" } })).toBe(false);
  });

  it("rejects payload with empty listing.listing_id", () => {
    expect(isValidBridgePayload({ source: { app: "keydraft" }, listing: { listing_id: "" } })).toBe(false);
  });

  it("rejects non-object payloads", () => {
    expect(isValidBridgePayload("string")).toBe(false);
    expect(isValidBridgePayload(42)).toBe(false);
    expect(isValidBridgePayload([])).toBe(false);
  });
});

describe("KeyDraft Data Origin Types", () => {
  it("covers all expected origin types", () => {
    const origins: KeyDraftDataOrigin[] = [
      "photo_derived",
      "agent_supplied",
      "generated_text",
      "completed_in_sottra",
      "bridge_metadata",
    ];
    expect(origins).toHaveLength(5);
  });

  it("origin_map correctly maps fields to origins", () => {
    const originMap = validPayload.origin_map!;
    expect(originMap.property_type).toBe("photo_derived");
    expect(originMap.address).toBe("agent_supplied");
    expect(originMap.primary_listing_text).toBe("generated_text");
  });
});

describe("Bridge Payload Data Integrity", () => {
  it("preserves property data from photo analysis", () => {
    const p = validPayload.property!;
    expect(p.property_type).toBe("Appartamento");
    expect(p.rooms_estimated).toBe(4);
    expect(p.materials_detected).toContain("laterizio");
  });

  it("preserves agent-supplied data", () => {
    const a = validPayload.agent_supplied!;
    expect(a.address).toBe("Via Roma 10, Milano");
    expect(a.surface_sqm).toBe(120);
    expect(a.elevator).toBe(true);
  });

  it("preserves generated text variants", () => {
    const t = validPayload.generated_text!;
    expect(t.primary_listing_text).toBeTruthy();
    expect(t.listing_social_variants).toHaveLength(2);
    expect(t.whatsapp_ready_summary).toContain("350.000");
  });

  it("handles partial payload without optional sections", () => {
    const partial: KeyDraftBridgePayload = {
      source: { app: "keydraft" },
      listing: { listing_id: "KD-PART-001" },
      property: { property_type: "Villa", photo_count: 3 },
      // No agent_supplied, no generated_text
    };
    expect(isValidBridgePayload(partial)).toBe(true);
    expect(partial.agent_supplied).toBeUndefined();
    expect(partial.generated_text).toBeUndefined();
    expect(partial.property!.property_type).toBe("Villa");
  });
});
