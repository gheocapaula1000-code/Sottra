import { describe, it, expect, vi } from "vitest";

// Mock the API layer so services never hit the network
vi.mock("@/services/api", () => ({
  coreRequest: vi.fn().mockResolvedValue({ address: "Via Test 1", buildingId: "IT-TEST", confidence: 0.9 }),
  isError: (res: unknown) => typeof res === "object" && res !== null && (res as { error?: boolean }).error === true,
}));

import { identifyBuilding, getPricing } from "@/services/scan";
import { getTimeView, getOpportunityIndex, getConvergenzaTerritoriale } from "@/services/forecast";

describe("scan.ts", () => {
  it("identifyBuilding returns data", async () => {
    const res = await identifyBuilding("photo", 41.9, 12.5);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getPricing returns data", async () => {
    const res = await getPricing("Via Roma 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });
});

describe("forecast.ts", () => {
  it("getTimeView returns data", async () => {
    const res = await getTimeView(41.9, 12.5, 12);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getOpportunityIndex returns data", async () => {
    const res = await getOpportunityIndex(41.9, 12.5);
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });

  it("getConvergenzaTerritoriale returns data", async () => {
    const res = await getConvergenzaTerritoriale(41.9, 12.5, 0.85, "Via Test 1");
    expect(res.error).toBe(false);
    expect(res.data).toBeTruthy();
  });
});
