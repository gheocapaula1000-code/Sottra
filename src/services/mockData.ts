import type {
  IdentifyResult, CadastralData, PricingData, ListingsData, EnergyData,
  MoodScoreData, TimeViewData, OpportunityData,
  CondominioData, StoricoTransazioniData,
  InfrastrutureData, RischioZonaData, TrendDemograficoData,
} from "@/types";

export const mockIdentify: IdentifyResult = {
  address: "Via Torino 45, Milano",
  buildingId: "MI-VT45",
  confidence: 0.92,
};

export const mockCadastral: CadastralData = {
  foglio: 234, particella: 89, subalterno: 3,
  anno: 1962, piani: 6, unitaImmobiliari: 24, renditaCatastale: 1850,
};

export const mockPricing: PricingData = {
  prezzoMq: 4200, prezzoMqMin: 3800, prezzoMqMax: 5100,
  mediaZona: 4050, trend5Anni: 18.5,
};

export const mockListings: ListingsData = {
  annunci: [
    { tipo: "vendita", prezzo: 320000, mq: 75, locali: 3, piano: 4, link: "#" },
    { tipo: "affitto", prezzo: 1200, mq: 55, locali: 2, piano: 2, link: "#" },
  ],
};

export const mockEnergy: EnergyData = {
  classeEnergetica: "D", epgl: 142.5, mediaZona: "E",
};

export const mockMoodScore: MoodScoreData = {
  score: 72, trend: "in crescita",
  categorie: { commercio: 78, trasporti: 85, verde: 55, sicurezza: 68, socialLife: 74 },
};

export const mockTimeView: TimeViewData = {
  previsione5Anni: 12, previsione10Anni: 28, previsione20Anni: 45,
  progettiInArrivo: [
    "Nuova fermata metro M4 (2027)",
    "Riqualificazione Piazza Sant'Ambrogio (2028)",
  ],
};

export const mockOpportunity: OpportunityData = {
  indice: 76, quadrante: "Stella Nascente",
  raccomandazione: "Zona in decollo — finestra d'acquisto ideale",
};

export const mockCondominio: CondominioData = {
  tipoRiscaldamento: "centralizzato",
  ascensore: true,
  statoConservazione: "buono",
  annoUltimaRistrutturazione: 2018,
  postiAuto: 12,
  giardino: false,
  portineria: true,
};

export const mockStoricoTransazioni: StoricoTransazioniData = {
  transazioni: [
    { data: "2025-09-15", prezzo: 310000, mq: 72, piano: 3, tipo: "vendita" },
    { data: "2025-03-02", prezzo: 1150, mq: 50, piano: 1, tipo: "affitto" },
    { data: "2024-11-20", prezzo: 285000, mq: 65, piano: 5, tipo: "vendita" },
    { data: "2024-06-10", prezzo: 340000, mq: 85, piano: 6, tipo: "vendita" },
  ],
  mediaZona12Mesi: 4150,
  variazione12Mesi: 3.2,
};

export const mockInfrastrutture: InfrastrutureData = {
  progetti: [
    { nome: "Prolungamento M4 Linate-Stazione Forlanini", tipo: "metro", stato: "in_costruzione", completamentoPrevisto: "2027-06", distanzaKm: 1.2 },
    { nome: "Pista ciclabile Naviglio Pavese", tipo: "ciclabile", stato: "approvato", completamentoPrevisto: "2028-03", distanzaKm: 0.8 },
    { nome: "Nuovo parco urbano ex-scalo Romana", tipo: "parco", stato: "approvato", completamentoPrevisto: "2029-01", distanzaKm: 2.1 },
  ],
  cantieriAperti: 3,
  impattoStimato: "alto",
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
