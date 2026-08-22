import { describe, it, expect, vi } from "vitest";
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
  getPoiEnrichment: (...args: unknown[]) => unusedScan(...args),
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
vi.mock("@/services/proSources", () => ({
  fetchProSources: (...args: unknown[]) => fetchProSources(...args),
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
});
