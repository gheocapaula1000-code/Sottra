/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

/**
 * Scan history — stores ONLY non-sensitive metadata.
 * No photos, no full addresses, no precise coordinates.
 */

export interface SavedScan {
  id: string;
  /** Short locality label (city/zone), NOT full address */
  locality: string;
  date: string;
  moodScore: number | null;
  convergenzaTerritoriale: {
    score: number | null;
    band: string | null;
  } | null;
}

interface ScanHistoryContextType {
  scans: SavedScan[];
  saveScan: (scan: Omit<SavedScan, "id" | "date">) => void;
  removeScan: (id: string) => void;
  clearAll: () => void;
  getScans: () => SavedScan[];
}

const STORAGE_KEY = "sottra_scan_history";
const LEGACY_KEY = "sottra_scan_history"; // same key, legacy format cleaned on load
const MAX_SCANS = 10;

/* ── Legacy migration: strip PII from old entries ─────── */

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
}

function migrateLegacy(raw: unknown[]): SavedScan[] {
  return raw
    .filter((e): e is LegacyEntry => !!e && typeof e === "object")
    .map((entry) => {
      // Derive locality from old address if present (take city-level only)
      let locality = entry.locality ?? "";
      if (!locality && entry.address) {
        // Attempt to extract city from comma-separated address
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

    // Detect legacy format (has photo/address/lat/lng fields)
    const isLegacy = parsed.some(
      (e: Record<string, unknown>) => e && ("photo" in e || "lat" in e || "scanResult" in e),
    );

    if (isLegacy) {
      const migrated = migrateLegacy(parsed);
      // Overwrite with clean data immediately
      saveToStorage(migrated);
      console.info("[ScanHistory] Migrated legacy entries — PII removed");
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
    // localStorage full — drop oldest and retry
    if (scans.length > 1) {
      saveToStorage(scans.slice(0, -1));
    }
  }
}

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>(loadFromStorage);

  // One-time cleanup on mount: purge any leftover legacy keys
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.some((e: Record<string, unknown>) => "photo" in e || "lat" in e)) {
          const migrated = migrateLegacy(parsed);
          saveToStorage(migrated);
          setScans(migrated);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveScan = useCallback((scan: Omit<SavedScan, "id" | "date">) => {
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
