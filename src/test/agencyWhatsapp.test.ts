import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  buildAgencyShareCaption,
  buildAgencyWhatsappUrl,
  formatAgencyWhatsapp,
  isValidAgencyWhatsapp,
  normalizeItalianMobile,
} from "@/lib/agencyWhatsapp";

describe("normalizeItalianMobile", () => {
  it("normalizes Italian mobiles to E.164 with 39", () => {
    expect(normalizeItalianMobile("345 678 9012")).toBe("+393456789012");
    expect(normalizeItalianMobile("+39 345-678-9012")).toBe("+393456789012");
    expect(normalizeItalianMobile("0039 3456789012")).toBe("+393456789012");
    expect(normalizeItalianMobile("393456789012")).toBe("+393456789012");
    expect(normalizeItalianMobile("335123456")).toBe("+39335123456");
  });

  it("fails closed on invalid or non-Italian numbers", () => {
    for (const bad of ["", "   ", null, undefined, "abc", "0498765432", "+44 7700 900123", "12345", "34567890123456"]) {
      expect(normalizeItalianMobile(bad)).toBeNull();
      expect(isValidAgencyWhatsapp(bad)).toBe(false);
    }
  });

  it("formats for display", () => {
    expect(formatAgencyWhatsapp("+393456789012")).toBe("+39 345 678 9012");
    expect(formatAgencyWhatsapp("nope")).toBe("");
  });
});

describe("buildAgencyWhatsappUrl", () => {
  it("targets exactly that number, never a generic chat", () => {
    const url = buildAgencyWhatsappUrl("345 678 9012", "Report Sottra — sottra.app");
    expect(url).toContain("https://wa.me/393456789012?text=");
    expect(url).toContain(encodeURIComponent("sottra.app"));
  });

  it("does not send without a valid number", () => {
    expect(buildAgencyWhatsappUrl(null, "x")).toBeNull();
    expect(buildAgencyWhatsappUrl("", "x")).toBeNull();
    expect(buildAgencyWhatsappUrl("+44 7700 900123", "x")).toBeNull();
  });
});

describe("buildAgencyShareCaption — only real facts", () => {
  it("uses via/civico and zona OMI when present", () => {
    const caption = buildAgencyShareCaption({
      street: "Via Giuseppe Giovanni Battaglia",
      houseNumber: "12",
      comuneLabel: "Padova",
      zonaOmi: "D8",
    });
    expect(caption).toContain("Via Giuseppe Giovanni Battaglia 12");
    expect(caption).toContain("Padova");
    expect(caption).toContain("Zona OMI D8");
    expect(caption).toContain("sottra.app");
    expect(caption).not.toContain("sottra.it");
  });

  it("omits missing fields and never invents vendita/successione or quotazioni", () => {
    const caption = buildAgencyShareCaption({});
    expect(caption).toBe("Report Sottra — sottra.app");
    for (const word of ["vendita", "successione", "intero stabile", "€"]) {
      expect(caption.toLowerCase()).not.toContain(word.toLowerCase());
    }
    const partial = buildAgencyShareCaption({ street: "Via Roma", comuneLabel: null, zonaOmi: "  " });
    expect(partial).toBe("Report Sottra — Via Roma — sottra.app");
  });
});

describe("Result wiring", () => {
  const result = readFileSync("src/pages/Result.tsx", "utf-8");

  it("sends to the saved agency number using the scanned photo", () => {
    expect(result).toContain("buildAgencyWhatsappUrl");
    expect(result).toContain("captureReportElement(reportRoot, { facadeSrc: state.photo })");
    expect(result).toContain("Invia in agenzia");
    expect(result).toContain("AgencyWhatsappDialog");
  });

  it("asks for the number before the first send instead of opening a generic sheet", () => {
    expect(result).toContain("setAgencyDialogOpen(true)");
    expect(result).not.toContain("shareOrDownloadReportFile");
  });
});
