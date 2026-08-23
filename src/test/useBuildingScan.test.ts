import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockInvoke = vi.fn().mockResolvedValue({
  data: { recorded: true, scans_used: 1, max_scans: 5, trial_end: "2099-12-31" },
  error: null,
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

const identifyBuilding = vi.fn().mockResolvedValue({
  error: false, message: null,
  data: { address: "Via Roma 1, Padova", buildingId: "PD-VR1", confidence: 0.95 },
});
const getPricing = vi.fn().mockResolvedValue({
  error: false, message: null,
  data: { prezzoMq: 2400, prezzoMqMin: 2100, prezzoMqMax: 2800, mediaZona: null, trend5Anni: null },
});
const unusedScan = vi.fn().mockResolvedValue({ error: false, message: null, data: null });
const getPoiEnrichment = vi.fn().mockResolvedValue({ error: false, message: null, data: null });

vi.mock("@/services/scan", () => ({
  identifyBuilding: (...args: unknown[]) => identifyBuilding(...args),
  getPricing: (...args: unknown[]) => getPricing(...args),
  getOffmarket: (...args: unknown[]) => unusedScan(...args),
  getZoneIntelligence: (...args: unknown[]) => unusedScan(...args),
  getListings: (...args: unknown[]) => unusedScan(...args),
  getCondominio: (...args: unknown[]) => unusedScan(...args),
  getStoricoTransazioni: (...args: unknown[]) => unusedScan(...args),
  getMoodScore: (...args: unknown[]) => unusedScan(...args),
  getEnergy: (...args: unknown[]) => unusedScan(...args),
  getNeighborhood: (...args: unknown[]) => unusedScan(...args),
  getPoiEnrichment: (...args: unknown[]) => getPoiEnrichment(...args),
}));

vi.mock("@/services/forecast", () => ({
  getTimeView: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { previsione5Anni: 10, previsione10Anni: 22, previsione20Anni: 40, progettiInArrivo: ["Metro"] },
  }),
  getOpportunityIndex: vi.fn().mockResolvedValue({
    error: false, message: null,
    data: { score: 80, band: "forte", drivers: ["Test driver"], risks: ["Test risk"], observation: "Test observation" },
  }),
  getInfrastrutture: vi.fn().mockResolvedValue({ error: false, message: null, data: { infrastructureScore: 70 } }),
  getRischioZona: vi.fn().mockResolvedValue({ error: false, message: null, data: { scoreRischio: 65 } }),
  getTrendDemografico: vi.fn().mockResolvedValue({ error: false, message: null, data: { etaMedia: 42 } }),
  getSviluppoArea: vi.fn().mockResolvedValue({ error: false, message: null, data: null }),
  getConvergenzaTerritoriale: vi.fn().mockResolvedValue({ error: false, message: null, data: null }),
  getMarketContext: vi.fn().mockResolvedValue({ error: false, message: null, data: { marketConfidence: 78, comparablesSummary: { count: 14 }, sourceType: "elaborated" } }),
}));

const fetchProSources = vi.fn().mockResolvedValue({
  poi: null,
  omi: {
    zonaOmi: "B2",
    zonaOmiLabel: "Semicentro",
    comuneLabel: "Padova",
    quotazioneMinResidenziale: 2100,
    quotazioneMaxResidenziale: 2800,
    sourceType: "official",
    polygonMatch: true,
  },
  istat: null,
});
const geocodeAddress = vi.fn().mockResolvedValue(null);
vi.mock("@/services/proSources", () => ({
  fetchProSources: (...args: unknown[]) => fetchProSources(...args),
  geocodeAddress: (...args: unknown[]) => geocodeAddress(...args),
}));

const getPhotoWow = vi.fn().mockResolvedValue({
  error: false,
  message: null,
  data: {
    immobile: { tipologiaProbabile: "residenziale", pianoStimato: null, statoApparente: null, puntiDiForzaVisivi: [], materialePresunto: null, annoPresunto: null },
    zona: { nomeComune: "Padova", provincia: "PD", nomeZonaOmi: null, fascia: null, valoreMinOmi: null, valoreMaxOmi: null, tendenzaMercato: null, classificazioneZona: null, sentimentResidenti: null, livelloSentiment: null },
    scores: { vendibilita: 62, opportunitaInvestimento: 55, pressioneEreditaria: 40 },
    liveSignals: [],
    territorialDocuments: [],
    zonaIntelligence: { notizieRecenti: [], puntiDiForzaNascosti: [], criticitaEmergenti: [], tendenzaMercato: "" },
    vendutoRecente: [],
    mappaCaloreUrl: "",
    pianoEsclusiva: { argomento: "", puntiChiave: [], obiezioniProbabili: [], stimaRapida: "" },
    qualita: "buona",
    tempoElaborazione: 1200,
    fontiUsate: ["OSM"],
  },
});
vi.mock("@/services/photoWow", () => ({
  getPhotoWow: (...args: unknown[]) => getPhotoWow(...args),
}));

import { useBuildingScan } from "@/hooks/useBuildingScan";

describe("useBuildingScan", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    identifyBuilding.mockClear();
    getPricing.mockClear();
    unusedScan.mockClear();
    getPoiEnrichment.mockClear();
    fetchProSources.mockClear();
    getPhotoWow.mockClear();
    geocodeAddress.mockReset();
    geocodeAddress.mockResolvedValue(null);
    identifyBuilding.mockResolvedValue({
      error: false, message: null,
      data: { address: "Via Roma 1, Padova", buildingId: "PD-VR1", confidence: 0.95 },
    });
  });

  it("starts with idle state and scanning false", () => {
    const { result } = renderHook(() => useBuildingScan());
    expect(result.current.scanning).toBe(false);
    expect(result.current.result.identify.status).toBe("idle");
    expect(result.current.result.pricing.status).toBe("idle");
  });

  it("completes scan and sets scanning to false", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(result.current.scanning).toBe(false);
  });

  it("fills official modules even when photoWow succeeds", async () => {
    getPhotoWow.mockResolvedValueOnce({
      error: false,
      message: null,
      data: { scores: { vendibilita: 70, opportunitaInvestimento: 60, pressioneEreditaria: 30 }, zona: { nomeComune: "Padova" } },
    });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(result.current.result.photoWow?.status).toBe("success");
    expect(result.current.result.identify.status).toBe("success");
    expect(result.current.result.identify.data?.address).toBe("Via Roma 1, Padova");
    expect(result.current.result.pricing.status).toBe("success");
    expect(result.current.result.timeView.status).toBe("success");
    expect(result.current.result.opportunity.status).toBe("success");
    expect(result.current.result.omiZone.status).toBe("success");
    expect(result.current.result.omiZone.data?.comuneLabel).toBe("Padova");
    expect(identifyBuilding).toHaveBeenCalled();
    expect(getPricing).toHaveBeenCalled();
    expect(fetchProSources).toHaveBeenCalled();
  });

  it("still runs official pipeline when photoWow fails", async () => {
    getPhotoWow.mockResolvedValueOnce({ error: true, message: "core-proxy HTTP 502", data: null });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(result.current.result.photoWow?.status).toBe("error");
    expect(result.current.result.identify.status).toBe("success");
    expect(result.current.result.pricing.status).toBe("success");
    expect(result.current.result.omiZone.status).toBe("success");
  });

  it("runs GPS official modules when identify fails", async () => {
    identifyBuilding.mockResolvedValueOnce({ error: true, message: "Identificazione non riuscita", data: null });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(result.current.result.identify.status).toBe("error");
    expect(result.current.result.timeView.status).toBe("success");
    expect(result.current.result.omiZone.status).toBe("success");
    expect(result.current.result.pricing.status).toBe("idle");
  });

  it("maps Core photoWow official OMI even when pro-sources is empty", async () => {
    getPhotoWow.mockResolvedValueOnce({
      error: false,
      message: null,
      data: {
        immobile: { tipologiaProbabile: "residenziale", pianoStimato: null, statoApparente: null, puntiDiForzaVisivi: [], materialePresunto: null, annoPresunto: null },
        zona: {
          nomeComune: "Padova",
          provincia: "PD",
          nomeZonaOmi: "Centro (OMI B1)",
          fascia: null,
          valoreMinOmi: 2400,
          valoreMaxOmi: 3400,
          tendenzaMercato: null,
          classificazioneZona: "B1",
          sentimentResidenti: null,
          livelloSentiment: null,
        },
        scores: { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null },
        liveSignals: [],
        territorialDocuments: [],
        zonaIntelligence: { notizieRecenti: [], puntiDiForzaNascosti: [], criticitaEmergenti: [], tendenzaMercato: "" },
        vendutoRecente: [],
        mappaCaloreUrl: "",
        pianoEsclusiva: { argomento: "", puntiChiave: [], obiezioniProbabili: [], stimaRapida: "" },
        qualita: "buona",
        tempoElaborazione: 800,
        fontiUsate: ["OMI"],
        officialMicrozona: "B1",
        prezzoMqMin: 2400,
        prezzoMqMax: 3400,
        sourceType: "official",
        polygonMatch: true,
      },
    });
    fetchProSources.mockResolvedValueOnce({ poi: null, omi: null, istat: null, subMunicipalMatch: null });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.407, 11.876);
    });

    expect(result.current.result.omiZone.status).toBe("success");
    expect(result.current.result.omiZone.data?.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(result.current.result.omiZone.data?.quotazioneMinResidenziale).toBe(2400);
    expect(result.current.result.omiZone.data?.quotazioneMaxResidenziale).toBe(3400);
    expect(result.current.result.omiZone.data?.sourceType).toBe("official");
    expect(result.current.result.photoWow?.data?.scores?.vendibilita).toBeNull();
  });

  it("resets state correctly", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(result.current.result.identify.status).toBe("success");

    act(() => {
      result.current.reset();
    });

    expect(result.current.scanning).toBe(false);
    expect(result.current.result.identify.status).toBe("idle");
    expect(result.current.result.pricing.status).toBe("idle");
  });

  it("Scansiona questo indirizzo (lat 0,0) sends geocoded coords to photoWow, not 0,0", async () => {
    const padova = { lat: 45.407, lng: 11.876 };
    geocodeAddress.mockResolvedValueOnce(padova);

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 0, 0, "Via San Francesco 2, Padova");
    });

    expect(geocodeAddress).toHaveBeenCalledWith("Via San Francesco 2, Padova");
    expect(getPhotoWow).toHaveBeenCalledWith(
      "base64photo",
      padova.lat,
      padova.lng,
      "address",
      "Via San Francesco 2, Padova",
    );
    expect(getPhotoWow).not.toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      expect.anything(),
      expect.anything(),
    );
    expect(fetchProSources).toHaveBeenCalledWith(padova.lat, padova.lng);
    expect(fetchProSources).not.toHaveBeenCalledWith(0, 0);
    expect(result.current.result.omiZone.status).toBe("success");
  });

  it("uses geocoded address coords over non-zero indoor GPS for OMI, photoWow, and POI", async () => {
    const padova = { lat: 45.407, lng: 11.876 };
    geocodeAddress.mockResolvedValueOnce(padova);

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.0, 9.0, "Via San Francesco 2, Padova");
    });

    expect(geocodeAddress).toHaveBeenCalledWith("Via San Francesco 2, Padova");
    expect(fetchProSources).toHaveBeenCalledWith(padova.lat, padova.lng);
    expect(getPhotoWow).toHaveBeenCalledWith(
      "base64photo",
      padova.lat,
      padova.lng,
      "address",
      "Via San Francesco 2, Padova",
    );
    expect(getPoiEnrichment).toHaveBeenCalledWith(padova.lat, padova.lng, "Via San Francesco 2, Padova");
    expect(identifyBuilding).toHaveBeenCalledWith(
      "base64photo",
      padova.lat,
      padova.lng,
      "Via San Francesco 2, Padova",
    );
    expect(fetchProSources).not.toHaveBeenCalledWith(45.0, 9.0);
    expect(result.current.result.omiZone.status).toBe("success");
    expect(result.current.result.omiZone.data?.comuneLabel).toBe("Padova");
  });

  it("uses device GPS when no manual address is provided", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(fetchProSources).toHaveBeenCalledWith(45.41, 11.87);
    expect(getPhotoWow).toHaveBeenCalledWith("base64photo", 45.41, 11.87, "device", undefined);
    expect(identifyBuilding).toHaveBeenCalledWith("base64photo", 45.41, 11.87, undefined);
  });

  it("fails closed without inventing a zone when geocode fails", async () => {
    geocodeAddress.mockResolvedValueOnce(null);
    fetchProSources.mockResolvedValueOnce({
      poi: null, omi: null, istat: null, subMunicipalMatch: null,
    });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.0, 9.0, "Via Inesistente 999, Nowhere");
    });

    expect(geocodeAddress).toHaveBeenCalledWith("Via Inesistente 999, Nowhere");
    expect(fetchProSources).not.toHaveBeenCalled();
    expect(getPhotoWow).not.toHaveBeenCalledWith(
      expect.anything(),
      45.0,
      9.0,
      expect.anything(),
      expect.anything(),
    );
    expect(result.current.result.omiZone.status).toBe("error");
    expect(result.current.result.omiZone.data).toBeNull();
    expect(result.current.result.omiZone.data?.zonaOmiLabel).toBeUndefined();
    expect(result.current.result.omiZone.message).toMatch(/non disponibili/i);
    expect(result.current.result.pricing.status).toBe("success");
  });

  it("prefers identify-resolved coords when geocode fails but identify geocoded the address", async () => {
    geocodeAddress.mockResolvedValueOnce(null);
    identifyBuilding.mockResolvedValueOnce({
      error: false, message: null,
      data: {
        address: "Via San Francesco 2, Padova",
        buildingId: "PD-SF2",
        confidence: 0.9,
        resolvedLat: 45.407,
        resolvedLng: 11.876,
      },
    });

    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.0, 9.0, "Via San Francesco 2, Padova");
    });

    expect(fetchProSources).toHaveBeenCalledWith(45.407, 11.876);
    expect(getPhotoWow).toHaveBeenCalledWith(
      "base64photo",
      45.407,
      11.876,
      "address",
      "Via San Francesco 2, Padova",
    );
    expect(result.current.result.omiZone.status).toBe("success");
  });

  it("refineAddress geocodes the typed address instead of keeping device GPS", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.0, 9.0);
    });

    fetchProSources.mockClear();
    geocodeAddress.mockResolvedValueOnce({ lat: 45.407, lng: 11.876 });

    await act(async () => {
      await result.current.refineAddress(
        { via: "Via San Francesco", civico: "2", cap: "", comune: "Padova", provincia: "PD" },
        45.0,
        9.0,
        "base64photo",
      );
    });

    expect(geocodeAddress).toHaveBeenCalledWith(expect.stringContaining("Via San Francesco"));
    expect(fetchProSources).toHaveBeenCalledWith(45.407, 11.876);
    expect(fetchProSources).not.toHaveBeenCalledWith(45.0, 9.0);
  });

  it("refresh reloads official modules without consuming a scan credit", async () => {
    const { result } = renderHook(() => useBuildingScan());

    await act(async () => {
      await result.current.scan("base64photo", 45.41, 11.87);
    });

    expect(mockInvoke).toHaveBeenCalledWith("record-scan", expect.anything());
    expect(result.current.result.photoWow?.status).toBe("success");

    fetchProSources.mockClear();
    getPhotoWow.mockClear();
    identifyBuilding.mockClear();
    mockInvoke.mockClear();

    await act(async () => {
      await result.current.refresh("base64photo", 45.41, 11.87);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(identifyBuilding).toHaveBeenCalledWith("base64photo", 45.41, 11.87, undefined);
    expect(fetchProSources).toHaveBeenCalledWith(45.41, 11.87);
    expect(getPhotoWow).toHaveBeenCalled();
    expect(result.current.scanning).toBe(false);
    expect(result.current.result.photoWow?.status).toBe("success");
    expect(result.current.result.omiZone.status).toBe("success");
    expect(result.current.result.omiZone.data?.comuneLabel).toBe("Padova");
  });
});
