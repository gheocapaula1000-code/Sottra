import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PLANS } from "@/lib/plans";
import { clearPendingPlan, peekPendingPlan, releaseCheckoutLaunchLock } from "@/lib/pendingCheckout";

const { navigate, invoke, assign, authState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  invoke: vi.fn(),
  assign: vi.fn(),
  authState: { session: null as { user: { email: string } } | null },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: authState.session,
    user: authState.session?.user ?? null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    subscribed: false,
    planKey: null,
    canManageBilling: false,
    isOwner: false,
    isAdmin: false,
    trial: { active: true, scans_used: 1, max_scans: 5 },
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

import PricingSection from "@/components/landing/PricingSection";

describe("PricingSection paid checkout CTA", () => {
  beforeEach(() => {
    authState.session = null;
    navigate.mockReset();
    invoke.mockReset();
    assign.mockReset();
    clearPendingPlan();
    releaseCheckoutLaunchLock();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, href: "https://sottra.app/prezzi" },
    });
  });

  afterEach(() => {
    cleanup();
    clearPendingPlan();
    releaseCheckoutLaunchLock();
  });

  it("logged-out cards keep the free trial and expose Abbonati per plan", () => {
    render(
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: /Inizia la prova gratuita/i })).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Abbonati — Agente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abbonati — Agenzia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abbonati — Rete/i })).toBeInTheDocument();
  });

  it("logged-out Abbonati stores the plan and goes to signup, not only /signup trial", () => {
    render(
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Abbonati — Agente/i }));
    expect(peekPendingPlan()).toBe("agente");
    expect(navigate).toHaveBeenCalledWith("/signup?plan=agente");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("logged-in Abbonati invokes create-checkout with the live price_id and assigns the URL", async () => {
    authState.session = { user: { email: "buyer@test.it" } };
    invoke.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_agenzia" },
      error: null,
    });

    render(
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /Inizia la prova gratuita/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abbonati — Agenzia/i }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create-checkout", {
        body: { priceId: PLANS.agenzia.price_id },
      });
    });
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_agenzia");
    });
  });
});
