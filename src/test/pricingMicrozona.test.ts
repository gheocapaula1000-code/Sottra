import { describe, it, expect } from "vitest";
import { isPricingPublishable, isPricingMicrozonaOmi } from "@/lib/reportSectionPublishable";
import type { PricingData } from "@/types";

function pricing(over: Partial<PricingData>): PricingData {
  return {
    prezzoMq: 2400,
    prezzoMqMin: 2000,
    prezzoMqMax: 2800,
    mediaZona: 2400,
    trend5Anni: 1.2,
    sourceType: "official_data",
    ...over,
  } as PricingData;
}

describe("Prezzi di Mercato — official OMI microzona only (fail-closed)", () => {
  it("publishes when GPS matched the AdE polygon (microzona)", () => {
    expect(isPricingPublishable(pricing({ polygonMatch: true }))).toBe(true);
    expect(isPricingPublishable(pricing({ polygonMatch: true, omiGeoLevel: "microzona_omi" }))).toBe(true);
    expect(isPricingPublishable(pricing({ omiGeoLevel: "microzona_omi" }))).toBe(true);
    expect(isPricingPublishable(pricing({ omiGeoLevel: "zona_specifica" }))).toBe(true);
    expect(isPricingPublishable(pricing({ omiGeoLevel: "quartiere" }))).toBe(true);
  });

  it("hides when GPS missed the AdE polygon (comunale or unknown)", () => {
    expect(isPricingPublishable(pricing({ omiGeoLevel: "comune" }))).toBe(false);
    expect(isPricingPublishable(pricing({ omiGeoLevel: "comune", polygonMatch: true }))).toBe(false);
    expect(isPricingPublishable(pricing({ omiGeoLevel: "non_determinato" }))).toBe(false);
    expect(isPricingPublishable(pricing({ polygonMatch: false }))).toBe(false);
    expect(isPricingPublishable(pricing({}))).toBe(false);
  });

  it("hides when data is unavailable or missing", () => {
    expect(isPricingPublishable(null)).toBe(false);
    expect(isPricingPublishable(undefined)).toBe(false);
    expect(isPricingPublishable(pricing({ sourceType: "unavailable" }))).toBe(false);
    expect(isPricingPublishable({ ...pricing({ polygonMatch: true }), prezzoMq: null as unknown as number })).toBe(false);
  });

  it("isPricingMicrozonaOmi never treats municipal data as microzona", () => {
    expect(isPricingMicrozonaOmi(pricing({ omiGeoLevel: "comune" }))).toBe(false);
    expect(isPricingMicrozonaOmi(pricing({ polygonMatch: true }))).toBe(true);
  });
});
