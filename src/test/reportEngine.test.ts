import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  isFieldAvailable, isSectionRenderable, countAvailableFields,
  unavailableField, sourceTypeLabels, availabilityLabels,
} from "@/types/report";
import type {
  ReportField, ContestoVicinatoData, PosizionamentoCommercialeData,
  ScenarioTemporaleData, SintesiFinaleData, TrasparenzaFontiData,
} from "@/types/report";

/* ── ReportField helpers ─────────────────────────────────── */

describe("ReportField helpers", () => {
  it("isFieldAvailable returns true for available field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "available" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns true for partial field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "partial" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns false for unavailable field", () => {
    const field: ReportField<null> = { value: null, label: "Test", sourceType: "unavailable", availabilityStatus: "unavailable" };
    expect(isFieldAvailable(field)).toBe(false);
  });

  it("isFieldAvailable returns false for null", () => {
    expect(isFieldAvailable(null)).toBe(false);
    expect(isFieldAvailable(undefined)).toBe(false);
  });

  it("unavailableField creates correct structure", () => {
    const field = unavailableField("Prezzo");
    expect(field.value).toBeNull();
    expect(field.label).toBe("Prezzo");
    expect(field.sourceType).toBe("unavailable");
    expect(field.availabilityStatus).toBe("unavailable");
  });
});

/* ── Section renderability ───────────────────────────────── */

describe("isSectionRenderable", () => {
  it("returns false for null data", () => {
    expect(isSectionRenderable(null)).toBe(false);
    expect(isSectionRenderable(undefined)).toBe(false);
  });

  it("returns false when all fields are unavailable", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
    };
    expect(isSectionRenderable(data)).toBe(false);
  });

  it("returns true when at least one field is available", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: "test", label: "B", sourceType: "official_data", availabilityStatus: "available" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });

  it("returns true for partial fields", () => {
    const data: Record<string, unknown> = {
      field1: { value: "partial", label: "A", sourceType: "visual_estimate", availabilityStatus: "partial" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });
});

describe("countAvailableFields", () => {
  it("returns 0 for null", () => {
    expect(countAvailableFields(null)).toBe(0);
  });

  it("counts correctly", () => {
    const data: Record<string, unknown> = {
      field1: { value: "a", label: "A", sourceType: "official_data", availabilityStatus: "available" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field3: { value: "c", label: "C", sourceType: "market_data", availabilityStatus: "partial" },
      nonField: "just a string",
    };
    expect(countAvailableFields(data)).toBe(2);
  });
});

/* ── sourceType and availability labels completeness ──── */

describe("labels completeness", () => {
  it("sourceTypeLabels has all ReportSourceTypes", () => {
    const expected = ["image_detected", "visual_estimate", "territorial_verified", "official_data", "market_data", "forecast_scenario", "unavailable"];
    for (const key of expected) {
      expect(sourceTypeLabels[key as keyof typeof sourceTypeLabels]).toBeTruthy();
    }
  });

  it("availabilityLabels has all AvailabilityStatus values", () => {
    const expected = ["available", "partial", "unavailable", "not_determinable", "fallback"];
    for (const key of expected) {
      expect(availabilityLabels[key as keyof typeof availabilityLabels]).toBeTruthy();
    }
  });
});

/* ── Scenario temporal structure ─────────────────────────── */

describe("ScenarioTemporaleData structure", () => {
  it("should allow empty scenari array", () => {
    const data: ScenarioTemporaleData = { scenari: [] };
    expect(data.scenari).toHaveLength(0);
  });

  it("should structure 5/10/20 year scenarios correctly", () => {
    const data: ScenarioTemporaleData = {
      scenari: [
        { orizzonte: "5_anni", label: "5 anni", variazioneStimataPct: { value: 5, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "10_anni", label: "10 anni", variazioneStimataPct: { value: 12, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "20_anni", label: "20 anni", variazioneStimataPct: { value: null, label: "Variazione", sourceType: "unavailable", availabilityStatus: "unavailable" } },
      ],
      disclaimer: "Proiezione indicativa",
    };
    expect(data.scenari).toHaveLength(3);
    expect(data.scenari![0].orizzonte).toBe("5_anni");
    expect(data.scenari![2].variazioneStimataPct?.availabilityStatus).toBe("unavailable");
  });
});

/* ── TrasparenzaFonti structure ──────────────────────────── */

describe("TrasparenzaFontiData structure", () => {
  it("should accept valid fonti entries", () => {
    const data: TrasparenzaFontiData = {
      fonti: [
        { categoria: "immagine", categoriaLabel: "Analisi immagine", provider: "AI" },
        { categoria: "dato_ufficiale", categoriaLabel: "OMI", provider: "Agenzia delle Entrate", periodo: "2S 2024" },
        { categoria: "dato_mercato", categoriaLabel: "Prezzi", dettaglio: "Comparabili zona" },
      ],
    };
    expect(data.fonti).toHaveLength(3);
    expect(data.fonti[0].categoria).toBe("immagine");
    expect(data.fonti[1].periodo).toBe("2S 2024");
  });
});

/* ── Non-regression: OMI types unchanged ─────────────────── */

describe("OMI types non-regression", () => {
  it("OmiZoneData interface still has polygonMatch", () => {
    const omi: import("@/types").OmiZoneData = {
      zonaOmi: "B1",
      quotazioneMinResidenziale: 1300,
      quotazioneMaxResidenziale: 1650,
      polygonMatch: true,
    };
    expect(omi.polygonMatch).toBe(true);
    expect(omi.zonaOmi).toBe("B1");
  });
});
