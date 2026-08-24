/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearLastScanPhoto } from "@/lib/lastScanPhotoStore";
import type { ScanResult, SectionState } from "@/types";

/**
 * Scan history — stores structured scan results for real report reopening.
 * Photos are stored as compressed thumbnails to fit localStorage constraints.
 */

export interface SavedScan {
  id: string;
  /** Short locality label (city/zone) */
  locality: string;
  date: string;
  moodScore: number | null;
  convergenzaTerritoriale: {
    score: number | null;
    band: string | null;
  } | null;
  /** GPS coordinates — needed to reopen report */
  lat: number | null;
  lng: number | null;
  /** Compressed photo thumbnail (small JPEG) — may be null if storage failed */
  photoThumbnail: string | null;
  /** Full scan result snapshot — enables real report reopening */
  resultSnapshot: Partial<ScanResult> | null;
  /** Geo level used for the primary reading */
  primaryGeoLevel: string | null;
  /** Whether the report is fully restorable */
  restorable: boolean;
}

interface ScanHistoryContextType {
  scans: SavedScan[];
  saveScan: (scan: Omit<SavedScan, "id" | "date">) => void;
  removeScan: (id: string) => void;
  clearAll: () => void;
  getScans: () => SavedScan[];
}

const STORAGE_KEY = "sottra_scan_history";
const MAX_SCANS = 5; // Reduced from 10 to fit full results in localStorage

/* ── Thumbnail compression ─────────────────────────────── */

/**
 * Compress a photo to a small thumbnail for localStorage storage.
 * Target: ~30-50KB JPEG to keep total storage manageable.
 */
function compressToThumbnail(photoDataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 320;
        let w = img.width;
        let h = img.height;
        if (w > h) { h = Math.round(h * (MAX_DIM / w)); w = MAX_DIM; }
        else { w = Math.round(w * (MAX_DIM / h)); h = MAX_DIM; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.onerror = () => resolve(null);
      img.src = photoDataUrl;
    } catch {
      resolve(null);
    }
  });
}

/* ── Serialization helpers ─────────────────────────────── */

/**
 * Serialize a ScanResult for storage, stripping non-essential fields
 * to reduce localStorage footprint.
 */
function serializeResult(result: Partial<ScanResult>): Partial<ScanResult> | null {
  try {
    const serializable: Record<string, SectionState> = {};
    for (const [key, section] of Object.entries(result)) {
      const s = section as SectionState;
      if (s && s.status === "success" && s.data != null) {
        serializable[key] = { status: "success", data: s.data, message: null };
      }
    }
    // Test if it can be stringified
    JSON.stringify(serializable);
    return serializable as Partial<ScanResult>;
  } catch {
    return null;
  }
}

/* ── Legacy migration ─────────────────────────────────── */

interface LegacyEntry {
  id?: string;
  photo?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  locality?: string;
  date?: string;
  moodScore?: number | null;
  convergenzaTerritoriale?: Record<string, unknown> | null;
  scanResult?: unknown;
  // New fields that may or may not be present
  photoThumbnail?: string | null;
  resultSnapshot?: unknown;
  primaryGeoLevel?: string | null;
  restorable?: boolean;
}

function migrateLegacy(raw: unknown[]): SavedScan[] {
  return raw
    .filter((e): e is LegacyEntry => !!e && typeof e === "object")
    .map((entry) => {
      let locality = entry.locality ?? "";
      if (!locality && entry.address) {
        const parts = entry.address.split(",").map((p: string) => p.trim());
        locality = parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? "";
      }

      const ct = entry.convergenzaTerritoriale;
      return {
        id: entry.id ?? crypto.randomUUID(),
        locality,
        date: entry.date ?? new Date().toISOString(),
        moodScore: typeof entry.moodScore === "number" ? entry.moodScore : null,
        convergenzaTerritoriale: ct
          ? {
              score: typeof ct.score === "number" ? ct.score : null,
              band: typeof ct.band === "string" ? ct.band : null,
            }
          : null,
        lat: typeof entry.lat === "number" ? entry.lat : null,
        lng: typeof entry.lng === "number" ? entry.lng : null,
        photoThumbnail: typeof entry.photoThumbnail === "string" ? entry.photoThumbnail : null,
        resultSnapshot: entry.resultSnapshot as Partial<ScanResult> | null ?? null,
        primaryGeoLevel: typeof entry.primaryGeoLevel === "string" ? entry.primaryGeoLevel : null,
        restorable: typeof entry.restorable === "boolean" ? entry.restorable : false,
      };
    })
    .slice(0, MAX_SCANS);
}

function loadFromStorage(): SavedScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Detect legacy format (has photo/address/scanResult fields but no resultSnapshot)
    const isLegacy = parsed.some(
      (e: Record<string, unknown>) => e && ("photo" in e || "scanResult" in e) && !("restorable" in e),
    );

    if (isLegacy) {
      const migrated = migrateLegacy(parsed);
      saveToStorage(migrated);
      console.info("[ScanHistory] Migrated legacy entries");
      return migrated;
    }

    return parsed as SavedScan[];
  } catch {
    return [];
  }
}

function saveToStorage(scans: SavedScan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
  } catch {
    // localStorage full — try dropping result snapshots from oldest scans
    if (scans.length > 1) {
      const trimmed = scans.map((s, i) => 
        i >= 2 ? { ...s, resultSnapshot: null, restorable: false } : s
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return;
      } catch { /* fall through */ }
    }
    // Last resort: drop oldest
    if (scans.length > 1) {
      saveToStorage(scans.slice(0, -1));
    }
  }
}

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>(loadFromStorage);

  // One-time cleanup on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.some((e: Record<string, unknown>) => "photo" in e && !("restorable" in e))) {
          const migrated = migrateLegacy(parsed);
          saveToStorage(migrated);
          setScans(migrated);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveScan = useCallback(async (scan: Omit<SavedScan, "id" | "date">) => {
    const newScan: SavedScan = {
      ...scan,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    setScans((prev) => {
      const updated = [newScan, ...prev].slice(0, MAX_SCANS);
      saveToStorage(updated);
      return updated;
    });
    const { data: { session } } = await supabase.auth.getSession();

    supabase.functions.invoke("sottra", {
      body: {
        route: "scan/save",
        address: scan.locality,
        comune: scan.locality,
        lat: scan.lat,
        lng: scan.lng,
        photo_thumbnail: scan.photoThumbnail,
        result_snapshot: scan.resultSnapshot,
      },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    }).catch(() => {});
  }, []);

  const removeScan = useCallback((id: string) => {
    setScans((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setScans([]);
    localStorage.removeItem(STORAGE_KEY);
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
