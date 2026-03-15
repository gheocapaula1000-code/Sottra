/**
 * Phase 2 Report Mapper — transforms real scan data into ReportField structures.
 * 
 * Rules:
 * - No mock data, no invented values
 * - Each field must have correct sourceType and availabilityStatus
 * - If data is absent, field is omitted (not set to unavailable filler)
 * - OMI module is frozen — we only READ from omiZone results
 */

import type { ScanResult } from "@/types";
import type {
  ReportField, ProfiloRapidoData, ImmobileFacciataData,
  ContestoVicinatoData, PosizionamentoCommercialeData,
  ProfiloAreaData, ScenarioTemporaleData, ScenarioTemporaleEntry,
  SintesiFinaleData, ReportSourceType, AvailabilityStatus,
} from "@/types/report";
import type {
  IdentifyResult, PricingData, MarketContextData,
  OmiZoneData, PoiEnrichmentData, IstatDemographicData,
  TimeViewData, OpportunityData, ConvergenzaTerritorialeData,
  RischioZonaData, TrendDemograficoData, InfrastrutureData,
} from "@/types";

/* ── Helpers ─────────────────────────────────────────────── */

function field<T>(
  value: T,
  label: string,
  sourceType: ReportSourceType,
  availabilityStatus: AvailabilityStatus = "available",
  note?: string,
): ReportField<T> {
  return { value, label, sourceType, availabilityStatus, note };
}

function ok<T>(section: T | undefined): T | null {
  return section ?? null;
}

function sectionData<T>(result: ScanResult, key: keyof ScanResult): T | null {
  const s = result[key];
  if (s.status !== "success" || !s.data) return null;
  return s.data as T;
}

/* ── A) Profilo Rapido ───────────────────────────────────── */

export function buildProfiloRapido(result: ScanResult, lat: number | null, lng: number | null): ProfiloRapidoData | null {
  const identify = sectionData<IdentifyResult>(result, "identify");
  const omi = sectionData<OmiZoneData>(result, "omiZone");

  if (!identify) return null;

  const data: ProfiloRapidoData = {};

  if (identify.address) {
    data.indirizzo = field(identify.address, "Indirizzo", "territorial_verified");
  }

  if (lat != null && lng != null) {
    data.coordinate = field(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, "Coordinate GPS", "territorial_verified");
  }

  if (omi?.zonaOmiLabel) {
    data.zonaOmiRiferimento = field(
      omi.zonaOmiLabel,
      "Zona OMI",
      "official_data",
      omi.polygonMatch ? "available" : "partial",
      omi.polygonMatch ? "Identificata da coordinate" : "Riferimento comunale",
    );
  }

  // Only return if we have at least one renderable field
  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── B) Immobile e Facciata ──────────────────────────────── */

export function buildImmobileFacciata(result: ScanResult): ImmobileFacciataData | null {
  const identify = sectionData<IdentifyResult>(result, "identify");
  if (!identify?.streetEvidence) return null;

  const se = identify.streetEvidence;
  const pa = se.photoAnalysis;
  const data: ImmobileFacciataData = {};

  // buildingType from photo analysis → image_detected
  if (pa?.buildingType) {
    data.tipologiaFacciata = field(pa.buildingType, "Tipologia edificio", "image_detected");
  }

  // visibleFloors from photo analysis → image_detected
  if (pa?.visibleFloors != null) {
    data.presenzaBalconi = undefined; // not available — don't invent
    data.noteVisive = field(
      `${pa.visibleFloors} pian${pa.visibleFloors === 1 ? "o" : "i"} visibil${pa.visibleFloors === 1 ? "e" : "i"}`,
      "Piani visibili",
      "image_detected",
    );
  }

  // facadeConsistencyLevel → visual_estimate (inferred, not certain)
  // Backend values: "strong" | "good" | "partial" | "weak" | "none"
  if (se.facadeConsistencyLevel && se.facadeConsistencyLevel !== "none") {
    const consistencyLabels: Record<string, string> = {
      strong: "Facciata coerente e in buono stato apparente",
      good: "Facciata in buone condizioni generali",
      partial: "Facciata con elementi di disomogeneità",
      weak: "Facciata con evidenti segni di deterioramento",
    };
    const label = consistencyLabels[se.facadeConsistencyLevel];
    if (label) {
      data.statoConservazioneFacciata = field(
        label,
        "Coerenza facciata",
        "visual_estimate",
        "partial",
        "Valutazione basata sull'immagine esterna",
      );
    }
  }

  // photoReadability as technical note
  // Backend values: "clear" | "partial" | "poor"
  if (pa?.photoReadability && pa.photoReadability !== "clear") {
    const readabilityNotes: Record<string, string> = {
      partial: "Leggibilità immagine nella media — alcuni dettagli non determinabili",
      poor: "Leggibilità immagine limitata — valutazione visiva parziale",
    };
    const note = readabilityNotes[pa.photoReadability];
    if (note) {
      data.qualitaEsteticaGenerale = field(
        note,
        "Nota sulla leggibilità",
        "image_detected",
        "partial",
      );
    }
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── C) Contesto e Vicinato ──────────────────────────────── */

export function buildContestoVicinato(result: ScanResult): ContestoVicinatoData | null {
  const poi = sectionData<PoiEnrichmentData>(result, "poiEnrichment");

  if (!poi || poi.totalPois === 0) return null;

  const data: ContestoVicinatoData = {};

  // Derive context from POI categories
  const categories = poi.categories ?? [];
  const hasManyServices = poi.totalPois >= 10;
  const hasTransport = categories.some(c => c.category === "transport");
  const hasShopping = categories.some(c => c.category === "shopping");
  const hasHealth = categories.some(c => c.category === "health");
  const hasEducation = categories.some(c => c.category === "education");
  const hasParks = categories.some(c => c.category === "parks");

  // presenzaServiziRilevati — derived from POI count (territorial, not visual)
  if (poi.totalPois > 0) {
    data.presenzaServiziRilevati = field(
      hasManyServices,
      "Presenza servizi nell'area",
      "territorial_verified",
      "available",
    );
  }

  // elencoServiziRilevati — from POI category labels (territorial source)
  if (categories.length > 0) {
    const serviziLabels = categories
      .filter(c => c.count > 0)
      .slice(0, 8)
      .map(c => `${c.categoryLabel} (${c.count})`);

    if (serviziLabels.length > 0) {
      data.elencoServiziRilevati = field(
        serviziLabels,
        "Servizi rilevati nell'area",
        "territorial_verified",
        "available",
      );
    }
  }

  // dotazioneServizi — qualitative from POI density (territorial, not visual)
  if (poi.totalPois >= 15 && categories.length >= 4) {
    data.dotazioneServizi = field(
      "Buona dotazione di servizi",
      "Dotazione servizi",
      "territorial_verified",
      "partial",
      "Derivato dalla densità di servizi nell'area",
    );
  } else if (poi.totalPois >= 5) {
    data.dotazioneServizi = field(
      "Dotazione servizi nella media",
      "Dotazione servizi",
      "territorial_verified",
      "partial",
      "Derivato dalla densità di servizi nell'area",
    );
  }

  // livelloServiziArea — only if strong territorial signals
  if (hasTransport && hasShopping && (hasHealth || hasEducation)) {
    data.livelloServiziArea = field(
      "Area ben servita",
      "Livello servizi area",
      "territorial_verified",
      "partial",
      "Basato su servizi rilevati: trasporti, commercio, servizi primari",
    );
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── G) Posizionamento Commerciale ───────────────────────── */

export function buildPosizionamentoCommerciale(result: ScanResult): PosizionamentoCommercialeData | null {
  const pricing = sectionData<PricingData>(result, "pricing");
  const market = sectionData<MarketContextData>(result, "marketContext");
  const omi = sectionData<OmiZoneData>(result, "omiZone");

  // Need at least pricing or market data to show this section
  if (!pricing && !market) return null;

  const data: PosizionamentoCommercialeData = {};

  // prezzoRichiestoRilevato — distinguish official vs market source
  if (pricing?.prezzoMq != null) {
    const pricingSource: ReportSourceType =
      pricing.sourceType === "official" ? "official_data" :
      pricing.sourceType === "unavailable" ? "unavailable" as ReportSourceType : "market_data";
    data.prezzoRichiestoRilevato = field(
      pricing.prezzoMq,
      "Prezzo stimato €/m²",
      pricingSource,
      pricing.sourceType === "unavailable" ? "unavailable" : "available",
    );
  }

  // noteCommercialiSintetiche — qualitative positioning from combined signals
  const signals: string[] = [];

  if (pricing?.prezzoMq != null && omi?.quotazioneMinResidenziale != null && omi?.quotazioneMaxResidenziale != null) {
    const omiMid = (omi.quotazioneMinResidenziale + omi.quotazioneMaxResidenziale) / 2;
    const ratio = pricing.prezzoMq / omiMid;
    if (ratio > 1.2) {
      signals.push("Prezzo di mercato superiore alla media OMI di zona");
    } else if (ratio < 0.8) {
      signals.push("Prezzo di mercato inferiore alla media OMI di zona");
    } else {
      signals.push("Prezzo di mercato in linea con i valori OMI di zona");
    }
  }

  if (market?.comparablesSummary?.count != null && market.comparablesSummary.count > 0) {
    const depth = market.comparablesSummary.marketDepth;
    if (depth === "profondo") {
      signals.push("Mercato con buona profondità di comparabili");
    } else if (depth === "limitato") {
      signals.push("Mercato con pochi comparabili disponibili");
    }
  }

  if (signals.length > 0) {
    data.noteCommercialiSintetiche = field(
      signals.join(". ") + ".",
      "Note commerciali",
      "market_data",
      signals.length >= 2 ? "available" : "partial",
    );
  }

  // statoCommercialeRilevato — qualitative from market depth
  if (market?.marketCoverageLevel) {
    const coverageMap: Record<string, string> = {
      completa: "Mercato attivo",
      buona: "Mercato attivo",
      parziale: "Mercato con segnali parziali",
      scarsa: "Mercato con dati limitati",
    };
    const label = coverageMap[market.marketCoverageLevel];
    if (label) {
      data.statoCommercialeRilevato = field(
        label,
        "Stato commerciale",
        "market_data",
        market.marketCoverageLevel === "scarsa" ? "partial" : "available",
      );
    }
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── H) Profilo Area ─────────────────────────────────────── */

export function buildProfiloArea(result: ScanResult): ProfiloAreaData | null {
  const poi = sectionData<PoiEnrichmentData>(result, "poiEnrichment");
  const rischio = sectionData<RischioZonaData>(result, "rischioZona");
  const istat = sectionData<IstatDemographicData>(result, "istatDemographic");
  const infra = sectionData<InfrastrutureData>(result, "infrastrutture");
  const trend = sectionData<TrendDemograficoData>(result, "trendDemografico");

  const data: ProfiloAreaData = {};

  // accessibilitaTrasporti — from POI transport category
  if (poi) {
    const transport = poi.categories?.find(c => c.category === "transport");
    if (transport && transport.count > 0) {
      const nearest = transport.nearest;
      data.accessibilitaTrasporti = field(
        nearest ? `${transport.count} fermata/e · più vicina a ${nearest.distance}m` : `${transport.count} fermata/e nel raggio`,
        "Accessibilità trasporti",
        "territorial_verified",
        "available",
      );
    }
  }

  // presenzaServiziPrimari — from POI
  if (poi && poi.totalPois > 0) {
    const primary = poi.categories?.filter(c =>
      ["health", "education", "shopping"].includes(c.category)
    ) ?? [];
    const count = primary.reduce((sum, c) => sum + c.count, 0);
    if (count > 0) {
      data.presenzaServiziPrimari = field(
        `${count} servizi primari nel raggio di ${poi.searchRadius}m`,
        "Servizi primari",
        "territorial_verified",
        "available",
      );
    }
  }

  // qualitaAmbientale — from rischio zona if available
  if (rischio?.scoreRischio != null) {
    const score = rischio.scoreRischio;
    let qualita: string;
    let status: AvailabilityStatus = "available";
    if (score <= 30) qualita = "Basso profilo di rischio ambientale";
    else if (score <= 60) qualita = "Profilo di rischio ambientale nella media";
    else qualita = "Profilo di rischio ambientale da monitorare";

    data.qualitaAmbientale = field(qualita, "Profilo ambientale", "territorial_verified", status);
  }

  // livelloUrbanizzazione — from demographic density
  if (istat?.densita != null) {
    let level: string;
    if (istat.densita > 3000) level = "Alta densità abitativa";
    else if (istat.densita > 1000) level = "Media densità abitativa";
    else if (istat.densita > 300) level = "Bassa densità abitativa";
    else level = "Area a bassa urbanizzazione";

    data.livelloUrbanizzazione = field(
      level,
      "Urbanizzazione",
      "official_data",
      "available",
      `${istat.densita.toLocaleString("it-IT")} ab/km²`,
    );
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── I) Scenario Temporale ───────────────────────────────── */

export function buildScenarioTemporale(result: ScanResult): ScenarioTemporaleData | null {
  const tv = sectionData<TimeViewData>(result, "timeView");
  if (!tv) return null;

  const scenari: ScenarioTemporaleEntry[] = [];

  if (tv.previsione5Anni != null) {
    scenari.push({
      orizzonte: "5_anni",
      label: "5 anni",
      variazioneStimataPct: field(tv.previsione5Anni, "Variazione stimata", "forecast_scenario"),
      driverPrincipali: tv.scenarioDrivers?.length
        ? field(tv.scenarioDrivers as string[], "Driver", "forecast_scenario")
        : undefined,
      rischiPrincipali: tv.scenarioRisks?.length
        ? field(tv.scenarioRisks as string[], "Rischi", "forecast_scenario")
        : undefined,
      narrativa: tv.narrativeObservation
        ? field(tv.narrativeObservation, "Osservazione", "forecast_scenario")
        : undefined,
    });
  }

  if (tv.previsione10Anni != null) {
    scenari.push({
      orizzonte: "10_anni",
      label: "10 anni",
      variazioneStimataPct: field(tv.previsione10Anni, "Variazione stimata", "forecast_scenario"),
    });
  }

  if (tv.previsione20Anni != null) {
    scenari.push({
      orizzonte: "20_anni",
      label: "20 anni",
      variazioneStimataPct: field(tv.previsione20Anni, "Variazione stimata", "forecast_scenario"),
    });
  }

  if (scenari.length === 0) return null;

  return {
    scenari,
    disclaimer: "Le proiezioni sono scenari indicativi elaborati da Sottra e non costituiscono consulenza finanziaria o immobiliare",
  };
}

/* ── J) Sintesi Finale ───────────────────────────────────── */

export function buildSintesiFinale(result: ScanResult): SintesiFinaleData | null {
  const opportunity = sectionData<OpportunityData>(result, "opportunity");
  const convergenza = sectionData<ConvergenzaTerritorialeData>(result, "convergenzaTerritoriale");
  const pricing = sectionData<PricingData>(result, "pricing");

  if (!opportunity && !convergenza) return null;

  const data: SintesiFinaleData = {};

  // giudizioSintetico — from convergenza band
  if (convergenza?.band && convergenza.score != null) {
    const bandTexts: Record<string, string> = {
      molto_forte: "Convergenza territoriale molto forte. Molteplici segnali favorevoli confermano il potenziale dell'area.",
      forte: "Convergenza territoriale forte. I principali indicatori confermano un quadro positivo.",
      interessante: "Convergenza territoriale interessante. Alcuni segnali meritano approfondimento.",
      debole: "Convergenza territoriale debole. Il quadro presenta elementi da monitorare con attenzione.",
    };
    const text = bandTexts[convergenza.band];
    if (text) {
      data.giudizioSintetico = field(text, "Giudizio sintetico", "market_data", "available");
    }
  }

  // puntiDiForza — from opportunity drivers and convergenza positive
  const forza: string[] = [];
  if (opportunity?.drivers) {
    forza.push(...(opportunity.drivers as string[]).slice(0, 2));
  }
  if (convergenza?.positiveFamilies) {
    forza.push(...convergenza.positiveFamilies.slice(0, 2).map(f => `Convergenza positiva: ${f}`));
  }
  if (forza.length > 0) {
    data.puntiDiForza = field(forza.slice(0, 4), "Punti di forza", "market_data", "available");
  }

  // puntiDiAttenzione — from opportunity risks and convergenza negative
  const attenzione: string[] = [];
  if (opportunity?.risks) {
    attenzione.push(...(opportunity.risks as string[]).slice(0, 2));
  }
  if (convergenza?.negativeFamilies) {
    attenzione.push(...convergenza.negativeFamilies.slice(0, 2).map(f => `Attenzione: ${f}`));
  }
  if (attenzione.length > 0) {
    data.puntiDiAttenzione = field(attenzione.slice(0, 4), "Punti di attenzione", "market_data", "available");
  }

  // raccomandazione — from opportunity observation
  if (opportunity?.observation) {
    data.raccomandazione = field(
      opportunity.observation,
      "Osservazione",
      "market_data",
      "available",
    );
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── Master mapper ───────────────────────────────────────── */

export interface MappedReportSections {
  profiloRapido: ProfiloRapidoData | null;
  immobileFacciata: ImmobileFacciataData | null;
  contestoVicinato: ContestoVicinatoData | null;
  posizionamentoCommerciale: PosizionamentoCommercialeData | null;
  profiloArea: ProfiloAreaData | null;
  scenarioTemporale: ScenarioTemporaleData | null;
  sintesiFinale: SintesiFinaleData | null;
}

export function mapScanToReportSections(
  result: ScanResult,
  lat: number | null,
  lng: number | null,
): MappedReportSections {
  return {
    profiloRapido: buildProfiloRapido(result, lat, lng),
    immobileFacciata: buildImmobileFacciata(result),
    contestoVicinato: buildContestoVicinato(result),
    posizionamentoCommerciale: buildPosizionamentoCommerciale(result),
    profiloArea: buildProfiloArea(result),
    scenarioTemporale: buildScenarioTemporale(result),
    sintesiFinale: buildSintesiFinale(result),
  };
}
