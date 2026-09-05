import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANS } from "@/lib/plans";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
  },
}));

import {
  classifyCheckoutError,
  createCheckoutSession,
  redirectToCheckout,
} from "@/lib/checkout";

describe("createCheckoutSession", () => {
  afterEach(() => {
    invoke.mockReset();
  });

  it("rejects unknown price IDs without calling the edge function", async () => {
    const result = await createCheckoutSession("price_not_in_catalog");
    expect(result).toEqual({
      ok: false,
      error: "Piano non valido.",
      error_code: "invalid_plan",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns the Stripe Checkout URL for a live plan price_id", async () => {
    invoke.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_agente" },
      error: null,
    });
    const result = await createCheckoutSession(PLANS.agente.price_id);
    expect(invoke).toHaveBeenCalledWith("create-checkout", {
      body: { priceId: PLANS.agente.price_id },
    });
    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_agente",
    });
  });

  it("maps duplicate subscription and billing-off errors", async () => {
    invoke.mockResolvedValueOnce({
      data: { error: "Hai già un abbonamento attivo.", error_code: "already_subscribed" },
      error: null,
    });
    const dup = await createCheckoutSession(PLANS.agenzia.price_id);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error_code).toBe("already_subscribed");

    invoke.mockResolvedValueOnce({
      data: { error: "Il sistema di pagamento non è ancora attivo. Il trial gratuito resta disponibile." },
      error: { message: "503" },
    });
    const off = await createCheckoutSession(PLANS.rete.price_id);
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.error_code).toBe("billing_inactive");
  });

  it("rejects non-https redirect targets", async () => {
    invoke.mockResolvedValue({
      data: { url: "javascript:alert(1)" },
      error: null,
    });
    const result = await createCheckoutSession(PLANS.agente.price_id);
    expect(result.ok).toBe(false);
  });

  it("classifyCheckoutError covers portal and 409", () => {
    expect(classifyCheckoutError("409 already_subscribed")).toBe("already_subscribed");
    expect(classifyCheckoutError("use_customer_portal")).toBe("use_customer_portal");
    expect(classifyCheckoutError("Piano non valido.")).toBe("invalid_plan");
  });

  it("redirectToCheckout only assigns https URLs", () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });
    redirectToCheckout("https://checkout.stripe.com/c/pay/cs_ok");
    redirectToCheckout("http://evil.test");
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_ok");
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });
});
