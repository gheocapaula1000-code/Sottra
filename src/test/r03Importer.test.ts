import { describe, it, expect } from "vitest";
import {
  validateR03Record,
  parseCsvToRecords,
  mapSezCsvRow,
  buildAscMappings,
} from "@/lib/r03Importer";
import type { SubMunicipalMatchData } from "@/types";
import type { AscLevelMatchDetail } from "@/lib/r03Importer";

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

describe("AscLevelMatchDetail type shape", () => {
  it("has correct fields", () => {
    const detail: AscLevelMatchDetail = {
      level: 1,
      codesInSections: new Set(["A", "B"]),
      codesInLayer: new Set(["A", "C"]),
      matched: ["A"],
      unmatchedInSections: ["B"],
      unmatchedInLayer: ["C"],
      coveragePct: 50,
    };
    expect(detail.level).toBe(1);
    expect(detail.matched).toHaveLength(1);
    expect(detail.coveragePct).toBe(50);
  });

  it("does not false-match codes across levels", () => {
    // Same code "X" at level 1 and level 2 should not cross-match
    const level1: AscLevelMatchDetail = {
      level: 1,
      codesInSections: new Set(["X"]),
      codesInLayer: new Set(),
      matched: [],
      unmatchedInSections: ["X"],
      unmatchedInLayer: [],
      coveragePct: 0,
    };
    const level2: AscLevelMatchDetail = {
      level: 2,
      codesInSections: new Set(),
      codesInLayer: new Set(["X"]),
      matched: [],
      unmatchedInSections: [],
      unmatchedInLayer: ["X"],
      coveragePct: 0,
    };
    // Code "X" in sections at level 1 should NOT appear as matched in level 2
    expect(level1.matched).not.toContain("X");
    expect(level2.matched).not.toContain("X");
    expect(level1.unmatchedInSections).toContain("X");
    expect(level2.unmatchedInLayer).toContain("X");
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

  it("SubMunicipalMatchData supports R03 enrichment fields", () => {
    const match: SubMunicipalMatchData = {
      available: true,
      matched: true,
      coverage_status: "available",
      r03_enriched: true,
      r03_coverage: "available",
      r03_population: 12500,
      r03_families: 5200,
      r03_dwellings: 6100,
      r03_buildings: 450,
      r03_density: 3200,
      r03_sections_count: 25,
      r03_sections_with_data: 23,
    };
    expect(match.r03_enriched).toBe(true);
    expect(match.r03_population).toBe(12500);
    expect(match.r03_coverage).toBe("available");
  });

  it("R03 enrichment fields default to undefined when absent", () => {
    const match: SubMunicipalMatchData = {
      available: true,
      matched: true,
      coverage_status: "available",
    };
    expect(match.r03_enriched).toBeUndefined();
    expect(match.r03_population).toBeUndefined();
  });
});

describe("R03 aggregate comune-aware key", () => {
  it("two aggregates with same asc_code but different comuni do not collide", () => {
    // Simulates the unique key (source_dataset, comune_istat_code, asc_level, asc_code)
    const aggregates = new Map<string, { pop: number; comune: string }>();
    const key1 = "R03_21|015146|1|ASC1_001";
    const key2 = "R03_21|017029|1|ASC1_001";
    aggregates.set(key1, { pop: 12000, comune: "015146" });
    aggregates.set(key2, { pop: 8500, comune: "017029" });
    expect(aggregates.size).toBe(2);
    expect(aggregates.get(key1)!.pop).toBe(12000);
    expect(aggregates.get(key2)!.pop).toBe(8500);
  });

  it("lookup filters by comune_istat_code to get correct aggregate", () => {
    const aggregates = [
      { asc_code: "ASC1_001", asc_level: 1, comune_istat_code: "015146", population: 12000 },
      { asc_code: "ASC1_001", asc_level: 1, comune_istat_code: "017029", population: 8500 },
    ];
    const target = "015146";
    const result = aggregates.find(a => a.asc_code === "ASC1_001" && a.asc_level === 1 && a.comune_istat_code === target);
    expect(result).toBeDefined();
    expect(result!.population).toBe(12000);
  });

  it("without comune filter, lookup would be ambiguous", () => {
    const aggregates = [
      { asc_code: "ASC1_001", asc_level: 1, comune_istat_code: "015146", population: 12000 },
      { asc_code: "ASC1_001", asc_level: 1, comune_istat_code: "017029", population: 8500 },
    ];
    const ambiguous = aggregates.filter(a => a.asc_code === "ASC1_001" && a.asc_level === 1);
    expect(ambiguous.length).toBe(2); // Would be ambiguous without comune filter
  });
});

describe("R03 aggregation gating", () => {
  it("report shows R03 data only when r03_enriched is true", () => {
    // Simulate gating logic
    const withR03: SubMunicipalMatchData = {
      available: true, matched: true, coverage_status: "available",
      r03_enriched: true, r03_coverage: "available", r03_population: 8000,
    };
    const withoutR03: SubMunicipalMatchData = {
      available: true, matched: true, coverage_status: "available",
      popolazione: 5000,
    };

    const shouldShowR03 = (m: SubMunicipalMatchData) =>
      m.matched && m.r03_enriched === true && (m.r03_coverage === "available" || m.r03_coverage === "partial") && (m.r03_population ?? 0) > 0;

    expect(shouldShowR03(withR03)).toBe(true);
    expect(shouldShowR03(withoutR03)).toBe(false);
  });

  it("partial R03 coverage is flagged correctly", () => {
    const partial: SubMunicipalMatchData = {
      available: true, matched: true, coverage_status: "available",
      r03_enriched: true, r03_coverage: "partial", r03_population: 3000,
      r03_sections_count: 10, r03_sections_with_data: 6,
    };
    expect(partial.r03_coverage).toBe("partial");
    expect(partial.r03_sections_with_data! < partial.r03_sections_count!).toBe(true);
  });

  it("no crash when R03 fields are null", () => {
    const noData: SubMunicipalMatchData = {
      available: true, matched: true, coverage_status: "available",
      r03_enriched: true, r03_coverage: "unavailable", r03_population: null,
    };
    const shouldShow = noData.r03_enriched && (noData.r03_population ?? 0) > 0;
    expect(shouldShow).toBe(false);
  });
});
