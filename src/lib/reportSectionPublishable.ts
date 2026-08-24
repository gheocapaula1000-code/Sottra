/**
 * Per-scan gates for /result accordion tendine.
 *
 * Rule: if THIS scan has renderable data for a section, show the title.
 * If that section is empty on THIS scan, show nothing (no title, no chevron).
 * Visibility is never a fixed hide-list of section names — Padova can show
 * Quotazioni OMI and hide Condominio; another city can show demografici and hide POI.
 *
 * Gate BEFORE mounting ReportAccordionItem. Do not sniff the DOM after.
 * Loading may keep the title visible; an empty finished module must not.
 */

import { isRenderableTrendDemografico } from "@/lib/demographic";
import { hasRenderableOfficialOmi } from "@/lib/officialOmiFromCore";
import type { NeighborhoodIndex } from "@/lib/neighborhoodIndex";
import { isSectionRenderable } from "@/types/report";
import type {
  CondominioData,
  ConvergenzaTerritorialeData,
  EnergyData,
  InfrastrutureData,
  IstatDemographicData,
  ListingsData,
  MarketContextData,
  MoodScoreData,
  OffmarketData,
  OpportunityData,
  PoiEnrichmentData,
  PricingData,
  RischioZonaData,
  StoricoTransazioniData,
  SviluppoAreaData,
  TimeViewData,
  TrendDemograficoData,
  ZoneIntelligenceData,
} from "@/types";
import type {
  PrioritaCriticitaData,
  ScenarioTemporaleData,
  TrasparenzaFontiData,
} from "@/types/report";

export { hasRenderableOfficialOmi as isOmiPublishable };

/** True while a module is in-flight — title+skeleton may show, then hide if empty. */
export function isModuleLoading(status: string | undefined | null): boolean {
  return status === "loading";
}

/** Mount the tendina only while loading or when the section has real data. */
export function shouldRenderAccordion(loading: boolean, publishable: boolean): boolean {
  return loading || publishable;
}

/**
 * After a finished scan with zero publishable tendine, keep the address form
 * visible. Do not invent OMI / catasto / APE / scores to fill the report.
 */
export function shouldShowEmptyScanAddressPrompt(
  scanning: boolean,
  hasPublishableTendine: boolean,
): boolean {
  return !scanning && !hasPublishableTendine;
}

function sourceUnavailable(data: { sourceType?: string } | null | undefined): boolean {
  return !data || data.sourceType === "unavailable";
}

/** Ignore leftover em-dashes and "non disponibile" copy — those are not content. */
export function isMeaningfulCopy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return false;
  if (/^[—–−-]+$/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (lower === "n/d" || lower === "n.d." || lower === "nd") return false;
  if (/\bnon disponibil[ei]\b/.test(lower)) return false;
  return true;
}

export function isPricingPublishable(data: PricingData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.prezzoMq != null;
}

export function isMarketPublishable(data: MarketContextData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  const hasComparables = data!.comparablesSummary != null
    && data!.comparablesSummary.count != null
    && data!.comparablesSummary.count > 0;
  const hasSignals = (data!.marketSignals ?? []).length > 0;
  return hasComparables || hasSignals;
}

export function isPoiPublishable(data: PoiEnrichmentData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return (data!.totalPois ?? 0) > 0;
}

export function isIstatPublishable(data: IstatDemographicData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.popolazione != null;
}

export function isDemographicsPublishable(
  istat: IstatDemographicData | null | undefined,
  trend: TrendDemograficoData | null | undefined,
): boolean {
  return isIstatPublishable(istat) || isRenderableTrendDemografico(trend);
}

export function isRischioPublishable(data: RischioZonaData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.scoreRischio != null;
}

export function isConvergenzaPublishable(data: ConvergenzaTerritorialeData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.score != null;
}

export function isOpportunityPublishable(data: OpportunityData | null | undefined): boolean {
  if (sourceUnavailable(data) || !data) return false;
  const scoreValue = data.score ?? data.indice ?? null;
  return scoreValue != null;
}

export function isTimeViewPublishable(data: TimeViewData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return !!(data!.scenarioBand || data!.previsione5Anni != null);
}

export function isInfraPublishable(data: InfrastrutureData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.infrastructureScore != null || isMeaningfulCopy(data!.narrativeObservation);
}

export function isSviluppoPublishable(data: SviluppoAreaData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return data!.areaDevelopmentScore != null || isMeaningfulCopy(data!.narrativeObservation);
}

export function isNeighborhoodPublishable(
  index: Pick<NeighborhoodIndex, "isRenderable" | "score"> | null | undefined,
): boolean {
  if (!index) return false;
  return index.isRenderable === true && index.score != null;
}

export function isReportFieldsPublishable(data: Record<string, unknown> | null | undefined): boolean {
  return isSectionRenderable(data);
}

export function isScenarioTemporalePublishable(data: ScenarioTemporaleData | null | undefined): boolean {
  if (!data?.scenari || data.scenari.length === 0) return false;
  return data.scenari.some((s) =>
    s.variazioneStimataPct?.availabilityStatus === "available"
    || s.narrativa?.availabilityStatus === "available",
  );
}

export function isPrioritaPublishable(data: PrioritaCriticitaData | null | undefined): boolean {
  return !!data?.items && data.items.length > 0;
}

export function isFontiPublishable(data: TrasparenzaFontiData | null | undefined): boolean {
  return !!data?.fonti && data.fonti.length > 0;
}

export function isOffmarketPublishable(data: OffmarketData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  const segnali = data!.segnali ?? [];
  const opportunita = (data!.opportunita ?? []).filter(isMeaningfulCopy);
  const totale = data!.totale ?? 0;
  return totale > 0 || segnali.length > 0 || opportunita.length > 0;
}

export function isZoneIntelligencePublishable(data: ZoneIntelligenceData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  return (data!.risultati ?? []).length > 0;
}

export function isListingsPublishable(data: ListingsData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  const annunci = data!.annunci ?? [];
  const totale = data!.totale ?? annunci.length;
  return totale > 0;
}

export function isCondominioPublishable(data: CondominioData | null | undefined): boolean {
  if (sourceUnavailable(data) || !data) return false;
  return isMeaningfulCopy(data.amministratore)
    || data.numero_unita != null
    || data.anno_costruzione != null
    || isMeaningfulCopy(data.classe_energetica)
    || (data.segnali?.length ?? 0) > 0;
}

export function isStoricoPublishable(data: StoricoTransazioniData | null | undefined): boolean {
  if (sourceUnavailable(data)) return false;
  const transazioni = data!.transazioni ?? [];
  const totale = data!.totale ?? transazioni.length;
  return totale > 0;
}

export function isMoodPublishable(data: MoodScoreData | null | undefined): boolean {
  if (sourceUnavailable(data) || !data) return false;
  return typeof data.score === "number"
    || isMeaningfulCopy(data.observation)
    || (data.drivers?.length ?? 0) > 0;
}

export function isEnergyPublishable(data: EnergyData | null | undefined): boolean {
  if (sourceUnavailable(data) || !data) return false;
  return isMeaningfulCopy(data.classeEnergetica)
    || data.epglKwhM2Anno != null
    || data.annoCostruzione != null
    || isMeaningfulCopy(data.tipoRiscaldamento);
}

