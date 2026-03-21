import { describe, it, expect } from "vitest";
import { isOwnerEmail, OWNER_EMAILS, OWNER_EMAIL } from "@/lib/ownerConfig";

describe("ownerConfig", () => {
  it("recognizes gheocapaula1000@gmail.com as owner", () => {
    expect(isOwnerEmail("gheocapaula1000@gmail.com")).toBe(true);
  });

  it("recognizes massimilianogalli75@gmail.com as owner", () => {
    expect(isOwnerEmail("massimilianogalli75@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isOwnerEmail("GHEOCAPAULA1000@GMAIL.COM")).toBe(true);
    expect(isOwnerEmail("MassimilianoGalli75@Gmail.COM")).toBe(true);
  });

  it("rejects non-owner emails", () => {
    expect(isOwnerEmail("random@test.com")).toBe(false);
    expect(isOwnerEmail("gheocapaula@gmail.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });

  it("OWNER_EMAILS contains both addresses", () => {
    expect(OWNER_EMAILS).toContain("gheocapaula1000@gmail.com");
    expect(OWNER_EMAILS).toContain("massimilianogalli75@gmail.com");
    expect(OWNER_EMAILS).toHaveLength(2);
  });

  it("legacy OWNER_EMAIL still exported", () => {
    expect(OWNER_EMAIL).toBe("gheocapaula1000@gmail.com");
  });
});
