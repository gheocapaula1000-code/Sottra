import { describe, it, expect } from "vitest";
import {
  mockIdentify,
  mockPricing,
  mockOpportunity,
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
