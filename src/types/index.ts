/** Risultato generico da un servizio scan/forecast */
export interface ServiceResult<T = unknown> {
  error: boolean;
  message: string | null;
  data: T | null;
}

/** Stato di una singola sezione nel risultato */
export type SectionStatus = "idle" | "loading" | "success" | "error";

/** Sezione generica nel risultato scan */
export interface SectionState<T = unknown> {
  status: SectionStatus;
  data: T | null;
  message: string | null;
}

/** Dati identificazione edificio */
export interface IdentifyResult {
  address: string;
  buildingId: string;
  confidence: number;
}

/** Dati catastali */
export interface CadastralData {
  foglio: number;
  particella: number;
  subalterno: number;
  anno: number;
  piani: number;
  unitaImmobiliari: number;
  renditaCatastale: number;
}

/** Dati prezzi di mercato */
export interface PricingData {
  prezzoMq: number;
  prezzoMqMin: number;
  prezzoMqMax: number;
  mediaZona: number;
  trend5Anni: number;
}

/** Singolo annuncio immobiliare */
export interface Listing {
  tipo: "vendita" | "affitto";
  prezzo: number;
  mq: number;
  locali: number;
  piano: number;
  link: string;
}

/** Contenitore annunci */
export interface ListingsData {
  annunci: Listing[];
}

/** Dati classe energetica */
export interface EnergyData {
  classeEnergetica: string;
  epgl: number;
  mediaZona: string;
}

/** MoodScore zona */
export interface MoodScoreData {
  score: number;
  trend: string;
  categorie: Record<string, number>;
}

/** Previsione futura */
export interface TimeViewData {
  previsione5Anni: number;
  previsione10Anni: number;
  previsione20Anni: number;
  progettiInArrivo: string[];
}

/** Indice opportunità */
export interface OpportunityData {
  indice: number;
  quadrante: "Stella Nascente" | "Diamante Grezzo" | "Picco Raggiunto" | "Allerta Rossa";
  raccomandazione: string;
}

/** Risultato completo di una scansione */
export interface ScanResult {
  identify: SectionState<IdentifyResult>;
  cadastral: SectionState<CadastralData>;
  pricing: SectionState<PricingData>;
  listings: SectionState<ListingsData>;
  energy: SectionState<EnergyData>;
  moodScore: SectionState<MoodScoreData>;
  timeView: SectionState<TimeViewData>;
  opportunity: SectionState<OpportunityData>;
}

/** Errore restituito da coreRequest */
export interface CoreError {
  error: true;
  message: string;
}
