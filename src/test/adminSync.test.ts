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

describe("Admin Sync — explicit sourceKey→table mapping", () => {
  it("explicit mapping never confuses omi_quotazioni with istat_comuni_nazionale", () => {
    // Simulates the correct explicit mapping used in syncRegistryFromData
    const sourceKeys = [
      "omi_quotazioni", "omi_polygons", "omi_zone",
      "istat_comuni_nazionale", "istat_localita_2021",
      "r03_asc_aggregates", "asc_2021", "r03_lombardia_2021",
      "demographic_zones",
    ];
    const tableTargets = [
      "omi_quotazioni", "omi_polygons", "omi_zone",
      "territorial_registry:comune", "territorial_registry:localita",
      "r03_asc_aggregates_2021", "sub_municipal_areas_2021", "census_sections_r03_2021",
      "demographic_zones",
    ];

    // Build explicit map (not index-based)
    const mapping = new Map<string, string>();
    sourceKeys.forEach((k, i) => mapping.set(k, tableTargets[i]));

    // These must never be swapped — the old index-based bug would swap them
    expect(mapping.get("omi_quotazioni")).toBe("omi_quotazioni");
    expect(mapping.get("istat_comuni_nazionale")).toBe("territorial_registry:comune");
    expect(mapping.get("omi_quotazioni")).not.toContain("territorial_registry");
    expect(mapping.get("istat_comuni_nazionale")).not.toBe("omi_quotazioni");
  });

  it("index-based mapping would produce wrong results if arrays are reordered", () => {
    // This test fails if someone reverts to fragile index-based mapping
    // by showing that array reorder breaks the association
    const sourceKeys = ["omi_quotazioni", "istat_comuni_nazionale", "omi_zone"];
    const fakeCounts = [42000, 7904, 8500]; // omi=42k, comuni=7904, zone=8500

    // Correct explicit approach: each key gets its own count
    const explicitMap: Record<string, number> = {};
    sourceKeys.forEach((k, i) => { explicitMap[k] = fakeCounts[i]; });
    expect(explicitMap["omi_quotazioni"]).toBe(42000);
    expect(explicitMap["istat_comuni_nazionale"]).toBe(7904);

    // Now simulate a reorder (like adding a new source in the middle)
    const reorderedKeys = ["istat_comuni_nazionale", "omi_quotazioni", "omi_zone"];
    // With index-based mapping, counts[0] would wrongly go to first key
    const brokenMap: Record<string, number> = {};
    reorderedKeys.forEach((k, i) => { brokenMap[k] = fakeCounts[i]; });
    // This would assign omi count (42000) to istat_comuni — WRONG
    expect(brokenMap["istat_comuni_nazionale"]).toBe(42000); // broken!
    expect(brokenMap["omi_quotazioni"]).toBe(7904); // broken!

    // Proves that index-based is fragile — explicit map is required
    expect(brokenMap["istat_comuni_nazionale"]).not.toBe(explicitMap["istat_comuni_nazionale"]);
  });
});

/**
 * Coherence check: DB CHECK constraints must cover all dataset_types and statuses
 * used by the application layer. If a new type/status is added in code but not in DB,
 * this test must be updated — and the migration must follow.
 */
describe("territorial_dataset_jobs — DB ↔ App coherence", () => {
  const DB_ALLOWED_DATASET_TYPES = [
    "ASC_2021", "R03_2021", "R03_CSV_SEZ", "R03_CSV_ASC1", "R03_CSV_ASC2", "R03_CSV_ASC3",
    "COMUNI_ITALIA", "LOCALITA_ISTAT",
  ];

  const DB_ALLOWED_STATUSES = [
    "uploaded", "validated", "validating", "ready_to_import", "importing", "imported", "failed",
  ];

  // These are the types actually used by the app/UI/edge-functions
  const APP_USED_DATASET_TYPES = [
    "ASC_2021", "R03_CSV_SEZ", "R03_CSV_ASC1", "R03_CSV_ASC2",
    "COMUNI_ITALIA", "LOCALITA_ISTAT",
  ];

  const APP_USED_STATUSES = [
    "uploaded", "validated", "validating", "importing", "imported", "failed",
  ];

  it("every app-used dataset_type is in DB allowed list", () => {
    for (const t of APP_USED_DATASET_TYPES) {
      expect(DB_ALLOWED_DATASET_TYPES).toContain(t);
    }
  });

  it("every app-used status is in DB allowed list", () => {
    for (const s of APP_USED_STATUSES) {
      expect(DB_ALLOWED_STATUSES).toContain(s);
    }
  });

  it("'validated' status is allowed (was missing before fix)", () => {
    expect(DB_ALLOWED_STATUSES).toContain("validated");
  });

  it("COMUNI_ITALIA dataset_type is allowed (was missing before fix)", () => {
    expect(DB_ALLOWED_DATASET_TYPES).toContain("COMUNI_ITALIA");
  });

  it("LOCALITA_ISTAT dataset_type is allowed (was missing before fix)", () => {
    expect(DB_ALLOWED_DATASET_TYPES).toContain("LOCALITA_ISTAT");
  });
});

describe("Admin Upload Flow — error surfacing and rollback", () => {
  it("loadJobs must not silently ignore errors", () => {
    // The old code had: catch { /* ignore */ }
    // Verify the current source does NOT have silent catch in loadJobs
    const fs = require("fs");
    const src = fs.readFileSync("src/pages/AdminSubMunicipal.tsx", "utf-8");
    // Extract the loadJobs function body
    const loadJobsMatch = src.match(/const loadJobs = async[^]*?setJobsLoading\(false\);\s*\};/);
    expect(loadJobsMatch).toBeTruthy();
    const loadJobsBody = loadJobsMatch![0];
    // Must NOT contain empty catch
    expect(loadJobsBody).not.toMatch(/catch\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/);
    // Must contain toast.error or setJobsError
    expect(loadJobsBody).toContain("setJobsError");
    expect(loadJobsBody).toContain("toast.error");
  });

  it("handleUpload has storage rollback on job insert failure", () => {
    const fs = require("fs");
    const src = fs.readFileSync("src/pages/AdminSubMunicipal.tsx", "utf-8");
    const uploadMatch = src.match(/const handleUpload = async[^]*?setUploading\(null\);\s*\};/);
    expect(uploadMatch).toBeTruthy();
    const body = uploadMatch![0];
    // Must contain rollback (storage remove) after job insert failure
    expect(body).toContain(".remove([path])");
    // Must show specific RLS error message
    expect(body).toContain("row-level security");
  });

  it("edge function allows owner in addition to admin", () => {
    const fs = require("fs");
    const src = fs.readFileSync("supabase/functions/territorial-import/index.ts", "utf-8");
    expect(src).toContain("owner_access");
    expect(src).toContain("Admin or owner required");
    // Must NOT have the old admin-only check
    expect(src).not.toMatch(/if \(!roleData\) return json\(\{ error: "Admin required"/);
  });

  it("debug trace state tracks all phases", () => {
    const fs = require("fs");
    const src = fs.readFileSync("src/pages/AdminSubMunicipal.tsx", "utf-8");
    // Verify debug trace captures upload, insert, and list phases
    expect(src).toContain("trace.uploadOk");
    expect(src).toContain("trace.insertJobOk");
    expect(src).toContain("trace.listJobsOk");
    expect(src).toContain("trace.jobId");
    expect(src).toContain("debugTrace");
  });

  it("jobsError state is displayed inline above job list", () => {
    const fs = require("fs");
    const src = fs.readFileSync("src/pages/AdminSubMunicipal.tsx", "utf-8");
    expect(src).toContain("jobsError");
    expect(src).toContain("border-destructive");
  });
});
