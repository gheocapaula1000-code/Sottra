import { describe, it, expect } from "vitest";
import { isOwnerEmail, OWNER_EMAILS, OWNER_EMAIL } from "@/lib/ownerConfig";

describe("ownerConfig", () => {
  it("recognizes gheocapaula@gmail.com as owner", () => {
    expect(isOwnerEmail("gheocapaula@gmail.com")).toBe(true);
  });

  it("recognizes gheocapaula1000@gmail.com as owner", () => {
    expect(isOwnerEmail("gheocapaula1000@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isOwnerEmail("GheocaPaula@Gmail.COM")).toBe(true);
    expect(isOwnerEmail("GHEOCAPAULA1000@GMAIL.COM")).toBe(true);
  });

  it("rejects non-owner emails", () => {
    expect(isOwnerEmail("random@test.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });

  it("OWNER_EMAILS contains both addresses", () => {
    expect(OWNER_EMAILS).toContain("gheocapaula@gmail.com");
    expect(OWNER_EMAILS).toContain("gheocapaula1000@gmail.com");
  });

  it("legacy OWNER_EMAIL still exported", () => {
    expect(OWNER_EMAIL).toBe("gheocapaula@gmail.com");
  });
});
