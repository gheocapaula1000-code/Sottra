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

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>([]);

  const saveScan = useCallback((scan: Omit<SavedScan, "id" | "date">) => {
    const newScan: SavedScan = {
      ...scan,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    setScans((prev) => [newScan, ...prev]);
  }, []);

  const removeScan = useCallback((id: string) => {
    setScans((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getScans = useCallback(() => scans, [scans]);

  return (
    <ScanHistoryContext.Provider value={{ scans, saveScan, removeScan, getScans }}>
      {children}
    </ScanHistoryContext.Provider>
  );
}

export function useScanHistory() {
  const ctx = useContext(ScanHistoryContext);
  if (!ctx) throw new Error("useScanHistory must be used within ScanHistoryProvider");
  return ctx;
}
