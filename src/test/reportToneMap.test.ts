import { describe, it, expect } from "vitest";
import {
  toneAttentionLabel, toneSpecificityLabel, toneReliabilityLabel,
  toneOutlookLabel, toneFallbackLabel, toneCaseStrengthLabel,
  toneZoneReadLabel, toneSegnaliLabel, toneLimiteLabel,
  toneStrengthLine, toneTopLimiter, toneAlignmentLabel,
  toneBoundaryLabel,
} from "@/lib/reportToneMap";

describe("reportToneMap", () => {
  it("maps attention signals to elegant labels", () => {
    expect(toneAttentionLabel("high")).toBe("Prioritaria");
    expect(toneAttentionLabel("medium")).toBe("Interessante");
    expect(toneAttentionLabel("low")).toBe("Selettiva");
    expect(toneAttentionLabel("insufficient")).toBe("Da verificare");
  });

  it("maps specificity labels without raw technical terms", () => {
    expect(toneSpecificityLabel("Alta")).toBe("Distinta");
    expect(toneSpecificityLabel("Bassa")).toBe("Da confermare");
    expect(toneSpecificityLabel("Non sufficiente")).toBe("Da approfondire");
  });

  it("maps reliability to constructive phrasing", () => {
    expect(toneReliabilityLabel("Alta")).toBe("Buona affidabilità");
    expect(toneReliabilityLabel("Bassa")).toBe("Da contestualizzare");
  });

  it("maps outlook without 'debole' or 'insufficiente'", () => {
    expect(toneOutlookLabel("supportive")).toBe("Ben supportato");
    expect(toneOutlookLabel("weak")).toBe("In formazione");
    expect(toneOutlookLabel("insufficient")).toBe("Base ancora ridotta");
    expect(toneOutlookLabel(null)).toBe("Non disponibile");
  });

  it("maps fallback without 'alto/basso'", () => {
    expect(toneFallbackLabel("low")).toBe("Contenuto");
    expect(toneFallbackLabel("high")).toBe("Rilevante");
  });

  it("maps case strength to premium labels", () => {
    expect(toneCaseStrengthLabel("strong_case")).toBe("Analisi solida");
    expect(toneCaseStrengthLabel("weak_case")).toBe("Quadro da consolidare");
    expect(toneCaseStrengthLabel("mixed_case")).toBe("Quadro composito");
  });

  it("does not lose semantic information", () => {
    // weak is still clearly different from strong
    expect(toneZoneReadLabel("strong")).not.toBe(toneZoneReadLabel("weak"));
    expect(toneFallbackLabel("low")).not.toBe(toneFallbackLabel("high"));
    expect(toneOutlookLabel("supportive")).not.toBe(toneOutlookLabel("weak"));
  });

  it("fallback visible and still penalizing in labels", () => {
    const high = toneFallbackLabel("high");
    expect(high).toBe("Rilevante"); // not hidden, not positive
  });

  it("strong cases get assertive strength lines", () => {
    expect(toneStrengthLine("Valore affidabile")).toBe("Valore affidabile");
    expect(toneStrengthLine("Lettura zona solida")).toBe("Lettura zona solida");
  });

  it("weak cases get elegant but not falsified labels", () => {
    expect(toneSpecificityLabel("Non sufficiente")).toBe("Da approfondire");
    expect(toneOutlookLabel("insufficient")).toBe("Base ancora ridotta");
    // These are clearly not positive
    expect(toneSpecificityLabel("Non sufficiente")).not.toContain("Distinta");
  });

  it("limite label is constructive, not punitive", () => {
    const mapped = toneLimiteLabel("Forte componente di fallback — precisione ridotta");
    expect(mapped).toContain("contestualizzare");
    expect(mapped).not.toContain("fallback");
  });

  it("top limiter uses premium phrasing", () => {
    expect(toneTopLimiter("Fallback elevato — precisione ridotta")).toContain("contestualizzare");
    expect(toneTopLimiter("Specificità immobile ancora ambigua")).toBe("Specificità immobile da confermare");
    expect(toneTopLimiter(null)).toBeNull();
  });

  it("alignment labels are coherent", () => {
    expect(toneAlignmentLabel("high_alignment")).toBe("Coerente");
    expect(toneAlignmentLabel("conflicting_alignment")).toBe("Incongruente");
    expect(toneAlignmentLabel(null)).toBe("Non disponibile");
  });

  it("boundary labels are clear", () => {
    expect(toneBoundaryLabel("polygon_confirmed")).toBe("Confine ben definito");
    expect(toneBoundaryLabel(null)).toContain("Non disponibile");
  });

  it("segnali zona mapped consistently", () => {
    expect(toneSegnaliLabel("Non sufficienti")).toBe("Non ancora disponibili");
    expect(toneSegnaliLabel("Quadro misto")).toBe("Quadro composito");
    expect(toneSegnaliLabel("Segnali deboli")).toBe("In fase di formazione");
  });

  it("type safety: all tone map functions return strings", () => {
    expect(typeof toneAttentionLabel("high")).toBe("string");
    expect(typeof toneSpecificityLabel("Alta")).toBe("string");
    expect(typeof toneReliabilityLabel("Alta")).toBe("string");
    expect(typeof toneOutlookLabel("supportive")).toBe("string");
    expect(typeof toneFallbackLabel("low")).toBe("string");
    expect(typeof toneCaseStrengthLabel("strong_case")).toBe("string");
    expect(typeof toneZoneReadLabel("strong")).toBe("string");
  });
});
