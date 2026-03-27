import { describe, it, expect } from "vitest";
import {
  getMacrozoneByRegionCode,
  getMacrozoneByRegionName,
  getMacrozoneLabel,
  getAllMacrozoneCodes,
  getRegionsForMacrozone,
  getRegionCodesForMacrozone,
  isGeoLevelAtLeast,
  finerGeoLevel,
  MACROZONE_DEFINITIONS,
} from "@/lib/macrozoneRegistry";

describe("macrozoneRegistry — region→macrozone mapping", () => {
  it("maps Lombardia to Nord-Ovest by code", () => {
    const match = getMacrozoneByRegionCode("03");
    expect(match).not.toBeNull();
    expect(match!.macrozone_code).toBe("nord_ovest");
    expect(match!.macrozone_label).toBe("Nord-Ovest");
    expect(match!.regione_name).toBe("Lombardia");
  });

  it("maps Sicilia to Isole by code", () => {
    const match = getMacrozoneByRegionCode("19");
    expect(match!.macrozone_code).toBe("isole");
  });

  it("normalizes single-digit region codes", () => {
    const match = getMacrozoneByRegionCode("3");
    expect(match!.macrozone_code).toBe("nord_ovest");
  });

  it("maps by region name case-insensitive", () => {
    const match = getMacrozoneByRegionName("TOSCANA");
    expect(match!.macrozone_code).toBe("centro");
  });

  it("returns null for unknown region", () => {
    expect(getMacrozoneByRegionCode("99")).toBeNull();
    expect(getMacrozoneByRegionName("Atlantide")).toBeNull();
  });

  it("covers all 20 Italian regions", () => {
    const total = MACROZONE_DEFINITIONS.reduce((s, m) => s + m.regioni.length, 0);
    expect(total).toBe(20);
  });

  it("has exactly 5 macrozones", () => {
    expect(getAllMacrozoneCodes()).toHaveLength(5);
  });

  it("getMacrozoneLabel returns correct label", () => {
    expect(getMacrozoneLabel("sud")).toBe("Sud");
  });

  it("getRegionsForMacrozone returns correct regions", () => {
    const regions = getRegionsForMacrozone("nord_est");
    expect(regions).toHaveLength(4);
    expect(regions.map(r => r.nome_regione)).toContain("Veneto");
  });

  it("getRegionCodesForMacrozone returns codes", () => {
    const codes = getRegionCodesForMacrozone("isole");
    expect(codes).toEqual(["19", "20"]);
  });
});

describe("macrozoneRegistry — geographic hierarchy", () => {
  it("sub_comunale is finer than comunale", () => {
    expect(isGeoLevelAtLeast("sub_comunale", "comunale")).toBe(true);
    expect(isGeoLevelAtLeast("comunale", "sub_comunale")).toBe(false);
  });

  it("macrozonale is coarser than regionale", () => {
    expect(isGeoLevelAtLeast("macrozonale", "regionale")).toBe(false);
    expect(isGeoLevelAtLeast("regionale", "macrozonale")).toBe(true);
  });

  it("finerGeoLevel returns the finer one", () => {
    expect(finerGeoLevel("comunale", "macrozonale")).toBe("comunale");
    expect(finerGeoLevel("nazionale", "sub_comunale")).toBe("sub_comunale");
  });

  it("non_determinato is always coarsest", () => {
    expect(isGeoLevelAtLeast("macrozonale", "non_determinato")).toBe(true);
    expect(isGeoLevelAtLeast("non_determinato", "macrozonale")).toBe(false);
  });

  it("sub-municipal data beats macrozone — no replacement", () => {
    // This test validates the core principle: sub-municipal is always preferred
    expect(isGeoLevelAtLeast("sub_comunale", "macrozonale")).toBe(true);
  });

  it("macrozone never replaces comunale data", () => {
    expect(isGeoLevelAtLeast("macrozonale", "comunale")).toBe(false);
  });
});

describe("macrozoneRegistry — no regression on Lombardia pilot", () => {
  it("Lombardia is in Nord-Ovest, not lost", () => {
    const match = getMacrozoneByRegionCode("03");
    expect(match!.regione_name).toBe("Lombardia");
  });
});
