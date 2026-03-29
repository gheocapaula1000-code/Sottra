/**
 * Badge Utilities — Sottra Hardening
 *
 * Single source of truth for badge variants, labels, and CSS classes
 * across all engines, reports, and admin pages.
 *
 * Eliminates scattered inline badge helpers and ensures
 * consistent semantics throughout the system.
 */

import type { TerritorialDataQuality } from "@/lib/territorialDataBackbone";
import type { OverallQualityStatus } from "@/lib/territorialDataBackbone";
import type { FactSupportLevel } from "@/lib/buildingProfileEngine";

/* ═══════════════════════════════════════════════════════════
   BADGE VARIANT — unified across all reports
   ═══════════════════════════════════════════════════════════ */

export type BadgeVariant = "official" | "elaborated" | "partial" | "unavailable" | "info";

/* ═══════════════════════════════════════════════════════════
   VARIANT CSS — design-token-friendly, consistent everywhere
   ═══════════════════════════════════════════════════════════ */

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  official: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  elaborated: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  partial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unavailable: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/15 text-primary border-primary/30",
};

export function badgeVariantClasses(variant: BadgeVariant): string {
  return VARIANT_CLASSES[variant];
}

/* ═══════════════════════════════════════════════════════════
   QUALITY → VARIANT MAPPING — no silent promotions
   ═══════════════════════════════════════════════════════════ */

/**
 * Maps TerritorialDataQuality to BadgeVariant.
 *
 * IMPORTANT: territorial_verified and commercial_verified are NOT
 * promoted to "official" — they get "elaborated" to maintain
 * semantic honesty. Only "official" sources get the "official" badge.
 */
export function qualityToBadgeVariant(q: TerritorialDataQuality): BadgeVariant {
  switch (q) {
    case "official": return "official";
    case "territorial_verified": return "elaborated";
    case "commercial_verified": return "elaborated";
    case "commercial_partial": return "partial";
    case "elaborated": return "elaborated";
    case "unavailable": return "unavailable";
  }
}

/**
 * Maps OverallQualityStatus to BadgeVariant.
 */
export function statusToBadgeVariant(s: OverallQualityStatus): BadgeVariant {
  switch (s) {
    case "strong": return "official";
    case "adequate": return "elaborated";
    case "limited": return "partial";
    case "insufficient": return "unavailable";
  }
}

/**
 * Maps FactSupportLevel to BadgeVariant.
 */
export function supportToBadgeVariant(s: FactSupportLevel): BadgeVariant {
  switch (s) {
    case "direct": return "official";
    case "contextual": return "elaborated";
    case "derived": return "partial";
    case "unavailable": return "unavailable";
  }
}

/* ═══════════════════════════════════════════════════════════
   STRENGTH → VARIANT — for quality strength fields
   ═══════════════════════════════════════════════════════════ */

export function strengthToBadgeVariant(s: "strong" | "moderate" | "weak" | "none"): BadgeVariant {
  switch (s) {
    case "strong": return "official";
    case "moderate": return "elaborated";
    case "weak": return "partial";
    case "none": return "unavailable";
  }
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS QUALITY → VARIANT
   ═══════════════════════════════════════════════════════════ */

export function addressQualityToBadgeVariant(q: "strong" | "moderate" | "weak" | "none"): BadgeVariant {
  switch (q) {
    case "strong": return "official";
    case "moderate": return "elaborated";
    case "weak": return "partial";
    case "none": return "unavailable";
  }
}

/* ═══════════════════════════════════════════════════════════
   RISK LEVEL → VARIANT
   ═══════════════════════════════════════════════════════════ */

export function riskToBadgeVariant(r: "low" | "medium" | "high"): BadgeVariant {
  switch (r) {
    case "low": return "official";
    case "medium": return "partial";
    case "high": return "unavailable";
  }
}
