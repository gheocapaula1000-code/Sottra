/**
 * Strong Case Evaluator — Sottra
 *
 * Aggregates existing engine outputs to classify the overall
 * case strength (strong / solid / mixed / weak).
 *
 * CRITICAL: This is a READ-ONLY evaluator. It does NOT change data.
 * "strong_case" ≠ building truth. It means the zone/value/outlook
 * reading is well-supported by converging signals.
 * Weak cases stay weak. No inflation.
 */

import type { WowSnapshot, AttentionSignal } from "@/lib/sottraWowSnapshot";
import type { SpecificityStrength } from "@/lib/houseDifferentiationEngine";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type OverallCaseStrength = "strong_case" | "solid_case" | "mixed_case" | "weak_case";

export interface StrongCaseFlags {
  strong_zone_read: boolean;
  strong_value_read: boolean;
  strong_outlook_read: boolean;
  strong_house_candidate: boolean;
  strong_alignment: boolean;
  fallback_under_control: boolean;
  confidence_stack_coherent: boolean;
}

export interface StrongCaseLimiters {
  missing_boundary: boolean;
  comune_only_bias: boolean;
  weak_house_alignment: boolean;
  fallback_dominant: boolean;
  insufficient_signal_depth: boolean;
  ambiguity_penalty: boolean;
}

export interface StrongCaseIdentity {
  zone_strength: "strong" | "medium" | "weak" | "insufficient";
  value_strength: "strong" | "medium" | "weak" | "insufficient";
  outlook_strength: "strong" | "medium" | "weak" | "insufficient";
  house_specificity_strength: SpecificityStrength;
  fallback_penalty: "none" | "low" | "medium" | "high";
  overall_case_strength: OverallCaseStrength;
}

export interface StrongCaseResult {
  identity: StrongCaseIdentity;
  flags: StrongCaseFlags;
  limiters: StrongCaseLimiters;
  strengths: string[];
  top_limiter: string | null;
}

/* ═══════════════════════════════════════════════════════════
   INPUT
   ═══════════════════════════════════════════════════════════ */

export interface StrongCaseInput {
  snapshot: WowSnapshot;
  /** From house differentiation engine */
  house_specificity_strength: SpecificityStrength;
  /** Alignment status from house diff */
  alignment_status?: string | null;
  /** Outlook status if available */
  outlook_status?: "supportive" | "mixed" | "weak" | "insufficient" | null;
  /** Whether a real boundary polygon exists */
  boundary_available?: boolean;
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function affidabilitaToStrength(aff: string): "strong" | "medium" | "weak" | "insufficient" {
  if (aff === "Alta") return "strong";
  if (aff === "Media") return "medium";
  if (aff === "Bassa") return "weak";
  return "insufficient";
}

function attentionToZoneStrength(att: AttentionSignal): "strong" | "medium" | "weak" | "insufficient" {
  if (att === "high") return "strong";
  if (att === "medium") return "medium";
  if (att === "low") return "weak";
  return "insufficient";
}

function outlookToStrength(s: string | null | undefined): "strong" | "medium" | "weak" | "insufficient" {
  if (s === "supportive") return "strong";
  if (s === "mixed") return "medium";
  if (s === "weak") return "weak";
  return "insufficient";
}

function fallbackFromAffidabilita(aff: string): "none" | "low" | "medium" | "high" {
  if (aff === "Alta") return "none";
  if (aff === "Media") return "low";
  if (aff === "Bassa") return "medium";
  return "high";
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function evaluateStrongCase(input: StrongCaseInput): StrongCaseResult {
  const { snapshot, house_specificity_strength, alignment_status, outlook_status, boundary_available } = input;

  const zone_strength = attentionToZoneStrength(snapshot.attenzione_area);
  const value_strength = affidabilitaToStrength(snapshot.affidabilita_valore);
  const outlook_str = outlookToStrength(outlook_status);
  const fallback_penalty = fallbackFromAffidabilita(snapshot.affidabilita_valore);

  // ── Flags ──
  const flags: StrongCaseFlags = {
    strong_zone_read: zone_strength === "strong",
    strong_value_read: value_strength === "strong",
    strong_outlook_read: outlook_str === "strong",
    strong_house_candidate: house_specificity_strength === "strong",
    strong_alignment: alignment_status === "high_alignment",
    fallback_under_control: fallback_penalty === "none" || fallback_penalty === "low",
    confidence_stack_coherent: zone_strength !== "insufficient" && value_strength !== "insufficient",
  };

  // ── Limiters ──
  const limiters: StrongCaseLimiters = {
    missing_boundary: !boundary_available,
    comune_only_bias: snapshot.affidabilita_valore === "Bassa" || snapshot.limite_principale.includes("comunale"),
    weak_house_alignment: alignment_status === "low_alignment" || alignment_status === "conflicting_alignment" || alignment_status === "insufficient_alignment",
    fallback_dominant: fallback_penalty === "high",
    insufficient_signal_depth: zone_strength === "insufficient" || value_strength === "insufficient",
    ambiguity_penalty: house_specificity_strength === "weak" || house_specificity_strength === "insufficient",
  };

  // ── Convergence score (0-7) ──
  let score = 0;
  if (flags.strong_zone_read) score += 1;
  if (flags.strong_value_read) score += 1.5;
  if (flags.strong_outlook_read) score += 1;
  if (flags.strong_house_candidate) score += 1;
  if (flags.strong_alignment) score += 0.5;
  if (flags.fallback_under_control) score += 1;
  if (flags.confidence_stack_coherent) score += 1;

  // Limiter penalties
  if (limiters.fallback_dominant) score -= 2;
  if (limiters.comune_only_bias) score -= 1;
  if (limiters.insufficient_signal_depth) score -= 1.5;
  if (limiters.ambiguity_penalty) score -= 0.5;

  // ── Overall strength — requires real convergence ──
  let overall: OverallCaseStrength;
  const strongFlagCount = Object.values(flags).filter(Boolean).length;

  if (score >= 5 && strongFlagCount >= 4 && !limiters.fallback_dominant && !limiters.insufficient_signal_depth) {
    overall = "strong_case";
  } else if (score >= 3.5 && strongFlagCount >= 3 && !limiters.fallback_dominant) {
    overall = "solid_case";
  } else if (score >= 2 && !limiters.insufficient_signal_depth) {
    overall = "mixed_case";
  } else {
    overall = "weak_case";
  }

  // ── Strengths (human-readable, for UI) ──
  const strengths: string[] = [];
  if (flags.strong_zone_read) strengths.push("Zona letta con buona profondità");
  if (flags.strong_value_read) strengths.push("Valore con buona affidabilità");
  if (flags.strong_outlook_read) strengths.push("Outlook supportato da segnali coerenti");
  if (flags.strong_house_candidate) strengths.push("Immobile distinguibile dal contesto vicino");
  if (flags.fallback_under_control) strengths.push("Fallback sotto controllo");

  // ── Top limiter ──
  let top_limiter: string | null = null;
  if (limiters.fallback_dominant) top_limiter = "Fallback elevato — precisione ridotta";
  else if (limiters.comune_only_bias) top_limiter = "Lettura ancora prevalentemente comunale";
  else if (limiters.insufficient_signal_depth) top_limiter = "Profondità segnali insufficiente";
  else if (limiters.weak_house_alignment) top_limiter = "Allineamento foto/indirizzo debole";
  else if (limiters.ambiguity_penalty) top_limiter = "Specificità immobile ancora ambigua";
  else if (limiters.missing_boundary) top_limiter = "Perimetro zona non disponibile";

  return {
    identity: {
      zone_strength,
      value_strength,
      outlook_strength: outlook_str,
      house_specificity_strength,
      fallback_penalty,
      overall_case_strength: overall,
    },
    flags,
    limiters,
    strengths,
    top_limiter,
  };
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function caseStrengthLabel(s: OverallCaseStrength): string {
  const m: Record<OverallCaseStrength, string> = {
    strong_case: "Lettura solida",
    solid_case: "Lettura discreta",
    mixed_case: "Quadro misto",
    weak_case: "Elementi limitati",
  };
  return m[s];
}

export function caseStrengthColor(s: OverallCaseStrength): string {
  const m: Record<OverallCaseStrength, string> = {
    strong_case: "text-emerald-400",
    solid_case: "text-primary",
    mixed_case: "text-amber-400",
    weak_case: "text-muted-foreground",
  };
  return m[s];
}
