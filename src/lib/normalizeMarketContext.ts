/**
 * Normalizes the raw Central Core `/scan/market` response into the
 * canonical MarketContextData shape consumed by the UI.
 *
 * Handles both the legacy frontend format and the documented Core contract:
 * - comparablesSummary.comparablesCount → count
 * - comparablesSummary.lowerQuartilePricePerSqm → q1PricePerSqm
 * - comparablesSummary.upperQuartilePricePerSqm → q3PricePerSqm
 * - comparableCoverageLevel → marketCoverageLevel
 * - marketSignals as keyed object → array
 */

import type { MarketContextData, MarketSignal, ComparablesSummary } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Normalize comparablesSummary from Core aliases → canonical shape */
function normalizeComparables(raw: any): ComparablesSummary | null {
  if (!raw || typeof raw !== "object") return null;

  return {
    count: raw.count ?? raw.comparablesCount ?? null,
    medianPricePerSqm: raw.medianPricePerSqm ?? null,
    q1PricePerSqm: raw.q1PricePerSqm ?? raw.lowerQuartilePricePerSqm ?? null,
    q3PricePerSqm: raw.q3PricePerSqm ?? raw.upperQuartilePricePerSqm ?? null,
    minPricePerSqm: raw.minPricePerSqm ?? null,
    maxPricePerSqm: raw.maxPricePerSqm ?? null,
    marketDepth: raw.marketDepth ?? null,
    marketFreshness: raw.marketFreshness ?? null,
  };
}

/** Normalize marketSignals — accept array or keyed object */
function normalizeSignals(raw: any): MarketSignal[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((s: any) => s && typeof s === "object")
      .map((s: any) => ({
        key: s.key ?? s.id ?? "",
        label: s.label ?? s.key ?? "",
        value: s.value ?? null,
        detail: s.detail ?? s.description ?? null,
      }));
  }
  // Keyed object: { sellerPressure: { value: 0.7, detail: "..." }, ... }
  if (typeof raw === "object") {
    return Object.entries(raw).map(([key, val]: [string, any]) => {
      if (val && typeof val === "object") {
        return {
          key,
          label: val.label ?? key,
          value: val.value ?? null,
          detail: val.detail ?? val.description ?? null,
        };
      }
      // Simple scalar value
      return { key, label: key, value: val ?? null, detail: null };
    });
  }
  return [];
}

/**
 * Main normalizer — accepts the raw Core response and returns canonical MarketContextData.
 * Safe to call with data already in canonical form (idempotent).
 */
export function normalizeMarketContext(raw: any): MarketContextData | null {
  if (!raw || typeof raw !== "object") return null;

  const comparablesSummary = normalizeComparables(raw.comparablesSummary);
  const marketSignals = normalizeSignals(raw.marketSignals);

  // Derive marketCoverageLevel from Core alias if missing
  const marketCoverageLevel: MarketContextData["marketCoverageLevel"] =
    raw.marketCoverageLevel ?? raw.comparableCoverageLevel ?? null;

  const result: MarketContextData = {
    marketConfidence: raw.marketConfidence ?? null,
    marketCoverageLevel,
    comparablesSummary,
    marketSignals: marketSignals.length > 0 ? marketSignals : null,
    providerBreakdown: Array.isArray(raw.providerBreakdown) ? raw.providerBreakdown : null,
    narrativeObservation: raw.narrativeObservation ?? null,
    // Pass-through source metadata
    sourceLabel: raw.sourceLabel,
    sourceType: raw.sourceType,
    sourceProvider: raw.sourceProvider,
    sourcePeriod: raw.sourcePeriod,
    sourceFreshness: raw.sourceFreshness,
    sourceConfidence: raw.sourceConfidence,
    confidenceReason: raw.confidenceReason,
    limitations: raw.limitations,
    sourceCoverageLevel: raw.sourceCoverageLevel,
    availabilityReason: raw.availabilityReason,
    licensingNote: raw.licensingNote,
    attributionNote: raw.attributionNote,
  };

  return result;
}
