/**
 * Report-specific types for the Sottra structured report engine.
 * These types define the framework for all report sections,
 * with uniform source typing and availability status.
 *
 * IMPORTANT: Do NOT touch OmiZoneData or OMI pipeline types — those are frozen.
 */

import type { SourceMetadata } from "./index";

/* ── Report Source Types ────────────────────────────────── */

export type ReportSourceType =
  | "image_detected"
  | "visual_estimate"
  | "territorial_verified"
  | "official_data"
  | "market_data"
  | "forecast_scenario"
  | "unavailable";

export type AvailabilityStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "not_determinable"
  | "fallback";

/* ── Report Field ───────────────────────────────────────── */

export interface ReportField<T = string | number | boolean | null> {
  value: T;
  label: string;
  sourceType: ReportSourceType;
  confidence?: number;
  availabilityStatus: AvailabilityStatus;
  note?: string;
}

export function unavailableField(label: string): ReportField<null> {
  return { value: null, label, sourceType: "unavailable", availabilityStatus: "unavailable" };
}

export function isFieldAvailable(field: ReportField | null | undefined): boolean {
  if (!field) return false;
  return field.availabilityStatus === "available" || field.availabilityStatus === "partial";
}

/* ── Section A: Profilo Rapido ──────────────────────────── */

export interface ProfiloRapidoData extends SourceMetadata {
  indirizzo?: ReportField<string>;
  coordinate?: ReportField<string>;
  tipologiaEdificio?: ReportField<string>;
  annoCostruzioneStimato?: ReportField<string>;
  pianiStimati?: ReportField<number>;
  statoGenerale?: ReportField<string>;
  zonaOmiRiferimento?: ReportField<string>;
}

/* ── Section B: Immobile e Facciata ─────────────────────── */

export interface ImmobileFacciataData extends SourceMetadata {
  tipologiaFacciata?: ReportField<string>;
  materialePrevalente?: ReportField<string>;
  statoConservazioneFacciata?: ReportField<string>;
  presenzaBalconi?: ReportField<boolean>;
  presenzaAscensore?: ReportField<string>;
  leggibilitaImmagine?: ReportField<string>;
  noteVisive?: ReportField<string>;
}

/* ── Section C: Contesto e Vicinato ─────────────────────── */

export interface ContestoVicinatoData extends SourceMetadata {
  prevalenzaContesto?: ReportField<string>;
  tessutoUrbano?: ReportField<string>;
  densitaEdiliziaPercepita?: ReportField<string>;
  dotazioneServizi?: ReportField<string>;
  presenzaServiziRilevati?: ReportField<boolean>;
  elencoServiziRilevati?: ReportField<string[]>;
  vicinatoPercepito?: ReportField<string>;
  livelloDecorositaUrbana?: ReportField<string>;
  livelloServiziArea?: ReportField<string>;
}

/* ── Section F: Posizionamento Commerciale Immobile ────── */

export interface PosizionamentoCommercialeData extends SourceMetadata {
  statoCommercialeRilevato?: ReportField<string>;
  matchAnnuncioTrovato?: ReportField<boolean>;
  livelloConfidenzaMatchAnnuncio?: ReportField<string>;
  tipoReferente?: ReportField<string>;
  nomeAgenziaPrincipale?: ReportField<string>;
  numeroReferentiRilevati?: ReportField<number>;
  unicoReferenteRilevato?: ReportField<boolean>;
  multiagenziaRilevata?: ReportField<boolean>;
  esclusivaDichiarataNellAnnuncio?: ReportField<boolean>;
  esclusiva_verificabile?: ReportField<boolean>;
  prezzoRichiestoRilevato?: ReportField<number>;
  canoneRichiestoRilevato?: ReportField<number>;
  portaleOrigine?: ReportField<string>;
  dataAnnuncioOAntichita?: ReportField<string>;
  noteCommercialiSintetiche?: ReportField<string>;
}

/* ── Geo-level metadata for territorial sections ───────── */

export type ReportGeoLevel =
  | "microzona_omi" | "zona_specifica" | "quartiere" | "comune" | "non_determinato";

export interface GeoContext {
  geoLevel: ReportGeoLevel;
  geoLabel?: string;
}

/* ── Section H: Profilo Area ────────────────────────────── */

export interface ProfiloAreaData extends SourceMetadata {
  classificazioneArea?: ReportField<string>;
  vocazioneTerritoriale?: ReportField<string>;
  livelloUrbanizzazione?: ReportField<string>;
  presenzaServiziPrimari?: ReportField<string>;
  accessibilitaTrasporti?: ReportField<string>;
  qualitaAmbientale?: ReportField<string>;
  sintesiArea?: ReportField<string>;
  noteArea?: ReportField<string>;
  /** Geographic resolution of the data used in this section */
  geo?: GeoContext;
}

/* ── Section I: Scenario 5/10/20 anni ───────────────────── */

export interface ScenarioTemporaleEntry {
  orizzonte: "5_anni" | "10_anni" | "20_anni";
  label: string;
  variazioneStimataPct?: ReportField<number>;
  driverPrincipali?: ReportField<string[]>;
  rischiPrincipali?: ReportField<string[]>;
  narrativa?: ReportField<string>;
}

export interface ScenarioTemporaleData extends SourceMetadata {
  scenari?: ScenarioTemporaleEntry[];
  disclaimer?: string;
}

/* ── Section J: Sintesi Finale ──────────────────────────── */

export interface SintesiFinaleData extends SourceMetadata {
  giudizioSintetico?: ReportField<string>;
  puntiDiForza?: ReportField<string[]>;
  puntiDiAttenzione?: ReportField<string[]>;
  raccomandazione?: ReportField<string>;
  coperturaAnalisi?: ReportField<string>;
  /** Geographic resolution of the data used in this section */
  geo?: GeoContext;
}

/* ── Section L: Priorità / Criticità ────────────────────── */

export type PrioritaCriticaCategoria =
  | "da_verificare"
  | "elemento_favorevole"
  | "attenzione"
  | "copertura_parziale";

export interface PrioritaCriticaItem {
  testo: string;
  categoria: PrioritaCriticaCategoria;
  sourceType: ReportSourceType;
  availabilityStatus: AvailabilityStatus;
  nota?: string;
}

export interface PrioritaCriticitaData {
  items: PrioritaCriticaItem[];
}

/* ── Section K: Trasparenza Fonti ───────────────────────── */

export interface FonteEntry {
  categoria: "immagine" | "dato_ufficiale" | "dato_territoriale" | "dato_mercato" | "scenario" | "elaborazione";
  categoriaLabel: string;
  provider?: string;
  dettaglio?: string;
  periodo?: string;
  copertura?: string;
}

export interface TrasparenzaFontiData {
  fonti: FonteEntry[];
}

/* ── Full Report Structure ──────────────────────────────── */

export interface SottraReport {
  profiloRapido?: ProfiloRapidoData;
  immobileFacciata?: ImmobileFacciataData;
  contestoVicinato?: ContestoVicinatoData;
  posizionamentoCommerciale?: PosizionamentoCommercialeData;
  profiloArea?: ProfiloAreaData;
  scenarioTemporale?: ScenarioTemporaleData;
  sintesiFinale?: SintesiFinaleData;
  prioritaCriticita?: PrioritaCriticitaData;
  trasparenzaFonti?: TrasparenzaFontiData;
}

/* ── Section rendering helpers ──────────────────────────── */

export function isSectionRenderable(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  const fields = Object.values(data).filter(
    (v) => v != null && typeof v === "object" && "availabilityStatus" in (v as Record<string, unknown>)
  ) as ReportField[];
  return fields.some(isFieldAvailable);
}

export function countAvailableFields(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  const fields = Object.values(data).filter(
    (v) => v != null && typeof v === "object" && "availabilityStatus" in (v as Record<string, unknown>)
  ) as ReportField[];
  return fields.filter(isFieldAvailable).length;
}

export const sourceTypeLabels: Record<ReportSourceType, string> = {
  image_detected: "Rilevato da immagine",
  visual_estimate: "Stima visiva",
  territorial_verified: "Verificato territoriale",
  official_data: "Dato ufficiale",
  market_data: "Dato di mercato",
  forecast_scenario: "Scenario proiettivo",
  unavailable: "Non disponibile",
};

export const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Disponibile",
  partial: "Parziale",
  unavailable: "Non disponibile",
  not_determinable: "Non determinabile",
  fallback: "Approssimazione",
};
