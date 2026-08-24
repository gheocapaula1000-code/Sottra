import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  clearLastScanPhoto,
  loadLastScanPhoto,
  mergeResultScanState,
  peekLastScanPhoto,
  saveLastScanPhoto,
} from "@/lib/lastScanPhotoStore";

/**
 * Tiny JPEG data URL fixture (1×1). Not a building photo.
 * Length > 100 so isValidImageDataUrl accepts it.
 */
const FIXTURE_A =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD/2Q==";
const FIXTURE_B = FIXTURE_A.replace("GfAD/2Q==", "GfAE/2Q==");

const D8_SNAPSHOT = {
  omiZone: {
    status: "success" as const,
    data: {
      zonaOmi: "D8",
      zonaOmiLabel: "S. Gregorio / Terranegra / Forcellini Est",
      comuneLabel: "Padova",
      quotazioneMinResidenziale: 1400,
      quotazioneMaxResidenziale: 2750,
    },
    message: null,
  },
  identify: {
    status: "success" as const,
    data: { address: "Via Forcellini 12, Padova", buildingId: "bld-test", confidence: 0.9 },
    message: null,
  },
};

const { scan, refresh, restoreResult } = vi.hoisted(() => ({
  scan: vi.fn(),
  refresh: vi.fn(),
  restoreResult: vi.fn(),
}));

vi.mock("@/hooks/useBuildingScan", () => {
  const idle = { status: "idle" as const, data: null, message: null };
  return {
    useBuildingScan: () => ({
      result: new Proxy({}, { get: () => idle }),
      scanning: false,
      refining: false,
      manualAddress: null,
      scan,
      refresh,
      refineAddress: vi.fn(),
      restoreResult,
      forceShowResult: false,
      setForceShowResult: vi.fn(),
    }),
  };
});

vi.mock("@/contexts/ScanHistoryContext", () => ({
  useScanHistory: () => ({ saveScan: vi.fn(), scans: [] }),
  compressToThumbnail: vi.fn(),
  serializeResult: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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

vi.mock("@/hooks/useImportCount", () => ({
  useImportCount: () => ({ count: 0, refetch: vi.fn() }),
}));

import Result from "@/pages/Result";
import Dashboard from "@/pages/Dashboard";

function renderResult(state?: { photo?: string; lat?: number | null; lng?: number | null; manualAddress?: string; savedResult?: typeof D8_SNAPSHOT }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/result", state }]}>
      <Result />
    </MemoryRouter>,
  );
}

describe("lastScanPhotoStore", () => {
  beforeEach(async () => {
    await clearLastScanPhoto();
  });

  it("saves and loads the actual JPEG plus lat/lng / address", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 45.4066,
      lng: 11.9172,
      manualAddress: "Via Forcellini 1, Padova",
    });
    const loaded = await loadLastScanPhoto();
    expect(loaded?.photo).toBe(FIXTURE_A);
    expect(loaded?.lat).toBe(45.4066);
    expect(loaded?.lng).toBe(11.9172);
    expect(loaded?.manualAddress).toBe("Via Forcellini 1, Padova");
  });

  it("new real photo overwrites last scan including the old snapshot", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 45.4,
      lng: 11.8,
      savedResult: D8_SNAPSHOT,
    });
    await saveLastScanPhoto({ photo: FIXTURE_B, lat: 45.41, lng: 11.87 });
    const loaded = await loadLastScanPhoto();
    expect(loaded?.photo).toBe(FIXTURE_B);
    expect(loaded?.photo).not.toBe(FIXTURE_A);
    expect(loaded?.lat).toBe(45.41);
    expect(loaded?.lng).toBe(11.87);
    expect(loaded?.savedResult).toBeUndefined();
  });

  it("keeps 0,0 as 0,0 when a typed address is present — does not invent GPS", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 0,
      lng: 0,
      manualAddress: "Via San Francesco 2, Padova",
      savedResult: D8_SNAPSHOT,
    });
    const loaded = await loadLastScanPhoto();
    expect(loaded?.lat).toBe(0);
    expect(loaded?.lng).toBe(0);
    expect(loaded?.manualAddress).toBe("Via San Francesco 2, Padova");
    expect(loaded?.lat).not.toBe(45.407);
    expect(loaded?.lng).not.toBe(11.876);
    expect(loaded?.savedResult).toEqual(D8_SNAPSHOT);
  });

  it("rejects a record without a real image data URL", async () => {
    await saveLastScanPhoto({ photo: "not-an-image", lat: 45.4, lng: 11.8 });
    expect(await loadLastScanPhoto()).toBeNull();
  });

  it("clear drops the stored shot", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 });
    await clearLastScanPhoto();
    expect(await loadLastScanPhoto()).toBeNull();
    expect(peekLastScanPhoto()).toBeNull();
  });

  it("merge prefers router photo over persisted, and restores when router lost it", () => {
    const persisted = { photo: FIXTURE_A, lat: 45.4, lng: 11.8, savedResult: D8_SNAPSHOT };
    expect(mergeResultScanState(null, persisted)?.photo).toBe(FIXTURE_A);
    expect(mergeResultScanState({ photo: FIXTURE_B, lat: 1, lng: 2 }, persisted)?.photo).toBe(FIXTURE_B);
    expect(mergeResultScanState({ photo: FIXTURE_B, lat: 1, lng: 2 }, persisted)?.savedResult).toBeUndefined();
    expect(mergeResultScanState({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 }, persisted)?.savedResult).toEqual(D8_SNAPSHOT);
    expect(mergeResultScanState(null, null)).toBeNull();
  });
});

describe("Result restores persisted photo after missing router state", () => {
  beforeEach(async () => {
    await clearLastScanPhoto();
    scan.mockReset();
    refresh.mockReset();
    restoreResult.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("empty router state restores persisted photo + saved snapshot and does not call scan()", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 45.4066,
      lng: 11.9172,
      savedResult: D8_SNAPSHOT,
    });

    renderResult(undefined);

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_A);
    expect(screen.queryByText("Nessuna immagine disponibile.")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(restoreResult).toHaveBeenCalledWith(D8_SNAPSHOT);
    });
    expect(scan).not.toHaveBeenCalled();
  });

  it("shows the stored JPEG and reuses lat/lng when location.state is empty and no snapshot yet", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4066, lng: 11.9172 });

    renderResult(undefined);

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_A);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_A, 45.4066, 11.9172, undefined);
    });
    expect(restoreResult).not.toHaveBeenCalled();
  });

  it("new scan overwrites — Result restores the latest fixture, not the first", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8, savedResult: D8_SNAPSHOT });
    await saveLastScanPhoto({ photo: FIXTURE_B, lat: 45.4066, lng: 11.9172 });

    renderResult(undefined);

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_B);
    expect(img).not.toHaveAttribute("src", FIXTURE_A);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_B, 45.4066, 11.9172, undefined);
    });
    expect(scan).not.toHaveBeenCalledWith(FIXTURE_A, expect.anything(), expect.anything(), expect.anything());
    expect(restoreResult).not.toHaveBeenCalled();
  });

  it("0,0 + typed address is passed through — not replaced with invented coords", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 0,
      lng: 0,
      manualAddress: "Via San Francesco 2, Padova",
    });

    renderResult(undefined);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_A, 0, 0, "Via San Francesco 2, Padova");
    });
    expect(scan).not.toHaveBeenCalledWith(expect.anything(), 45.407, 11.876, expect.anything());
    expect(await screen.findByAltText("Edificio acquisito")).toHaveAttribute("src", FIXTURE_A);
  });

  it("0,0 + typed address + snapshot restores without inventing coords or rescanning", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 0,
      lng: 0,
      manualAddress: "Via San Francesco 2, Padova",
      savedResult: D8_SNAPSHOT,
    });

    renderResult(undefined);

    await waitFor(() => {
      expect(restoreResult).toHaveBeenCalledWith(D8_SNAPSHOT);
    });
    expect(scan).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalledWith(expect.anything(), 45.407, 11.876, expect.anything());
    expect(await screen.findByAltText("Edificio acquisito")).toHaveAttribute("src", FIXTURE_A);
  });

  it("does not invent a photo when nothing was persisted", async () => {
    renderResult(undefined);

    expect(await screen.findByText("Nessuna immagine disponibile.")).toBeInTheDocument();
    expect(screen.queryByAltText("Edificio acquisito")).not.toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
    expect(restoreResult).not.toHaveBeenCalled();
  });

  it("router state photo wins over an older persisted shot", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8, savedResult: D8_SNAPSHOT });

    renderResult({ photo: FIXTURE_B, lat: 45.41, lng: 11.87 });

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_B);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_B, 45.41, 11.87, undefined);
    });
    expect(restoreResult).not.toHaveBeenCalled();
  });
});

describe("Dashboard mount does not wipe last scan", () => {
  afterEach(() => {
    cleanup();
  });

  it("Dashboard mount does not call clearLastScanPhoto", async () => {
    const dash = readFileSync("src/pages/Dashboard.tsx", "utf-8");
    expect(dash).not.toContain("clearLastScanPhoto");
    expect(dash).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*\{?\s*void clearLastScanPhoto/);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Pannello operativo")).toBeInTheDocument();
    expect(dash).not.toMatch(/clearLastScanPhoto\s*\(/);
  });
});

describe("last-scan photo wiring (no invented bytes)", () => {
  it("Result hydrates from IndexedDB store, not sessionStorage", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const store = readFileSync("src/lib/lastScanPhotoStore.ts", "utf-8");
    const scanSrc = readFileSync("src/pages/Scan.tsx", "utf-8");
    const dash = readFileSync("src/pages/Dashboard.tsx", "utf-8");
    const app = readFileSync("src/App.tsx", "utf-8");
    expect(store).toContain("indexedDB");
    expect(store).toContain("savedResult");
    expect(store).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(result).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(scanSrc).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(result).toContain("loadLastScanPhoto");
    expect(result).toContain("saveLastScanPhoto");
    expect(result).toContain("mergeResultScanState");
    expect(result).toContain("savedResult");
    expect(result).toContain('navigate("/app")');
    expect(scanSrc).toContain("saveLastScanPhoto");
    expect(scanSrc).toContain("replace: true");
    expect(scanSrc).not.toContain("clearLastScanPhoto");
    expect(dash).not.toContain("clearLastScanPhoto");
    expect(app).toMatch(/path="\/history"\s+element=\{<TrialProtectedRoute>/);
  });
});
