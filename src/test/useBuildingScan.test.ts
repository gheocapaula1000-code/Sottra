import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock all scan services
vi.mock("@/services/scan", () => ({
  identifyBuilding: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { address: "Via Roma 1, Milano", buildingId: "MI-VR1", confidence: 0.95 },
  }),
  getCadastral: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { foglio: 100, particella: 50, subalterno: 1, anno: 1970, piani: 5, unitaImmobiliari: 20, renditaCatastale: 1500 },
  }),
  getPricing: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { prezzoMq: 4000, prezzoMqMin: 3500, prezzoMqMax: 4800, mediaZona: 3900, trend5Anni: 12 },
  }),
  getListings: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { annunci: [{ tipo: "vendita", prezzo: 300000, mq: 70, locali: 3, piano: 3, link: "#" }] },
  }),
  getEnergy: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { classeEnergetica: "C", epgl: 120, mediaZona: "D" },
  }),
}));

// Mock all forecast services
vi.mock("@/services/forecast", () => ({
  getMoodScore: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { score: 75, trend: "stabile", categorie: { commercio: 80, trasporti: 70 } },
  }),
  getTimeView: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { previsione5Anni: 10, previsione10Anni: 22, previsione20Anni: 40, progettiInArrivo: ["Metro M5"] },
  }),
  getOpportunityIndex: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { indice: 80, quadrante: "Stella Nascente", raccomandazione: "Zona in crescita" },
  }),
}));

import { useBuildingScan } from "@/hooks/useBuildingScan";

describe("useBuildingScan", () => {
  it("starts with idle state and scanning false", () => {
    const { result } = renderHook(() => useBuildingScan());
    expect(result.current.scanning).toBe(false);
    expect(result.current.result.identify.status).toBe("idle");
    expect(result.current.result.moodScore.status).toBe("idle");
  });

  it("sets scanning to true during scan", async () => {
    const { result } = renderHook(() => useBuildingScan());

    act(() => {
      result.current.scan("base64photo", 45.46, 9.19);
    });

    expect(result.current.scanning).toBe(true);

    await waitFor(() => {
      expect(result.current.scanning).toBe(false);
    });
  });

  it("populates all sections on successful scan", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.46, 9.19);
    });

    expect(result.current.result.identify.status).toBe("success");
    expect(result.current.result.identify.data?.address).toBe("Via Roma 1, Milano");
    expect(result.current.result.cadastral.status).toBe("success");
    expect(result.current.result.pricing.status).toBe("success");
    expect(result.current.result.listings.status).toBe("success");
    expect(result.current.result.energy.status).toBe("success");
    expect(result.current.result.moodScore.status).toBe("success");
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
    expect(result.current.result.moodScore.status).toBe("idle");
  });
});
