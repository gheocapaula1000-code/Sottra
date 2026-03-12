/**
 * CONTENUTO DIMOSTRATIVO — Questi dati sono esempi a scopo illustrativo.
 * Non provengono da fonti ufficiali e non rappresentano informazioni reali.
 * Utilizzati solo quando VITE_USE_MOCK=true.
 */
import type {
  IdentifyResult, PricingData,
  TimeViewData, OpportunityData,
  InfrastrutureData, RischioZonaData, TrendDemograficoData,
} from "@/types";

export const mockIdentify: IdentifyResult = {
  address: "Via Torino 45, Milano",
  buildingId: "MI-VT45",
  confidence: 0.92,
};

export const mockPricing: PricingData = {
  prezzoMq: 4200, prezzoMqMin: 3800, prezzoMqMax: 5100,
  mediaZona: null, trend5Anni: null,
  sourceType: "official",
  sourceLabel: "Fonte: Agenzia Entrate — OMI",
};

export const mockTimeView: TimeViewData = {
  previsione5Anni: 12, previsione10Anni: 28, previsione20Anni: 45,
  progettiInArrivo: [
    "Nuova fermata metro M4 (2027)",
    "Riqualificazione Piazza Sant'Ambrogio (2028)",
  ],
  scenarioBand: "favorevole",
  scenarioHorizon: "3-5 anni",
  scenarioDrivers: ["Prossimità a nuove infrastrutture di trasporto", "Trend demografico positivo nella zona", "Riqualificazione urbana in corso"],
  scenarioRisks: ["Possibile saturazione dell'offerta residenziale", "Tempi di completamento delle opere pubbliche"],
  narrativeObservation: "L'area mostra segnali di evoluzione positiva sostenuti da interventi infrastrutturali concreti. Lo scenario di medio periodo appare favorevole, con elementi che meritano un monitoraggio attento.",
};

export const mockOpportunity: OpportunityData = {
  score: 76, band: "forte",
  drivers: ["Prezzi sotto la media di zona con trend in crescita", "Infrastrutture in fase di completamento nel raggio di 2 km", "Flusso demografico positivo negli ultimi 12 mesi"],
  risks: ["Classe energetica da verificare — potenziale costo di adeguamento", "Dinamica dei prezzi potrebbe rallentare nel breve"],
  observation: "Contesto con fattori convergenti da non sottovalutare. I driver identificati suggeriscono un quadro interessante che merita approfondimento.",
  indice: 76, quadrante: "Stella Nascente",
  raccomandazione: "Zona in decollo — finestra d'acquisto ideale",
};

export const mockInfrastrutture: InfrastrutureData = {
  infrastructureScore: 74,
  infrastructureBand: "significativa",
  infrastructureProjects: [
    { label: "Prolungamento M4 Linate-Stazione Forlanini", category: "Trasporto pubblico", status: "In corso", impact: "Alto", period: "Completamento 2027", source: "Open Data Comune di Milano" },
    { label: "Nuovo parco urbano ex-scalo Romana", category: "Riqualificazione", status: "Approvato", impact: "Medio", source: "Delibera comunale" },
  ],
  connectivitySignals: [
    { label: "Fibra ottica FTTH disponibile", source: "AgCom" },
    { label: "Copertura 5G attiva", source: "Operatori nazionali" },
  ],
  mobilitySignals: [
    { label: "Pista ciclabile Naviglio Pavese in fase di approvazione", source: "PUMS Milano" },
    { label: "3 linee bus entro 500m" },
  ],
  publicWorksSignals: [
    { label: "Riqualificazione Piazza Sant'Ambrogio", source: "Open Data comunali", detail: "Intervento previsto entro il 2028" },
  ],
  topDrivers: [
    { label: "Prossimità a nodi di trasporto in potenziamento", source: "Analisi geospaziale" },
    { label: "Rete ciclabile in espansione" },
    { label: "Investimenti pubblici significativi nel raggio di 2 km", source: "Open Data" },
  ],
  topRisks: [
    { label: "Tempi di completamento delle opere soggetti a variazioni" },
    { label: "Possibile impatto cantieri nel breve periodo", source: "Stime operative" },
  ],
  narrativeObservation: "La zona mostra segnali infrastrutturali rilevanti. Il contesto è sostenuto da interventi e reti che meritano attenzione, con elementi di trasformazione concreti già in fase operativa.",
  sourceType: "elaborated",
  sourceLabel: "Elaborazione da Open Data comunali e fonti pubbliche",
};

export const mockRischioZona: RischioZonaData = {
  idrogeologico: "basso",
  sismico: "zona3",
  inquinamento: "medio",
  alluvionale: false,
  scoreRischio: 72,
};

export const mockTrendDemografico: TrendDemograficoData = {
  etaMedia: 41,
  densitaAbitanti: 7800,
  flussoResidenti12Mesi: 245,
  percentualeFamiglie: 38,
  percentualeGiovani: 28,
  percentualeStranieri: 15,
};
