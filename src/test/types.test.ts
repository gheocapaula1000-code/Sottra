import { describe, it, expect } from "vitest";
import {
  mockIdentify,
  mockPricing,
  mockOpportunity,
  mockTrendDemografico,
} from "@/services/mockData";

describe("mockIdentify matches IdentifyResult", () => {
  it("has address (string)", () => {
    expect(typeof mockIdentify.address).toBe("string");
  });
  it("has buildingId (string)", () => {
    expect(typeof mockIdentify.buildingId).toBe("string");
  });
  it("has confidence (number 0-1)", () => {
    expect(mockIdentify.confidence).toBeGreaterThanOrEqual(0);
    expect(mockIdentify.confidence).toBeLessThanOrEqual(1);
  });
});

describe("mockPricing matches PricingData", () => {
  it("has prezzoMq (number)", () => {
    expect(typeof mockPricing.prezzoMq).toBe("number");
  });
  it("accepts mediaZona as null", () => {
    expect(mockPricing.mediaZona).toBeNull();
  });
  it("accepts trend5Anni as null", () => {
    expect(mockPricing.trend5Anni).toBeNull();
  });
});

describe("mockOpportunity matches OpportunityData", () => {
  it("has score (number)", () => {
    expect(typeof mockOpportunity.score).toBe("number");
  });
  it("has band (string)", () => {
    expect(typeof mockOpportunity.band).toBe("string");
  });
  it("has drivers (array)", () => {
    expect(Array.isArray(mockOpportunity.drivers)).toBe(true);
  });
});

describe("mockTrendDemografico — no false zeros", () => {
  it("has etaMedia as number", () => {
    expect(typeof mockTrendDemografico.etaMedia).toBe("number");
  });
  it("null fields are null, not 0", () => {
    const fields: (keyof typeof mockTrendDemografico)[] = [
      "percentualeFamiglie", "percentualeGiovani", "percentualeStranieri",
      "densitaAbitanti", "flussoResidenti12Mesi",
    ];
    for (const f of fields) {
      const v = mockTrendDemografico[f];
      if (v === 0) {
        throw new Error(`Field ${f} is 0 — must be null or a real value, never a false zero`);
      }
    }
  });
  it("has geoLevel set", () => {
    expect(mockTrendDemografico.geoLevel).toBeTruthy();
  });
  it("geoLevel is not 'comune' when geoLabel is a quartiere name", () => {
    if (mockTrendDemografico.geoLabel) {
      expect(mockTrendDemografico.geoLevel).not.toBe("comune");
    }
  });
});
