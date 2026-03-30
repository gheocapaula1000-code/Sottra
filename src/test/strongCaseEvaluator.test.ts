import { describe, it, expect } from "vitest";
import { evaluateStrongCase, type StrongCaseInput } from "@/lib/strongCaseEvaluator";
import type { WowSnapshot } from "@/lib/sottraWowSnapshot";

function baseSnapshot(overrides: Partial<WowSnapshot> = {}): WowSnapshot {
  return {
    zona_reale: "Centro Storico",
    livello_lettura: "Microzona OMI",
    livello_valore: "Microzona OMI",
    valore_zona_fine: true,
    valore_al_mq: "€ 2.500",
    valore_range: "€ 2.000 – € 3.000",
    affidabilita_valore: "Alta",
    costo_ristrutturazione: "€ 45.000",
    costo_range: "€ 35.000 – € 55.000",
    segnali_zona: "Convergenti e favorevoli",
    attenzione_area: "high",
    limite_principale: "Le stime offrono un orientamento — per decisioni importanti, consultare un professionista",
    narrative_mode: "full",
    specificita_immobile: "Alta",
    ...overrides,
  };
}

function baseInput(overrides: Partial<StrongCaseInput> = {}): StrongCaseInput {
  return {
    snapshot: baseSnapshot(),
    house_specificity_strength: "strong",
    alignment_status: "high_alignment",
    outlook_status: "supportive",
    boundary_available: true,
    ...overrides,
  };
}

describe("strongCaseEvaluator", () => {
  it("recognizes strong case with full convergence", () => {
    const r = evaluateStrongCase(baseInput());
    expect(r.identity.overall_case_strength).toBe("strong_case");
    expect(r.strengths.length).toBeGreaterThanOrEqual(3);
    expect(r.flags.strong_zone_read).toBe(true);
    expect(r.flags.strong_value_read).toBe(true);
  });

  it("solid case not crushed to mixed", () => {
    const r = evaluateStrongCase(baseInput({
      house_specificity_strength: "medium",
      outlook_status: "mixed",
    }));
    expect(["strong_case", "solid_case"]).toContain(r.identity.overall_case_strength);
  });

  it("weak case stays weak with insufficient signals", () => {
    const r = evaluateStrongCase(baseInput({
      snapshot: baseSnapshot({
        affidabilita_valore: "Non determinabile",
        attenzione_area: "insufficient",
      }),
      house_specificity_strength: "insufficient",
      outlook_status: "insufficient",
      alignment_status: "insufficient_alignment",
    }));
    expect(r.identity.overall_case_strength).toBe("weak_case");
  });

  it("fallback high prevents strong", () => {
    const r = evaluateStrongCase(baseInput({
      snapshot: baseSnapshot({
        affidabilita_valore: "Non determinabile",
        attenzione_area: "high",
        limite_principale: "Componente di contesto ampio presente — precisione da contestualizzare",
      }),
    }));
    expect(r.identity.overall_case_strength).not.toBe("strong_case");
    expect(r.limiters.fallback_dominant).toBe(true);
  });

  it("value strong + zone strong + house medium → more decisive than weak", () => {
    const r = evaluateStrongCase(baseInput({
      house_specificity_strength: "medium",
    }));
    expect(["strong_case", "solid_case"]).toContain(r.identity.overall_case_strength);
  });

  it("single-source not promoted to strong", () => {
    const r = evaluateStrongCase(baseInput({
      snapshot: baseSnapshot({
        affidabilita_valore: "Bassa",
        attenzione_area: "low",
      }),
      house_specificity_strength: "weak",
      outlook_status: "weak",
      alignment_status: "low_alignment",
    }));
    expect(r.identity.overall_case_strength).not.toBe("strong_case");
  });

  it("strengths list is populated for strong case", () => {
    const r = evaluateStrongCase(baseInput());
    expect(r.strengths).toContain("Valore affidabile");
    expect(r.strengths).toContain("Lettura zona solida");
  });

  it("top_limiter present for fallback_dominant", () => {
    const r = evaluateStrongCase(baseInput({
      snapshot: baseSnapshot({ affidabilita_valore: "Non determinabile" }),
    }));
    expect(r.top_limiter).toBeTruthy();
  });

  it("comunale limit triggers comune_only_bias", () => {
    const r = evaluateStrongCase(baseInput({
      snapshot: baseSnapshot({
        affidabilita_valore: "Bassa",
        limite_principale: "Lettura ancora a livello comunale",
        valore_zona_fine: false,
      }),
    }));
    expect(r.limiters.comune_only_bias).toBe(true);
  });

  it("no regression: wow snapshot specificity mapping", () => {
    const r = evaluateStrongCase(baseInput({ house_specificity_strength: "strong" }));
    expect(r.identity.house_specificity_strength).toBe("strong");
  });

  it("type safety: all fields defined", () => {
    const r = evaluateStrongCase(baseInput());
    expect(r.identity.overall_case_strength).toBeDefined();
    expect(r.identity.zone_strength).toBeDefined();
    expect(r.identity.value_strength).toBeDefined();
    expect(r.identity.fallback_penalty).toBeDefined();
    expect(r.flags).toBeDefined();
    expect(r.limiters).toBeDefined();
  });
});
