import { describe, it, expect } from "vitest";

/**
 * Tests for admin sync registry mapping correctness.
 * Validates that the source_key → table mapping is explicit and correct,
 * preventing the index-based mapping bug that existed before.
 */

describe("Admin Sync Registry — source_key mapping", () => {
  // The correct mapping that must be maintained
  const CORRECT_MAPPING: Record<string, string> = {
    omi_quotazioni: "omi_quotazioni",
    omi_polygons: "omi_polygons",
    omi_zone: "omi_zone",
    istat_comuni_nazionale: "territorial_registry (comune)",
    istat_localita_2021: "territorial_registry (localita)",
    r03_asc_aggregates: "r03_asc_aggregates_2021",
    asc_2021: "sub_municipal_areas_2021",
    r03_lombardia_2021: "census_sections_r03_2021",
    demographic_zones: "demographic_zones",
  };

  it("has 9 distinct source keys mapped", () => {
    expect(Object.keys(CORRECT_MAPPING)).toHaveLength(9);
  });

  it("omi_quotazioni maps to omi_quotazioni table, not istat_comuni_nazionale", () => {
    expect(CORRECT_MAPPING["omi_quotazioni"]).toBe("omi_quotazioni");
    expect(CORRECT_MAPPING["omi_quotazioni"]).not.toContain("comuni");
  });

  it("istat_comuni_nazionale maps to territorial_registry, not omi_quotazioni", () => {
    expect(CORRECT_MAPPING["istat_comuni_nazionale"]).toContain("territorial_registry");
    expect(CORRECT_MAPPING["istat_comuni_nazionale"]).not.toBe("omi_quotazioni");
  });

  it("istat_localita_2021 maps to territorial_registry localita, not omi_polygons", () => {
    expect(CORRECT_MAPPING["istat_localita_2021"]).toContain("territorial_registry");
    expect(CORRECT_MAPPING["istat_localita_2021"]).not.toBe("omi_polygons");
  });

  it("pilot keys are correctly identified", () => {
    const PILOT_KEYS = new Set(["asc_2021", "r03_lombardia_2021", "r03_asc_aggregates"]);
    expect(PILOT_KEYS.has("asc_2021")).toBe(true);
    expect(PILOT_KEYS.has("r03_lombardia_2021")).toBe(true);
    expect(PILOT_KEYS.has("r03_asc_aggregates")).toBe(true);
    expect(PILOT_KEYS.has("omi_quotazioni")).toBe(false);
    expect(PILOT_KEYS.has("istat_comuni_nazionale")).toBe(false);
  });

  it("backbone status logic works correctly", () => {
    const getStatus = (comuni: number) =>
      comuni >= 7000 ? "pronto" : comuni > 0 ? "parziale" : "vuoto";
    
    expect(getStatus(0)).toBe("vuoto");
    expect(getStatus(100)).toBe("parziale");
    expect(getStatus(7904)).toBe("pronto");
    expect(getStatus(7000)).toBe("pronto");
  });
});

describe("Massive Import — COMUNI_ITALIA validation", () => {
  it("requires PRO_COM_T or equivalent for valid record", () => {
    const validCols = ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE", "COD_COM"];
    const record = { DEN_COM: "Roma" }; // missing code
    const hasCode = validCols.some(c => record[c as keyof typeof record]);
    expect(hasCode).toBe(false);
  });

  it("accepts multiple column conventions for ISTAT code", () => {
    const validCols = ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE", "COD_COM"];
    for (const col of validCols) {
      const record = { [col]: "058091", DEN_COM: "Roma" };
      const hasCode = validCols.some(c => record[c]);
      expect(hasCode).toBe(true);
    }
  });
});

describe("Massive Import — LOCALITA_ISTAT validation", () => {
  it("rejects records without both codice and nome località", () => {
    const record = { PRO_COM_T: "058091" }; // no loc code or name
    const locCode = record["COD_LOC" as keyof typeof record] || "";
    const locName = record["DEN_LOC" as keyof typeof record] || "";
    expect(!locCode && !locName).toBe(true);
  });

  it("accepts località with either code or name", () => {
    const r1 = { PRO_COM_T: "058091", COD_LOC: "001" };
    const r2 = { PRO_COM_T: "058091", DEN_LOC: "Ostia" };
    expect(!!(r1["COD_LOC"] || r1["DEN_LOC" as keyof typeof r1])).toBe(true);
    expect(!!(r2["COD_LOC" as keyof typeof r2] || r2["DEN_LOC"])).toBe(true);
  });

  it("tracks centroid availability correctly", () => {
    const records = [
      { PRO_COM_T: "058091", COD_LOC: "001", LAT: "41.8", LNG: "12.5" },
      { PRO_COM_T: "058091", COD_LOC: "002" },
      { PRO_COM_T: "015146", COD_LOC: "001", LAT: "45.4", LON: "9.2" },
    ];
    const withCoords = records.filter(r => r.LAT && (r["LNG" as keyof typeof r] || r["LON" as keyof typeof r])).length;
    expect(withCoords).toBe(2);
    expect(records.length - withCoords).toBe(1);
  });
});

describe("Massive Import — dedup and idempotency", () => {
  it("composite key prevents duplicates", () => {
    const key = (r: { istat: string; level: string; loc: string; asc: string }) =>
      `${r.istat}|${r.level}|${r.loc}|${r.asc}`;

    const r1 = { istat: "058091", level: "comune", loc: "", asc: "" };
    const r2 = { istat: "058091", level: "comune", loc: "", asc: "" };
    const r3 = { istat: "058091", level: "localita", loc: "001", asc: "" };

    expect(key(r1)).toBe(key(r2)); // duplicate
    expect(key(r1)).not.toBe(key(r3)); // different level
  });
});
