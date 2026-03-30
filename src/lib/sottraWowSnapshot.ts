/**
 * Sottra WOW Snapshot Composer
 *
 * Composes a quick-read panel from zone value, renovation estimate,
 * zone growth signals, and correspondence. No magic scores.
 * Attention signal depends on real data strength, not hype.
 */

import type { ZoneValueResult, ValueNarrativeMode } from "@/lib/zoneValueEngine";
import { valueNarrativeMode, valuePrecisionLabel, valueReliabilityLabel } from "@/lib/zoneValueEngine";
import type { RenovationResult, RenovationNarrativeMode } from "@/lib/renovationCostEngine";
import { renovationNarrativeMode, estimateStrengthLabel } from "@/lib/renovationCostEngine";
import type { ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";
import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type AttentionSignal = "high" | "medium" | "low" | "insufficient";
export type SnapshotNarrativeMode = "full" | "partial" | "hidden";

export type SpecificityLabel = "Alta" | "Medio-alta" | "Media" | "Bassa" | "Non sufficiente";

export interface WowSnapshot {
  zona_reale: string;
  livello_lettura: string;
  valore_al_mq: string | null;
  valore_range: string | null;
  affidabilita_valore: string;
  costo_ristrutturazione: string | null;
  costo_range: string | null;
  segnali_zona: string;
  attenzione_area: AttentionSignal;
  limite_principale: string;
  narrative_mode: SnapshotNarrativeMode;
  specificita_immobile: SpecificityLabel | null;
}

/* ═══════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════ */

function fmtEur(n: number | null): string | null {
  if (n == null) return null;
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  return `${fmtEur(min)} – ${fmtEur(max)}`;
}

/* ═══════════════════════════════════════════════════════════
   ATTENTION SIGNAL LOGIC — no magic, just data strength
   ═══════════════════════════════════════════════════════════ */

function resolveAttention(
  valueMode: ValueNarrativeMode,
  growthStatus: string | null,
  fallbackWeight: string,
  valueConfidence: number,
): AttentionSignal {
  // If value not renderable → insufficient
  if (valueMode === "hidden") return "insufficient";

  let score = 0;
  // Value strength
  if (valueConfidence >= 0.7) score += 3;
  else if (valueConfidence >= 0.4) score += 2;
  else score += 1;

  // Growth signal bonus
  if (growthStatus === "supportive") score += 2;
  else if (growthStatus === "mixed") score += 1;

  // Fallback penalty
  if (fallbackWeight === "high") score -= 2;
  else if (fallbackWeight === "medium") score -= 1;

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "insufficient";
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export interface WowSnapshotInput {
  value: ZoneValueResult;
  renovation: RenovationResult;
  growth: ZoneGrowthSignalsResult | null;
  corr: ZoneCorrespondenceResult;
  /** Optional house differentiation specificity strength */
  specificity_strength?: "strong" | "medium" | "weak" | "insufficient" | null;
  /** Optional overall differentiation status for finer mapping */
  specificity_status?: string | null;
}

export function buildWowSnapshot(input: WowSnapshotInput): WowSnapshot {
  const { value, renovation, growth, corr, specificity_strength, specificity_status } = input;

  const valMode = valueNarrativeMode(value);
  const renMode = renovationNarrativeMode(renovation);
  const growthStatus = growth?.growth_summary.overall_growth_signal_status ?? null;

  const attention = resolveAttention(
    valMode,
    growthStatus,
    value.value_result.fallback_weight,
    value.value_result.value_confidence,
  );

  // ── Value display ──
  const valMid = value.value_result.value_per_sqm_mid;
  const valRange = fmtRange(value.value_result.value_per_sqm_min, value.value_result.value_per_sqm_max);

  // ── Renovation display ──
  const renRange = fmtRange(renovation.renovation_estimate.renovation_cost_min, renovation.renovation_estimate.renovation_cost_max);

  // ── Zone signals label ──
  let segnaliLabel: string;
  if (!growth || growth.growth_summary.narrative_mode === "hidden") {
    segnaliLabel = "Non sufficienti";
  } else if (growthStatus === "supportive") {
    segnaliLabel = "Segnali convergenti favorevoli";
  } else if (growthStatus === "mixed") {
    segnaliLabel = "Quadro misto";
  } else if (growthStatus === "weak") {
    segnaliLabel = "Segnali deboli";
  } else {
    segnaliLabel = "Insufficienti";
  }

  // ── Primary limitation ──
  let limitePrincipale: string;
  if (valMode === "hidden") {
    limitePrincipale = "Valore al mq non disponibile per questa zona";
  } else if (value.value_quality.comune_only_bias) {
    limitePrincipale = "Dato riferito al livello comunale — la zona specifica potrebbe variare";
  } else if (value.value_result.fallback_weight === "high") {
    limitePrincipale = "Forte componente di fallback — precisione ridotta";
  } else if (renMode === "hidden") {
    limitePrincipale = "Stima costi ristrutturazione non disponibile";
  } else {
    limitePrincipale = "Le stime non sostituiscono una valutazione professionale";
  }

  // ── Narrative mode ──
  let narrativeMode: SnapshotNarrativeMode;
  if (valMode === "hidden" && renMode === "hidden") {
    narrativeMode = "hidden";
  } else if (valMode === "full" && attention !== "insufficient") {
    narrativeMode = "full";
  } else {
    narrativeMode = "partial";
  }

  // ── Specificity label — finer 5-level mapping ──
  let specLabel: SpecificityLabel | null = null;
  if (specificity_strength) {
    if (specificity_strength === "strong") {
      specLabel = "Alta";
    } else if (specificity_strength === "medium") {
      // Distinguish "Medio-alta" from "Media" using status
      specLabel = specificity_status === "building_candidate_with_limited_ambiguity" ? "Medio-alta" : "Media";
    } else if (specificity_strength === "weak") {
      specLabel = "Bassa";
    } else {
      specLabel = "Non sufficiente";
    }
  }

  return {
    zona_reale: corr.zone_identity.geo_label,
    livello_lettura: corr.zone_identity.zone_type_label,
    valore_al_mq: valMid != null ? fmtEur(valMid) : null,
    valore_range: valRange,
    affidabilita_valore: valueReliabilityLabel(value.value_quality.reliability_status),
    costo_ristrutturazione: fmtEur(renovation.renovation_estimate.renovation_cost_mid),
    costo_range: renRange,
    segnali_zona: segnaliLabel,
    attenzione_area: attention,
    limite_principale: limitePrincipale,
    narrative_mode: narrativeMode,
    specificita_immobile: specLabel,
  };
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function attentionSignalLabel(s: AttentionSignal): string {
  const m: Record<AttentionSignal, string> = {
    high: "Merita attenzione",
    medium: "Da valutare",
    low: "Elementi limitati",
    insufficient: "Dati insufficienti",
  };
  return m[s];
}

export function attentionSignalColor(s: AttentionSignal): string {
  const m: Record<AttentionSignal, string> = {
    high: "text-emerald-400",
    medium: "text-primary",
    low: "text-amber-400",
    insufficient: "text-muted-foreground",
  };
  return m[s];
}
