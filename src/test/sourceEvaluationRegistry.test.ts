import { describe, it, expect } from "vitest";
import {
  SOURCE_FAMILIES,
  PRIORITY_ORDER,
  getFamiliesByPriority,
  getActionableFamilies,
  getDeferredFamilies,
  getStudyFamilies,
  isAntiHallucinationCompatible,
  getPriorityDetail,
  summarizeEvaluationRegistry,
} from "@/lib/sourceEvaluationRegistry";

describe("sourceEvaluationRegistry", () => {
  it("has all 5 source families", () => {
    expect(SOURCE_FAMILIES).toHaveLength(5);
  });

  it("has all 5 priority entries", () => {
    expect(PRIORITY_ORDER).toHaveLength(5);
  });

  it("sorts families by priority correctly", () => {
    const sorted = getFamiliesByPriority();
    expect(sorted[0].recommended_priority).toBe("P1");
    expect(sorted[sorted.length - 1].recommended_priority).toBe("P5");
  });

  it("returns actionable families (P1, P2)", () => {
    const actionable = getActionableFamilies();
    expect(actionable.length).toBeGreaterThanOrEqual(2);
    actionable.forEach(f => {
      expect(["integrate_next", "integrate_parallel"]).toContain(f.recommended_action);
    });
  });

  it("returns deferred families (P4, P5)", () => {
    const deferred = getDeferredFamilies();
    expect(deferred.length).toBeGreaterThanOrEqual(2);
    deferred.forEach(f => {
      expect(["defer", "avoid_for_now"]).toContain(f.recommended_action);
    });
  });

  it("returns study families (P3)", () => {
    const study = getStudyFamilies();
    expect(study.length).toBeGreaterThanOrEqual(1);
    study.forEach(f => {
      expect(f.recommended_action).toBe("study_feasibility");
    });
  });

  it("checks anti-hallucination compatibility correctly", () => {
    const addressRegistry = SOURCE_FAMILIES.find(f => f.source_family === "address_registry")!;
    expect(isAntiHallucinationCompatible(addressRegistry)).toBe(true);

    const marketData = SOURCE_FAMILIES.find(f => f.source_family === "market_data")!;
    expect(isAntiHallucinationCompatible(marketData)).toBe(false);
  });

  it("returns priority detail for each level", () => {
    expect(getPriorityDetail("P1")?.label).toContain("ANNCSU");
    expect(getPriorityDetail("P4")?.label).toContain("Mercato");
    expect(getPriorityDetail("P5")?.label).toContain("Mobilità");
  });

  it("summary stats are consistent", () => {
    const s = summarizeEvaluationRegistry();
    expect(s.total).toBe(5);
    expect(s.actionable + s.deferred + s.study).toBe(s.total);
    expect(s.anti_hallucination_compatible).toBeGreaterThanOrEqual(3);
  });

  it("every family has backbone_alignment defined", () => {
    SOURCE_FAMILIES.forEach(f => {
      expect(f.backbone_alignment).toBeDefined();
      expect(Array.isArray(f.backbone_alignment.strengthens_layers)).toBe(true);
    });
  });

  it("P1 family is address_registry and reuses existing taxonomy", () => {
    const p1 = SOURCE_FAMILIES.find(f => f.recommended_priority === "P1")!;
    expect(p1.source_family).toBe("address_registry");
    expect(p1.backbone_alignment.reuses_existing_taxonomy).toBe(true);
    expect(p1.backbone_alignment.requires_new_limitations).toBe(false);
  });

  it("no family has empty source_names", () => {
    SOURCE_FAMILIES.forEach(f => {
      expect(f.source_names.length).toBeGreaterThan(0);
    });
  });
});
