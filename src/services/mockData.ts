import type {
  IdentifyResult,
  CadastralData,
  PricingData,
  ListingsData,
  EnergyData,
  MoodScoreData,
  TimeViewData,
  OpportunityData,
} from "@/types";

export const mockIdentify: IdentifyResult = {
  address: "Via Torino 45, Milano",
  buildingId: "MI-VT45",
  confidence: 0.92,
};

export const mockCadastral: CadastralData = {
  foglio: 234,
  particella: 89,
  subalterno: 3,
  anno: 1962,
  piani: 6,
  unitaImmobiliari: 24,
  renditaCatastale: 1850,
};

export const mockPricing: PricingData = {
  prezzoMq: 4200,
  prezzoMqMin: 3800,
  prezzoMqMax: 5100,
  mediaZona: 4050,
  trend5Anni: 18.5,
};

export const mockListings: ListingsData = {
  annunci: [
    { tipo: "vendita", prezzo: 320000, mq: 75, locali: 3, piano: 4, link: "#" },
    { tipo: "affitto", prezzo: 1200, mq: 55, locali: 2, piano: 2, link: "#" },
  ],
};

export const mockEnergy: EnergyData = {
  classeEnergetica: "D",
  epgl: 142.5,
  mediaZona: "E",
};

export const mockMoodScore: MoodScoreData = {
  score: 72,
  trend: "in crescita",
  categorie: {
    commercio: 78,
    trasporti: 85,
    verde: 55,
    sicurezza: 68,
    socialLife: 74,
  },
};

export const mockTimeView: TimeViewData = {
  previsione5Anni: 12,
  previsione10Anni: 28,
  previsione20Anni: 45,
  progettiInArrivo: [
    "Nuova fermata metro M4 (2027)",
    "Riqualificazione Piazza Sant'Ambrogio (2028)",
  ],
};

export const mockOpportunity: OpportunityData = {
  indice: 76,
  quadrante: "Stella Nascente",
  raccomandazione: "Zona in decollo — finestra d'acquisto ideale",
};
