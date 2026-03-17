import { describe, it, expect, vi } from "vitest";
import { normalizeMarketContext } from "@/lib/normalizeMarketContext";

describe("normalizeMarketContext", () => {
  it("returns null for falsy input", () => {
    expect(normalizeMarketContext(null)).toBeNull();
    expect(normalizeMarketContext(undefined)).toBeNull();
  });

  it("maps Core comparablesSummary aliases to canonical shape", () => {
    const raw = {
      marketConfidence: 72,
      comparablesSummary: {
        comparablesCount: 14,
        medianPricePerSqm: 3200,
        lowerQuartilePricePerSqm: 2800,
        upperQuartilePricePerSqm: 3600,
      },
      comparableCoverageLevel: "buona",
      sourceType: "elaborated",
    };
    const result = normalizeMarketContext(raw)!;
    expect(result).not.toBeNull();
    expect(result.comparablesSummary!.count).toBe(14);
    expect(result.comparablesSummary!.q1PricePerSqm).toBe(2800);
    expect(result.comparablesSummary!.q3PricePerSqm).toBe(3600);
    expect(result.marketCoverageLevel).toBe("buona");
  });

  it("passes through already-canonical comparablesSummary", () => {
    const raw = {
      comparablesSummary: {
        count: 10,
        q1PricePerSqm: 2000,
        q3PricePerSqm: 3000,
      },
      marketCoverageLevel: "parziale",
    };
    const result = normalizeMarketContext(raw)!;
    expect(result.comparablesSummary!.count).toBe(10);
    expect(result.comparablesSummary!.q1PricePerSqm).toBe(2000);
    expect(result.marketCoverageLevel).toBe("parziale");
  });

  it("converts keyed-object marketSignals to array", () => {
    const raw = {
      marketSignals: {
        sellerPressure: { label: "Pressione venditori", value: 0.7, detail: "Alta" },
        rentalAppeal: { value: "buono" },
      },
    };
    const result = normalizeMarketContext(raw)!;
    expect(Array.isArray(result.marketSignals)).toBe(true);
    expect(result.marketSignals!.length).toBe(2);
    expect(result.marketSignals![0].key).toBe("sellerPressure");
    expect(result.marketSignals![0].label).toBe("Pressione venditori");
    expect(result.marketSignals![1].key).toBe("rentalAppeal");
  });

  it("passes through array marketSignals", () => {
    const raw = {
      marketSignals: [
        { key: "test", label: "Test Signal", value: 42 },
      ],
    };
    const result = normalizeMarketContext(raw)!;
    expect(result.marketSignals!.length).toBe(1);
    expect(result.marketSignals![0].label).toBe("Test Signal");
  });

  it("preserves source metadata", () => {
    const raw = {
      sourceType: "elaborated",
      sourceLabel: "Analisi mercato",
      sourcePeriod: "2024-H2",
      limitations: ["parziale"],
    };
    const result = normalizeMarketContext(raw)!;
    expect(result.sourceType).toBe("elaborated");
    expect(result.sourceLabel).toBe("Analisi mercato");
    expect(result.limitations).toEqual(["parziale"]);
  });

  it("handles empty comparablesSummary gracefully", () => {
    const raw = { comparablesSummary: null };
    const result = normalizeMarketContext(raw)!;
    expect(result.comparablesSummary).toBeNull();
  });

  it("card hidden when sourceType is unavailable", () => {
    const raw = { sourceType: "unavailable" };
    const result = normalizeMarketContext(raw)!;
    expect(result.sourceType).toBe("unavailable");
    // isMarketPublishable would return false — no comparables, no signals
    expect(result.comparablesSummary).toBeNull();
    expect(result.marketSignals).toBeNull();
  });
});

describe("forecast.ts market endpoint", () => {
  it("uses /scan/market endpoint", async () => {
    // Mock api layer
    vi.mock("@/services/api", () => ({
      coreRequest: vi.fn().mockResolvedValue({
        marketConfidence: 78,
        comparablesSummary: { comparablesCount: 14 },
        sourceType: "elaborated",
      }),
      isError: (res: unknown) => typeof res === "object" && res !== null && (res as { error?: boolean }).error === true,
    }));

    const { getMarketContext } = await import("@/services/forecast");
    const { coreRequest } = await import("@/services/api");

    const result = await getMarketContext(41.9, 12.5, "Via Test 1");
    expect(result.error).toBe(false);
    expect(result.data).not.toBeNull();
    // Verify normalized shape
    expect(result.data!.comparablesSummary!.count).toBe(14);
    // Verify correct endpoint was called
    expect(coreRequest).toHaveBeenCalledWith("/scan/market", "POST", expect.any(Object), 25000);
  });
});
