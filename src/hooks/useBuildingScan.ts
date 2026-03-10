import { useReducer, useState, useCallback, useRef } from "react";
import { identifyBuilding, getPricing } from "@/services/scan";
import { getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico, getSviluppoArea } from "@/services/forecast";
import { supabase } from "@/integrations/supabase/client";
import type { ScanResult, SectionState } from "@/types";

const idle = { status: "idle" as const, data: null, message: null };

const initialState: ScanResult = {
  identify: idle, cadastral: idle, pricing: idle,
  listings: idle, energy: idle, condominio: idle,
  storicoTransazioni: idle, moodScore: idle, timeView: idle,
  opportunity: idle, infrastrutture: idle, rischioZona: idle,
  trendDemografico: idle, sviluppoArea: idle,
} as ScanResult;

type Action =
  | { type: "RESET_ALL_LOADING" }
  | { type: "RESET_IDLE" }
  | { type: "SET"; key: keyof ScanResult; value: { status: SectionState["status"]; data: unknown; message: string | null } };

function reducer(state: ScanResult, action: Action): ScanResult {
  switch (action.type) {
    case "RESET_ALL_LOADING":
      return Object.fromEntries(
        Object.keys(initialState).map((k) => [k, { status: "loading", data: null, message: null }])
      ) as unknown as ScanResult;
    case "RESET_IDLE":
      return initialState;
    case "SET":
      return { ...state, [action.key]: action.value } as ScanResult;
    default:
      return state;
  }
}

export function useBuildingScan() {
  const [result, dispatch] = useReducer(reducer, initialState);
  const [scanning, setScanning] = useState(false);
  const scanIdRef = useRef<string | null>(null);

  const scan = useCallback(async (photo: string, lat: number, lng: number) => {
    // Generate unique scan_id for idempotent counting
    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setScanning(true);
    dispatch({ type: "RESET_ALL_LOADING" });

    const set = (key: keyof ScanResult, value: { status: SectionState["status"]; data: unknown; message: string | null }) =>
      dispatch({ type: "SET", key, value });

    const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) => {
      set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
    };

    const reject = (key: keyof ScanResult) => (err: unknown) => {
      console.error(`[SCAN] ${key} rejected:`, err);
      set(key, { status: "error", data: null, message: err instanceof Error ? err.message : "Errore imprevisto" });
    };

    // Record scan consumption (idempotent, fire-and-forget)
    supabase.functions.invoke("record-scan", {
      body: { scan_id: scanId },
    }).catch((err) => {
      console.error("[SCAN] record-scan failed:", err);
    });

    const scanEngine = async () => {
      const idRes = await identifyBuilding(photo, lat, lng);
      set("identify", {
        status: idRes.error ? "error" : "success",
        data: idRes.data,
        message: idRes.message,
      });

      if (idRes.error || !idRes.data) return;

      const address = (idRes.data as { address?: string }).address ?? "";
      if (!address) return;

      // Only live modules
      await Promise.allSettled([
        getPricing(address, photo).then(resolve("pricing")).catch(reject("pricing")),
      ]);
    };

    const forecastEngine = async () => {
      await Promise.allSettled([
        getTimeView(lat, lng, 12).then(resolve("timeView")).catch(reject("timeView")),
        getOpportunityIndex(lat, lng).then(resolve("opportunity")).catch(reject("opportunity")),
        getInfrastrutture(lat, lng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
        getRischioZona(lat, lng).then(resolve("rischioZona")).catch(reject("rischioZona")),
        getTrendDemografico(lat, lng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
        getSviluppoArea(lat, lng).then(resolve("sviluppoArea")).catch(reject("sviluppoArea")),
      ]);
    };

    await Promise.allSettled([scanEngine(), forecastEngine()]);
    setScanning(false);
  }, []);

  return {
    result,
    scanning,
    scan,
    scanId: scanIdRef.current,
    reset: () => { dispatch({ type: "RESET_IDLE" }); setScanning(false); },
  };
}
