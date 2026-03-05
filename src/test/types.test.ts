import { describe, it, expect } from "vitest";
import {
  mockIdentify,
  mockCadastral,
  mockMoodScore,
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

describe("mockCadastral matches CadastralData", () => {
  it("has foglio (number)", () => {
    expect(typeof mockCadastral.foglio).toBe("number");
  });
  it("has particella (number)", () => {
    expect(typeof mockCadastral.particella).toBe("number");
  });
  it("has anno (number)", () => {
    expect(typeof mockCadastral.anno).toBe("number");
  });
  it("has piani (number)", () => {
    expect(typeof mockCadastral.piani).toBe("number");
  });
});

describe("mockMoodScore matches MoodScoreData", () => {
  it("has score (number)", () => {
    expect(typeof mockMoodScore.score).toBe("number");
  });
  it("has trend (string)", () => {
    expect(typeof mockMoodScore.trend).toBe("string");
  });
  it("has categorie (object with numeric values)", () => {
    expect(typeof mockMoodScore.categorie).toBe("object");
    Object.values(mockMoodScore.categorie).forEach((v) => {
      expect(typeof v).toBe("number");
    });
  });
});

describe("mockOpportunity matches OpportunityData", () => {
  it("has indice (number)", () => {
    expect(typeof mockOpportunity.indice).toBe("number");
  });
  it("has quadrante (string)", () => {
    expect(typeof mockOpportunity.quadrante).toBe("string");
  });
  it("has raccomandazione (string)", () => {
    expect(typeof mockOpportunity.raccomandazione).toBe("string");
  });
  it("quadrante is one of 4 valid values", () => {
    const valid = ["Stella Nascente", "Diamante Grezzo", "Picco Raggiunto", "Allerta Rossa"];
    expect(valid).toContain(mockOpportunity.quadrante);
  });
});
