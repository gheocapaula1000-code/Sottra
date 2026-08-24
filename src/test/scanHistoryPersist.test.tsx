import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScanHistoryProvider } from "@/contexts/ScanHistoryContext";
import History from "@/pages/History";
import Result from "@/pages/Result";
import {
  buildHistoryDraft,
  clearHistoryRows,
  formatHistoryLocality,
  isHistoryRestorable,
  loadHistoryRows,
  persistHistoryRows,
  resetHistoryMemoryCache,
  shouldRecordFinishedScan,
  upsertHistoryList,
  type SavedScan,
} from "@/lib/scanHistoryStore";
/** Tiny JPEG fixture — not a building photo. Length > 100 for isValidImageDataUrl. */
const FIXTURE =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD/2Q==";

const { PADOVA_D8, idle } = vi.hoisted(() => ({
  PADOVA_D8: {
    sourceType: "official" as const,
    zonaOmi: "D8",
    zonaOmiLabel: "S. Gregorio / Terranegra / Forcellini Est",
    comuneLabel: "Padova",
    quotazioneMinResidenziale: 1400,
    quotazioneMaxResidenziale: 1850,
  },
  idle: { status: "idle" as const, data: null, message: null },
}));

function d8Snapshot() {
  return {
    omiZone: { status: "success" as const, data: PADOVA_D8, message: null },
    identify: {
      status: "success" as const,
      data: { address: "Via Forcellini 12, Padova", confidence: 0.9 },
      message: null,
    },
  };
}

function finishedRow(overrides: Partial<SavedScan> = {}): SavedScan {
  const draft = buildHistoryDraft({
    id: overrides.id ?? "scan-d8-1",
    photoThumbnail: FIXTURE,
    resultSnapshot: d8Snapshot(),
    officialOmi: PADOVA_D8,
    lat: 45.4066,
    lng: 11.9172,
    primaryGeoLevel: "zona_omi",
    convergenzaTerritoriale: null,
  });
  return {
    ...draft,
    id: draft.id ?? "scan-d8-1",
    date: overrides.date ?? "2026-08-24T08:00:00.000Z",
    ...overrides,
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({
        order: () => ({
          limit: async () => ({ data: [] }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/useBuildingScan", () => ({
  useBuildingScan: () => ({
    result: new Proxy({
      identify: {
        status: "success",
        data: { address: "Via Forcellini 12, Padova", confidence: 0.9 },
        message: null,
      },
      omiZone: { status: "success", data: PADOVA_D8, message: null },
    }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : idle) }),
    scanning: false,
    refining: false,
    manualAddress: null,
    scan: vi.fn(),
    refresh: vi.fn(),
    refineAddress: vi.fn(),
    restoreResult: vi.fn(),
    forceShowResult: false,
    setForceShowResult: vi.fn(),
  }),
}));

function providers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Providers({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ScanHistoryProvider>
          <MemoryRouter initialEntries={[{
            pathname: "/result",
            state: { photo: FIXTURE, lat: 45.4066, lng: 11.9172 },
          }]}
          >
            {children}
          </MemoryRouter>
        </ScanHistoryProvider>
      </QueryClientProvider>
    );
  };
}

describe("history draft helpers — zero mock", () => {
  it("formats Padova D8 from official fields and does not invent them", () => {
    expect(formatHistoryLocality("Padova", "D8")).toBe("Padova D8");
    expect(formatHistoryLocality(null, null)).toBe("Posizione non disponibile");
    expect(formatHistoryLocality("Padova", null)).toBe("Padova");
  });

  it("records a finished official-OMI scan and marks it restorable", () => {
    expect(shouldRecordFinishedScan({
      scanning: false,
      hasPhoto: true,
      officialOmi: PADOVA_D8,
      identifyOk: true,
    })).toBe(true);
    expect(shouldRecordFinishedScan({
      scanning: true,
      hasPhoto: true,
      officialOmi: PADOVA_D8,
      identifyOk: true,
    })).toBe(false);
    expect(shouldRecordFinishedScan({
      scanning: false,
      hasPhoto: false,
      officialOmi: PADOVA_D8,
      identifyOk: true,
    })).toBe(false);

    const draft = buildHistoryDraft({
      photoThumbnail: FIXTURE,
      resultSnapshot: d8Snapshot(),
      officialOmi: PADOVA_D8,
      lat: 45.4066,
      lng: 11.9172,
      primaryGeoLevel: "zona_omi",
      convergenzaTerritoriale: null,
    });
    expect(draft.locality).toBe("Padova D8");
    expect(draft.zonaOmi).toBe("D8");
    expect(draft.comune).toBe("Padova");
    expect(draft.restorable).toBe(true);
    expect(isHistoryRestorable(draft)).toBe(true);
  });

  it("does not invent OMI when official data is missing", () => {
    const draft = buildHistoryDraft({
      photoThumbnail: FIXTURE,
      resultSnapshot: { identify: { status: "success", data: { address: "Via Roma 1, Milano" }, message: null } },
      officialOmi: null,
      lat: 45.46,
      lng: 9.19,
      identifyAddress: "Via Roma 1, Milano",
      primaryGeoLevel: "comune",
      convergenzaTerritoriale: null,
    });
    expect(draft.zonaOmi).toBeNull();
    expect(draft.locality).not.toContain("D8");
    expect(draft.locality).not.toBe("Padova D8");
  });
});

describe("history store — persist, reload, append", () => {
  beforeEach(async () => {
    await clearHistoryRows();
    resetHistoryMemoryCache();
  });

  it("reload still shows a restorable D8 row", async () => {
    await persistHistoryRows([finishedRow()]);
    resetHistoryMemoryCache();
    const rows = await loadHistoryRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].locality).toBe("Padova D8");
    expect(rows[0].restorable).toBe(true);
    expect(rows[0].photoThumbnail).toBe(FIXTURE);
    expect(rows[0].zonaOmi).toBe("D8");
  });

  it("new scan appends; same id updates in place", () => {
    const a = finishedRow({ id: "a" });
    const b = finishedRow({
      id: "b",
      comune: "Padova",
      zonaOmi: "B1",
      locality: "Padova B1",
      lat: 45.41,
      lng: 11.87,
    });
    const once = upsertHistoryList([], a);
    const two = upsertHistoryList(once, b);
    expect(two).toHaveLength(2);
    expect(two.map((s) => s.id)).toEqual(["b", "a"]);
    const updated = finishedRow({ id: "a", locality: "Padova D8" });
    const again = upsertHistoryList(two, updated);
    expect(again).toHaveLength(2);
    expect(again.filter((s) => s.id === "a")).toHaveLength(1);
    expect(again.find((s) => s.id === "a")?.date).toBe(a.date);
  });
});

describe("History page after a finished D8 result", () => {
  beforeEach(async () => {
    await clearHistoryRows();
    resetHistoryMemoryCache();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists one restorable Padova D8 scan after Result finishes", async () => {
    const { rerender } = render(<Result />, { wrapper: providers() });

    await waitFor(() => {
      expect(screen.getByAltText("Edificio acquisito")).toBeInTheDocument();
    });
    await waitFor(async () => {
      const rows = await loadHistoryRows();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].locality).toBe("Padova D8");
    });

    rerender(<History />);

    await waitFor(() => {
      expect(screen.getByText("Padova D8")).toBeInTheDocument();
    });
    expect(screen.queryByText("Nessuna scansione effettuata")).not.toBeInTheDocument();
    expect(screen.queryByText("Risultato non più ricostruibile")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /padova d8/i })).not.toBeDisabled();
  });

  it("reload of History still lists the stored D8 scan", async () => {
    await persistHistoryRows([finishedRow()]);
    resetHistoryMemoryCache();

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ScanHistoryProvider>
          <MemoryRouter>
            <History />
          </MemoryRouter>
        </ScanHistoryProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Padova D8")).toBeInTheDocument();
    expect(screen.queryByText("Nessuna scansione effettuata")).not.toBeInTheDocument();
  });
});

describe("history wiring", () => {
  it("Result auto-saves into Cronologia; History reopens a snapshot", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const history = readFileSync("src/pages/History.tsx", "utf-8");
    const ctx = readFileSync("src/contexts/ScanHistoryContext.tsx", "utf-8");
    expect(result).toContain("shouldRecordFinishedScan");
    expect(result).toContain("buildHistoryDraft");
    expect(result).toContain("saveScan");
    expect(history).toContain("canReopenHistoryScan");
    expect(ctx).toContain("sottra_scans");
    expect(ctx).toContain("upsert");
    expect(readFileSync("src/App.tsx", "utf-8")).toMatch(
      /path="\/history"\s+element=\{<TrialProtectedRoute>/,
    );
  });
});
