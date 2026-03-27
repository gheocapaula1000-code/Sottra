/**
 * Source Resolution Layer — Sottra
 *
 * Manages data source hierarchy, geo-level compatibility, and
 * controlled fallback from official to non-official sources.
 *
 * RULES:
 * 1. Official always wins when available
 * 2. Non-official sources are NEVER promoted to official
 * 3. Geo-level must be compatible — no overclaim
 * 4. Unavailable is preferred over fake precision
 *
 * This module is ARCHITECTURAL PREPARATION. Secondary sources
 * are predisposed but not aggressively activated.
 */

import type { SourceType, CoverageLevel, SourceMetadata } from "@/types";
import type { ReportGeoLevel } from "@/types/report";

/* ── Source Reliability Tier ─────────────────────────────── */

/**
 * Unified source reliability tier, ordered from most to least trustworthy.
 * Maps cleanly to both backend SourceType and UI DataTier.
 */
export type SourceReliabilityTier =
  | "ufficiale"
  | "mercato_verificato"
  | "mercato_parziale"
  | "dato_elaborato"
  | "unavailable";

/** Priority rank — lower is better (more reliable) */
const TIER_PRIORITY: Record<SourceReliabilityTier, number> = {
  ufficiale: 0,
  mercato_verificato: 1,
  mercato_parziale: 2,
  dato_elaborato: 3,
  unavailable: 99,
};

/* ── Candidate Source ────────────────────────────────────── */

/** A data source candidate for resolution */
export interface SourceCandidate<T = unknown> {
  /** The data payload */
  data: T | null;
  /** Reliability tier */
  tier: SourceReliabilityTier;
  /** Geographic resolution level */
  geoLevel: ReportGeoLevel;
  /** Human-readable geo label */
  geoLabel?: string;
  /** Provider identifier */
  provider?: string;
  /** Confidence score 0-1 */
  confidence?: number;
  /** ISO date string of last update */
  lastUpdated?: string;
  /** Whether this is an official/institutional source */
  isOfficial: boolean;
  /** Original backend source metadata */
  sourceMeta?: SourceMetadata;
}

/** Result of source resolution */
export interface ResolvedSource<T = unknown> {
  /** The winning data */
  data: T | null;
  /** The winning tier */
  tier: SourceReliabilityTier;
  /** The actual geo level of the resolved data */
  geoLevel: ReportGeoLevel;
  geoLabel?: string;
  /** Whether the resolved source is official */
  isOfficial: boolean;
  /** Human-readable label for UI */
  sourceLabel: string;
  /** Diagnostic trace of resolution */
  resolutionTrace: ResolutionTraceEntry[];
}

/** Diagnostic entry for observability */
export interface ResolutionTraceEntry {
  provider: string;
  tier: SourceReliabilityTier;
  geoLevel: ReportGeoLevel;
  accepted: boolean;
  reason: string;
}

/* ── Mapping Helpers ─────────────────────────────────────── */

/**
 * Maps backend SourceType to unified reliability tier.
 */
export function mapSourceTypeToTier(sourceType?: SourceType | string): SourceReliabilityTier {
  switch (sourceType) {
    case "official":
      return "ufficiale";
    case "commercial_verified":
    case "verified_geo":
    case "premium":
      return "mercato_verificato";
    case "commercial_partial":
      return "mercato_parziale";
    case "elaborated":
    case "derived":
    case "estimate":
      return "dato_elaborato";
    case "unavailable":
      return "unavailable";
    default:
      return "dato_elaborato";
  }
}

/**
 * Maps unified tier back to UI-facing label.
 */
export function mapTierToLabel(tier: SourceReliabilityTier): string {
  switch (tier) {
    case "ufficiale":
      return "Dato ufficiale";
    case "mercato_verificato":
      return "Fonte di mercato verificata";
    case "mercato_parziale":
      return "Copertura di mercato parziale";
    case "dato_elaborato":
      return "Dato elaborato";
    case "unavailable":
      return "Non disponibile";
  }
}

/**
 * Maps CoverageLevel from backend to ReportGeoLevel.
 */
export function mapCoverageLevelToGeoLevel(coverage?: CoverageLevel): ReportGeoLevel {
  switch (coverage) {
    case "address":
    case "zone_omi":
      return "microzona_omi";
    case "quartiere":
      return "quartiere";
    case "comune":
      return "comune";
    case "provincia":
    case "area_vasta":
      return "comune"; // downgrade to comunale for safety
    case "unknown":
    default:
      return "non_determinato";
  }
}

/** Label for macrozone-level geo contexts */
export function geoLevelDisplayLabel(level: ReportGeoLevel): string {
  switch (level) {
    case "microzona_omi": return "Microzona OMI";
    case "zona_specifica": return "Zona specifica";
    case "quartiere": return "Quartiere";
    case "comune": return "Comune";
    case "macrozona": return "Macrozona";
    case "nazionale": return "Nazionale";
    case "non_determinato": return "Non determinato";
  }
}

/* ── Geo-Level Compatibility ─────────────────────────────── */

/** Ordered geo levels from finest to coarsest */
const GEO_RANK: Record<ReportGeoLevel, number> = {
  microzona_omi: 0,
  zona_specifica: 1,
  quartiere: 2,
  comune: 3,
  macrozona: 4,
  nazionale: 5,
  non_determinato: 6,
};

/**
 * Checks if a candidate's geo-level is compatible with the
 * required minimum precision. A candidate claiming microzona
 * is always compatible; one claiming only "comune" is NOT
 * compatible if we need zona_specifica.
 *
 * However: we never reject official data based on geo-level
 * (it gets a warning instead).
 */
export function isGeoLevelCompatible(
  candidateGeo: ReportGeoLevel,
  requiredMinGeo: ReportGeoLevel,
): boolean {
  return GEO_RANK[candidateGeo] <= GEO_RANK[requiredMinGeo];
}

/**
 * Returns true if the candidate can be used as a secondary/fallback
 * source. Secondary sources must NOT overclaim geo precision.
 */
export function canUseSecondarySource(
  candidate: SourceCandidate,
  officialGeoLevel: ReportGeoLevel,
): boolean {
  // No data → can't use
  if (candidate.data == null) return false;

  // Official sources are always primary, never "secondary"
  if (candidate.isOfficial) return false;

  // Secondary source must not claim finer precision than official
  if (GEO_RANK[candidate.geoLevel] < GEO_RANK[officialGeoLevel]) {
    return false; // Would be overclaim
  }

  // Secondary source at same or coarser level is OK
  return true;
}

/* ── Source Resolution ───────────────────────────────────── */

/**
 * Resolves the best data source from a list of candidates.
 *
 * Priority:
 * 1. Official source always wins if data is present
 * 2. Among non-official: tier priority (mercato_verificato > parziale > elaborato)
 * 3. Among same tier: finer geo-level wins
 * 4. Among same tier+geo: higher confidence wins
 *
 * CRITICAL: An official source is NEVER replaced by a non-official one.
 */
export function resolveBestSource<T>(
  candidates: SourceCandidate<T>[],
  requiredMinGeo?: ReportGeoLevel,
): ResolvedSource<T> {
  const trace: ResolutionTraceEntry[] = [];
  const validCandidates: SourceCandidate<T>[] = [];

  for (const c of candidates) {
    const provider = c.provider ?? "unknown";

    // Skip null data
    if (c.data == null) {
      trace.push({ provider, tier: c.tier, geoLevel: c.geoLevel, accepted: false, reason: "no_data" });
      continue;
    }

    // Geo compatibility check (official sources bypass this)
    if (requiredMinGeo && !c.isOfficial && !isGeoLevelCompatible(c.geoLevel, requiredMinGeo)) {
      trace.push({ provider, tier: c.tier, geoLevel: c.geoLevel, accepted: false, reason: "geo_incompatible" });
      continue;
    }

    trace.push({ provider, tier: c.tier, geoLevel: c.geoLevel, accepted: true, reason: "candidate" });
    validCandidates.push(c);
  }

  // Sort: official first, then by tier priority, then by geo precision, then confidence
  validCandidates.sort((a, b) => {
    // Official always first
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;

    // Tier priority
    const tierDiff = TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier];
    if (tierDiff !== 0) return tierDiff;

    // Finer geo wins
    const geoDiff = GEO_RANK[a.geoLevel] - GEO_RANK[b.geoLevel];
    if (geoDiff !== 0) return geoDiff;

    // Higher confidence wins
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const winner = validCandidates[0] ?? null;

  // Update trace to mark winner
  if (winner) {
    const winnerProvider = winner.provider ?? "unknown";
    const existing = trace.find(t => t.provider === winnerProvider && t.accepted);
    if (existing) existing.reason = "selected";
  }

  if (!winner) {
    return {
      data: null,
      tier: "unavailable",
      geoLevel: "non_determinato",
      isOfficial: false,
      sourceLabel: "Non disponibile",
      resolutionTrace: trace,
    };
  }

  return {
    data: winner.data,
    tier: winner.tier,
    geoLevel: winner.geoLevel,
    geoLabel: winner.geoLabel,
    isOfficial: winner.isOfficial,
    sourceLabel: mapTierToLabel(winner.tier),
    resolutionTrace: trace,
  };
}

/* ── Normalization ───────────────────────────────────────── */

/**
 * Normalizes a backend SourceMetadata into a SourceCandidate.
 * Useful for converting existing module data into the resolution pipeline.
 */
export function normalizeToCandidate<T>(
  data: T | null,
  meta?: SourceMetadata,
  provider?: string,
): SourceCandidate<T> {
  const tier = mapSourceTypeToTier(meta?.sourceType);
  const geoLevel = mapCoverageLevelToGeoLevel(meta?.sourceCoverageLevel);

  return {
    data,
    tier,
    geoLevel,
    provider: provider ?? meta?.sourceProvider ?? "unknown",
    confidence: meta?.sourceConfidence,
    isOfficial: tier === "ufficiale",
    sourceMeta: meta,
  };
}

/* ── Feature Flags ───────────────────────────────────────── */

/**
 * Runtime feature flags for secondary source activation.
 * All secondary sources are OFF by default.
 * Can be toggled via env vars or admin config.
 */
export interface SecondarySourceFlags {
  /** Allow market_verified sources as fallback */
  enableMarketVerified: boolean;
  /** Allow market_partial sources as fallback */
  enableMarketPartial: boolean;
  /** Allow elaborated/derived sources as fallback */
  enableElaborated: boolean;
}

/** Default flags — all secondary sources subordinate/controlled */
export const DEFAULT_SOURCE_FLAGS: SecondarySourceFlags = {
  enableMarketVerified: true,   // ready, subordinate to official
  enableMarketPartial: true,    // ready, shown with prudence
  enableElaborated: true,       // ready, clearly labeled
};

/**
 * Filters candidates based on feature flags.
 * Official sources always pass through.
 */
export function filterByFlags<T>(
  candidates: SourceCandidate<T>[],
  flags: SecondarySourceFlags = DEFAULT_SOURCE_FLAGS,
): SourceCandidate<T>[] {
  return candidates.filter(c => {
    if (c.isOfficial) return true;
    if (c.tier === "mercato_verificato" && !flags.enableMarketVerified) return false;
    if (c.tier === "mercato_parziale" && !flags.enableMarketPartial) return false;
    if (c.tier === "dato_elaborato" && !flags.enableElaborated) return false;
    return true;
  });
}

/* ── Diagnostic Helpers ──────────────────────────────────── */

/**
 * Formats a resolution trace for diagnostic/admin view.
 * Not exposed to end users.
 */
export function formatResolutionTrace(trace: ResolutionTraceEntry[]): string {
  return trace
    .map(t => `[${t.provider}] ${t.tier} / ${t.geoLevel} → ${t.accepted ? t.reason : `SKIP: ${t.reason}`}`)
    .join("\n");
}

/**
 * Summary for diagnostic logging — which source was picked and why.
 */
export function resolutionSummary(resolved: ResolvedSource): string {
  if (resolved.tier === "unavailable") return "Nessuna fonte disponibile";
  const geoNote = resolved.geoLevel === "comune"
    ? " (livello comunale)"
    : resolved.geoLevel === "macrozona"
      ? " (livello macrozona)"
      : resolved.geoLevel === "nazionale"
        ? " (livello nazionale)"
        : resolved.geoLevel === "non_determinato"
          ? " (geo non determinato)"
          : "";
  return `${resolved.sourceLabel}${geoNote} — ${resolved.isOfficial ? "ufficiale" : "non ufficiale"}`;
}
