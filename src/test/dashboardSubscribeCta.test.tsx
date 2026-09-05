import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "trial@test.it" }, signOut: vi.fn() }),
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    subscribed: false,
    trial: { active: true, scans_used: 2, max_scans: 5 },
    isAdmin: false,
    isOwner: false,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    planKey: null,
    canManageBilling: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/contexts/ScanHistoryContext", () => ({
  useScanHistory: () => ({ scans: [], saveScan: vi.fn() }),
}));

vi.mock("@/hooks/useImportCount", () => ({
  useImportCount: () => ({ count: 0, refetch: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/lastScanPhotoStore", () => ({
  clearLastScanPhoto: vi.fn(),
}));

import Dashboard from "@/pages/Dashboard";

describe("Dashboard trial subscribe CTA", () => {
  afterEach(() => {
    cleanup();
    navigate.mockReset();
  });

  it("shows Abbonati while the free trial is active and opens /abbonamento", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Pannello operativo")).toBeInTheDocument();
    const ctas = screen.getAllByRole("button", { name: /Abbonati/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(ctas[0]);
    expect(navigate).toHaveBeenCalledWith("/abbonamento");
  });
});
