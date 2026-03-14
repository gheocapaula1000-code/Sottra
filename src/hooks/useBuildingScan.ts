import { useReducer, useState, useCallback, useRef } from "react";
import { identifyBuilding, getPricing } from "@/services/scan";
import { getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico, getSviluppoArea, getConvergenzaTerritoriale, getMarketContext } from "@/services/forecast";
import { fetchProSources } from "@/services/proSources";
import { supabase } from "@/integrations/supabase/client";
import type { ScanResult, SectionState, IdentifyResult } from "@/types";

const idle: SectionState = { status: "idle", data: null, message: null };

/** All active modules */
const MODULES: (keyof ScanResult)[] = [
  "identify", "pricing", "marketContext", "timeView", "opportunity",
  "infrastrutture", "rischioZona", "trendDemografico",
  "sviluppoArea", "convergenzaTerritoriale",
  "poiEnrichment", "omiZone", "istatDemographic",
];

function buildInitialState(): ScanResult {
  const s = {} as Record<string, SectionState>;
  for (const k of MODULES) s[k] = idle;
  return s as unknown as ScanResult;
}

const initialState = buildInitialState();

type Action =
  | { type: "START_SCAN" }
  | { type: "RESET_IDLE" }
  | { type: "RESTORE"; payload: Partial<ScanResult> }
  | { type: "SET"; key: keyof ScanResult; value: SectionState };

function reducer(state: ScanResult, action: Action): ScanResult {
  switch (action.type) {
    case "START_SCAN": {
      const s = {} as Record<string, SectionState>;
      for (const k of MODULES) s[k] = { status: "loading", data: null, message: null };
      return s as unknown as ScanResult;
    }
    case "RESET_IDLE":
      return initialState;
    case "RESTORE": {
      const restored = { ...initialState } as Record<string, SectionState>;
      for (const k of MODULES) {
        const saved = (action.payload as Record<string, SectionState>)[k];
        if (saved) restored[k] = saved;
      }
      return restored as unknown as ScanResult;
    }
    case "SET":
      return { ...state, [action.key]: action.value } as ScanResult;
    default:
      return state;
  }
}

export function useBuildingScan() {
  const [result, dispatch] = useReducer(reducer, initialState);
  const [scanning, setScanning] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const scanIdRef = useRef<string | null>(null);

  const scan = useCallback(async (photo: string, lat: number, lng: number) => {
    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setScanning(true);
    dispatch({ type: "START_SCAN" });

    const set = (key: keyof ScanResult, value: SectionState) =>
      dispatch({ type: "SET", key, value });

    const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) => {
      set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
    };

    const reject = (key: keyof ScanResult) => (err: unknown) => {
      console.error(`[SCAN] ${key} rejected:`, err);
      set(key, { status: "error", data: null, message: err instanceof Error ? err.message : "Errore imprevisto" });
    };

    const runPipeline = async () => {
      // Step 1: Identify building
      const idRes = await identifyBuilding(photo, lat, lng);
      set("identify", {
        status: idRes.error ? "error" : "success",
        data: idRes.data,
        message: idRes.message,
      });

      if (idRes.error || !idRes.data) {
        for (const k of MODULES) {
          if (k !== "identify") set(k, { status: "error", data: null, message: "Identificazione non riuscita" });
        }
        return;
      }

      // Step 2: Record scan consumption
      try {
        const { data: recordData, error: recordError } = await supabase.functions.invoke("record-scan", {
          body: { scan_id: scanId },
        });

        if (recordError) {
          console.error("[SCAN] record-scan invocation error:", recordError);
          const errMsg = "Errore durante la registrazione della scansione. Riprova.";
          for (const k of MODULES) {
            if (k !== "identify") set(k, { status: "error", data: null, message: errMsg });
          }
          return;
        }

        if (recordData?.limit_reached || recordData?.error) {
          const errMsg = recordData?.error ?? "Limite scansioni raggiunto";
          for (const k of MODULES) {
            if (k !== "identify") set(k, { status: "error", data: null, message: errMsg });
          }
          setLimitReached(true);
          return;
        }
      } catch (err) {
        console.error("[SCAN] record-scan failed:", err);
        const errMsg = "Servizio temporaneamente non disponibile. Riprova.";
        for (const k of MODULES) {
          if (k !== "identify") set(k, { status: "error", data: null, message: errMsg });
        }
        return;
      }

      // Step 3: Launch all modules in parallel (Core V3 + Pro Sources)
      const identifyData = idRes.data as IdentifyResult;
      const address = identifyData.address ?? "";
      const confidence = identifyData.confidence ?? undefined;

      await Promise.allSettled([
        // Core V3 modules
        ...(address ? [getPricing(address, photo).then(resolve("pricing")).catch(reject("pricing"))] : []),
        getMarketContext(lat, lng, address || undefined).then(resolve("marketContext")).catch(reject("marketContext")),
        getTimeView(lat, lng, 12).then(resolve("timeView")).catch(reject("timeView")),
        getOpportunityIndex(lat, lng).then(resolve("opportunity")).catch(reject("opportunity")),
        getInfrastrutture(lat, lng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
        getRischioZona(lat, lng).then(resolve("rischioZona")).catch(reject("rischioZona")),
        getTrendDemografico(lat, lng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
        getSviluppoArea(lat, lng).then(resolve("sviluppoArea")).catch(reject("sviluppoArea")),
        getConvergenzaTerritoriale(lat, lng, confidence, address).then(resolve("convergenzaTerritoriale")).catch(reject("convergenzaTerritoriale")),
        // Pro Sources (POI, OMI, ISTAT) — non-blocking
        fetchProSources(lat, lng).then((proData) => {
          set("poiEnrichment", {
            status: proData.poi ? "success" : "error",
            data: proData.poi,
            message: proData.poi ? null : "Dati POI non disponibili",
          });
          set("omiZone", {
            status: proData.omi ? "success" : "error",
            data: proData.omi,
            message: proData.omi ? null : "Dati OMI non disponibili",
          });
          set("istatDemographic", {
            status: proData.istat ? "success" : "error",
            data: proData.istat,
            message: proData.istat ? null : "Dati ISTAT non disponibili",
          });
        }).catch((e) => {
          console.error("[SCAN] pro-sources failed:", e);
          set("poiEnrichment", { status: "error", data: null, message: "Servizio non disponibile" });
          set("omiZone", { status: "error", data: null, message: "Servizio non disponibile" });
          set("istatDemographic", { status: "error", data: null, message: "Servizio non disponibile" });
        }),
      ]);

      if (!address) {
        set("pricing", { status: "success", data: null, message: "Indirizzo non disponibile per la valutazione prezzi" });
      }
    };

    await runPipeline();
    setScanning(false);
  }, []);

  const restoreResult = useCallback((saved: Partial<ScanResult>) => {
    dispatch({ type: "RESTORE", payload: saved });
  }, []);

  return {
    result,
    scanning,
    limitReached,
    scan,
    scanId: scanIdRef.current,
    restoreResult,
    reset: () => { dispatch({ type: "RESET_IDLE" }); setScanning(false); setLimitReached(false); },
  };
}
