import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PLANS } from "@/lib/plans";
import { setBillingReady } from "@/lib/billing";

const { invoke, assign } = vi.hoisted(() => ({
  invoke: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { user: { email: "expired@test.it" } },
    user: { email: "expired@test.it" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";

describe("TrialExpiredScreen always offers Checkout", () => {
  beforeEach(() => {
    invoke.mockReset();
    assign.mockReset();
    setBillingReady(false);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, href: "https://sottra.app/app" },
    });
  });

  afterEach(() => {
    cleanup();
    setBillingReady(false);
  });

  it("shows Abbonati for each live plan even when billingReady is false", () => {
    render(
      <MemoryRouter>
        <TrialExpiredScreen scansUsed={0} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Periodo di prova concluso")).toBeInTheDocument();
    expect(screen.getByText("0 scansioni")).toBeInTheDocument();
    expect(screen.queryByText(/Per attivare un piano, contattaci/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abbonati a Agente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abbonati a Agenzia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abbonati a Rete/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /supporto@sottra\.app/i })).toBeInTheDocument();
  });

  it("Abbonati a Agente invokes create-checkout with the live price_id", async () => {
    invoke.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_expired" },
      error: null,
    });

    render(
      <MemoryRouter>
        <TrialExpiredScreen scansUsed={0} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Abbonati a Agente/i }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create-checkout", {
        body: { priceId: PLANS.agente.price_id },
      });
    });
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_expired");
    });
  });
});
