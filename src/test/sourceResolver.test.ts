import { describe, it, expect } from "vitest";
import {
  resolveBestSource,
  mapSourceTypeToTier,
  mapTierToLabel,
  mapCoverageLevelToGeoLevel,
  isGeoLevelCompatible,
  canUseSecondarySource,
  normalizeToCandidate,
  filterByFlags,
  formatResolutionTrace,
  resolutionSummary,
  type SourceCandidate,
  type SecondarySourceFlags,
} from "@/lib/sourceResolver";

/* ── mapSourceTypeToTier ─────────────────────────────────── */

describe("mapSourceTypeToTier", () => {
  it("maps official → ufficiale", () => {
    expect(mapSourceTypeToTier("official")).toBe("ufficiale");
  });

  it("maps commercial_verified → mercato_verificato", () => {
    expect(mapSourceTypeToTier("commercial_verified")).toBe("mercato_verificato");
  });

  it("maps commercial_partial → mercato_parziale", () => {
    expect(mapSourceTypeToTier("commercial_partial")).toBe("mercato_parziale");
  });

  it("maps elaborated → dato_elaborato", () => {
    expect(mapSourceTypeToTier("elaborated")).toBe("dato_elaborato");
  });

  it("maps estimate → dato_elaborato", () => {
    expect(mapSourceTypeToTier("estimate")).toBe("dato_elaborato");
  });

  it("maps unavailable → unavailable", () => {
    expect(mapSourceTypeToTier("unavailable")).toBe("unavailable");
  });

  it("maps unknown/undefined → dato_elaborato (safe default)", () => {
    expect(mapSourceTypeToTier(undefined)).toBe("dato_elaborato");
    expect(mapSourceTypeToTier("something_new")).toBe("dato_elaborato");
  });
});

/* ── mapTierToLabel ──────────────────────────────────────── */

describe("mapTierToLabel", () => {
  it("returns Italian labels for all tiers", () => {
    expect(mapTierToLabel("ufficiale")).toBe("Dato ufficiale");
    expect(mapTierToLabel("mercato_verificato")).toBe("Fonte di mercato verificata");
    expect(mapTierToLabel("mercato_parziale")).toBe("Copertura di mercato parziale");
    expect(mapTierToLabel("dato_elaborato")).toBe("Dato elaborato");
    expect(mapTierToLabel("unavailable")).toBe("Non disponibile");
  });
});

/* ── mapCoverageLevelToGeoLevel ──────────────────────────── */

describe("mapCoverageLevelToGeoLevel", () => {
  it("maps address → microzona_omi", () => {
    expect(mapCoverageLevelToGeoLevel("address")).toBe("microzona_omi");
  });

  it("maps zone_omi → microzona_omi", () => {
    expect(mapCoverageLevelToGeoLevel("zone_omi")).toBe("microzona_omi");
  });

  it("maps comune → comune", () => {
    expect(mapCoverageLevelToGeoLevel("comune")).toBe("comune");
  });

  it("maps provincia → comune (safety downgrade)", () => {
    expect(mapCoverageLevelToGeoLevel("provincia")).toBe("comune");
  });

  it("maps unknown → non_determinato", () => {
    expect(mapCoverageLevelToGeoLevel("unknown")).toBe("non_determinato");
    expect(mapCoverageLevelToGeoLevel(undefined)).toBe("non_determinato");
  });
});

/* ── isGeoLevelCompatible ────────────────────────────────── */

describe("isGeoLevelCompatible", () => {
  it("microzona_omi is compatible with any requirement", () => {
    expect(isGeoLevelCompatible("microzona_omi", "comune")).toBe(true);
    expect(isGeoLevelCompatible("microzona_omi", "microzona_omi")).toBe(true);
  });

  it("comune is NOT compatible with microzona_omi requirement", () => {
    expect(isGeoLevelCompatible("comune", "microzona_omi")).toBe(false);
  });

  it("comune is compatible with comune requirement", () => {
    expect(isGeoLevelCompatible("comune", "comune")).toBe(true);
  });

  it("non_determinato is only compatible with non_determinato", () => {
    expect(isGeoLevelCompatible("non_determinato", "non_determinato")).toBe(true);
    expect(isGeoLevelCompatible("non_determinato", "comune")).toBe(false);
  });
});

/* ── canUseSecondarySource ───────────────────────────────── */

describe("canUseSecondarySource", () => {
  it("rejects null data", () => {
    const c: SourceCandidate = { data: null, tier: "mercato_verificato", geoLevel: "comune", isOfficial: false };
    expect(canUseSecondarySource(c, "comune")).toBe(false);
  });

  it("rejects official sources (they are primary, not secondary)", () => {
    const c: SourceCandidate = { data: { x: 1 }, tier: "ufficiale", geoLevel: "comune", isOfficial: true };
    expect(canUseSecondarySource(c, "comune")).toBe(false);
  });

  it("rejects secondary source that overclaims geo precision", () => {
    const c: SourceCandidate = { data: { x: 1 }, tier: "mercato_verificato", geoLevel: "microzona_omi", isOfficial: false };
    // Official only has comune, secondary claims microzona → overclaim
    expect(canUseSecondarySource(c, "comune")).toBe(false);
  });

  it("accepts secondary source at same or coarser geo level", () => {
    const c: SourceCandidate = { data: { x: 1 }, tier: "mercato_verificato", geoLevel: "comune", isOfficial: false };
    expect(canUseSecondarySource(c, "comune")).toBe(true);
    expect(canUseSecondarySource(c, "microzona_omi")).toBe(true);
  });
});

/* ── resolveBestSource — core resolution logic ───────────── */

describe("resolveBestSource", () => {
  it("official always wins when available", () => {
    const candidates: SourceCandidate<number>[] = [
      { data: 100, tier: "mercato_verificato", geoLevel: "microzona_omi", isOfficial: false, provider: "market" },
      { data: 200, tier: "ufficiale", geoLevel: "comune", isOfficial: true, provider: "omi" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe(200);
    expect(result.tier).toBe("ufficiale");
    expect(result.isOfficial).toBe(true);
  });

  it("falls back to mercato_verificato when official is absent", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: null, tier: "ufficiale", geoLevel: "comune", isOfficial: true, provider: "omi" },
      { data: "market_val", tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "immobiliare" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe("market_val");
    expect(result.tier).toBe("mercato_verificato");
    expect(result.isOfficial).toBe(false);
  });

  it("respects tier priority: mercato_verificato > mercato_parziale > dato_elaborato", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "elaborated", tier: "dato_elaborato", geoLevel: "comune", isOfficial: false, provider: "algo" },
      { data: "partial", tier: "mercato_parziale", geoLevel: "comune", isOfficial: false, provider: "scraper" },
      { data: "verified", tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "market" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe("verified");
    expect(result.tier).toBe("mercato_verificato");
  });

  it("rejects geo-incompatible non-official candidates when requiredMinGeo is set", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "too_coarse", tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "a" },
      { data: "fine", tier: "mercato_parziale", geoLevel: "microzona_omi", isOfficial: false, provider: "b" },
    ];
    const result = resolveBestSource(candidates, "quartiere");
    // "comune" is coarser than "quartiere", so rejected
    expect(result.data).toBe("fine");
    expect(result.tier).toBe("mercato_parziale");
  });

  it("official bypasses geo compatibility check", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "official_comune", tier: "ufficiale", geoLevel: "comune", isOfficial: true, provider: "omi" },
    ];
    const result = resolveBestSource(candidates, "microzona_omi");
    // Official wins even though geo is coarser than required
    expect(result.data).toBe("official_comune");
    expect(result.tier).toBe("ufficiale");
  });

  it("returns unavailable when all candidates are null", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: null, tier: "ufficiale", geoLevel: "comune", isOfficial: true, provider: "omi" },
      { data: null, tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "market" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBeNull();
    expect(result.tier).toBe("unavailable");
  });

  it("returns unavailable for empty candidate list", () => {
    const result = resolveBestSource([]);
    expect(result.tier).toBe("unavailable");
    expect(result.data).toBeNull();
  });

  it("secondary source NEVER overrides valid official source", () => {
    const candidates: SourceCandidate<number>[] = [
      { data: 1500, tier: "ufficiale", geoLevel: "microzona_omi", isOfficial: true, provider: "omi" },
      { data: 9999, tier: "mercato_verificato", geoLevel: "microzona_omi", confidence: 0.99, isOfficial: false, provider: "premium_market" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe(1500);
    expect(result.isOfficial).toBe(true);
  });

  it("among same tier, finer geo wins", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "comunale", tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "a" },
      { data: "micro", tier: "mercato_verificato", geoLevel: "microzona_omi", isOfficial: false, provider: "b" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe("micro");
    expect(result.geoLevel).toBe("microzona_omi");
  });

  it("among same tier+geo, higher confidence wins", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "low", tier: "mercato_verificato", geoLevel: "comune", confidence: 0.3, isOfficial: false, provider: "a" },
      { data: "high", tier: "mercato_verificato", geoLevel: "comune", confidence: 0.9, isOfficial: false, provider: "b" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.data).toBe("high");
  });

  it("populates resolutionTrace correctly", () => {
    const candidates: SourceCandidate<number>[] = [
      { data: null, tier: "ufficiale", geoLevel: "comune", isOfficial: true, provider: "omi" },
      { data: 42, tier: "dato_elaborato", geoLevel: "comune", isOfficial: false, provider: "algo" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.resolutionTrace).toHaveLength(2);
    const omiTrace = result.resolutionTrace.find(t => t.provider === "omi");
    expect(omiTrace?.accepted).toBe(false);
    expect(omiTrace?.reason).toBe("no_data");
    const algoTrace = result.resolutionTrace.find(t => t.provider === "algo");
    expect(algoTrace?.accepted).toBe(true);
  });
});

/* ── normalizeToCandidate ────────────────────────────────── */

describe("normalizeToCandidate", () => {
  it("converts SourceMetadata to candidate correctly", () => {
    const c = normalizeToCandidate(
      { price: 1500 },
      { sourceType: "official", sourceCoverageLevel: "zone_omi", sourceConfidence: 0.95 },
      "omi",
    );
    expect(c.tier).toBe("ufficiale");
    expect(c.geoLevel).toBe("microzona_omi");
    expect(c.isOfficial).toBe(true);
    expect(c.confidence).toBe(0.95);
  });

  it("handles null data", () => {
    const c = normalizeToCandidate(null, { sourceType: "unavailable" });
    expect(c.data).toBeNull();
    expect(c.tier).toBe("unavailable");
    expect(c.isOfficial).toBe(false);
  });

  it("handles missing metadata", () => {
    const c = normalizeToCandidate({ v: 1 });
    expect(c.tier).toBe("dato_elaborato");
    expect(c.geoLevel).toBe("non_determinato");
    expect(c.isOfficial).toBe(false);
  });
});

/* ── filterByFlags ───────────────────────────────────────── */

describe("filterByFlags", () => {
  const official: SourceCandidate = { data: 1, tier: "ufficiale", geoLevel: "comune", isOfficial: true };
  const market: SourceCandidate = { data: 2, tier: "mercato_verificato", geoLevel: "comune", isOfficial: false };
  const partial: SourceCandidate = { data: 3, tier: "mercato_parziale", geoLevel: "comune", isOfficial: false };
  const elab: SourceCandidate = { data: 4, tier: "dato_elaborato", geoLevel: "comune", isOfficial: false };

  it("passes all through with default flags", () => {
    const result = filterByFlags([official, market, partial, elab]);
    expect(result).toHaveLength(4);
  });

  it("official always passes regardless of flags", () => {
    const allOff: SecondarySourceFlags = {
      enableMarketVerified: false,
      enableMarketPartial: false,
      enableElaborated: false,
    };
    const result = filterByFlags([official, market, partial, elab], allOff);
    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe("ufficiale");
  });

  it("selectively disables tiers", () => {
    const flags: SecondarySourceFlags = {
      enableMarketVerified: true,
      enableMarketPartial: false,
      enableElaborated: true,
    };
    const result = filterByFlags([official, market, partial, elab], flags);
    expect(result).toHaveLength(3);
    expect(result.some(c => c.tier === "mercato_parziale")).toBe(false);
  });
});

/* ── Diagnostic helpers ──────────────────────────────────── */

describe("formatResolutionTrace", () => {
  it("formats trace entries", () => {
    const trace = [
      { provider: "omi", tier: "ufficiale" as const, geoLevel: "comune" as const, accepted: false, reason: "no_data" },
      { provider: "market", tier: "mercato_verificato" as const, geoLevel: "comune" as const, accepted: true, reason: "selected" },
    ];
    const formatted = formatResolutionTrace(trace);
    expect(formatted).toContain("[omi]");
    expect(formatted).toContain("SKIP: no_data");
    expect(formatted).toContain("[market]");
    expect(formatted).toContain("selected");
  });
});

describe("resolutionSummary", () => {
  it("returns unavailable message for no source", () => {
    const summary = resolutionSummary({
      data: null, tier: "unavailable", geoLevel: "non_determinato",
      isOfficial: false, sourceLabel: "Non disponibile", resolutionTrace: [],
    });
    expect(summary).toBe("Nessuna fonte disponibile");
  });

  it("includes geo note for municipal level", () => {
    const summary = resolutionSummary({
      data: 1, tier: "ufficiale", geoLevel: "comune",
      isOfficial: true, sourceLabel: "Dato ufficiale", resolutionTrace: [],
    });
    expect(summary).toContain("comunale");
    expect(summary).toContain("ufficiale");
  });

  it("no geo note for fine-grained levels", () => {
    const summary = resolutionSummary({
      data: 1, tier: "mercato_verificato", geoLevel: "microzona_omi",
      isOfficial: false, sourceLabel: "Fonte di mercato verificata", resolutionTrace: [],
    });
    expect(summary).not.toContain("comunale");
    expect(summary).toContain("non ufficiale");
  });
});

/* ── Non-regression: no fake data, no overclaim ──────────── */

describe("Non-regression: no overclaim", () => {
  it("mercato_parziale is labeled correctly (prudent UI)", () => {
    expect(mapTierToLabel("mercato_parziale")).toBe("Copertura di mercato parziale");
  });

  it("dato_elaborato is labeled as elaboration, not official", () => {
    expect(mapTierToLabel("dato_elaborato")).toBe("Dato elaborato");
    expect(mapTierToLabel("dato_elaborato")).not.toContain("ufficiale");
  });

  it("no source resolution produces fake official data", () => {
    const candidates: SourceCandidate<string>[] = [
      { data: "market", tier: "mercato_verificato", geoLevel: "comune", isOfficial: false, provider: "x" },
    ];
    const result = resolveBestSource(candidates);
    expect(result.isOfficial).toBe(false);
    expect(result.tier).not.toBe("ufficiale");
  });
});
