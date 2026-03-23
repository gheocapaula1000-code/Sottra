import { describe, it, expect } from "vitest";
import { normalizeInfrastrutture, normalizeSviluppoArea } from "@/lib/normalizeForecastContext";

describe("normalizeInfrastrutture", () => {
  it("returns null for falsy input", () => {
    expect(normalizeInfrastrutture(null)).toBeNull();
    expect(normalizeInfrastrutture(undefined)).toBeNull();
  });

  it("uses nested connectivityContext as-is", () => {
    const raw = {
      infrastructureScore: 65,
      connectivityContext: {
        connectivityAvailable: true,
        connectivityLabel: "FTTH 1 Gbps",
        connectivityPrecision: "civico",
      },
    };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.connectivityContext!.connectivityAvailable).toBe(true);
    expect(result.connectivityContext!.connectivityLabel).toBe("FTTH 1 Gbps");
    expect(result.connectivityContext!.connectivityPrecision).toBe("civico");
  });

  it("builds connectivityContext from legacy flat fields", () => {
    const raw = {
      infrastructureScore: 50,
      connectivityLabel: "FTTC 100 Mbps",
      connectivityPrecision: "strada",
    };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.connectivityContext).not.toBeNull();
    expect(result.connectivityContext!.connectivityAvailable).toBe(true);
    expect(result.connectivityContext!.connectivityLabel).toBe("FTTC 100 Mbps");
    expect(result.connectivityContext!.connectivityPrecision).toBe("strada");
  });

  it("does not crash when neither connectivity fields are present", () => {
    const raw = { infrastructureScore: 40 };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.connectivityContext).toBeUndefined();
  });

  it("normalizes nested schoolContext object", () => {
    const raw = {
      infrastructureScore: 55,
      schoolContext: {
        available: true,
        totalSchools: 12,
        byGrado: { primaria: 5, secondaria: 7 },
        gradiPresenti: ["primaria", "secondaria"],
        nearestSchools: [{ denominazione: "Scuola Test", grado: "primaria" }],
        precision: "comune",
      },
    };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.schoolContext).not.toBeNull();
    expect(typeof result.schoolContext).toBe("object");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).available).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).totalSchools).toBe(12);
  });

  it("converts legacy string schoolContext to structured form", () => {
    const raw = {
      infrastructureScore: 45,
      schoolContext: "3 scuole nel raggio di 500m",
    };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.schoolContext).not.toBeNull();
    expect(typeof result.schoolContext).toBe("object");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).available).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).source).toBe("legacy");
  });

  it("returns null schoolContext for null/empty", () => {
    const raw = { infrastructureScore: 40, schoolContext: null };
    const result = normalizeInfrastrutture(raw)!;
    expect(result.schoolContext).toBeNull();
  });
});

describe("normalizeSviluppoArea", () => {
  it("returns null for falsy input", () => {
    expect(normalizeSviluppoArea(null)).toBeNull();
  });

  it("normalizes structured schoolContext", () => {
    const raw = {
      areaDevelopmentScore: 60,
      schoolContext: {
        available: true,
        totalSchools: 8,
        byGrado: { primaria: 3 },
        gradiPresenti: ["primaria"],
        nearestSchools: [],
      },
    };
    const result = normalizeSviluppoArea(raw)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).available).toBe(true);
  });

  it("handles schoolContext.available=false correctly", () => {
    const raw = {
      areaDevelopmentScore: 30,
      schoolContext: {
        available: false,
        totalSchools: 0,
        byGrado: {},
        gradiPresenti: [],
        nearestSchools: [],
      },
    };
    const result = normalizeSviluppoArea(raw)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.schoolContext as any).available).toBe(false);
    // UI should NOT render this — verified in render tests
  });

  it("keeps object schoolContext as object (not coerced to string)", () => {
    const raw = {
      areaDevelopmentScore: 50,
      schoolContext: {
        available: true,
        totalSchools: 5,
        byGrado: { primaria: 5 },
        gradiPresenti: ["primaria"],
        nearestSchools: [],
      },
    };
    const result = normalizeSviluppoArea(raw)!;
    const sc = result.schoolContext;
    // Must be object, never a plain string
    expect(typeof sc).toBe("object");
    expect(sc).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sc as any).available).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sc as any).totalSchools).toBe(5);
  });
});
