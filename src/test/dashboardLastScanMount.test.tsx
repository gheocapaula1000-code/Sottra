import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const clearLastScanPhoto = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lastScanPhotoStore", () => ({
  clearLastScanPhoto,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "paula@test.it" }, signOut: vi.fn() }),
}));

vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    subscribed: true,
    trial: { active: true, scans_used: 1, max_scans: 5 },
    isAdmin: false,
    isOwner: false,
    subscriptionStatus: "active",
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

import Dashboard from "@/pages/Dashboard";

describe("Dashboard mount last-scan", () => {
  afterEach(() => {
    cleanup();
    clearLastScanPhoto.mockClear();
  });

  it("does not call clearLastScanPhoto on mount", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Pannello operativo")).toBeInTheDocument();
    expect(clearLastScanPhoto).not.toHaveBeenCalled();
  });
});
