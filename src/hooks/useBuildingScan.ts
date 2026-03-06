import { useState, useCallback } from "react";
import { identifyBuilding, getCadastral, getPricing, getListings, getEnergy, getCondominio, getStoricoTransazioni } from "@/services/scan";
import { getMoodScore, getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico } from "@/services/forecast";
import type { ScanResult, SectionState } from "@/types";

const idle = { status: "idle" as const, data: null, message: null };

const initialState: ScanResult = {
  identify: idle, cadastral: idle, pricing: idle,
  listings: idle, energy: idle, condominio: idle,
  storicoTransazioni: idle, moodScore: idle, timeView: idle,
  opportunity: idle, infrastrutture: idle, rischioZona: idle,
  trendDemografico: idle,
} as ScanResult;

export function useBuildingScan() {
  const [result, setResult] = useState<ScanResult>(initialState);
  const [scanning, setScanning] = useState(false);

  const update = (key: keyof ScanResult, value: { status: SectionState["status"]; data: unknown; message: string | null }) =>
    setResult((prev) => ({ ...prev, [key]: value } as ScanResult));

  const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) =>
    update(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });

  const scan = useCallback(async (photo: string, lat: number, lng: number) => {
    setScanning(true);
    setResult(
      Object.fromEntries(
        Object.keys(initialState).map((k) => [k, { status: "loading", data: null, message: null }])
      ) as unknown as ScanResult
    );

    const scanEngine = async () => {
      const idRes = await identifyBuilding(photo, lat, lng);
      update("identify", {
        status: idRes.error ? "error" : "success",
        data: idRes.data,
        message: idRes.message,
      });

      if (idRes.error || !idRes.data) return;

      const address = (idRes.data as { address?: string }).address ?? "";
      if (!address) return;

      await Promise.allSettled([
        getCadastral(address).then(resolve("cadastral")),
        getPricing(address).then(resolve("pricing")),
        getListings(address).then(resolve("listings")),
        getEnergy(address).then(resolve("energy")),
        getCondominio(address).then(resolve("condominio")),
        getStoricoTransazioni(address).then(resolve("storicoTransazioni")),
      ]);
    };

    const forecastEngine = async () => {
      await Promise.allSettled([
        getMoodScore(lat, lng).then(resolve("moodScore")),
        getTimeView(lat, lng, 12).then(resolve("timeView")),
        getOpportunityIndex(lat, lng).then(resolve("opportunity")),
        getInfrastrutture(lat, lng).then(resolve("infrastrutture")),
        getRischioZona(lat, lng).then(resolve("rischioZona")),
        getTrendDemografico(lat, lng).then(resolve("trendDemografico")),
      ]);
    };

    await Promise.allSettled([scanEngine(), forecastEngine()]);
    setScanning(false);
  }, []);

  return { result, scanning, scan, reset: () => { setResult(initialState); setScanning(false); } };
}
