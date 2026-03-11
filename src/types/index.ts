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

/** Source metadata dal backend */
export interface SourceMetadata {
  sourceLabel?: string;
  sourceType?: "official" | "elaborated" | "estimate" | "unavailable";
  sourcePeriod?: string;
  confidenceReason?: string;
  limitations?: string[];
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
export interface PricingData extends SourceMetadata {
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
export interface TimeViewData extends SourceMetadata {
  previsione5Anni?: number;
  previsione10Anni?: number;
  previsione20Anni?: number;
  progettiInArrivo?: string[];
  scenarioBand?: "favorevole" | "moderatamente_favorevole" | "stabile" | "da_monitorare" | null;
  scenarioHorizon?: string | null;
  scenarioDrivers?: string[] | null;
  scenarioRisks?: string[] | null;
  narrativeObservation?: string | null;
}

/** Indice opportunità */
export interface OpportunityData extends SourceMetadata {
  score: number | null;
  band?: "molto_forte" | "forte" | "interessante" | "limitata" | null;
  drivers?: string[] | null;
  risks?: string[] | null;
  observation?: string | null;
  /** Legacy fields — fallback */
  indice?: number;
  quadrante?: string;
  raccomandazione?: string;
}

/** Info condominio */
export interface CondominioData {
  tipoRiscaldamento: "centralizzato" | "autonomo";
  ascensore: boolean;
  statoConservazione: "ottimo" | "buono" | "sufficiente" | "mediocre";
  annoUltimaRistrutturazione: number | null;
  postiAuto: number;
  giardino: boolean;
  portineria: boolean;
}

/** Storico transazioni */
export interface TransazioneStorica {
  data: string;
  prezzo: number;
  mq: number;
  piano: number;
  tipo: "vendita" | "affitto";
}

export interface StoricoTransazioniData {
  transazioni: TransazioneStorica[];
  mediaZona12Mesi: number;
  variazione12Mesi: number;
}

/** Progetto infrastrutturale */
export interface InfrastructureProject {
  label: string;
  category?: string;
  status?: string;
  source?: string;
  impact?: string;
  period?: string;
}

/** Segnale infrastrutturale generico */
export interface InfrastructureSignal {
  label: string;
  source?: string;
  detail?: string;
}

/** Driver o rischio infrastrutturale */
export interface InfrastructureDriverRisk {
  label: string;
  source?: string;
}

/** Infrastrutture e reti */
export interface InfrastrutureData extends SourceMetadata {
  infrastructureScore: number | null;
  infrastructureBand?: "elevata" | "significativa" | "moderata" | "contenuta" | "limitata" | null;
  infrastructureProjects?: (InfrastructureProject | string)[] | null;
  connectivitySignals?: (InfrastructureSignal | string)[] | null;
  mobilitySignals?: (InfrastructureSignal | string)[] | null;
  publicWorksSignals?: (InfrastructureSignal | string)[] | null;
  topDrivers?: (InfrastructureDriverRisk | string)[] | null;
  topRisks?: (InfrastructureDriverRisk | string)[] | null;
  narrativeObservation?: string | null;
}

/** Rischio zona */
export interface RischioZonaData extends SourceMetadata {
  idrogeologico: "alto" | "medio" | "basso" | "nullo" | null;
  sismico: "zona1" | "zona2" | "zona3" | "zona4" | null;
  inquinamento: "alto" | "medio" | "basso" | null;
  alluvionale: boolean | null;
  scoreRischio: number | null;
}

/** Trend demografico */
export interface TrendDemograficoData extends SourceMetadata {
  etaMedia: number | null;
  densitaAbitanti: number | null;
  flussoResidenti12Mesi: number | null;
  percentualeFamiglie: number | null;
  percentualeGiovani: number | null;
  percentualeStranieri: number | null;
}

/** Segnale di sviluppo area */
export interface DevelopmentSignal {
  type: string;
  label: string;
  relevance?: "alta" | "media" | "bassa";
  detail?: string;
}

/** Sviluppo area / Dinamica territoriale */
export interface SviluppoAreaData extends SourceMetadata {
  developmentSignals: DevelopmentSignal[] | null;
  infrastructureProjects: string[] | null;
  connectivitySignals: string[] | null;
  publicInvestmentSignals: string[] | null;
  areaDevelopmentScore: number | null;
  areaDevelopmentBand: "elevata" | "significativa" | "moderata" | "contenuta" | "limitata" | null;
  narrativeObservation: string | null;
}

/** Segnale convergenza territoriale */
export interface ConvergenzaSignal {
  label: string;
  source: string;
  weight: number;
}

/** Traccia evidenza convergenza */
export interface ConvergenzaEvidenceTrace {
  family: string;
  direction: "positivo" | "negativo" | "neutro";
  weightedScore: number;
  sourceCount: number;
}

/** Convergenza territoriale */
export interface ConvergenzaTerritorialeData extends SourceMetadata {
  score: number | null;
  band: "molto_forte" | "forte" | "interessante" | "debole" | null;
  convergenceLevel: "alta" | "media" | "bassa" | "insufficiente" | null;
  coverageLevel: "completa" | "buona" | "parziale" | "scarsa" | null;
  identityConfidence: number | null;
  positiveFamilies: string[] | null;
  negativeFamilies: string[] | null;
  topPositiveSignals: ConvergenzaSignal[] | null;
  topNegativeSignals: ConvergenzaSignal[] | null;
  evidenceTrace: ConvergenzaEvidenceTrace[] | null;
}

/** Risultato completo di una scansione */
export interface ScanResult {
  // Motore Scan
  identify: SectionState<IdentifyResult>;
  cadastral: SectionState<CadastralData>;
  pricing: SectionState<PricingData>;
  listings: SectionState<ListingsData>;
  energy: SectionState<EnergyData>;
  condominio: SectionState<CondominioData>;
  storicoTransazioni: SectionState<StoricoTransazioniData>;
  // Motore Forecast
  moodScore: SectionState<MoodScoreData>;
  timeView: SectionState<TimeViewData>;
  opportunity: SectionState<OpportunityData>;
  infrastrutture: SectionState<InfrastrutureData>;
  rischioZona: SectionState<RischioZonaData>;
  trendDemografico: SectionState<TrendDemograficoData>;
  sviluppoArea: SectionState<SviluppoAreaData>;
  convergenzaTerritoriale: SectionState<ConvergenzaTerritorialeData>;
}

/** Errore restituito da coreRequest */
export interface CoreError {
  error: true;
  message: string;
}
