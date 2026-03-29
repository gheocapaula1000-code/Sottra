import { describe, it, expect } from "vitest";
import {
  resolveAddress,
  type AddressResolutionInput,
  type AnncsuCandidate,
  type AddressResolutionResult,
} from "@/lib/addressResolutionEngine";
import {
  classifyCase,
  evaluatePromotionReadiness,
  computeAuditMetrics,
  assessSystemReadiness,
  type AuditCaseClass,
} from "@/lib/anncsuMatchAudit";

/* ── helpers ───────────────────────────────────────────── */

function makeInput(o?: Partial<AddressResolutionInput>): AddressResolutionInput {
  return { raw_address: "Via Roma 12", comune: "Milano", provincia: "MI", regione: "Lombardia", ...o };
}

function cand(o?: Partial<AnncsuCandidate>): AnncsuCandidate {
  return {
    street_name: "Roma", street_type: "Via", civic_normalized: null, esponente: null,
    cod_strada: "001", comune_istat_code: "015146", comune_label: "Milano",
    ingest_readiness: "ready", ambiguity_flags: [], ...o,
  };
}

function resolveWith(o?: Partial<AddressResolutionInput>): AddressResolutionResult {
  return resolveAddress(makeInput(o));
}

/* ── Case classification ───────────────────────────────── */

describe("ANNCSU Match Audit — classifyCase", () => {
  it("strong_official_street for exact ANNCSU street", () => {
    const r = resolveWith({ anncsu_street_candidates: [cand()] });
    expect(classifyCase(r)).toBe("strong_official_street");
  });

  it("strong_official_street_and_civic when civic also official", () => {
    const r = resolveWith({
      anncsu_street_candidates: [cand()],
      anncsu_civic_candidates: [cand({ civic_normalized: "12" })],
    });
    expect(classifyCase(r)).toBe("strong_official_street_and_civic");
  });

  it("official_but_ambiguous with multiple esponenti", () => {
    const r = resolveWith({
      anncsu_street_candidates: [cand()],
      anncsu_civic_candidates: [
        cand({ civic_normalized: "12", esponente: "A" }),
        cand({ civic_normalized: "12", esponente: "B" }),
      ],
    });
    expect(classifyCase(r)).toBe("official_but_ambiguous");
  });

  it("textual_match_only without ANNCSU", () => {
    const r = resolveWith();
    expect(classifyCase(r)).toBe("textual_match_only");
  });

  it("unresolved for empty input", () => {
    const r = resolveAddress({ raw_address: "" });
    expect(classifyCase(r)).toBe("unresolved");
  });
});

/* ── Promotion readiness ───────────────────────────────── */

describe("ANNCSU Match Audit — promotion readiness", () => {
  it("never_eligible for unresolved", () => {
    const r = resolveAddress({ raw_address: "" });
    const pr = evaluatePromotionReadiness(r);
    expect(pr.readiness).toBe("never_eligible");
  });

  it("not_ready without official street", () => {
    const r = resolveWith();
    const pr = evaluatePromotionReadiness(r);
    expect(pr.readiness).toBe("not_ready");
    expect(pr.blocking_reasons).toContain("no_official_street_support");
  });

  it("blocked_by_missing_building_evidence with full ANNCSU + coords", () => {
    const r = resolveWith({
      lat: 45.46, lng: 9.19,
      anncsu_street_candidates: [cand()],
      anncsu_civic_candidates: [cand({ civic_normalized: "12" })],
    });
    const pr = evaluatePromotionReadiness(r);
    expect(pr.readiness).toBe("blocked_by_missing_building_evidence");
    expect(pr.missing_signals).toContain("building_registry_evidence");
  });

  it("blocked_by_ambiguity with ambiguous civic", () => {
    const r = resolveWith({
      anncsu_street_candidates: [cand()],
      anncsu_civic_candidates: [
        cand({ civic_normalized: "12", esponente: "A" }),
        cand({ civic_normalized: "12", esponente: "B" }),
      ],
    });
    const pr = evaluatePromotionReadiness(r);
    expect(pr.readiness).toBe("blocked_by_ambiguity");
  });

  it("building_truth_support always false in result", () => {
    const r = resolveWith({
      lat: 45.46, lng: 9.19,
      anncsu_street_candidates: [cand()],
      anncsu_civic_candidates: [cand({ civic_normalized: "12" })],
    });
    expect(r.address_resolution.building_truth_support).toBe(false);
    expect(r.civic_resolution.civic_supported_as_building_truth).toBe(false);
  });
});

/* ── Aggregate metrics ─────────────────────────────────── */

describe("ANNCSU Match Audit — aggregate metrics", () => {
  it("computes metrics on synthetic batch", () => {
    const batch: AddressResolutionResult[] = [
      resolveWith({ anncsu_street_candidates: [cand()] }),
      resolveWith({
        anncsu_street_candidates: [cand()],
        anncsu_civic_candidates: [cand({ civic_normalized: "12" })],
      }),
      resolveWith(), // no ANNCSU
      resolveAddress({ raw_address: "" }), // unresolved
    ];

    const m = computeAuditMetrics(batch);
    expect(m.total_evaluated).toBe(4);
    expect(m.official_street_support_count).toBeGreaterThanOrEqual(2);
    expect(m.building_truth_promoted_count).toBe(0);
    expect(m.case_distribution.unresolved).toBe(1);
    expect(m.case_distribution.textual_match_only).toBe(1);
  });

  it("building_truth_promoted_count always 0", () => {
    const batch = [
      resolveWith({ anncsu_street_candidates: [cand()], anncsu_civic_candidates: [cand({ civic_normalized: "12" })], lat: 45.46, lng: 9.19 }),
    ];
    const m = computeAuditMetrics(batch);
    expect(m.building_truth_promoted_count).toBe(0);
  });
});

/* ── System readiness assessment ───────────────────────── */

describe("ANNCSU Match Audit — system readiness", () => {
  it("not_ready with insufficient strong matches", () => {
    const batch = [resolveWith(), resolveWith()];
    const m = computeAuditMetrics(batch);
    const a = assessSystemReadiness(m);
    expect(a.level).toBe("not_ready");
    expect(a.building_truth_ever_promoted).toBe(false);
  });

  it("partially_ready with some strong matches", () => {
    // 4 strong out of 10 = 40%
    const strong = Array.from({ length: 4 }, () =>
      resolveWith({ anncsu_street_candidates: [cand()] })
    );
    const weak = Array.from({ length: 6 }, () => resolveWith());
    const m = computeAuditMetrics([...strong, ...weak]);
    const a = assessSystemReadiness(m);
    expect(a.level).toBe("partially_ready_rare_cases");
  });

  it("ready_but_blocked_by_policy with mostly strong matches", () => {
    const strong = Array.from({ length: 8 }, () =>
      resolveWith({ anncsu_street_candidates: [cand()] })
    );
    const m = computeAuditMetrics(strong);
    const a = assessSystemReadiness(m);
    expect(a.level).toBe("ready_but_blocked_by_policy");
    expect(a.recommendation).toContain("building truth");
  });

  it("no regresssion — addressResolutionEngine types stable", () => {
    const r = resolveWith();
    expect(r.address_resolution).toHaveProperty("anncsu_match_status");
    expect(r.address_resolution).toHaveProperty("building_truth_support");
    expect(r.civic_resolution).toHaveProperty("civic_supported_as_building_truth");
  });
});
