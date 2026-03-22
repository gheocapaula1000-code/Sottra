import { describe, it, expect } from "vitest";
import { BILLING_ENABLED } from "@/lib/billing";

describe("Billing feature flag", () => {
  it("billing is disabled by default", () => {
    expect(BILLING_ENABLED).toBe(false);
  });

  it("BILLING_ENABLED is a boolean", () => {
    expect(typeof BILLING_ENABLED).toBe("boolean");
  });
});
