/**
 * Public homepage demo — Padova OMI D8 Est numbers from Paula's live
 * iPhone scan (civile NORMALE 1400–1850, 1° semestre 2025).
 * Not invented. Not a municipal average. Labeled Esempio.
 * No catasto, APE, reddito medio, or Superbonus.
 */

import type { IdentifyResult, OmiZoneData } from "@/types";
import type { PhotoWowResponse } from "@/types/photoWow";

/** Headline Paula saw on the D8 Est scan — civile NORMALE, not the mashed 1400–2750. */
export const DEMO_OMI_MIN = 1400;
export const DEMO_OMI_MAX = 1850;
export const DEMO_OMI_SEMESTRE_LABEL = "1° semestre 2025";
export const DEMO_OMI_ZONA = "Est (OMI D8)";
export const DEMO_COMUNE = "Padova";

export const OMI_MICROZONA_HONESTY =
  "Quotazione della microzona OMI — non è una media comunale né il valore di questo civico.";

export const DEMO_OMI: OmiZoneData = {
  sourceType: "official",
  sourceProvider: "omi",
  sourceLabel: "OMI / Agenzia delle Entrate",
  sourcePeriod: "2025/1",
  sourceCoverageLevel: "zone_omi",
  zonaOmi: "D8",
  zonaOmiLabel: DEMO_OMI_ZONA,
  comuneLabel: DEMO_COMUNE,
  quotazioneMinResidenziale: DEMO_OMI_MIN,
  quotazioneMaxResidenziale: DEMO_OMI_MAX,
  tipologia: "Abitazioni civili",
  statoConservazione: "NORMALE",
  semestre: DEMO_OMI_SEMESTRE_LABEL,
  polygonMatch: true,
  omiGeoLevel: "microzona_omi",
};

/** What THIS demo facade actually shows. No invented civico, floors count, or listings. */
export const DEMO_PHOTO_FACTS = {
  buildingType: "Palazzina",
  materiale: "Intonaco ocra",
  strengths: ["Persiane verdi", "Più piani visibili"],
} as const;

/** Street-level esempio identity — no cadastral id, no invented civico plate. */
export const DEMO_IDENTIFY: IdentifyResult = {
  address: "",
  buildingId: "demo-homepage-d8",
  confidence: 0,
  comune: "Padova",
  streetEvidence: {
    facadeConsistencyLevel: "good",
    photoAnalysis: {
      buildingType: DEMO_PHOTO_FACTS.buildingType,
      photoReadability: "clear",
    },
  },
};

export function emptyDemoWow(overrides: Partial<PhotoWowResponse> = {}): PhotoWowResponse {
  return {
    immobile: {
      tipologiaProbabile: DEMO_PHOTO_FACTS.buildingType,
      pianoStimato: null,
      statoApparente: null,
      puntiDiForzaVisivi: [...DEMO_PHOTO_FACTS.strengths],
      materialePresunto: DEMO_PHOTO_FACTS.materiale,
      annoPresunto: null,
    },
    zona: {
      nomeComune: DEMO_COMUNE,
      provincia: "PD",
      nomeZonaOmi: DEMO_OMI_ZONA,
      fascia: null,
      valoreMinOmi: DEMO_OMI_MIN,
      valoreMaxOmi: DEMO_OMI_MAX,
      tendenzaMercato: null,
      classificazioneZona: "D8",
      sentimentResidenti: null,
      livelloSentiment: null,
    },
    scores: {
      vendibilita: null,
      opportunitaInvestimento: null,
      pressioneEreditaria: null,
    },
    liveSignals: [],
    territorialDocuments: [],
    zonaIntelligence: {
      notizieRecenti: [],
      puntiDiForzaNascosti: [],
      criticitaEmergenti: [],
      tendenzaMercato: "",
    },
    vendutoRecente: [],
    mappaCaloreUrl: "",
    pianoEsclusiva: {
      argomento: "",
      puntiChiave: [],
      obiezioniProbabili: [],
      stimaRapida: "",
    },
    qualita: "buona",
    tempoElaborazione: 0,
    fontiUsate: [],
    ...overrides,
  };
}
