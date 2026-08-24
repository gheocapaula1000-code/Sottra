import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  clearLastScanPhoto,
  loadLastScanPhoto,
  mergeResultScanState,
  saveLastScanPhoto,
} from "@/lib/lastScanPhotoStore";

/**
 * Tiny JPEG data URL fixture (1×1). Not a building photo.
 * Length > 100 so isValidImageDataUrl accepts it.
 */
const FIXTURE_A =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD/2Q==";
const FIXTURE_B = FIXTURE_A.replace("GfAD/2Q==", "GfAE/2Q==");

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
  useScanHistory: () => ({ saveScan: vi.fn() }),
  compressToThumbnail: vi.fn(),
  serializeResult: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import Result from "@/pages/Result";

function renderResult(state?: { photo?: string; lat?: number | null; lng?: number | null; manualAddress?: string }) {
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

  it("new scan overwrites the stored photo", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 });
    await saveLastScanPhoto({ photo: FIXTURE_B, lat: 45.41, lng: 11.87 });
    const loaded = await loadLastScanPhoto();
    expect(loaded?.photo).toBe(FIXTURE_B);
    expect(loaded?.photo).not.toBe(FIXTURE_A);
    expect(loaded?.lat).toBe(45.41);
    expect(loaded?.lng).toBe(11.87);
  });

  it("keeps 0,0 as 0,0 when a typed address is present — does not invent GPS", async () => {
    await saveLastScanPhoto({
      photo: FIXTURE_A,
      lat: 0,
      lng: 0,
      manualAddress: "Via San Francesco 2, Padova",
    });
    const loaded = await loadLastScanPhoto();
    expect(loaded?.lat).toBe(0);
    expect(loaded?.lng).toBe(0);
    expect(loaded?.manualAddress).toBe("Via San Francesco 2, Padova");
    expect(loaded?.lat).not.toBe(45.407);
    expect(loaded?.lng).not.toBe(11.876);
  });

  it("rejects a record without a real image data URL", async () => {
    await saveLastScanPhoto({ photo: "not-an-image", lat: 45.4, lng: 11.8 });
    expect(await loadLastScanPhoto()).toBeNull();
  });

  it("clear drops the stored shot", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 });
    await clearLastScanPhoto();
    expect(await loadLastScanPhoto()).toBeNull();
  });

  it("merge prefers router photo over persisted, and restores when router lost it", () => {
    const persisted = { photo: FIXTURE_A, lat: 45.4, lng: 11.8 };
    expect(mergeResultScanState(null, persisted)?.photo).toBe(FIXTURE_A);
    expect(mergeResultScanState({ photo: FIXTURE_B, lat: 1, lng: 2 }, persisted)?.photo).toBe(FIXTURE_B);
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

  it("shows the stored JPEG and reuses lat/lng when location.state is empty", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4066, lng: 11.9172 });

    renderResult(undefined);

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_A);
    expect(screen.queryByText("Nessuna immagine disponibile.")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_A, 45.4066, 11.9172, undefined);
    });
  });

  it("new scan overwrites — Result restores the latest fixture, not the first", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 });
    await saveLastScanPhoto({ photo: FIXTURE_B, lat: 45.4066, lng: 11.9172 });

    renderResult(undefined);

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_B);
    expect(img).not.toHaveAttribute("src", FIXTURE_A);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_B, 45.4066, 11.9172, undefined);
    });
    expect(scan).not.toHaveBeenCalledWith(FIXTURE_A, expect.anything(), expect.anything(), expect.anything());
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

  it("does not invent a photo when nothing was persisted", async () => {
    renderResult(undefined);

    expect(await screen.findByText("Nessuna immagine disponibile.")).toBeInTheDocument();
    expect(screen.queryByAltText("Edificio acquisito")).not.toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
  });

  it("router state photo wins over an older persisted shot", async () => {
    await saveLastScanPhoto({ photo: FIXTURE_A, lat: 45.4, lng: 11.8 });

    renderResult({ photo: FIXTURE_B, lat: 45.41, lng: 11.87 });

    const img = await screen.findByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", FIXTURE_B);

    await waitFor(() => {
      expect(scan).toHaveBeenCalledWith(FIXTURE_B, 45.41, 11.87, undefined);
    });
  });
});

describe("last-scan photo wiring (no invented bytes)", () => {
  it("Result hydrates from IndexedDB store, not sessionStorage", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const store = readFileSync("src/lib/lastScanPhotoStore.ts", "utf-8");
    const scan = readFileSync("src/pages/Scan.tsx", "utf-8");
    expect(store).toContain("indexedDB");
    expect(store).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(result).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(scan).not.toMatch(/sessionStorage\.(get|set|remove)Item/);
    expect(result).toContain("loadLastScanPhoto");
    expect(result).toContain("saveLastScanPhoto");
    expect(scan).toContain("saveLastScanPhoto");
    expect(scan).toContain("clearLastScanPhoto");
    expect(readFileSync("src/pages/Dashboard.tsx", "utf-8")).toContain("clearLastScanPhoto");
  });
});
