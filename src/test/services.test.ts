import { describe, it, expect, vi, beforeEach } from "vitest";
import { identifyBuilding, getCadastral, getPricing, getListings, getEnergy } from "@/services/scan";
import { getMoodScore, getTimeView, getOpportunityIndex } from "@/services/forecast";

// Mock VITE_USE_MOCK to true so we test the mock paths
vi.stubEnv("VITE_USE_MOCK", "true");

describe("scan.ts (mock mode)", () => {
  it("identifyBuilding returns mock data", async () => {
    const res = await identifyBuilding("base64photo", 41.9, 12.5);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
    expect(res.data).toHaveProperty("address");
  });

  it("getCadastral returns mock data", async () => {
    const res = await getCadastral("Via Roma 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getPricing returns mock data", async () => {
    const res = await getPricing("Via Roma 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getListings returns mock data", async () => {
    const res = await getListings("Via Roma 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getEnergy returns mock data", async () => {
    const res = await getEnergy("Via Roma 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });
});

describe("forecast.ts (mock mode)", () => {
  it("getMoodScore returns mock data", async () => {
    const res = await getMoodScore(41.9, 12.5);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getTimeView returns mock data", async () => {
    const res = await getTimeView(41.9, 12.5, 12);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getOpportunityIndex returns mock data", async () => {
    const res = await getOpportunityIndex(41.9, 12.5);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });
});
