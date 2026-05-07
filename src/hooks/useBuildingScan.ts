import { useReducer, useState, useCallback, useRef } from "react";
import { identifyBuilding, getPricing, getOffmarket } from "@/services/scan";
import { getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico, getSviluppoArea, getConvergenzaTerritoriale, getMarketContext } from "@/services/forecast";
import { fetchProSources } from "@/services/proSources";
import { supabase } from "@/integrations/supabase/client";
import { mapScanToReportSections } from "@/lib/reportMapper";
import type { ScanResult, SectionState, IdentifyResult } from "@/types";
import type { ManualAddressInput } from "@/components/AddressOverrideForm";
import { formatManualAddress } from "@/components/AddressOverrideForm";

const idle: SectionState = { status: "idle", data: null, message: null };

/** All active modules */
const MODULES: (keyof ScanResult)[] = [
  "identify", "pricing", "marketContext", "timeView", "opportunity",
  "infrastrutture", "rischioZona", "trendDemografico",
  "sviluppoArea", "convergenzaTerritoriale",
  "poiEnrichment", "omiZone", "istatDemographic",
  "subMunicipalMatch",
  "offmarket",
  // Report engine sections — populated by MAP_REPORT action after data modules complete
  "profiloRapido", "immobileFacciata", "contestoVicinato",
  "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
  "prioritaCriticita",
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
  | { type: "SET"; key: keyof ScanResult; value: SectionState }
  | { type: "MAP_REPORT"; lat: number | null; lng: number | null };

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
    case "MAP_REPORT": {
      const mapped = mapScanToReportSections(state, action.lat, action.lng);
      const updates: Partial<Record<keyof ScanResult, SectionState>> = {};
      for (const [key, data] of Object.entries(mapped)) {
        updates[key as keyof ScanResult] = {
          status: data ? "success" : "idle",
          data,
          message: null,
        };
      }
      return { ...state, ...updates } as ScanResult;
    }
    default:
      return state;
  }
}

export function useBuildingScan() {
  const [result, dispatch] = useReducer(reducer, initialState);
  const [scanning, setScanning] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [refining, setRefining] = useState(false);
  const [manualAddress, setManualAddress] = useState<ManualAddressInput | null>(null);
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

      // Derive comune/provincia from address tail (last two CSV segments) as fallback
      const addrParts = address.split(",").map((s) => s.trim()).filter(Boolean);
      const comuneFromAddr = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : undefined;
      const provinciaFromAddr = addrParts.length >= 1 ? addrParts[addrParts.length - 1] : undefined;

      // Set report sections to loading during data fetch
      const reportModules: (keyof ScanResult)[] = [
        "profiloRapido", "immobileFacciata", "contestoVicinato",
        "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
        "prioritaCriticita",
      ];
      for (const m of reportModules) {
        set(m, { status: "loading", data: null, message: null });
      }

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
        getOffmarket(lat, lng, comuneFromAddr, provinciaFromAddr).then(resolve("offmarket")).catch(reject("offmarket")),
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
          set("subMunicipalMatch", {
            status: proData.subMunicipalMatch ? "success" : "idle",
            data: proData.subMunicipalMatch,
            message: null,
          });
        }).catch((e) => {
          console.error("[SCAN] pro-sources failed:", e);
          set("poiEnrichment", { status: "error", data: null, message: "Servizio non disponibile" });
          set("omiZone", { status: "error", data: null, message: "Servizio non disponibile" });
          set("istatDemographic", { status: "error", data: null, message: "Servizio non disponibile" });
          set("subMunicipalMatch", { status: "idle", data: null, message: null });
        }),
      ]);

      if (!address) {
        set("pricing", { status: "success", data: null, message: "Indirizzo non disponibile per la valutazione prezzi" });
      }

      // Phase 2: Map real data to report sections using reducer action
      // The MAP_REPORT action reads current state inside the reducer
      dispatch({ type: "MAP_REPORT", lat, lng });
    };

    await runPipeline();
    setScanning(false);
  }, []);

  /**
   * Refine territorial data using a manually provided address.
   * Does NOT re-consume a scan credit — only re-runs pricing + territorial modules.
   * Priority: manual address > scanned address.
   */
  const refineAddress = useCallback(async (
    addressInput: ManualAddressInput,
    lat: number,
    lng: number,
    photo?: string,
  ) => {
    setRefining(true);
    setManualAddress(addressInput);

    const manualAddr = formatManualAddress(addressInput);
    if (import.meta.env.DEV) console.log("[SCAN] refineAddress:", manualAddr);

    const set = (key: keyof ScanResult, value: SectionState) =>
      dispatch({ type: "SET", key, value });

    const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) => {
      set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
    };

    const reject = (key: keyof ScanResult) => (err: unknown) => {
      console.error(`[REFINE] ${key} rejected:`, err);
      set(key, { status: "error", data: null, message: err instanceof Error ? err.message : "Errore imprevisto" });
    };

    // Set affected sections to loading
    const affectedModules: (keyof ScanResult)[] = [
      "pricing", "marketContext", "timeView", "opportunity",
      "infrastrutture", "rischioZona", "trendDemografico",
      "sviluppoArea", "convergenzaTerritoriale",
      "poiEnrichment", "omiZone", "istatDemographic",
      "profiloRapido", "immobileFacciata", "contestoVicinato",
      "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
      "prioritaCriticita",
    ];
    for (const m of affectedModules) {
      set(m, { status: "loading", data: null, message: null });
    }

    // Update identify data with the manual address (keep existing data, override address)
    const currentIdentify = result.identify.data as IdentifyResult | null;
    if (currentIdentify) {
      set("identify", {
        status: "success",
        data: { ...currentIdentify, address: manualAddr },
        message: null,
      });
    }

    const confidence = currentIdentify?.confidence ?? undefined;

    await Promise.allSettled([
      getPricing(manualAddr, photo).then(resolve("pricing")).catch(reject("pricing")),
      getMarketContext(lat, lng, manualAddr).then(resolve("marketContext")).catch(reject("marketContext")),
      getTimeView(lat, lng, 12).then(resolve("timeView")).catch(reject("timeView")),
      getOpportunityIndex(lat, lng).then(resolve("opportunity")).catch(reject("opportunity")),
      getInfrastrutture(lat, lng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
      getRischioZona(lat, lng).then(resolve("rischioZona")).catch(reject("rischioZona")),
      getTrendDemografico(lat, lng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
      getSviluppoArea(lat, lng).then(resolve("sviluppoArea")).catch(reject("sviluppoArea")),
      getConvergenzaTerritoriale(lat, lng, confidence, manualAddr).then(resolve("convergenzaTerritoriale")).catch(reject("convergenzaTerritoriale")),
      fetchProSources(lat, lng).then((proData) => {
        set("poiEnrichment", { status: proData.poi ? "success" : "error", data: proData.poi, message: proData.poi ? null : "Dati POI non disponibili" });
        set("omiZone", { status: proData.omi ? "success" : "error", data: proData.omi, message: proData.omi ? null : "Dati OMI non disponibili" });
        set("istatDemographic", { status: proData.istat ? "success" : "error", data: proData.istat, message: proData.istat ? null : "Dati ISTAT non disponibili" });
      }).catch((e) => {
        console.error("[REFINE] pro-sources failed:", e);
        set("poiEnrichment", { status: "error", data: null, message: "Servizio non disponibile" });
        set("omiZone", { status: "error", data: null, message: "Servizio non disponibile" });
        set("istatDemographic", { status: "error", data: null, message: "Servizio non disponibile" });
      }),
    ]);

    dispatch({ type: "MAP_REPORT", lat, lng });
    setRefining(false);
  }, [result.identify.data]);

  const restoreResult = useCallback((saved: Partial<ScanResult>) => {
    dispatch({ type: "RESTORE", payload: saved });
  }, []);

  return {
    result,
    scanning,
    refining,
    limitReached,
    manualAddress,
    scan,
    refineAddress,
    scanId: scanIdRef.current,
    restoreResult,
    reset: () => { dispatch({ type: "RESET_IDLE" }); setScanning(false); setLimitReached(false); setRefining(false); setManualAddress(null); },
  };
}
