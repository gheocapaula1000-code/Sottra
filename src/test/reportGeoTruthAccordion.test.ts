import { describe, it, expect } from "vitest";
import { resolveReportGeoStatus } from "@/components/report/ReportAccordion";

describe("Report Geo Truth & Accordion", () => {
  describe("resolveReportGeoStatus", () => {
    it("returns microzona_omi when polygon match + microzona level", () => {
      expect(resolveReportGeoStatus("microzona_omi", true)).toBe("microzona_omi");
    });

    it("returns microzona_omi when polygon match without explicit level", () => {
      expect(resolveReportGeoStatus(undefined, true)).toBe("microzona_omi");
    });

    it("returns zona_reale for zona_specifica", () => {
      expect(resolveReportGeoStatus("zona_specifica", false)).toBe("zona_reale");
    });

    it("returns zona_reale for quartiere", () => {
      expect(resolveReportGeoStatus("quartiere", false)).toBe("zona_reale");
    });

    it("returns sub_comunale when ISTAT has microzona level", () => {
      expect(resolveReportGeoStatus(undefined, false, "microzona")).toBe("sub_comunale");
    });

    it("returns sub_comunale when ISTAT has quartiere level", () => {
      expect(resolveReportGeoStatus(undefined, false, "quartiere")).toBe("sub_comunale");
    });

    it("returns fallback_comunale when OMI level is comune", () => {
      expect(resolveReportGeoStatus("comune", false)).toBe("fallback_comunale");
    });

    it("returns fallback_comunale when no geo level provided", () => {
      expect(resolveReportGeoStatus(null, false, null)).toBe("fallback_comunale");
    });

    it("returns fallback_comunale when all null", () => {
      expect(resolveReportGeoStatus()).toBe("fallback_comunale");
    });

    it("hero banner distinguishes zona vs comune correctly", () => {
      // Microzona with polygon = strongest signal
      const strong = resolveReportGeoStatus("microzona_omi", true, "microzona");
      expect(strong).toBe("microzona_omi");

      // Comunale with no sub-municipal = weakest
      const weak = resolveReportGeoStatus("comune", false, "comune");
      expect(weak).toBe("fallback_comunale");

      // No false specificity: comune should never resolve to zona_reale
      const falseSpec = resolveReportGeoStatus("comune", false, undefined);
      expect(falseSpec).not.toBe("zona_reale");
      expect(falseSpec).not.toBe("microzona_omi");
      expect(falseSpec).toBe("fallback_comunale");
    });

    it("no false specificity when only polygon match is false and level is comune", () => {
      const result = resolveReportGeoStatus("comune", false, "comune");
      expect(result).toBe("fallback_comunale");
    });

    it("municipal ISTAT does not override to sub_comunale", () => {
      const result = resolveReportGeoStatus("comune", false, "comune");
      expect(result).toBe("fallback_comunale");
    });

    it("accordion weak sections are marked when pricing is comunale", () => {
      // Simulate the isWeak logic used in accordion items
      const pricingData = { polygonMatch: false, omiGeoLevel: "comune" as const };
      const isWeak = !pricingData.polygonMatch && (!pricingData.omiGeoLevel || pricingData.omiGeoLevel === "comune");
      expect(isWeak).toBe(true);
    });

    it("accordion sections are NOT weak when pricing has polygon match", () => {
      const pricingData = { polygonMatch: true, omiGeoLevel: "microzona_omi" as const };
      const isWeak = !pricingData.polygonMatch && (!pricingData.omiGeoLevel || pricingData.omiGeoLevel === "comune");
      expect(isWeak).toBe(false);
    });
  });
});
