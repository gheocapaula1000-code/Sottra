/**
 * Response shape from the Central Core `civiko-property-from-photo` opener.
 * Cinematic preview only — official OMI/ISTAT/forecast come from Sottra modules.
 */
export interface PhotoWowImmobile {
  tipologiaProbabile: string | null;
  pianoStimato: string | null;
  statoApparente: string | null;
  puntiDiForzaVisivi: string[];
  materialePresunto: string | null;
  annoPresunto: string | null;
}

export interface PhotoWowZona {
  nomeComune: string | null;
  provincia: string | null;
  nomeZonaOmi: string | null;
  fascia: string | null;
  valoreMinOmi: number | null;
  valoreMaxOmi: number | null;
  tendenzaMercato: string | null;
  classificazioneZona: string | null;
  sentimentResidenti: string | null;
  livelloSentiment: string | null;
}

export interface PhotoWowScores {
  vendibilita: number;
  opportunitaInvestimento: number;
  pressioneEreditaria: number;
}

export interface PhotoWowLiveSignal {
  tipo: string;
  titolo: string;
  estratto: string;
  url: string;
  fonte: string;
  dataRilevazione: string;
}

export interface PhotoWowTerritorialDocument {
  tipo: string;
  titolo: string;
  descrizione: string;
  url: string;
  fonte: string;
}

export interface PhotoWowZonaIntelligenceNotizia {
  titolo: string;
  url: string;
  data: string;
}

export interface PhotoWowZonaIntelligence {
  notizieRecenti: PhotoWowZonaIntelligenceNotizia[];
  puntiDiForzaNascosti: string[];
  criticitaEmergenti: string[];
  tendenzaMercato: string;
}

export interface PhotoWowVendutoRecente {
  prezzoMq: number;
  fonte: string;
  data: string;
}

export interface PhotoWowObiezione {
  obiezione: string;
  risposta: string;
}

export interface PhotoWowPianoEsclusiva {
  argomento: string;
  puntiChiave: string[];
  obiezioniProbabili: PhotoWowObiezione[];
  stimaRapida: string;
}

export type PhotoWowQualita = "ottima" | "buona" | "minima";

export interface PhotoWowResponse {
  immobile: PhotoWowImmobile;
  zona: PhotoWowZona;
  scores: PhotoWowScores;
  liveSignals: PhotoWowLiveSignal[];
  territorialDocuments: PhotoWowTerritorialDocument[];
  zonaIntelligence: PhotoWowZonaIntelligence;
  vendutoRecente: PhotoWowVendutoRecente[];
  mappaCaloreUrl: string;
  pianoEsclusiva: PhotoWowPianoEsclusiva;
  qualita: PhotoWowQualita;
  tempoElaborazione: number;
  fontiUsate: string[];
}
