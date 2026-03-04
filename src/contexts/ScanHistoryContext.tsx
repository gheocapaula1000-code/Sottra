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
  getScans: () => SavedScan[];
}

const ScanHistoryContext = createContext<ScanHistoryContextType | null>(null);

const mockScans: SavedScan[] = [
  {
    id: "mock-1",
    photo: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=300&fit=crop",
    address: "Via Roma 12, Milano",
    lat: 45.4642,
    lng: 9.1900,
    date: new Date(Date.now() - 86400000).toISOString(),
    moodScore: 78,
    scanResult: {},
  },
  {
    id: "mock-2",
    photo: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
    address: "Corso Vittorio Emanuele 45, Torino",
    lat: 45.0703,
    lng: 7.6869,
    date: new Date(Date.now() - 172800000).toISOString(),
    moodScore: 52,
    scanResult: {},
  },
  {
    id: "mock-3",
    photo: "https://images.unsplash.com/photo-1464146072230-91cabc968266?w=400&h=300&fit=crop",
    address: "Piazza San Marco 1, Venezia",
    lat: 45.4343,
    lng: 12.3388,
    date: new Date(Date.now() - 604800000).toISOString(),
    moodScore: null,
    scanResult: {},
  },
];

export function ScanHistoryProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<SavedScan[]>(mockScans);

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
