import { useReducer, useState, useCallback } from "react";
import { identifyBuilding, getCadastral, getPricing, getListings, getEnergy, getCondominio, getStoricoTransazioni } from "@/services/scan";
import { getMoodScore, getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico, getSviluppoArea } from "@/services/forecast";
import type { ScanResult, SectionState } from "@/types";

const idle = { status: "idle" as const, data: null, message: null };

const initialState: ScanResult = {
  identify: idle, cadastral: idle, pricing: idle,
  listings: idle, energy: idle, condominio: idle,
  storicoTransazioni: idle, moodScore: idle, timeView: idle,
  opportunity: idle, infrastrutture: idle, rischioZona: idle,
  trendDemografico: idle,
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

  const scan = useCallback(async (photo: string, lat: number, lng: number) => {
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

      await Promise.allSettled([
        getCadastral(address, photo).then(resolve("cadastral")).catch(reject("cadastral")),
        getPricing(address, photo).then(resolve("pricing")).catch(reject("pricing")),
        getListings(address, photo).then(resolve("listings")).catch(reject("listings")),
        getEnergy(address, photo).then(resolve("energy")).catch(reject("energy")),
        getCondominio(address, photo).then(resolve("condominio")).catch(reject("condominio")),
        getStoricoTransazioni(address, photo).then(resolve("storicoTransazioni")).catch(reject("storicoTransazioni")),
      ]);
    };

    const forecastEngine = async () => {
      await Promise.allSettled([
        getMoodScore(lat, lng).then(resolve("moodScore")).catch(reject("moodScore")),
        getTimeView(lat, lng, 12).then(resolve("timeView")).catch(reject("timeView")),
        getOpportunityIndex(lat, lng).then(resolve("opportunity")).catch(reject("opportunity")),
        getInfrastrutture(lat, lng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
        getRischioZona(lat, lng).then(resolve("rischioZona")).catch(reject("rischioZona")),
        getTrendDemografico(lat, lng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
      ]);
    };

    await Promise.allSettled([scanEngine(), forecastEngine()]);
    setScanning(false);
  }, []);

  return {
    result,
    scanning,
    scan,
    reset: () => { dispatch({ type: "RESET_IDLE" }); setScanning(false); },
  };
}
