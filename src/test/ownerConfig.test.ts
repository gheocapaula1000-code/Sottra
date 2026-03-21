import { describe, it, expect } from "vitest";
import { isOwnerEmail, OWNER_EMAILS, OWNER_EMAIL } from "@/lib/ownerConfig";

describe("ownerConfig", () => {
  it("OWNER_EMAILS is a non-empty readonly array", () => {
    expect(Array.isArray(OWNER_EMAILS)).toBe(true);
    expect(OWNER_EMAILS.length).toBeGreaterThanOrEqual(1);
  });

  it("recognizes configured owner emails", () => {
    for (const email of OWNER_EMAILS) {
      expect(isOwnerEmail(email)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    for (const email of OWNER_EMAILS) {
      expect(isOwnerEmail(email.toUpperCase())).toBe(true);
    }
  });

  it("rejects non-owner emails", () => {
    expect(isOwnerEmail("random@test.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });

  it("legacy OWNER_EMAIL still exported", () => {
    expect(typeof OWNER_EMAIL).toBe("string");
    expect(OWNER_EMAIL).toBe(OWNER_EMAILS[0]);
  });
});
