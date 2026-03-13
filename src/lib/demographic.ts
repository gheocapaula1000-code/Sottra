import type { TrendDemograficoData } from "@/types";

/** Metric fields that count as "real demographic data" */
const DEMOGRAPHIC_METRIC_KEYS: (keyof TrendDemograficoData)[] = [
  "etaMedia",
  "densitaAbitanti",
  "flussoResidenti12Mesi",
  "percentualeFamiglie",
  "percentualeGiovani",
  "percentualeStranieri",
];

/**
 * Single source of truth for demographic card visibility.
 *
 * Returns `true` when at least one real metric is present.
 * `geoLevel` / `geoLabel` alone are NOT sufficient.
 */
export function isRenderableTrendDemografico(
  data: TrendDemograficoData | null | undefined,
): boolean {
  if (!data || data.sourceType === "unavailable") return false;
  return DEMOGRAPHIC_METRIC_KEYS.some((k) => data[k] != null);
}

/**
 * Count of non-null demographic metrics — useful for sparse-data microcopy.
 */
export function getAvailableDemographicMetricCount(
  data: TrendDemograficoData | null | undefined,
): number {
  if (!data) return 0;
  return DEMOGRAPHIC_METRIC_KEYS.filter((k) => data[k] != null).length;
}
