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

/** Photo analysis sub-fields from enriched identify */
export interface PhotoAnalysis {
  buildingType?: string;
  visibleFloors?: number;
  photoReadability?: "clear" | "partial" | "poor";
}

/** Street evidence sub-fields from enriched identify */
export interface StreetEvidence {
  facadeConsistencyLevel?: "strong" | "good" | "partial" | "weak" | "none";
  photoAnalysis?: PhotoAnalysis;
}

/** Dati identificazione edificio */
export interface IdentifyResult {
  address: string;
  buildingId: string;
  confidence: number;
  streetEvidence?: StreetEvidence;
}

/** Source provider identifiers */
export type SourceProvider =
  | "core_v3" | "istat" | "omi" | "here" | "overpass" | "mapillary"
  | "google_places" | "geoapify" | "internal" | "unknown";

/** Extended source type taxonomy */
export type SourceType =
  | "official" | "verified_geo" | "premium" | "elaborated"
  | "estimate" | "derived" | "unavailable"
  | "commercial_verified" | "commercial_partial";

/** Geographic coverage level */
export type CoverageLevel =
  | "address" | "zone_omi" | "quartiere" | "comune"
  | "provincia" | "area_vasta" | "unknown";

/** Reason why data is unavailable */
export type AvailabilityReason =
  | "no_match" | "provider_unavailable" | "no_coverage"
  | "requires_premium" | "requires_agreement" | "parsing_error" | "timeout";

/** Source metadata dal backend */
export interface SourceMetadata {
  sourceLabel?: string;
  sourceType?: SourceType;
  sourceProvider?: SourceProvider;
  sourcePeriod?: string;
  sourceFreshness?: string;
  sourceConfidence?: number;
  confidenceReason?: string;
  limitations?: string[];
  sourceCoverageLevel?: CoverageLevel;
  availabilityReason?: AvailabilityReason;
  licensingNote?: string;
  attributionNote?: string;
}

/** Dati prezzi di mercato */
export interface PricingData extends SourceMetadata {
  prezzoMq: number;
  prezzoMqMin: number;
  prezzoMqMax: number;
  mediaZona: number | null;
  trend5Anni: number | null;
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

/** Livello geografico del dato territoriale */
export type GeoLevel = "microzona" | "quartiere" | "zona" | "comune" | "area_vasta" | "stimato";

/** Trend demografico */
export interface TrendDemograficoData extends SourceMetadata {
  etaMedia: number | null;
  densitaAbitanti: number | null;
  flussoResidenti12Mesi: number | null;
  percentualeFamiglie: number | null;
  percentualeGiovani: number | null;
  percentualeStranieri: number | null;
  /** Livello geografico di riferimento del dato */
  geoLevel?: GeoLevel | null;
  /** Nome leggibile della zona/quartiere */
  geoLabel?: string | null;
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

/** Segnale di mercato premium */
export interface MarketSignal {
  key: string;
  label: string;
  value?: string | number | null;
  detail?: string | null;
}

/** Provider breakdown */
export interface MarketProviderBreakdown {
  provider: string;
  listingsUsed?: number | null;
  coverageLevel?: string | null;
}

/** Comparables summary */
export interface ComparablesSummary {
  count: number | null;
  medianPricePerSqm?: number | null;
  q1PricePerSqm?: number | null;
  q3PricePerSqm?: number | null;
  minPricePerSqm?: number | null;
  maxPricePerSqm?: number | null;
  marketDepth?: "profondo" | "sufficiente" | "limitato" | null;
  marketFreshness?: "recente" | "moderata" | "datata" | null;
}

/** Market context */
export interface MarketContextData extends SourceMetadata {
  marketConfidence?: number | null;
  marketCoverageLevel?: "completa" | "buona" | "parziale" | "scarsa" | null;
  comparablesSummary?: ComparablesSummary | null;
  marketSignals?: MarketSignal[] | null;
  providerBreakdown?: MarketProviderBreakdown[] | null;
  narrativeObservation?: string | null;
}

/* ── PRO SOURCES TYPES ─────────────────────────────────── */

/** Single POI near the scanned building */
export interface NearbyPoi {
  name: string;
  category: string;
  categoryLabel: string;
  distance: number;
  lat: number;
  lng: number;
  provider: SourceProvider;
}

/** POI category summary */
export interface PoiCategorySummary {
  category: string;
  categoryLabel: string;
  count: number;
  nearest?: NearbyPoi;
}

/** POI enrichment data */
export interface PoiEnrichmentData extends SourceMetadata {
  totalPois: number;
  categories: PoiCategorySummary[];
  pois: NearbyPoi[];
  searchRadius: number;
}

/** OMI zone data */
export interface OmiZoneData extends SourceMetadata {
  zonaOmi?: string | null;
  zonaOmiLabel?: string | null;
  comuneLabel?: string | null;
  quotazioneMinResidenziale?: number | null;
  quotazioneMaxResidenziale?: number | null;
  semestre?: string | null;
  tipologia?: string | null;
  statoConservazione?: string | null;
  polygonMatch?: boolean;
}

/** ISTAT enhanced demographic data */
export interface IstatDemographicData extends SourceMetadata {
  popolazione?: number | null;
  nucleiFamiliari?: number | null;
  densita?: number | null;
  indiceVecchiaia?: number | null;
  percentualeStranieri?: number | null;
  comuneLabel?: string | null;
  annoRilevazione?: string | null;
}

/** Risultato completo di una scansione — solo moduli realmente operativi */
export interface ScanResult {
  identify: SectionState<IdentifyResult>;
  pricing: SectionState<PricingData>;
  marketContext: SectionState<MarketContextData>;
  timeView: SectionState<TimeViewData>;
  opportunity: SectionState<OpportunityData>;
  infrastrutture: SectionState<InfrastrutureData>;
  rischioZona: SectionState<RischioZonaData>;
  trendDemografico: SectionState<TrendDemograficoData>;
  sviluppoArea: SectionState<SviluppoAreaData>;
  convergenzaTerritoriale: SectionState<ConvergenzaTerritorialeData>;
  poiEnrichment: SectionState<PoiEnrichmentData>;
  omiZone: SectionState<OmiZoneData>;
  istatDemographic: SectionState<IstatDemographicData>;
  /* ── New report engine sections (Phase 1 — framework only) ── */
  profiloRapido: SectionState<import("@/types/report").ProfiloRapidoData>;
  immobileFacciata: SectionState<import("@/types/report").ImmobileFacciataData>;
  contestoVicinato: SectionState<import("@/types/report").ContestoVicinatoData>;
  posizionamentoCommerciale: SectionState<import("@/types/report").PosizionamentoCommercialeData>;
  profiloArea: SectionState<import("@/types/report").ProfiloAreaData>;
  scenarioTemporale: SectionState<import("@/types/report").ScenarioTemporaleData>;
  sintesiFinale: SectionState<import("@/types/report").SintesiFinaleData>;
}

/** Errore restituito da coreRequest */
export interface CoreError {
  error: true;
  message: string;
}
