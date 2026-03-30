/**
 * Report Tone Map — Sottra
 *
 * Central lexical mapping from internal technical states to
 * elegant, premium, user-facing labels. The engine is NOT touched.
 * Only the presentation layer changes.
 *
 * Rules:
 * - Same state = same wording everywhere
 * - Positive but true — never inflate weak into strong
 * - Limits stay visible, just not punitive
 */

import type { AttentionSignal, SpecificityLabel } from "@/lib/sottraWowSnapshot";
import type { OverallCaseStrength } from "@/lib/strongCaseEvaluator";

/* ═══════════════════════════════════════════════════════════
   ATTENTION AREA
   ═══════════════════════════════════════════════════════════ */

const attentionLabels: Record<AttentionSignal, string> = {
  high: "Prioritaria",
  medium: "Interessante",
  low: "Selettiva",
  insufficient: "Da verificare",
};

const attentionDesc: Record<AttentionSignal, string> = {
  high: "Segnali convergenti su questa area — merita attenzione prioritaria",
  medium: "Elementi di interesse rilevati — da valutare con attenzione",
  low: "Segnali presenti ma selettivi — approfondimento consigliato",
  insufficient: "Base informativa ancora da consolidare",
};

export function toneAttentionLabel(s: AttentionSignal): string {
  return attentionLabels[s];
}

export function toneAttentionDesc(s: AttentionSignal): string {
  return attentionDesc[s];
}

/* ═══════════════════════════════════════════════════════════
   SPECIFICITY
   ═══════════════════════════════════════════════════════════ */

const specificityLabels: Record<SpecificityLabel, string> = {
  "Alta": "Distinta",
  "Medio-alta": "Abbastanza distinta",
  "Media": "Contestuale",
  "Bassa": "Da confermare",
  "Non sufficiente": "Da approfondire",
};

export function toneSpecificityLabel(s: SpecificityLabel): string {
  return specificityLabels[s];
}

/* ═══════════════════════════════════════════════════════════
   AFFIDABILITÀ VALORE
   ═══════════════════════════════════════════════════════════ */

const reliabilityLabels: Record<string, string> = {
  "Alta": "Buona affidabilità",
  "Media": "Affidabilità intermedia",
  "Bassa": "Da contestualizzare",
  "Non disponibile": "Non disponibile",
};

export function toneReliabilityLabel(s: string): string {
  return reliabilityLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   OUTLOOK
   ═══════════════════════════════════════════════════════════ */

const outlookLabels: Record<string, string> = {
  supportive: "Ben supportato",
  mixed: "Composito",
  weak: "In formazione",
  insufficient: "Base ancora ridotta",
};

export function toneOutlookLabel(s: string | null | undefined): string {
  if (!s) return "Non disponibile";
  return outlookLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════ */

const fallbackLabels: Record<string, string> = {
  low: "Contenuto",
  medium: "Presente",
  high: "Rilevante",
  none: "Assente",
};

export function toneFallbackLabel(s: string): string {
  return fallbackLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   BOUNDARY / CONFINI
   ═══════════════════════════════════════════════════════════ */

export function toneBoundaryLabel(status: string | null | undefined): string {
  if (!status) return "Non disponibile a questo livello";
  if (status === "polygon_confirmed") return "Confine ben definito";
  if (status === "polygon_available") return "Confine disponibile";
  if (status === "wider_boundary") return "Confine più ampio";
  return "Non disponibile a questo livello";
}

/* ═══════════════════════════════════════════════════════════
   CASE STRENGTH
   ═══════════════════════════════════════════════════════════ */

const caseLabels: Record<OverallCaseStrength, string> = {
  strong_case: "Analisi solida",
  solid_case: "Analisi discreta",
  mixed_case: "Quadro composito",
  weak_case: "Quadro da consolidare",
};

export function toneCaseStrengthLabel(s: OverallCaseStrength): string {
  return caseLabels[s];
}

/* ═══════════════════════════════════════════════════════════
   ZONE READ STRENGTH
   ═══════════════════════════════════════════════════════════ */

const zoneReadLabels: Record<string, string> = {
  strong: "Solida",
  medium: "Intermedia",
  weak: "Limitata",
  insufficient: "Da consolidare",
};

export function toneZoneReadLabel(s: string): string {
  return zoneReadLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   LIMITE PRINCIPALE — constructive, not punitive
   ═══════════════════════════════════════════════════════════ */

export function toneLimiteLabel(raw: string): string {
  // Map known patterns to more constructive phrasing
  if (raw.includes("non disponibile")) return raw; // already fine
  if (raw.includes("comunale")) return "Lettura ancora a livello comunale — la zona specifica potrebbe variare";
  if (raw.includes("Forte componente di fallback")) return "Componente di contesto ampio presente — precisione da contestualizzare";
  if (raw.includes("non sostituiscono")) return "Le stime offrono un orientamento — per decisioni importanti, consultare un professionista";
  return raw;
}

/* ═══════════════════════════════════════════════════════════
   SEGNALI ZONA
   ═══════════════════════════════════════════════════════════ */

const segnaliLabels: Record<string, string> = {
  "Non sufficienti": "Non ancora disponibili",
  "Segnali convergenti favorevoli": "Convergenti e favorevoli",
  "Quadro misto": "Quadro composito",
  "Segnali deboli": "In fase di formazione",
  "Insufficienti": "Non ancora disponibili",
};

export function toneSegnaliLabel(s: string): string {
  return segnaliLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   ALIGNMENT
   ═══════════════════════════════════════════════════════════ */

const alignmentLabels: Record<string, string> = {
  high_alignment: "Coerente",
  medium_alignment: "Parzialmente coerente",
  low_alignment: "Da verificare",
  conflicting_alignment: "Incongruente",
  insufficient_alignment: "Dati insufficienti",
};

export function toneAlignmentLabel(s: string | null | undefined): string {
  if (!s) return "Non disponibile";
  return alignmentLabels[s] ?? s;
}

/* ═══════════════════════════════════════════════════════════
   STRONG CASE STRENGTHS — more premium phrasing
   ═══════════════════════════════════════════════════════════ */

export function toneStrengthLine(raw: string): string {
  const map: Record<string, string> = {
    "Zona letta con buona profondità": "Lettura zona solida",
    "Valore con buona affidabilità": "Valore affidabile",
    "Outlook supportato da segnali coerenti": "Prospettiva ben supportata",
    "Immobile distinguibile dal contesto vicino": "Immobile distinto",
    "Fallback sotto controllo": "Base dati ben calibrata",
  };
  return map[raw] ?? raw;
}

/* ═══════════════════════════════════════════════════════════
   TOP LIMITER — elegant phrasing
   ═══════════════════════════════════════════════════════════ */

export function toneTopLimiter(raw: string | null): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    "Fallback elevato — precisione ridotta": "Componente di contesto ampio — precisione da contestualizzare",
    "Lettura ancora prevalentemente comunale": "Lettura ancora a livello comunale",
    "Profondità segnali insufficiente": "Profondità segnali ancora da consolidare",
    "Allineamento foto/indirizzo debole": "Allineamento foto/indirizzo da verificare",
    "Specificità immobile ancora ambigua": "Specificità immobile da confermare",
    "Perimetro zona non disponibile": "Perimetro zona non disponibile a questo livello",
  };
  return map[raw] ?? raw;
}
