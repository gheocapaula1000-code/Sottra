/**
 * Phase 3 Report Mapper — transforms real scan data into ReportField structures.
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
  PrioritaCriticitaData, PrioritaCriticaItem, PrioritaCriticaCategoria,
  GeoContext, ReportGeoLevel,
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

function sectionData<T>(result: ScanResult, key: keyof ScanResult): T | null {
  const s = result[key];
  if (s.status !== "success" || !s.data) return null;
  return s.data as T;
}

/* ── Geographic resolution helper ─────────────────────── */

/**
 * Determines the best geographic resolution from available data sources.
 * Priority: OMI polygon match > POI (local radius) > coordinate-based > comune fallback.
 */
export function resolveGeoContext(result: ScanResult): GeoContext {
  const omi = sectionData<OmiZoneData>(result, "omiZone");
  const istat = sectionData<IstatDemographicData>(result, "istatDemographic");
  const trendDemo = sectionData<import("@/types").TrendDemograficoData>(result, "trendDemografico");

  // Best case: OMI polygon match = microzone-level
  if (omi?.polygonMatch && omi?.zonaOmiLabel) {
    return { geoLevel: "microzona_omi", geoLabel: `Zona OMI ${omi.zonaOmiLabel}` };
  }

  // TrendDemografico may carry its own geoLevel from the backend
  if (trendDemo?.geoLevel && trendDemo.geoLevel !== "comune" && trendDemo.geoLevel !== "stimato") {
    return { geoLevel: trendDemo.geoLevel as ReportGeoLevel, geoLabel: trendDemo.geoLabel ?? undefined };
  }

  // Fallback: if we only have ISTAT or OMI without polygon match → comunale
  if (istat?.comuneLabel) {
    return { geoLevel: "comune", geoLabel: `Comune di ${istat.comuneLabel}` };
  }
  if (omi?.comuneLabel) {
    return { geoLevel: "comune", geoLabel: `Comune di ${omi.comuneLabel}` };
  }

  return { geoLevel: "non_determinato" };
}

/* ── Coverage helper (centralized) ───────────────────────── */

const COVERAGE_MODULES: (keyof ScanResult)[] = [
  "pricing", "omiZone", "poiEnrichment", "rischioZona",
  "timeView", "convergenzaTerritoriale", "opportunity",
];

export function computeModuleCoverage(result: ScanResult): { available: number; total: number; pct: number } {
  const total = COVERAGE_MODULES.length;
  const available = COVERAGE_MODULES.filter(k => {
    const s = result[k];
    return s.status === "success" && s.data != null;
  }).length;
  return { available, total, pct: Math.round((available / total) * 100) };
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

  if (pa?.buildingType) {
    data.tipologiaFacciata = field(pa.buildingType, "Tipologia edificio", "image_detected");
  }

  if (pa?.visibleFloors != null) {
    data.noteVisive = field(
      `${pa.visibleFloors} pian${pa.visibleFloors === 1 ? "o" : "i"} visibil${pa.visibleFloors === 1 ? "e" : "i"}`,
      "Piani visibili",
      "image_detected",
    );
  }

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

  if (pa?.photoReadability && pa.photoReadability !== "clear") {
    const readabilityNotes: Record<string, string> = {
      partial: "Leggibilità immagine nella media — alcuni dettagli non determinabili",
      poor: "Leggibilità immagine limitata — valutazione visiva parziale",
    };
    const note = readabilityNotes[pa.photoReadability];
    if (note) {
      data.leggibilitaImmagine = field(
        note,
        "Leggibilità immagine",
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

  const categories = poi.categories ?? [];
  const hasManyServices = poi.totalPois >= 10;
  const hasTransport = categories.some(c => c.category === "transport");
  const hasShopping = categories.some(c => c.category === "shopping");
  const hasHealth = categories.some(c => c.category === "health");
  const hasEducation = categories.some(c => c.category === "education");

  if (poi.totalPois > 0) {
    data.presenzaServiziRilevati = field(
      hasManyServices,
      "Presenza servizi nell'area",
      "territorial_verified",
      "available",
    );
  }

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

  if (!pricing && !market) return null;

  const data: PosizionamentoCommercialeData = {};

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

/* ── H) Profilo Area — premium synthesis ─────────────────── */

export function buildProfiloArea(result: ScanResult): ProfiloAreaData | null {
  const poi = sectionData<PoiEnrichmentData>(result, "poiEnrichment");
  const rischio = sectionData<RischioZonaData>(result, "rischioZona");
  const istat = sectionData<IstatDemographicData>(result, "istatDemographic");

  const data: ProfiloAreaData = {};

  // accessibilitaTrasporti
  if (poi) {
    const transport = poi.categories?.find(c => c.category === "transport");
    if (transport && transport.count > 0) {
      const nearest = transport.nearest;
      data.accessibilitaTrasporti = field(
        nearest?.distance != null ? `${transport.count} fermata/e · più vicina a ${nearest.distance}m` : `${transport.count} fermata/e nel raggio`,
        "Accessibilità trasporti",
        "territorial_verified",
        "available",
      );
    }
  }

  // presenzaServiziPrimari
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

  // qualitaAmbientale
  if (rischio?.scoreRischio != null) {
    const score = rischio.scoreRischio;
    let qualita: string;
    if (score <= 30) qualita = "Basso profilo di rischio ambientale";
    else if (score <= 60) qualita = "Profilo di rischio ambientale nella media";
    else qualita = "Profilo di rischio ambientale da monitorare";

    data.qualitaAmbientale = field(qualita, "Profilo ambientale", "territorial_verified", "available");
  }

  // livelloUrbanizzazione
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

  // sintesiArea — prudent micro-synthesis only when enough data
  const signalCount = [
    data.accessibilitaTrasporti,
    data.presenzaServiziPrimari,
    data.qualitaAmbientale,
    data.livelloUrbanizzazione,
  ].filter(Boolean).length;

  if (signalCount >= 3) {
    const parts: string[] = [];

    if (data.livelloUrbanizzazione) {
      parts.push(data.livelloUrbanizzazione.value.toLowerCase());
    }
    if (data.accessibilitaTrasporti) {
      parts.push("con accesso a trasporti pubblici");
    }
    if (data.presenzaServiziPrimari) {
      parts.push("servizi primari presenti nell'area");
    }
    if (data.qualitaAmbientale && rischio?.scoreRischio != null && rischio.scoreRischio <= 40) {
      parts.push("profilo ambientale contenuto");
    }

    if (parts.length >= 2) {
      const synthesis = `Area con ${parts.slice(0, 3).join(", ")}.`;
      data.sintesiArea = field(
        synthesis,
        "Quadro sintetico dell'area",
        "territorial_verified",
        signalCount >= 4 ? "available" : "partial",
        `Basato su ${signalCount} indicatori territoriali verificati`,
      );
    }
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

/* ── J) Sintesi Finale — executive summary ───────────────── */

export function buildSintesiFinale(result: ScanResult): SintesiFinaleData | null {
  const opportunity = sectionData<OpportunityData>(result, "opportunity");
  const convergenza = sectionData<ConvergenzaTerritorialeData>(result, "convergenzaTerritoriale");
  const pricing = sectionData<PricingData>(result, "pricing");
  const omi = sectionData<OmiZoneData>(result, "omiZone");
  const poi = sectionData<PoiEnrichmentData>(result, "poiEnrichment");
  const rischio = sectionData<RischioZonaData>(result, "rischioZona");
  const tv = sectionData<TimeViewData>(result, "timeView");

  if (!opportunity && !convergenza) return null;

  const data: SintesiFinaleData = {};

  // Executive summary — build from convergence of real signals
  if (convergenza?.band && convergenza.score != null) {
    const summaryParts: string[] = [];

    // Opening statement from convergence
    const bandOpenings: Record<string, string> = {
      molto_forte: "Il quadro complessivo mostra una convergenza territoriale molto forte tra i segnali analizzati.",
      forte: "I principali indicatori convergono verso un quadro positivo per l'area esaminata.",
      interessante: "L'analisi evidenzia elementi di interesse, con alcuni segnali che meritano approfondimento.",
      debole: "Il quadro presenta elementi eterogenei che richiedono una valutazione attenta.",
    };
    const opening = bandOpenings[convergenza.band];
    if (opening) summaryParts.push(opening);

    // Add coverage context
    const covLabels: Record<string, string> = {
      completa: "L'analisi dispone di una copertura dati completa.",
      buona: "La copertura dei dati analizzati è buona.",
      parziale: "Alcuni indicatori non sono disponibili per questa zona; la lettura è parziale.",
      scarsa: "La copertura dati per questa area è limitata; le conclusioni sono da considerare con prudenza.",
    };
    if (convergenza.coverageLevel && covLabels[convergenza.coverageLevel]) {
      summaryParts.push(covLabels[convergenza.coverageLevel]);
    }

    if (summaryParts.length > 0) {
      data.giudizioSintetico = field(
        summaryParts.join(" "),
        "Quadro sintetico",
        "territorial_verified",
        convergenza.coverageLevel === "scarsa" ? "partial" : "available",
        "Sintesi basata su convergenza territoriale, servizi, rischio e scenario",
      );
    }
  }

  // puntiDiForza — only real, supported items
  const forza: string[] = [];
  if (opportunity?.drivers) {
    forza.push(...(opportunity.drivers as string[]).slice(0, 2));
  }
  if (convergenza?.positiveFamilies) {
    forza.push(...convergenza.positiveFamilies.slice(0, 2).map(f => `Convergenza positiva: ${f}`));
  }
  if (rischio?.scoreRischio != null && rischio.scoreRischio <= 30) {
    forza.push("Profilo di rischio ambientale contenuto");
  }
  if (poi && poi.totalPois >= 15) {
    forza.push("Buona dotazione di servizi nell'area");
  }
  if (forza.length > 0) {
    data.puntiDiForza = field(
      forza.slice(0, 4), "Punti di forza", "territorial_verified", "available",
      "Derivati da convergenza, rischio, servizi e opportunità",
    );
  }

  // puntiDiAttenzione — real cautions
  const attenzione: string[] = [];
  if (opportunity?.risks) {
    attenzione.push(...(opportunity.risks as string[]).slice(0, 2));
  }
  if (convergenza?.negativeFamilies) {
    attenzione.push(...convergenza.negativeFamilies.slice(0, 2).map(f => `Attenzione: ${f}`));
  }
  if (rischio?.scoreRischio != null && rischio.scoreRischio > 60) {
    attenzione.push("Profilo di rischio ambientale da monitorare");
  }
  if (attenzione.length > 0) {
    data.puntiDiAttenzione = field(
      attenzione.slice(0, 4), "Punti di attenzione", "territorial_verified", "available",
      "Derivati da convergenza, rischio, servizi e opportunità",
    );
  }

  // raccomandazione — prudent conclusion
  if (opportunity?.observation) {
    data.raccomandazione = field(
      opportunity.observation,
      "Osservazione conclusiva",
      "forecast_scenario",
      "available",
      "Basata su indice di opportunità territoriale",
    );
  }

  // Coverage analysis note — centralized helper
  const coverage = computeModuleCoverage(result);
  if (coverage.available < coverage.total) {
    data.coperturaAnalisi = field(
      `Analisi basata su ${coverage.available} di ${coverage.total} moduli disponibili (${coverage.pct}% di copertura)`,
      "Copertura analisi",
      "territorial_verified",
      coverage.available >= 5 ? "available" : "partial",
    );
  } else {
    data.coperturaAnalisi = field(
      "Copertura analisi completa",
      "Copertura analisi",
      "territorial_verified",
      "available",
    );
  }

  const hasContent = Object.values(data).some(f => f && typeof f === "object" && "availabilityStatus" in f);
  return hasContent ? data : null;
}

/* ── L) Priorità / Criticità ─────────────────────────────── */

export function buildPrioritaCriticita(result: ScanResult): PrioritaCriticitaData | null {
  const identify = sectionData<IdentifyResult>(result, "identify");
  if (!identify) return null; // No scan data = no priorities

  const pricing = sectionData<PricingData>(result, "pricing");
  const omi = sectionData<OmiZoneData>(result, "omiZone");
  const poi = sectionData<PoiEnrichmentData>(result, "poiEnrichment");
  const rischio = sectionData<RischioZonaData>(result, "rischioZona");
  const tv = sectionData<TimeViewData>(result, "timeView");
  const convergenza = sectionData<ConvergenzaTerritorialeData>(result, "convergenzaTerritoriale");
  const market = sectionData<MarketContextData>(result, "marketContext");

  const items: PrioritaCriticaItem[] = [];

  // Image readability issue
  if (identify?.streetEvidence?.photoAnalysis?.photoReadability === "poor") {
    items.push({
      testo: "Leggibilità immagine limitata — la valutazione visiva dell'edificio è parziale",
      categoria: "da_verificare",
      sourceType: "image_detected",
      availabilityStatus: "partial",
    });
  }

  // Low POI coverage
  if (poi && poi.totalPois < 5 && poi.totalPois > 0) {
    items.push({
      testo: "Contesto servizi limitato nell'area analizzata",
      categoria: "attenzione",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
    });
  }

  // High risk score
  if (rischio?.scoreRischio != null && rischio.scoreRischio > 60) {
    items.push({
      testo: "Profilo di rischio ambientale da approfondire",
      categoria: "attenzione",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
    });
  }

  // Low risk = favorable
  if (rischio?.scoreRischio != null && rischio.scoreRischio <= 25) {
    items.push({
      testo: "Profilo di rischio ambientale contenuto",
      categoria: "elemento_favorevole",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
    });
  }

  // Good convergence
  if (convergenza?.band === "molto_forte" || convergenza?.band === "forte") {
    items.push({
      testo: "Convergenza territoriale positiva tra i segnali analizzati",
      categoria: "elemento_favorevole",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
      nota: "Basato su convergenza di più fonti territoriali",
    });
  }

  // Weak convergence
  if (convergenza?.band === "debole") {
    items.push({
      testo: "Convergenza territoriale debole — quadro da valutare con cautela",
      categoria: "attenzione",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
      nota: "Basato su convergenza di più fonti territoriali",
    });
  }

  // Pricing vs OMI divergence
  if (pricing?.prezzoMq != null && omi?.quotazioneMinResidenziale != null && omi?.quotazioneMaxResidenziale != null) {
    const omiMid = (omi.quotazioneMinResidenziale + omi.quotazioneMaxResidenziale) / 2;
    const ratio = pricing.prezzoMq / omiMid;
    if (ratio > 1.3) {
      items.push({
        testo: "Prezzo di mercato significativamente superiore alla media OMI — verificare coerenza",
        categoria: "da_verificare",
        sourceType: "official_data",
        availabilityStatus: "available",
        nota: "Confronto tra prezzo di mercato e quotazioni OMI ufficiali",
      });
    }
  }

  // Incomplete scenario
  if (!tv) {
    items.push({
      testo: "Scenario temporale non disponibile per questa area",
      categoria: "copertura_parziale",
      sourceType: "forecast_scenario",
      availabilityStatus: "partial",
    });
  }

  // Partial data coverage
  if (convergenza?.coverageLevel === "scarsa" || convergenza?.coverageLevel === "parziale") {
    items.push({
      testo: "Copertura dati parziale — alcune fonti non disponibili per l'area",
      categoria: "copertura_parziale",
      sourceType: "territorial_verified",
      availabilityStatus: "partial",
      nota: "Basato sulla copertura dei moduli di analisi",
    });
  }

  // Good POI coverage = favorable
  if (poi && poi.totalPois >= 15) {
    items.push({
      testo: "Area discretamente servita — buona densità di servizi rilevati",
      categoria: "elemento_favorevole",
      sourceType: "territorial_verified",
      availabilityStatus: "available",
    });
  }

  if (items.length === 0) return null;

  // Max 5 items, prioritized: attenzione > da_verificare > copertura_parziale > elemento_favorevole
  const priority: Record<PrioritaCriticaCategoria, number> = {
    attenzione: 0,
    da_verificare: 1,
    copertura_parziale: 2,
    elemento_favorevole: 3,
  };
  const sorted = items.sort((a, b) => priority[a.categoria] - priority[b.categoria]).slice(0, 5);

  return { items: sorted };
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
  prioritaCriticita: PrioritaCriticitaData | null;
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
    prioritaCriticita: buildPrioritaCriticita(result),
  };
}
