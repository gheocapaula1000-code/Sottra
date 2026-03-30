/**
 * Zone Outlook Engine — Sottra
 *
 * Builds a 2/5/10 year prospective view of a zone based on existing signals
 * (urban transformations, attractors, growth signals, zone correspondence).
 *
 * NO price predictions. NO invented data. NO "zona crescerà sicuramente".
 * Fallback-heavy zones get degraded outlook, never inflated narratives.
 */

import type { ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import type { ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";
import type { UrbanTransformationResult, UrbanSignalStage } from "@/lib/zoneUrbanTransformations";
import type { AttractorPressureResult } from "@/lib/zoneAttractorsPressure";
import type { CanonicalGeoLevel } from "@/lib/geoBackbone";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type OutlookDirection = "upward_pressure" | "mixed_pressure" | "neutral_pressure" | "not_determinable";
export type OutlookStatus = "supportive" | "mixed" | "weak" | "insufficient";
export type OutlookEvidenceLevel = "strong" | "medium" | "weak";
export type OutlookNarrativeMode = "full" | "partial" | "hidden";
export type OutlookAttention = "high" | "medium" | "low" | "insufficient";

export interface HorizonView {
  horizon_label: string;
  outlook_status: OutlookStatus;
  outlook_direction: OutlookDirection;
  support_strength: "strong" | "medium" | "weak" | "insufficient";
  evidence_level: OutlookEvidenceLevel;
  transformation_signal_strength: "strong" | "medium" | "weak" | "none";
  attractor_signal_strength: "strong" | "medium" | "weak" | "none";
  market_support_strength: "strong" | "medium" | "weak" | "none";
  fallback_penalty: number;
  narrative_mode: OutlookNarrativeMode;
  summary: string;
  limitations: string[];
}

export interface OutlookIdentity {
  zone_geo_code: string;
  zone_geo_level: CanonicalGeoLevel;
  zone_label: string;
  outlook_scope_label: string;
  signal_base_strength: "strong" | "medium" | "weak" | "insufficient";
}

export interface OutlookValuePressure {
  near_term_value_pressure: OutlookDirection;
  mid_term_value_pressure: OutlookDirection;
  long_term_value_pressure: OutlookDirection;
  pressure_direction: OutlookDirection;
  pressure_confidence: "high" | "medium" | "low" | "not_determinable";
  pressure_basis: string;
  false_specificity_risk: boolean;
}

export interface OutlookLimitations {
  weak_signal_base: boolean;
  comune_only_bias: boolean;
  fallback_dominant: boolean;
  insufficient_depth: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

export interface ZoneOutlookResult {
  outlook_identity: OutlookIdentity;
  horizon_2y: HorizonView;
  horizon_5y: HorizonView;
  horizon_10y: HorizonView;
  outlook_value_pressure: OutlookValuePressure;
  outlook_attention: OutlookAttention;
  outlook_limitations: OutlookLimitations;
}

/* ═══════════════════════════════════════════════════════════
   STAGE WEIGHT MAPS — which stages matter per horizon
   ═══════════════════════════════════════════════════════════ */

const STAGE_WEIGHT_2Y: Record<UrbanSignalStage, number> = {
  completed: 0.9, in_progress: 1.0, funded: 0.8, approved: 0.6,
  planned: 0.2, announced: 0.1, unclear: 0.05,
};

const STAGE_WEIGHT_5Y: Record<UrbanSignalStage, number> = {
  completed: 0.5, in_progress: 0.9, funded: 0.9, approved: 0.8,
  planned: 0.6, announced: 0.3, unclear: 0.1,
};

const STAGE_WEIGHT_10Y: Record<UrbanSignalStage, number> = {
  completed: 0.3, in_progress: 0.6, funded: 0.7, approved: 0.7,
  planned: 0.8, announced: 0.5, unclear: 0.2,
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function computeTransformationStrength(
  urban: UrbanTransformationResult | null,
  weights: Record<UrbanSignalStage, number>,
): { strength: "strong" | "medium" | "weak" | "none"; score: number } {
  if (!urban || urban.urban_transformation_signals.length === 0) return { strength: "none", score: 0 };
  const relevant = urban.urban_transformation_signals.filter(
    s => s.territorial_relevance === "high" || s.territorial_relevance === "medium",
  );
  if (relevant.length === 0) return { strength: "none", score: 0 };
  let total = 0;
  for (const s of relevant) {
    const w = weights[s.signal_stage] ?? 0.1;
    const relMul = s.territorial_relevance === "high" ? 1 : 0.6;
    const evMul = s.evidence_level === "strong" ? 1 : s.evidence_level === "medium" ? 0.7 : 0.4;
    total += w * relMul * evMul;
  }
  const norm = Math.min(total / 2, 1); // 2 strong high-relevance signals = max
  if (norm >= 0.6) return { strength: "strong", score: norm };
  if (norm >= 0.3) return { strength: "medium", score: norm };
  return { strength: "weak", score: norm };
}

function computeAttractorStrength(
  attr: AttractorPressureResult | null,
): "strong" | "medium" | "weak" | "none" {
  if (!attr) return "none";
  const s = attr.pressure_summary;
  if (s.overall_pressure_signal_status === "supportive" && s.strong_attractor_count >= 2) return "strong";
  if (s.overall_pressure_signal_status === "supportive" || s.strong_attractor_count >= 1) return "medium";
  if (s.total_signals > 0) return "weak";
  return "none";
}

function computeMarketStrength(
  growth: ZoneGrowthSignalsResult | null,
): "strong" | "medium" | "weak" | "none" {
  if (!growth) return "none";
  const ms = growth.growth_signals.find(s => s.signal_family === "market");
  if (!ms) return "none";
  if (ms.signal_direction === "positive" && ms.evidence_level === "strong") return "strong";
  if (ms.signal_direction === "positive") return "medium";
  if (ms.signal_direction === "mixed") return "weak";
  return "none";
}

function strengthValue(s: "strong" | "medium" | "weak" | "none"): number {
  return s === "strong" ? 1 : s === "medium" ? 0.6 : s === "weak" ? 0.3 : 0;
}

function buildHorizon(
  label: string,
  transStrength: { strength: "strong" | "medium" | "weak" | "none"; score: number },
  attrStr: "strong" | "medium" | "weak" | "none",
  mktStr: "strong" | "medium" | "weak" | "none",
  fallbackPenalty: number,
  comuneOnly: boolean,
  horizonPrudence: number, // 0-1, higher = more prudent
): HorizonView {
  const raw = (
    transStrength.score * 0.45 +
    strengthValue(attrStr) * 0.3 +
    strengthValue(mktStr) * 0.25
  );
  const penalized = Math.max(raw - fallbackPenalty, 0);
  const prudent = penalized * (1 - horizonPrudence * 0.3);

  const support: HorizonView["support_strength"] =
    prudent >= 0.55 ? "strong" : prudent >= 0.3 ? "medium" : prudent >= 0.1 ? "weak" : "insufficient";

  const status: OutlookStatus =
    support === "strong" ? "supportive" : support === "medium" ? "mixed" : support === "weak" ? "weak" : "insufficient";

  const direction: OutlookDirection =
    status === "supportive" ? "upward_pressure"
    : status === "mixed" ? "mixed_pressure"
    : status === "weak" ? "neutral_pressure"
    : "not_determinable";

  const evidence: OutlookEvidenceLevel =
    prudent >= 0.5 ? "strong" : prudent >= 0.2 ? "medium" : "weak";

  let narrative: OutlookNarrativeMode = "full";
  if (comuneOnly && status !== "supportive") narrative = "partial";
  if (status === "insufficient") narrative = "hidden";
  if (comuneOnly && prudent < 0.15) narrative = "hidden";

  const limitations: string[] = [];
  if (comuneOnly) limitations.push("Lettura basata su livello comunale — lo scenario non è micro-locale");
  if (fallbackPenalty > 0.15) limitations.push("Peso fallback significativo — scenario penalizzato");
  if (transStrength.strength === "none") limitations.push("Nessun segnale di trasformazione rilevato per questo orizzonte");
  if (attrStr === "none") limitations.push("Nessun attrattore rilevante disponibile");

  const summaryParts: string[] = [];
  if (transStrength.strength !== "none")
    summaryParts.push(`Trasformazioni: evidenza ${transStrength.strength}`);
  if (attrStr !== "none")
    summaryParts.push(`Attrattori: ${attrStr}`);
  if (mktStr !== "none")
    summaryParts.push(`Mercato: ${mktStr}`);
  if (summaryParts.length === 0) summaryParts.push("Base segnali insufficiente");

  return {
    horizon_label: label,
    outlook_status: status,
    outlook_direction: direction,
    support_strength: support,
    evidence_level: evidence,
    transformation_signal_strength: transStrength.strength,
    attractor_signal_strength: attrStr,
    market_support_strength: mktStr,
    fallback_penalty: fallbackPenalty,
    narrative_mode: narrative,
    summary: summaryParts.join(" · "),
    limitations,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN BUILDER
   ═══════════════════════════════════════════════════════════ */

export function buildZoneOutlook(
  corr: ZoneCorrespondenceResult,
  growth: ZoneGrowthSignalsResult | null,
  urban: UrbanTransformationResult | null,
  attractors: AttractorPressureResult | null,
): ZoneOutlookResult {
  // comuneOnly is true ONLY when the actual geo level is comune — not just because fallback_weight is high
  // A zona_omi with high fallback_weight is still a zone-level reading, not a comune reading
  const comuneOnly = corr.zone_identity.geo_level_reale === "comune"
    || corr.zone_identity.geo_level_reale === "non_determinato";
  const fbPenalty = corr.zone_correspondence.fallback_weight === "high" ? 0.25
    : corr.zone_correspondence.fallback_weight === "medium" ? 0.12
    : corr.zone_correspondence.fallback_weight === "low" ? 0.05
    : 0;

  const trans2 = computeTransformationStrength(urban, STAGE_WEIGHT_2Y);
  const trans5 = computeTransformationStrength(urban, STAGE_WEIGHT_5Y);
  const trans10 = computeTransformationStrength(urban, STAGE_WEIGHT_10Y);
  const attrStr = computeAttractorStrength(attractors);
  const mktStr = computeMarketStrength(growth);

  const h2 = buildHorizon("2 anni", trans2, attrStr, mktStr, fbPenalty, comuneOnly, 0);
  const h5 = buildHorizon("5 anni", trans5, attrStr, mktStr, fbPenalty, comuneOnly, 0.3);
  const h10 = buildHorizon("10 anni", trans10, attrStr, mktStr, fbPenalty, comuneOnly, 0.6);

  // Signal base strength
  const anyStrong = [trans2.strength, trans5.strength, attrStr, mktStr].some(s => s === "strong");
  const anyMedium = [trans2.strength, trans5.strength, attrStr, mktStr].some(s => s === "medium");
  const signalBase: OutlookIdentity["signal_base_strength"] =
    anyStrong ? "strong" : anyMedium ? "medium"
    : [trans2.strength, attrStr, mktStr].some(s => s === "weak") ? "weak"
    : "insufficient";

  // Value pressure — aggregate from horizons
  const dirMap = (h: HorizonView) => h.outlook_direction;
  const overallDir: OutlookDirection =
    h2.outlook_direction === "upward_pressure" || h5.outlook_direction === "upward_pressure"
      ? "upward_pressure"
      : h2.outlook_direction === "mixed_pressure" || h5.outlook_direction === "mixed_pressure"
        ? "mixed_pressure"
        : h2.outlook_direction === "neutral_pressure" || h5.outlook_direction === "neutral_pressure"
          ? "neutral_pressure"
          : "not_determinable";

  const pressureConf: OutlookValuePressure["pressure_confidence"] =
    signalBase === "strong" && !comuneOnly ? "high"
    : signalBase === "medium" ? "medium"
    : signalBase === "weak" ? "low"
    : "not_determinable";

  const pressureBasisParts: string[] = [];
  if (trans2.strength !== "none" || trans5.strength !== "none") pressureBasisParts.push("trasformazioni");
  if (attrStr !== "none") pressureBasisParts.push("attrattori");
  if (mktStr !== "none") pressureBasisParts.push("segnali mercato");

  // Attention signal
  const bestStatus = [h2.outlook_status, h5.outlook_status, h10.outlook_status];
  const hasSupportive = bestStatus.includes("supportive");
  const hasMixed = bestStatus.includes("mixed");
  const attention: OutlookAttention =
    hasSupportive && pressureConf !== "not_determinable" ? "high"
    : hasMixed || hasSupportive ? "medium"
    : bestStatus.includes("weak") ? "low"
    : "insufficient";

  // Limitations
  const lim: OutlookLimitations = {
    weak_signal_base: signalBase === "weak" || signalBase === "insufficient",
    comune_only_bias: comuneOnly,
    fallback_dominant: fbPenalty >= 0.2,
    insufficient_depth: signalBase === "insufficient",
    blocking_gaps: [],
    transparency_notes: [],
  };
  if (comuneOnly) lim.transparency_notes.push("Lo scenario prospettico è basato su una lettura solo comunale — non rappresenta una previsione micro-locale");
  if (fbPenalty >= 0.2) lim.transparency_notes.push("Il peso del fallback penalizza significativamente la forza dello scenario");
  if (signalBase === "insufficient") {
    lim.blocking_gaps.push("Base segnali insufficiente per costruire uno scenario affidabile");
    lim.transparency_notes.push("Lo scenario non è disponibile: segnali insufficienti per la zona");
  }
  lim.transparency_notes.push("I valori prospettici indicano pressione potenziale, non previsioni certe di prezzo");

  return {
    outlook_identity: {
      zone_geo_code: corr.zone_identity.geo_code,
      zone_geo_level: corr.zone_identity.geo_level_reale,
      zone_label: corr.zone_identity.geo_label,
      outlook_scope_label: `Vista prospettica ${corr.zone_identity.zone_type_label}`,
      signal_base_strength: signalBase,
    },
    horizon_2y: h2,
    horizon_5y: h5,
    horizon_10y: h10,
    outlook_value_pressure: {
      near_term_value_pressure: dirMap(h2),
      mid_term_value_pressure: dirMap(h5),
      long_term_value_pressure: dirMap(h10),
      pressure_direction: overallDir,
      pressure_confidence: pressureConf,
      pressure_basis: pressureBasisParts.length > 0 ? pressureBasisParts.join(", ") : "nessuna base sufficiente",
      false_specificity_risk: comuneOnly,
    },
    outlook_attention: attention,
    outlook_limitations: lim,
  };
}

/* ═══════════════════════════════════════════════════════════
   LABEL HELPERS
   ═══════════════════════════════════════════════════════════ */

export function outlookStatusLabel(s: OutlookStatus): string {
  switch (s) {
    case "supportive": return "Scenario supportato";
    case "mixed": return "Quadro misto";
    case "weak": return "Evidenza limitata";
    case "insufficient": return "Insufficiente";
  }
}

export function outlookDirectionLabel(d: OutlookDirection): string {
  switch (d) {
    case "upward_pressure": return "Pressione potenziale positiva";
    case "mixed_pressure": return "Pressione mista";
    case "neutral_pressure": return "Pressione neutra";
    case "not_determinable": return "Non determinabile";
  }
}

export function outlookAttentionLabel(a: OutlookAttention): string {
  switch (a) {
    case "high": return "Attenzione alta";
    case "medium": return "Attenzione media";
    case "low": return "Attenzione bassa";
    case "insufficient": return "Dati insufficienti";
  }
}

export function outlookNarrativeMode(r: ZoneOutlookResult): OutlookNarrativeMode {
  const modes = [r.horizon_2y.narrative_mode, r.horizon_5y.narrative_mode, r.horizon_10y.narrative_mode];
  if (modes.every(m => m === "hidden")) return "hidden";
  if (modes.some(m => m === "full")) return "full";
  return "partial";
}
