import { describe, it, expect } from "vitest";
import {
  normalizeAnncsuRecord,
  normalizeStreetType,
  summarizeAnncsuBatch,
  type AnncsuRawRecord,
  type AnncsuNormalizedRecord,
} from "@/lib/anncsuSchema";

describe("ANNCSU street type normalization", () => {
  it("normalizes common Italian street types", () => {
    expect(normalizeStreetType("via")).toBe("Via");
    expect(normalizeStreetType("V.")).toBe("Via");
    expect(normalizeStreetType("CORSO")).toBe("Corso");
    expect(normalizeStreetType("c.so")).toBe("Corso");
    expect(normalizeStreetType("P.ZZA")).toBe("Piazza");
    expect(normalizeStreetType("piazzale")).toBe("Piazzale");
    expect(normalizeStreetType("loc.")).toBe("Località");
  });

  it("preserves unknown types as-is", () => {
    expect(normalizeStreetType("Rotonda")).toBe("Rotonda");
  });

  it("returns null for empty/null input", () => {
    expect(normalizeStreetType(null)).toBeNull();
    expect(normalizeStreetType("")).toBeNull();
    expect(normalizeStreetType("  ")).toBeNull();
  });
});

describe("normalizeAnncsuRecord — complete record", () => {
  const raw: AnncsuRawRecord = {
    COD_REG: "03",
    COD_PROV: "015",
    COD_COM: "015146",
    DENOM_COM: "Milano",
    SPECIE: "Via",
    DENOM_STRADA: "Roma",
    COD_STRADA: "12345",
    CIVICO: "42",
    ESPONENTE: "bis",
    SEZ_CENSUARIA: "001",
  };

  it("produces a fully linked normalized record", () => {
    const norm = normalizeAnncsuRecord(raw);
    expect(norm.identity.source_name).toBe("ANNCSU");
    expect(norm.identity.source_officiality).toBe("official_institutional");
    expect(norm.geo.comune_istat_code).toBe("015146");
    expect(norm.geo.regione_code).toBe("03");
    expect(norm.geo.normalized_geo_path).toBe("R03/P015/C015146");
    expect(norm.street.street_name_normalized).toBe("Roma");
    expect(norm.street.street_type_normalized).toBe("Via");
    expect(norm.street.street_full_name).toBe("Via Roma");
    expect(norm.street.street_status).toBe("complete");
    expect(norm.civic.civic_normalized).toBe("42");
    expect(norm.civic.esponente_normalized).toBe("BIS");
    expect(norm.civic.civic_full_label).toBe("42/BIS");
    expect(norm.civic.civic_status).toBe("present_with_esponente");
    expect(norm.quality.ingest_readiness).toBe("ready");
    expect(norm.quality.geo_link_status).toBe("linked");
  });

  it("promotion policy is ALWAYS locked false", () => {
    const norm = normalizeAnncsuRecord(raw);
    expect(norm.promotion_policy.qualifies_for_building_truth).toBe(false);
    expect(norm.promotion_policy.qualifies_for_precise_location).toBe(false);
    expect(norm.promotion_policy.blocking_reasons).toContain("P1_readiness_phase_only");
  });
});

describe("normalizeAnncsuRecord — PROCOM fallback", () => {
  it("resolves istat code from PROCOM when COD_COM missing", () => {
    const raw: AnncsuRawRecord = {
      PROCOM: "15146",
      COD_REG: "03",
      COD_PROV: "015",
      DENOM_STRADA: "Garibaldi",
      SPECIE: "Corso",
    };
    const norm = normalizeAnncsuRecord(raw);
    expect(norm.geo.comune_istat_code).toBe("015146");
    expect(norm.normalization_trace).toContain("istat_code_from_PROCOM");
  });
});

describe("normalizeAnncsuRecord — civic edge cases", () => {
  it("strips leading zeros from civic", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", CIVICO: "007" });
    expect(norm.civic.civic_normalized).toBe("7");
  });

  it("marks civic '0' as missing", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", CIVICO: "0" });
    expect(norm.civic.civic_status).toBe("missing");
    expect(norm.civic.civic_normalized).toBeNull();
  });

  it("marks non-numeric civic as malformed", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", CIVICO: "SNC" });
    expect(norm.civic.civic_status).toBe("malformed");
  });
});

describe("normalizeAnncsuRecord — quality gates", () => {
  it("blocks records without geo anchor", () => {
    const norm = normalizeAnncsuRecord({ DENOM_STRADA: "Roma", SPECIE: "Via", CIVICO: "1" });
    expect(norm.quality.ingest_readiness).toBe("blocked");
    expect(norm.quality.geo_link_status).toBe("unlinked");
  });

  it("flags high ambiguity as review_needed", () => {
    // Missing street, civic, regione, type → 4 flags
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_PROV: "015" });
    expect(norm.quality.ambiguity_flags.length).toBeGreaterThanOrEqual(2);
  });

  it("marks complete records as ready", () => {
    const norm = normalizeAnncsuRecord({
      COD_REG: "03", COD_PROV: "015", COD_COM: "015146",
      DENOM_COM: "Milano", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1",
    });
    expect(norm.quality.ingest_readiness).toBe("ready");
  });
});

describe("normalizeAnncsuRecord — no regression on address engine", () => {
  it("does not set civic_supported_as_building_truth anywhere", () => {
    const norm = normalizeAnncsuRecord({
      COD_REG: "03", COD_PROV: "015", COD_COM: "015146",
      SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "42",
    });
    // The ANNCSU schema never produces building_truth
    expect(norm.promotion_policy.qualifies_for_building_truth).toBe(false);
    expect(JSON.stringify(norm)).not.toContain('"civic_supported_as_building_truth":true');
  });
});

describe("summarizeAnncsuBatch", () => {
  it("produces correct summary for mixed batch", () => {
    const records: AnncsuNormalizedRecord[] = [
      normalizeAnncsuRecord({ COD_REG: "03", COD_PROV: "015", COD_COM: "015146", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1", DENOM_COM: "Milano" }),
      normalizeAnncsuRecord({ COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_STRADA: "Verdi" }),
      normalizeAnncsuRecord({ DENOM_STRADA: "Nowhere" }), // blocked
    ];
    const summary = summarizeAnncsuBatch(records);
    expect(summary.total_records).toBe(3);
    expect(summary.blocked).toBe(1);
    expect(summary.ready + summary.ready_with_warnings).toBeGreaterThanOrEqual(1);
    expect(summary.ingest_eligible_pct).toBeGreaterThan(0);
  });

  it("handles empty batch", () => {
    const summary = summarizeAnncsuBatch([]);
    expect(summary.total_records).toBe(0);
    expect(summary.ingest_eligible_pct).toBe(0);
  });
});

describe("type safety", () => {
  it("AnncsuNormalizedRecord has all required fields", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015" });
    expect(norm.identity).toBeDefined();
    expect(norm.geo).toBeDefined();
    expect(norm.street).toBeDefined();
    expect(norm.civic).toBeDefined();
    expect(norm.quality).toBeDefined();
    expect(norm.promotion_policy).toBeDefined();
    expect(norm.normalization_trace).toBeDefined();
    expect(Array.isArray(norm.normalization_trace)).toBe(true);
  });
});
