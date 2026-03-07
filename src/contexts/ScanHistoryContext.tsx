import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ScanResult } from "@/types";

export interface SavedScan {
  id: string;
  photo: string;
  address: string;
  lat: number | null;
  lng: number | null;
  date: string;
  moodScore: number | null;
  scanResult: Partial<ScanResult>;
}

interface ScanHistoryContextType {
  scans: SavedScan[];
  saveScan: (scan: Omit<SavedScan, "id" | "date">) => void;
  removeScan: (id: string) => void;
  clearAll: () => void;
  getScans: () => SavedScan[];
}

const STORAGE_KEY = "sottra_scan_history";
const MAX_SCANS = 10;
const THUMB_MAX = 200; // px – longest side for thumbnail

/** Downscale a base64 image to a small thumbnail to save localStorage space */
function makeThumbnail(base64: string): Promise<string> {
  return new Promise((resolve) => {
    // If it's not a data-url image, just return as-is (can't resize)
    if (!base64.startsWith("data:image")) {
      resolve(base64);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(THUMB_MAX / img.width, THUMB_MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

function loadFromStorage(): SavedScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveToStorage(scans: SavedScan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
  } catch {
    // localStorage full – drop oldest and retry
    if (scans.length > 1) {
      saveToStorage(scans.slice(0, -1));
    }
  }
}

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>(loadFromStorage);

  const saveScan = useCallback(async (scan: Omit<SavedScan, "id" | "date">) => {
    const thumb = await makeThumbnail(scan.photo);
    const newScan: SavedScan = {
      ...scan,
      photo: thumb,
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
