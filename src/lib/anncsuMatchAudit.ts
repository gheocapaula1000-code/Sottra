/**
 * ANNCSU Match Quality Audit Engine — Sottra P1
 *
 * Evaluates address resolution results that used ANNCSU support,
 * producing aggregate metrics, case classification, and promotion
 * readiness scores — WITHOUT changing any operational behavior.
 *
 * This module is AUDIT-ONLY. It does not alter building_truth_support,
 * civic_supported_as_building_truth, or any user-facing badge.
 */

import type {
  AddressResolutionResult,
  AnncsuMatchStatus,
} from "@/lib/addressResolutionEngine";

/* ═══════════════════════════════════════════════════════════
   CASE CLASSIFICATION
   ═══════════════════════════════════════════════════════════ */

export type AuditCaseClass =
  | "strong_official_street"
  | "strong_official_street_and_civic"
  | "official_but_ambiguous"
  | "official_partial_only"
  | "textual_match_only"
  | "unresolved"
  | "risky_false_specificity";

export function classifyCase(r: AddressResolutionResult): AuditCaseClass {
  const ar = r.address_resolution;
  const cr = r.civic_resolution;

  if (ar.resolution_status === "unresolved") return "unresolved";

  if (!ar.official_street_support) {
    if (ar.matched_street_status === "not_found") return "unresolved";
    return "textual_match_only";
  }

  // Official street support exists — check quality within official matches
  if (ar.anncsu_civic_exactness === "ambiguous") {
    return "official_but_ambiguous";
  }

  if (ar.official_civic_support && !cr.civic_supported_as_building_truth) {
    return "strong_official_street_and_civic";
  }

  if (ar.anncsu_street_exactness === "exact" || ar.anncsu_street_exactness === "normalized") {
    return "strong_official_street";
  }

  return "official_partial_only";
}

/* ═══════════════════════════════════════════════════════════
   PROMOTION READINESS
   ═══════════════════════════════════════════════════════════ */

export type PromotionReadiness =
  | "never_eligible"
  | "not_ready"
  | "potentially_eligible_future"
  | "needs_more_signals"
  | "blocked_by_ambiguity"
  | "blocked_by_missing_building_evidence";

export interface PromotionReadinessResult {
  readiness: PromotionReadiness;
  blocking_reasons: string[];
  missing_signals: string[];
}

/**
 * Evaluate whether a single resolution result would theoretically
 * qualify for promotion in a future policy — WITHOUT activating anything.
 */
export function evaluatePromotionReadiness(r: AddressResolutionResult): PromotionReadinessResult {
  const ar = r.address_resolution;
  const cr = r.civic_resolution;
  const blocking: string[] = [];
  const missing: string[] = [];

  // Always false today
  if (ar.building_truth_support !== false) {
    blocking.push("building_truth_support should be false");
  }

  if (ar.resolution_status === "unresolved") {
    return { readiness: "never_eligible", blocking_reasons: ["unresolved"], missing_signals: [] };
  }

  if (!ar.official_street_support) {
    blocking.push("no_official_street_support");
  }

  if (!ar.official_civic_support) {
    missing.push("official_civic_support");
  }

  if (ar.anncsu_civic_exactness === "ambiguous") {
    blocking.push("civic_ambiguous_in_anncsu");
  }

  if (cr.civic_ambiguity === "high" || cr.civic_ambiguity === "critical") {
    blocking.push("civic_ambiguity_too_high");
  }

  if (!cr.civic_input_present) {
    missing.push("civic_input_absent");
  }

  if (!ar.precise_location_support) {
    missing.push("precise_location_support");
  }

  // Building evidence always missing — ANNCSU is not building truth
  missing.push("building_registry_evidence");
  missing.push("cadastral_link");

  if (blocking.length > 0) {
    if (blocking.includes("civic_ambiguous_in_anncsu")) {
      return { readiness: "blocked_by_ambiguity", blocking_reasons: blocking, missing_signals: missing };
    }
    if (!ar.official_street_support) {
      return { readiness: "not_ready", blocking_reasons: blocking, missing_signals: missing };
    }
  }

  if (missing.length <= 3 && ar.official_street_support && ar.official_civic_support && ar.precise_location_support) {
    return { readiness: "blocked_by_missing_building_evidence", blocking_reasons: ["ANNCSU alone is not building truth"], missing_signals: missing };
  }

  if (ar.official_street_support && missing.length > 3) {
    return { readiness: "needs_more_signals", blocking_reasons: blocking, missing_signals: missing };
  }

  return { readiness: "potentially_eligible_future", blocking_reasons: blocking, missing_signals: missing };
}

/* ═══════════════════════════════════════════════════════════
   AGGREGATE METRICS
   ═══════════════════════════════════════════════════════════ */

export interface AuditMetrics {
  total_evaluated: number;
  exact_official_street_match_count: number;
  normalized_official_street_match_count: number;
  official_street_only_count: number;
  official_civic_support_count: number;
  official_civic_ambiguous_count: number;
  precise_location_support_count: number;
  no_official_match_count: number;
  ambiguous_match_count: number;
  low_confidence_count: number;
  building_truth_promoted_count: number; // should always be 0

  // Case classification distribution
  case_distribution: Record<AuditCaseClass, number>;

  // Promotion readiness distribution
  promotion_distribution: Record<PromotionReadiness, number>;

  // Per-quality
  quality_distribution: Record<string, number>;

  // Official support totals
  official_street_support_count: number;

  // Overprecision risk
  high_overprecision_risk_count: number;
  high_false_specificity_count: number;
}

function emptyMetrics(): AuditMetrics {
  return {
    total_evaluated: 0,
    exact_official_street_match_count: 0,
    normalized_official_street_match_count: 0,
    official_street_only_count: 0,
    official_civic_support_count: 0,
    official_civic_ambiguous_count: 0,
    precise_location_support_count: 0,
    no_official_match_count: 0,
    ambiguous_match_count: 0,
    low_confidence_count: 0,
    building_truth_promoted_count: 0,
    case_distribution: {
      strong_official_street: 0,
      strong_official_street_and_civic: 0,
      official_but_ambiguous: 0,
      official_partial_only: 0,
      textual_match_only: 0,
      unresolved: 0,
      risky_false_specificity: 0,
    },
    promotion_distribution: {
      never_eligible: 0,
      not_ready: 0,
      potentially_eligible_future: 0,
      needs_more_signals: 0,
      blocked_by_ambiguity: 0,
      blocked_by_missing_building_evidence: 0,
    },
    quality_distribution: {},
    official_street_support_count: 0,
    high_overprecision_risk_count: 0,
    high_false_specificity_count: 0,
  };
}

/**
 * Aggregate audit metrics from a batch of resolution results.
 */
export function computeAuditMetrics(results: AddressResolutionResult[]): AuditMetrics {
  const m = emptyMetrics();
  m.total_evaluated = results.length;

  for (const r of results) {
    const ar = r.address_resolution;
    const q = r.address_quality;

    // ANNCSU match status counts
    if (ar.anncsu_match_status === "exact_official_street_match") m.exact_official_street_match_count++;
    if (ar.anncsu_match_status === "normalized_official_street_match") m.normalized_official_street_match_count++;
    if (ar.anncsu_match_status === "official_street_only") m.official_street_only_count++;
    if (ar.anncsu_match_status === "no_official_match") m.no_official_match_count++;

    if (ar.official_civic_support) m.official_civic_support_count++;
    if (ar.anncsu_civic_exactness === "ambiguous") m.official_civic_ambiguous_count++;
    if (ar.precise_location_support) m.precise_location_support_count++;
    if (ar.official_street_support) m.official_street_support_count++;
    if (ar.ambiguity_level === "high" || ar.ambiguity_level === "critical") m.ambiguous_match_count++;
    if (ar.matched_street_confidence < 0.4) m.low_confidence_count++;
    if (ar.building_truth_support as boolean) m.building_truth_promoted_count++; // safety check

    // Quality
    const ql = q.overall_address_quality;
    m.quality_distribution[ql] = (m.quality_distribution[ql] || 0) + 1;

    if (q.overprecision_risk === "high") m.high_overprecision_risk_count++;
    if (q.false_specificity_risk === "high") m.high_false_specificity_count++;

    // Case classification
    const cc = classifyCase(r);
    m.case_distribution[cc]++;

    // Promotion readiness
    const pr = evaluatePromotionReadiness(r);
    m.promotion_distribution[pr.readiness]++;
  }

  return m;
}

/* ═══════════════════════════════════════════════════════════
   SYSTEM READINESS ASSESSMENT
   ═══════════════════════════════════════════════════════════ */

export type SystemReadinessLevel =
  | "not_ready"
  | "partially_ready_rare_cases"
  | "ready_but_blocked_by_policy"
  | "ready_for_evaluation";

export interface SystemReadinessAssessment {
  level: SystemReadinessLevel;
  summary: string;
  strong_case_ratio: number;
  ambiguity_ratio: number;
  overprecision_ratio: number;
  building_truth_ever_promoted: boolean;
  recommendation: string;
}

export function assessSystemReadiness(metrics: AuditMetrics): SystemReadinessAssessment {
  const total = metrics.total_evaluated || 1;
  const strongStreet = metrics.exact_official_street_match_count + metrics.normalized_official_street_match_count;
  const strongRatio = strongStreet / total;
  const ambiguityRatio = metrics.ambiguous_match_count / total;
  const overprecisionRatio = metrics.high_overprecision_risk_count / total;
  const promoted = metrics.building_truth_promoted_count > 0;

  let level: SystemReadinessLevel = "not_ready";
  let summary: string;
  let recommendation: string;

  if (promoted) {
    level = "not_ready";
    summary = "CRITICAL: building_truth_support è stato promosso — anomalia da investigare.";
    recommendation = "Bloccare e investigare promozione indebita di building truth.";
  } else if (strongRatio < 0.1) {
    level = "not_ready";
    summary = `Solo ${(strongRatio * 100).toFixed(1)}% dei casi ha match ufficiale forte. Insufficiente per policy più forte.`;
    recommendation = "Ampliare copertura ANNCSU prima di ipotizzare promozioni.";
  } else if (ambiguityRatio > 0.3) {
    level = "not_ready";
    summary = `Ambiguità troppo alta (${(ambiguityRatio * 100).toFixed(1)}%). Rischio falsa precisione.`;
    recommendation = "Ridurre ambiguità nei dati ANNCSU prima di procedere.";
  } else if (strongRatio >= 0.5 && ambiguityRatio < 0.1 && overprecisionRatio < 0.05) {
    level = "ready_but_blocked_by_policy";
    summary = `Match ufficiali forti al ${(strongRatio * 100).toFixed(1)}%, ambiguità bassa. Tecnicamente pronto, bloccato da policy.`;
    recommendation = "I dati sono tecnicamente adeguati ma ANNCSU da solo non è building truth. Serve catasto/registro edilizio.";
  } else if (strongRatio >= 0.3) {
    level = "partially_ready_rare_cases";
    summary = `Match forti al ${(strongRatio * 100).toFixed(1)}%. Casi isolati potrebbero qualificarsi, ma non su scala.`;
    recommendation = "Monitorare trend di copertura. Non attivare promozioni generalizzate.";
  } else {
    level = "not_ready";
    summary = `Copertura insufficiente (${(strongRatio * 100).toFixed(1)}% forti). Continuare ingest ANNCSU.`;
    recommendation = "Proseguire l'ingest e migliorare la qualità del matching prima di rivalutare.";
  }

  return {
    level,
    summary,
    strong_case_ratio: strongRatio,
    ambiguity_ratio: ambiguityRatio,
    overprecision_ratio: overprecisionRatio,
    building_truth_ever_promoted: promoted,
    recommendation,
  };
}
