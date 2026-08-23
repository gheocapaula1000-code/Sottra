import { useReducer, useState, useCallback, useRef } from "react";
import { identifyBuilding, getPricing, getOffmarket, getZoneIntelligence, getListings, getCondominio, getStoricoTransazioni, getMoodScore, getEnergy, getNeighborhood, getPoiEnrichment } from "@/services/scan";
import { getTimeView, getOpportunityIndex, getInfrastrutture, getRischioZona, getTrendDemografico, getSviluppoArea, getConvergenzaTerritoriale, getMarketContext } from "@/services/forecast";
import { fetchProSources, geocodeAddress } from "@/services/proSources";
import { getPhotoWow } from "@/services/photoWow";
import { supabase } from "@/integrations/supabase/client";
import { mapScanToReportSections } from "@/lib/reportMapper";
import { deriveGeoFromIdentify, type DerivedScanGeo } from "@/lib/deriveScanGeo";
import { isValidGps } from "@/lib/imageUtils";
import { hasRenderableOfficialOmi, mergeOfficialOmiData, officialOmiFromCore } from "@/lib/officialOmiFromCore";
import type { OmiZoneData, ScanResult, SectionState, IdentifyResult } from "@/types";
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
  "zoneIntelligence",
  "listings",
  "condominio",
  "storicoTransazioni",
  "moodScore",
  "energy",
  "neighborhood",
  "photoWow",
  // Report engine sections — populated by MAP_REPORT action after data modules complete
  "profiloRapido", "immobileFacciata", "contestoVicinato",
  "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
  "prioritaCriticita",
];

const REPORT_MODULES: (keyof ScanResult)[] = [
  "profiloRapido", "immobileFacciata", "contestoVicinato",
  "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
  "prioritaCriticita",
];

const ADDRESS_OPTIONAL_MODULES: (keyof ScanResult)[] = [
  "pricing", "listings", "condominio", "storicoTransazioni", "energy",
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
  | { type: "MAP_REPORT"; lat: number | null; lng: number | null }
  | { type: "MERGE_OFFICIAL_OMI"; data: OmiZoneData }
  | { type: "OMI_UNAVAILABLE_IF_EMPTY"; message: string };

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
    case "MERGE_OFFICIAL_OMI": {
      const merged = mergeOfficialOmiData(state.omiZone.data, action.data);
      return { ...state, omiZone: { status: "success", data: merged, message: null } };
    }
    case "OMI_UNAVAILABLE_IF_EMPTY": {
      if (hasRenderableOfficialOmi(state.omiZone.data)) return state;
      return {
        ...state,
        omiZone: { status: "error", data: state.omiZone.data, message: action.message },
      };
    }
    default:
      return state;
  }
}

const TERRITORIAL_MODULES: (keyof ScanResult)[] = [
  "marketContext", "timeView", "opportunity",
  "infrastrutture", "rischioZona", "trendDemografico",
  "sviluppoArea", "convergenzaTerritoriale",
  "poiEnrichment", "omiZone", "istatDemographic",
  "subMunicipalMatch", "offmarket", "zoneIntelligence",
  "moodScore", "neighborhood",
];

export function useBuildingScan() {
  const [result, dispatch] = useReducer(reducer, initialState);
  const [scanning, setScanning] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [refining, setRefining] = useState(false);
  const [manualAddress, setManualAddress] = useState<ManualAddressInput | null>(null);
  const [forceShowResult, setForceShowResult] = useState(false);
  const scanIdRef = useRef<string | null>(null);
  /** Highest official-OMI precedence applied so far (Core official > generic pricing). */
  const omiPriorityRef = useRef(0);

  const scan = useCallback(async (photo: string, lat: number, lng: number, manualAddrInput?: string) => {
    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;
    omiPriorityRef.current = 0;

    setScanning(true);
    dispatch({ type: "START_SCAN" });
    if (manualAddrInput && manualAddrInput.trim()) {
      setManualAddress({ via: manualAddrInput.trim(), civico: "", cap: "", comune: "", provincia: "" });
    }

    const set = (key: keyof ScanResult, value: SectionState) =>
      dispatch({ type: "SET", key, value });

    const applyCoreOmi = (raw: unknown, priority = 1) => {
      if (priority < omiPriorityRef.current) return;
      const omi = officialOmiFromCore(raw);
      if (!omi) return;
      omiPriorityRef.current = Math.max(omiPriorityRef.current, priority);
      dispatch({ type: "MERGE_OFFICIAL_OMI", data: omi });
    };

    const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) => {
      set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
      if (!r.error && key === "pricing") applyCoreOmi(r.data);
    };

    const reject = (key: keyof ScanResult) => (err: unknown) => {
      console.error(`[SCAN] ${key} rejected:`, err);
      set(key, { status: "error", data: null, message: err instanceof Error ? err.message : "Errore imprevisto" });
    };

    const idleAddressModules = () => {
      for (const k of ADDRESS_OPTIONAL_MODULES) {
        set(k, { status: "idle", data: null, message: "Indirizzo non disponibile" });
      }
    };

    const failClosedTerritorial = (message: string) => {
      for (const k of TERRITORIAL_MODULES) {
        set(k, { status: "error", data: null, message });
      }
      dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message });
    };

    const launchOfficialModules = async (
      identifyData: IdentifyResult | null,
      geo: DerivedScanGeo,
    ) => {
      const {
        address, confidence, comuneFromAddr, comuneFromIdentify,
        provinciaFromIdentify, addressFromIdentify, finalLat, finalLng,
      } = geo;

      for (const m of REPORT_MODULES) {
        set(m, { status: "loading", data: null, message: null });
      }

      if (finalLat == null || finalLng == null) {
        failClosedTerritorial("Dati OMI non disponibili");
        if (address) {
          const resolveAddressOnly = (key: keyof ScanResult) =>
            (r: { error: boolean; data: unknown; message: string | null }) => {
              // Do not promote pricing numbers to official OMI without a geocoded zone.
              set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
            };
          await Promise.allSettled([
            getPricing(address, photo).then(resolveAddressOnly("pricing")).catch(reject("pricing")),
            getEnergy(address, comuneFromAddr).then(resolveAddressOnly("energy")).catch(reject("energy")),
            ...(addressFromIdentify
              ? [getStoricoTransazioni(addressFromIdentify, comuneFromIdentify).then(resolveAddressOnly("storicoTransazioni")).catch(reject("storicoTransazioni"))]
              : []),
          ]);
          set("listings", { status: "idle", data: null, message: "Dati OMI non disponibili" });
          set("condominio", { status: "idle", data: null, message: "Dati OMI non disponibili" });
        } else {
          idleAddressModules();
        }
        dispatch({ type: "MAP_REPORT", lat: null, lng: null });
        return;
      }

      await Promise.allSettled([
        ...(address ? [getPricing(address, photo).then(resolve("pricing")).catch(reject("pricing"))] : []),
        getMarketContext(finalLat, finalLng, address || undefined).then(resolve("marketContext")).catch(reject("marketContext")),
        getTimeView(finalLat, finalLng, 12).then(resolve("timeView")).catch(reject("timeView")),
        getOpportunityIndex(finalLat, finalLng).then(resolve("opportunity")).catch(reject("opportunity")),
        getInfrastrutture(finalLat, finalLng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
        getRischioZona(finalLat, finalLng).then(resolve("rischioZona")).catch(reject("rischioZona")),
        getTrendDemografico(finalLat, finalLng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
        getSviluppoArea(finalLat, finalLng).then(resolve("sviluppoArea")).catch(reject("sviluppoArea")),
        getConvergenzaTerritoriale(finalLat, finalLng, confidence, address).then(resolve("convergenzaTerritoriale")).catch(reject("convergenzaTerritoriale")),
        getOffmarket(finalLat, finalLng, comuneFromIdentify, provinciaFromIdentify).then(resolve("offmarket")).catch(reject("offmarket")),
        getZoneIntelligence(finalLat, finalLng, comuneFromIdentify, provinciaFromIdentify, addressFromIdentify || undefined).then(resolve("zoneIntelligence")).catch(reject("zoneIntelligence")),
        ...(addressFromIdentify
          ? [
              getListings(addressFromIdentify, comuneFromIdentify, finalLat, finalLng).then(resolve("listings")).catch(reject("listings")),
              getCondominio(addressFromIdentify, comuneFromIdentify, finalLat, finalLng).then(resolve("condominio")).catch(reject("condominio")),
              getStoricoTransazioni(addressFromIdentify, comuneFromIdentify).then(resolve("storicoTransazioni")).catch(reject("storicoTransazioni")),
            ]
          : []),
        getMoodScore(finalLat, finalLng).then(resolve("moodScore")).catch(reject("moodScore")),
        ...(address ? [getEnergy(address, comuneFromAddr).then(resolve("energy")).catch(reject("energy"))] : []),
        getNeighborhood(finalLat, finalLng, address).then(resolve("neighborhood")).catch(reject("neighborhood")),
        getPoiEnrichment(finalLat, finalLng, address).then(resolve("poiEnrichment")).catch(reject("poiEnrichment")),
        fetchProSources(finalLat, finalLng).then((proData) => {
          // Official OMI/ISTAT from Sottra DB — never overwrite a prior POI success with null.
          if (proData.poi) {
            set("poiEnrichment", { status: "success", data: proData.poi, message: null });
          }
          if (proData.omi) {
            dispatch({ type: "MERGE_OFFICIAL_OMI", data: proData.omi });
          } else {
            dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message: "Dati OMI non disponibili" });
          }
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
          dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message: "Servizio non disponibile" });
          set("istatDemographic", { status: "error", data: null, message: "Servizio non disponibile" });
          set("subMunicipalMatch", { status: "idle", data: null, message: null });
        }),
      ]);

      if (!address) idleAddressModules();

      dispatch({ type: "MAP_REPORT", lat: finalLat, lng: finalLng });
    };

    const runOfficialPipeline = async (
      geocoded: { lat: number; lng: number } | null,
    ): Promise<DerivedScanGeo | null> => {
      const trimmedManual = manualAddrInput?.trim() ?? "";
      const identifyLat = trimmedManual ? (geocoded?.lat ?? 0) : lat;
      const identifyLng = trimmedManual ? (geocoded?.lng ?? 0) : lng;
      const idRes = await identifyBuilding(photo, identifyLat, identifyLng, manualAddrInput);
      set("identify", {
        status: idRes.error ? "error" : "success",
        data: idRes.data,
        message: idRes.message,
      });

      // Consume a scan credit whenever we are about to fill official modules
      // (GPS-based OMI/ISTAT still produce a report if identify fails).
      try {
        const { data: recordData, error: recordError } = await supabase.functions.invoke("record-scan", {
          body: { scan_id: scanId },
        });

        if (recordError) {
          console.error("[SCAN] record-scan invocation error:", recordError);
          const errMsg = "Errore durante la registrazione della scansione. Riprova.";
          for (const k of MODULES) {
            if (k === "identify" || k === "photoWow") continue;
            set(k, { status: "error", data: null, message: errMsg });
          }
          return null;
        }

        if (recordData?.limit_reached || recordData?.error) {
          const errMsg = recordData?.error ?? "Limite scansioni raggiunto";
          for (const k of MODULES) {
            if (k === "identify" || k === "photoWow") continue;
            set(k, { status: "error", data: null, message: errMsg });
          }
          setLimitReached(true);
          return null;
        }
      } catch (err) {
        console.error("[SCAN] record-scan failed:", err);
        const errMsg = "Servizio temporaneamente non disponibile. Riprova.";
        for (const k of MODULES) {
          if (k === "identify" || k === "photoWow") continue;
          set(k, { status: "error", data: null, message: errMsg });
        }
        return null;
      }

      const identifyData = (idRes.error || !idRes.data) ? null : (idRes.data as IdentifyResult);
      const geo = deriveGeoFromIdentify(identifyData, manualAddrInput, lat, lng, geocoded);
      await launchOfficialModules(identifyData, geo);
      return geo;
    };

    const runPhotoWow = async (
      wowLat: number | null,
      wowLng: number | null,
      geoSource: "device" | "address",
      addressForWow?: string,
    ) => {
      if (wowLat == null || wowLng == null || !isValidGps(wowLat, wowLng)) {
        set("photoWow", { status: "error", data: null, message: "Posizione dell'indirizzo non disponibile" });
        return;
      }
      set("photoWow", { status: "loading", data: null, message: null });
      const PHOTO_WOW_TIMEOUT_MS = 30000;
      const photoWowTimeout = new Promise<{ error: true; message: string; data: null }>((res) =>
        setTimeout(() => res({ error: true, message: "Timeout anteprima visiva", data: null }), PHOTO_WOW_TIMEOUT_MS),
      );
      try {
        const photoRes = await Promise.race([
          getPhotoWow(photo, wowLat, wowLng, geoSource, addressForWow),
          photoWowTimeout,
        ]);
        if (!photoRes.error && photoRes.data) {
          set("photoWow", { status: "success", data: photoRes.data, message: null });
          applyCoreOmi(photoRes.data, 2);
        } else {
          console.warn("[SCAN] photoWow opener failed (official pipeline continues):", photoRes.message);
          set("photoWow", { status: "error", data: null, message: photoRes.message });
        }
      } catch (err) {
        console.error("[SCAN] photoWow threw (official pipeline continues):", err);
        set("photoWow", { status: "error", data: null, message: err instanceof Error ? err.message : "Errore photoWow" });
      }
    };

    const trimmedManual = manualAddrInput?.trim() ?? "";
    const geocoded = trimmedManual ? await geocodeAddress(trimmedManual) : null;
    const preGeo = deriveGeoFromIdentify(null, manualAddrInput, lat, lng, geocoded);
    const wowSource: "device" | "address" = trimmedManual ? "address" : "device";

    // Photo-first opener + official Sottra modules in parallel when coords are known.
    // Typed address: geocode (or later identify) wins over indoor/device GPS.
    if (preGeo.finalLat != null && preGeo.finalLng != null) {
      await Promise.allSettled([
        runPhotoWow(preGeo.finalLat, preGeo.finalLng, wowSource, trimmedManual || undefined),
        runOfficialPipeline(geocoded),
      ]);
    } else {
      const geo = await runOfficialPipeline(geocoded);
      if (geo?.finalLat != null && geo.finalLng != null) {
        await runPhotoWow(geo.finalLat, geo.finalLng, "address", trimmedManual || undefined);
      } else {
        await runPhotoWow(null, null, "address", trimmedManual || undefined);
      }
    }

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

    const applyCoreOmi = (raw: unknown, priority = 1) => {
      if (priority < omiPriorityRef.current) return;
      const omi = officialOmiFromCore(raw);
      if (!omi) return;
      omiPriorityRef.current = Math.max(omiPriorityRef.current, priority);
      dispatch({ type: "MERGE_OFFICIAL_OMI", data: omi });
    };

    const resolve = (key: keyof ScanResult) => (r: { error: boolean; data: unknown; message: string | null }) => {
      set(key, { status: r.error ? "error" : "success", data: r.data, message: r.message });
      if (!r.error && key === "pricing") applyCoreOmi(r.data);
    };

    const reject = (key: keyof ScanResult) => (err: unknown) => {
      console.error(`[REFINE] ${key} rejected:`, err);
      set(key, { status: "error", data: null, message: err instanceof Error ? err.message : "Errore imprevisto" });
    };

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

    const currentIdentify = result.identify.data as IdentifyResult | null;
    const identifyForGeo = currentIdentify
      ? { ...currentIdentify, address: manualAddr }
      : null;
    if (identifyForGeo) {
      set("identify", {
        status: "success",
        data: identifyForGeo,
        message: null,
      });
    }

    const geocoded = await geocodeAddress(manualAddr);
    const geo = deriveGeoFromIdentify(identifyForGeo, manualAddr, lat, lng, geocoded);
    const { finalLat, finalLng, confidence } = geo;

    if (finalLat == null || finalLng == null) {
      for (const k of TERRITORIAL_MODULES) {
        if (affectedModules.includes(k) || k === "omiZone" || k === "istatDemographic" || k === "poiEnrichment") {
          set(k, { status: "error", data: null, message: "Dati OMI non disponibili" });
        }
      }
      dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message: "Dati OMI non disponibili" });
      await Promise.allSettled([
        getPricing(manualAddr, photo).then((r) => {
          set("pricing", { status: r.error ? "error" : "success", data: r.data, message: r.message });
        }).catch(reject("pricing")),
      ]);
      dispatch({ type: "MAP_REPORT", lat: null, lng: null });
      setRefining(false);
      return;
    }

    await Promise.allSettled([
      getPricing(manualAddr, photo).then(resolve("pricing")).catch(reject("pricing")),
      getMarketContext(finalLat, finalLng, manualAddr).then(resolve("marketContext")).catch(reject("marketContext")),
      getTimeView(finalLat, finalLng, 12).then(resolve("timeView")).catch(reject("timeView")),
      getOpportunityIndex(finalLat, finalLng).then(resolve("opportunity")).catch(reject("opportunity")),
      getInfrastrutture(finalLat, finalLng).then(resolve("infrastrutture")).catch(reject("infrastrutture")),
      getRischioZona(finalLat, finalLng).then(resolve("rischioZona")).catch(reject("rischioZona")),
      getTrendDemografico(finalLat, finalLng).then(resolve("trendDemografico")).catch(reject("trendDemografico")),
      getSviluppoArea(finalLat, finalLng).then(resolve("sviluppoArea")).catch(reject("sviluppoArea")),
      getConvergenzaTerritoriale(finalLat, finalLng, confidence, manualAddr).then(resolve("convergenzaTerritoriale")).catch(reject("convergenzaTerritoriale")),
      fetchProSources(finalLat, finalLng).then((proData) => {
        if (proData.poi) {
          set("poiEnrichment", { status: "success", data: proData.poi, message: null });
        }
        if (proData.omi) {
          dispatch({ type: "MERGE_OFFICIAL_OMI", data: proData.omi });
        } else {
          dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message: "Dati OMI non disponibili" });
        }
        set("istatDemographic", { status: proData.istat ? "success" : "error", data: proData.istat, message: proData.istat ? null : "Dati ISTAT non disponibili" });
      }).catch((e) => {
        console.error("[REFINE] pro-sources failed:", e);
        dispatch({ type: "OMI_UNAVAILABLE_IF_EMPTY", message: "Servizio non disponibile" });
        set("istatDemographic", { status: "error", data: null, message: "Servizio non disponibile" });
      }),
    ]);

    dispatch({ type: "MAP_REPORT", lat: finalLat, lng: finalLng });
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
    forceShowResult,
    setForceShowResult,
    reset: () => { dispatch({ type: "RESET_IDLE" }); setScanning(false); setLimitReached(false); setRefining(false); setManualAddress(null); setForceShowResult(false); },
  };
}
