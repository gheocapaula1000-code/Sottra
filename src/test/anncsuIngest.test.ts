import { describe, it, expect } from "vitest";
import {
  normalizeAnncsuRecord,
  summarizeAnncsuBatch,
} from "@/lib/anncsuSchema";

/**
 * ANNCSU ingest pipeline tests — verifies normalization, quality gates,
 * dedup contract, and promotion policy in the context of real ingest.
 */

describe("ANNCSU ingest normalization pipeline", () => {
  it("complete record normalizes with all fields for DB insert", () => {
    const norm = normalizeAnncsuRecord({
      COD_REG: "03", COD_PROV: "015", COD_COM: "015146",
      DENOM_COM: "Milano", SPECIE: "Via", DENOM_STRADA: "Roma",
      COD_STRADA: "001", CIVICO: "42", ESPONENTE: "bis",
    });
    // All fields needed for DB row are present
    expect(norm.geo.comune_istat_code).toBe("015146");
    expect(norm.street.street_name_normalized).toBe("Roma");
    expect(norm.street.street_full_name).toBe("Via Roma");
    expect(norm.civic.civic_normalized).toBe("42");
    expect(norm.civic.esponente_normalized).toBe("BIS");
    expect(norm.quality.ingest_readiness).toBe("ready");
  });

  it("dedup key components are deterministic", () => {
    const a = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1" });
    const b = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", SPECIE: "via", DENOM_STRADA: "Roma", CIVICO: "01" });
    // Same logical record should produce same dedup key values
    expect(a.geo.comune_istat_code).toBe(b.geo.comune_istat_code);
    expect(a.street.street_name_normalized).toBe(b.street.street_name_normalized);
    expect(a.civic.civic_normalized).toBe(b.civic.civic_normalized);
  });

  it("idempotent normalization produces identical output", () => {
    const raw = { COD_REG: "03", COD_PROV: "015", COD_COM: "015146", SPECIE: "Corso", DENOM_STRADA: "Buenos Aires", CIVICO: "33" };
    const first = normalizeAnncsuRecord(raw);
    const second = normalizeAnncsuRecord(raw);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("ANNCSU quality gates in ingest context", () => {
  it("blocks records without geo anchor", () => {
    const norm = normalizeAnncsuRecord({ DENOM_STRADA: "Roma", SPECIE: "Via", CIVICO: "1" });
    expect(norm.quality.ingest_readiness).toBe("blocked");
  });

  it("passes clean records as ready", () => {
    const norm = normalizeAnncsuRecord({
      COD_REG: "12", COD_PROV: "058", COD_COM: "058091",
      DENOM_COM: "Roma", SPECIE: "Piazza", DENOM_STRADA: "Venezia", CIVICO: "11",
    });
    expect(norm.quality.ingest_readiness).toBe("ready");
  });

  it("marks records with warnings correctly", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015", DENOM_STRADA: "Verdi" });
    expect(["ready_with_warnings", "review_needed"]).toContain(norm.quality.ingest_readiness);
    expect(norm.quality.ambiguity_flags.length).toBeGreaterThan(0);
  });
});

describe("ANNCSU batch summary for ingest reporting", () => {
  it("produces real counts for mixed batch", () => {
    const records = [
      normalizeAnncsuRecord({ COD_REG: "03", COD_PROV: "015", COD_COM: "015146", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1", DENOM_COM: "Milano" }),
      normalizeAnncsuRecord({ COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_STRADA: "Verdi" }),
      normalizeAnncsuRecord({ DENOM_STRADA: "Nowhere" }),
    ];
    const summary = summarizeAnncsuBatch(records);
    expect(summary.total_records).toBe(3);
    expect(summary.blocked).toBe(1);
    expect(summary.ready + summary.ready_with_warnings).toBeGreaterThanOrEqual(1);
    expect(summary.civic_present_pct).toBeGreaterThan(0);
  });
});

describe("ANNCSU promotion policy remains locked", () => {
  it("qualifies_for_building_truth is always false", () => {
    const clean = normalizeAnncsuRecord({
      COD_REG: "03", COD_PROV: "015", COD_COM: "015146", COD_STRADA: "001",
      SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1", DENOM_COM: "Milano",
    });
    expect(clean.promotion_policy.qualifies_for_building_truth).toBe(false);
    expect(clean.promotion_policy.qualifies_for_precise_location).toBe(false);
    expect(clean.promotion_policy.blocking_reasons).toContain("P1_readiness_phase_only");
  });

  it("no part of normalized record contains building truth promotion", () => {
    const norm = normalizeAnncsuRecord({
      COD_REG: "03", COD_PROV: "015", COD_COM: "015146",
      SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "42",
    });
    const serialized = JSON.stringify(norm);
    expect(serialized).not.toContain('"civic_supported_as_building_truth":true');
    expect(serialized).not.toContain('"qualifies_for_building_truth":true');
  });
});

describe("No regression on existing engines", () => {
  it("anncsuSchema types are stable", () => {
    const norm = normalizeAnncsuRecord({ COD_COM: "015146", COD_REG: "03", COD_PROV: "015" });
    expect(norm.identity.source_name).toBe("ANNCSU");
    expect(norm.identity.source_scope).toBe("national");
    expect(norm.geo).toBeDefined();
    expect(norm.street).toBeDefined();
    expect(norm.civic).toBeDefined();
    expect(norm.quality).toBeDefined();
    expect(norm.promotion_policy).toBeDefined();
  });

  it("address resolution engine contract is not affected", async () => {
    const { resolveAddress } = await import("@/lib/addressResolutionEngine");
    const res = resolveAddress({ raw_address: "Via Roma 12", comune: "Milano" });
    expect(res.civic_resolution.civic_supported_as_building_truth).toBe(false);
  });
});
