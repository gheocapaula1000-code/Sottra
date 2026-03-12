import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock scan services (only active ones)
vi.mock("@/services/scan", () => ({
  identifyBuilding: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { address: "Via Roma 1, Milano", buildingId: "MI-VR1", confidence: 0.95 },
  }),
  getPricing: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { prezzoMq: 4000, prezzoMqMin: 3500, prezzoMqMax: 4800, mediaZona: null, trend5Anni: null },
  }),
}));

// Mock forecast services (only active ones)
vi.mock("@/services/forecast", () => ({
  getTimeView: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { previsione5Anni: 10, previsione10Anni: 22, previsione20Anni: 40, progettiInArrivo: ["Metro M5"] },
  }),
  getOpportunityIndex: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { score: 80, band: "forte", drivers: ["Test driver"], risks: ["Test risk"], observation: "Test observation" },
  }),
  getInfrastrutture: vi.fn().mockResolvedValue({ error: false, message: null, data: { infrastructureScore: 70 } }),
  getRischioZona: vi.fn().mockResolvedValue({ error: false, message: null, data: { scoreRischio: 65 } }),
  getTrendDemografico: vi.fn().mockResolvedValue({ error: false, message: null, data: { etaMedia: 42 } }),
  getSviluppoArea: vi.fn().mockResolvedValue({ error: false, message: null, data: null }),
  getConvergenzaTerritoriale: vi.fn().mockResolvedValue({ error: false, message: null, data: null }),
  getMarketContext: vi.fn().mockResolvedValue({ error: false, message: null, data: { marketConfidence: 78, comparablesSummary: { count: 14 }, sourceType: "elaborated" } }),
}));

import { useBuildingScan } from "@/hooks/useBuildingScan";

describe("useBuildingScan", () => {
  it("starts with idle state and scanning false", () => {
    const { result } = renderHook(() => useBuildingScan());
    expect(result.current.scanning).toBe(false);
    expect(result.current.result.identify.status).toBe("idle");
    expect(result.current.result.pricing.status).toBe("idle");
  });

  it("completes scan and sets scanning to false", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.46, 9.19);
    });

    expect(result.current.scanning).toBe(false);
  });

  it("populates all sections on successful scan", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.46, 9.19);
    });

    expect(result.current.result.identify.status).toBe("success");
    expect(result.current.result.identify.data?.address).toBe("Via Roma 1, Milano");
    expect(result.current.result.pricing.status).toBe("success");
    expect(result.current.result.timeView.status).toBe("success");
    expect(result.current.result.opportunity.status).toBe("success");
  });

  it("resets state correctly", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.46, 9.19);
    });

    expect(result.current.result.identify.status).toBe("success");

    act(() => {
      result.current.reset();
    });

    expect(result.current.scanning).toBe(false);
    expect(result.current.result.identify.status).toBe("idle");
    expect(result.current.result.pricing.status).toBe("idle");
  });
});
