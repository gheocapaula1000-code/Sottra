import { useState, useCallback } from "react";
import { identifyBuilding, getCadastral, getPricing, getListings, getEnergy } from "@/services/scan";
import { getMoodScore, getTimeView, getOpportunityIndex } from "@/services/forecast";
import type { ScanResult, SectionState } from "@/types";

const idle = { status: "idle" as const, data: null, message: null };

const initialState: ScanResult = {
  identify: idle, cadastral: idle, pricing: idle,
  listings: idle, energy: idle, moodScore: idle,
  timeView: idle, opportunity: idle,
} as ScanResult;

export function useBuildingScan() {
  const [result, setResult] = useState<ScanResult>(initialState);
  const [scanning, setScanning] = useState(false);

  const update = (key: keyof ScanResult, value: SectionState) =>
    setResult((prev) => ({ ...prev, [key]: value }));

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

      const tasks = [
        getCadastral(address).then((r) =>
          update("cadastral", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
        getPricing(address).then((r) =>
          update("pricing", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
        getListings(address).then((r) =>
          update("listings", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
        getEnergy(address).then((r) =>
          update("energy", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
      ];

      await Promise.allSettled(tasks);
    };

    const forecastEngine = async () => {
      const tasks = [
        getMoodScore(lat, lng).then((r) =>
          update("moodScore", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
        getTimeView(lat, lng, 12).then((r) =>
          update("timeView", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
        getOpportunityIndex(lat, lng).then((r) =>
          update("opportunity", { status: r.error ? "error" : "success", data: r.data, message: r.message })
        ),
      ];

      await Promise.allSettled(tasks);
    };

    await Promise.allSettled([scanEngine(), forecastEngine()]);
    setScanning(false);
  }, []);

  return { result, scanning, scan, reset: () => { setResult(initialState); setScanning(false); } };
}
