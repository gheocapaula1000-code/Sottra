/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearLastScanPhoto } from "@/lib/lastScanPhotoStore";
import {
  type HistoryDraft,
  type SavedScan,
  clearHistoryRows,
  compressToThumbnail,
  loadHistoryRows,
  persistHistoryRows,
  serializeResult,
  upsertHistoryList,
} from "@/lib/scanHistoryStore";

export type { SavedScan, HistoryDraft } from "@/lib/scanHistoryStore";

interface ScanHistoryContextType {
  scans: SavedScan[];
  saveScan: (scan: HistoryDraft) => Promise<SavedScan>;
  removeScan: (id: string) => void;
  clearAll: () => void;
  getScans: () => SavedScan[];
}

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

async function upsertCloudScan(scan: SavedScan): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const row = {
      id: scan.id,
      comune: scan.comune ?? scan.locality,
      lat: scan.lat,
      lng: scan.lng,
      zona_omi: scan.zonaOmi,
      photo_thumbnail: scan.photoThumbnail,
      result_snapshot: scan.resultSnapshot,
    };

    const client = supabase as unknown as {
      from: (t: string) => {
        upsert: (v: unknown) => Promise<{ error: { message?: string } | null }>;
      };
      functions: {
        invoke: (name: string, opts: { body: unknown; headers?: Record<string, string> }) => Promise<unknown>;
      };
    };

    const { error } = await client.from("sottra_scans").upsert(row);
    if (error) {
      await client.functions.invoke("sottra", {
        body: {
          route: "scan/save",
          address: scan.locality,
          comune: scan.comune ?? scan.locality,
          lat: scan.lat,
          lng: scan.lng,
          zona_omi: scan.zonaOmi,
          photo_thumbnail: scan.photoThumbnail,
          result_snapshot: scan.resultSnapshot,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    }
  } catch {
    // Local row already persisted — do not swallow the scan.
  }
}

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadHistoryRows().then((rows) => {
      if (!cancelled) setScans(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveScan = useCallback(async (scan: HistoryDraft) => {
    const newScan: SavedScan = {
      ...scan,
      id: scan.id ?? crypto.randomUUID(),
      date: scan.date ?? new Date().toISOString(),
      zonaOmi: scan.zonaOmi ?? null,
      comune: scan.comune ?? null,
    };
    setScans((prev) => {
      const updated = upsertHistoryList(prev, newScan);
      void persistHistoryRows(updated);
      return updated;
    });
    void upsertCloudScan(newScan);
    return newScan;
  }, []);

  const removeScan = useCallback((id: string) => {
    setScans((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      void persistHistoryRows(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setScans([]);
    void clearHistoryRows();
    void clearLastScanPhoto();
  }, []);

  const getScans = useCallback(() => scans, [scans]);

  return (
    <ScanHistoryContext.Provider value={{ scans, saveScan, removeScan, clearAll, getScans }}>
      {children}
    </ScanHistoryContext.Provider>
  );
}

export function useScanHistory() {
  const ctx = useContext(ScanHistoryContext);
  if (!ctx) throw new Error("useScanHistory must be used within ScanHistoryProvider");
  return ctx;
}

export { compressToThumbnail, serializeResult };
