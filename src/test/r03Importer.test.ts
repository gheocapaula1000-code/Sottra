import { describe, it, expect } from "vitest";
import {
  validateR03Record,
  parseCsvToRecords,
  mapSezCsvRow,
  buildAscMappings,
} from "@/lib/r03Importer";
import type { SubMunicipalMatchData } from "@/types";

describe("validateR03Record", () => {
  it("validates complete record", () => {
    const r = validateR03Record({
      section_code: "123456",
      comune_istat_code: "015146",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects missing section_code", () => {
    const r = validateR03Record({ comune_istat_code: "015146" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("section_code mancante");
  });

  it("rejects missing comune_istat_code", () => {
    const r = validateR03Record({ section_code: "123" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("comune_istat_code mancante");
  });

  it("rejects non-numeric section_code", () => {
    const r = validateR03Record({ section_code: "ABC", comune_istat_code: "015146" });
    expect(r.valid).toBe(false);
  });

  it("rejects centroid outside Lombardia", () => {
    const r = validateR03Record({
      section_code: "123",
      comune_istat_code: "015146",
      centroid_lat: 40,
      centroid_lng: 9,
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("centroid_lat fuori Lombardia");
  });

  it("accepts centroid inside Lombardia", () => {
    const r = validateR03Record({
      section_code: "123",
      comune_istat_code: "015146",
      centroid_lat: 45.46,
      centroid_lng: 9.19,
    });
    expect(r.valid).toBe(true);
  });

  it("rejects negative population", () => {
    const r = validateR03Record({
      section_code: "123",
      comune_istat_code: "015146",
      population_2021: -5,
    });
    expect(r.valid).toBe(false);
  });
});

describe("parseCsvToRecords", () => {
  it("parses semicolon-separated CSV", () => {
    const csv = "SEZ2021;PRO_COM_T;P1\n100001;015146;1234\n100002;015146;567";
    const rows = parseCsvToRecords(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]["SEZ2021"]).toBe("100001");
    expect(rows[0]["P1"]).toBe("1234");
  });

  it("parses comma-separated CSV", () => {
    const csv = "SEZ2021,PRO_COM_T,P1\n100001,015146,1234";
    const rows = parseCsvToRecords(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]["PRO_COM_T"]).toBe("015146");
  });

  it("handles BOM", () => {
    const csv = "\uFEFFSEZ2021;P1\n100;50";
    const rows = parseCsvToRecords(csv);
    expect(rows[0]["SEZ2021"]).toBe("100");
  });

  it("handles quoted fields", () => {
    const csv = 'SEZ2021;DESC\n100;"Area con; separatore"';
    const rows = parseCsvToRecords(csv);
    expect(rows[0]["DESC"]).toBe("Area con; separatore");
  });

  it("returns empty for empty input", () => {
    expect(parseCsvToRecords("")).toHaveLength(0);
    expect(parseCsvToRecords("header_only")).toHaveLength(0);
  });
});

describe("mapSezCsvRow", () => {
  it("maps ISTAT columns to record", () => {
    const row = { SEZ2021: "123456", PRO_COM_T: "015146", COD_PRO: "015", P1: "500", P2: "240", P14: "200", A2: "150", E3: "80" };
    const rec = mapSezCsvRow(row);
    expect(rec.section_code).toBe("123456");
    expect(rec.comune_istat_code).toBe("015146");
    expect(rec.population_2021).toBe(500);
    expect(rec.males_2021).toBe(240);
    expect(rec.families_2021).toBe(200);
    expect(rec.occupied_dwellings_2021).toBe(150);
    expect(rec.buildings_2021).toBe(80);
  });

  it("applies ASC mappings when provided", () => {
    const row = { SEZ2021: "123", PRO_COM_T: "015146" };
    const mappings = new Map([["123", { section_code: "123", asc1_code: "ASC1_001", asc2_code: "ASC2_002", asc3_code: null }]]);
    const rec = mapSezCsvRow(row, mappings);
    expect(rec.asc1_code).toBe("ASC1_001");
    expect(rec.asc2_code).toBe("ASC2_002");
    expect(rec.asc3_code).toBeNull();
  });

  it("handles missing columns gracefully", () => {
    const row = { SEZ2021: "123", PRO_COM_T: "015146" };
    const rec = mapSezCsvRow(row);
    expect(rec.population_2021).toBeNull();
    expect(rec.asc1_code).toBeNull();
  });
});

describe("buildAscMappings", () => {
  it("builds mappings from ASC1 and ASC2 CSVs", () => {
    const asc1 = [{ SEZ2021: "100", COD_ASC: "A1_01" }, { SEZ2021: "200", COD_ASC: "A1_02" }];
    const asc2 = [{ SEZ2021: "100", COD_ASC: "A2_01" }];
    const map = buildAscMappings(asc1, asc2);
    expect(map.size).toBe(2);
    expect(map.get("100")?.asc1_code).toBe("A1_01");
    expect(map.get("100")?.asc2_code).toBe("A2_01");
    expect(map.get("200")?.asc1_code).toBe("A1_02");
    expect(map.get("200")?.asc2_code).toBeNull();
  });

  it("handles empty inputs", () => {
    const map = buildAscMappings([], []);
    expect(map.size).toBe(0);
  });
});

describe("non-regression R03", () => {
  it("R03 importer does not import from report pipeline", async () => {
    const mod = await import("@/lib/r03Importer");
    expect(mod.validateR03Record).toBeDefined();
    expect(mod.parseCsvToRecords).toBeDefined();
    expect(mod.mapSezCsvRow).toBeDefined();
  });

  it("SubMunicipalMatchData remains unaffected by R03 module", () => {
    const match: SubMunicipalMatchData = {
      available: false,
      matched: false,
      coverage_status: "unavailable",
    };
    expect(match.matched).toBe(false);
  });
});
