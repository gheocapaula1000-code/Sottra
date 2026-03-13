import { describe, it, expect } from "vitest";
import {
  mockIdentify,
  mockPricing,
  mockOpportunity,
  mockTrendDemografico,
} from "@/services/mockData";
import { isRenderableTrendDemografico, getAvailableDemographicMetricCount } from "@/lib/demographic";
import type { TrendDemograficoData } from "@/types";

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

describe("isRenderableTrendDemografico — real exported helper", () => {
  it("A) null input → false", () => {
    expect(isRenderableTrendDemografico(null)).toBe(false);
  });

  it("A2) undefined input → false", () => {
    expect(isRenderableTrendDemografico(undefined)).toBe(false);
  });

  it("B) unavailable sourceType → false even with metrics", () => {
    const data: TrendDemograficoData = {
      etaMedia: 41, densitaAbitanti: 7800, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      sourceType: "unavailable",
    };
    expect(isRenderableTrendDemografico(data)).toBe(false);
  });

  it("C) etaMedia null but densita exists → true", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: 3200, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      geoLevel: "quartiere", geoLabel: "Arcella",
    };
    expect(isRenderableTrendDemografico(data)).toBe(true);
  });

  it("D) all metrics null → false", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: null, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
    };
    expect(isRenderableTrendDemografico(data)).toBe(false);
  });

  it("E) geoLevel+geoLabel alone NOT enough", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: null, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      geoLevel: "quartiere", geoLabel: "Arcella",
    };
    expect(isRenderableTrendDemografico(data)).toBe(false);
  });

  it("F) single metric (percentualeStranieri) → true", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: null, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: 12.4,
    };
    expect(isRenderableTrendDemografico(data)).toBe(true);
  });

  it("G) comune + flussoResidenti → true", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: null, flussoResidenti12Mesi: 2.4,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      geoLevel: "comune", geoLabel: "Milano",
    };
    expect(isRenderableTrendDemografico(data)).toBe(true);
  });

  it("H) comune + etaMedia → true", () => {
    const data: TrendDemograficoData = {
      etaMedia: 43, densitaAbitanti: null, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      geoLevel: "comune", geoLabel: "Milano",
    };
    expect(isRenderableTrendDemografico(data)).toBe(true);
  });

  it("I) no numeric null field coerced to 0 in mock data", () => {
    const numericFields: (keyof TrendDemograficoData)[] = [
      "etaMedia", "densitaAbitanti", "flussoResidenti12Mesi",
      "percentualeFamiglie", "percentualeGiovani", "percentualeStranieri",
    ];
    for (const f of numericFields) {
      const v = mockTrendDemografico[f];
      if (v === 0) {
        throw new Error(`Mock field ${f} is 0 — must be null or a real value`);
      }
    }
  });
});

describe("getAvailableDemographicMetricCount", () => {
  it("returns 0 for null", () => {
    expect(getAvailableDemographicMetricCount(null)).toBe(0);
  });

  it("counts only non-null metrics", () => {
    const data: TrendDemograficoData = {
      etaMedia: 41, densitaAbitanti: 7800, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
    };
    expect(getAvailableDemographicMetricCount(data)).toBe(2);
  });

  it("does not count geoLevel/geoLabel", () => {
    const data: TrendDemograficoData = {
      etaMedia: null, densitaAbitanti: null, flussoResidenti12Mesi: null,
      percentualeFamiglie: null, percentualeGiovani: null, percentualeStranieri: null,
      geoLevel: "quartiere", geoLabel: "Arcella",
    };
    expect(getAvailableDemographicMetricCount(data)).toBe(0);
  });
});
