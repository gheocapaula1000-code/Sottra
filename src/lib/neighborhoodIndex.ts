/**
 * Indice di Vicinato — Sottra
 * 
 * Calcola un indice composito trasparente di qualità del vicinato
 * basato su sotto-dimensioni reali e verificabili.
 * 
 * REGOLE:
 * - Nessun dato inventato
 * - Ogni sotto-dimensione dichiara fonti, geoLevel e copertura
 * - Il punteggio finale viene calcolato solo con copertura minima (≥3 dimensioni)
 * - Se mancano dati, la dimensione è "non_disponibile"
 */

import type {
  PoiEnrichmentData, IstatDemographicData,
  RischioZonaData, OmiZoneData, SourceMetadata,
} from "@/types";
import type { GeoLevel } from "@/types";

/* ── Sub-dimension types ─────────────────────────────── */

export type DimensionStatus = "disponibile" | "parziale" | "non_disponibile";

export interface SubDimension {
  id: string;
  label: string;
  /** Score 0-100, null if unavailable */
  score: number | null;
  status: DimensionStatus;
  /** Geo level of the underlying data */
  geoLevel: GeoLevel | null;
  /** Human label for the area */
  geoLabel?: string;
  /** Sources used */
  sources: string[];
  /** Year/period of data */
  period?: string;
  /** Notes for transparency */
  note?: string;
}

export interface NeighborhoodIndex {
  /** Composite score 0-100, null if insufficient coverage */
  score: number | null;
  /** Band label */
  band: "ottimo" | "buono" | "discreto" | "sufficiente" | "insufficiente" | null;
  /** How many dimensions have data */
  dimensionsAvailable: number;
  /** Total dimensions attempted */
  dimensionsTotal: number;
  /** Coverage percentage */
  coveragePct: number;
  /** Individual sub-dimensions */
  dimensions: SubDimension[];
  /** Whether the index has enough data to be meaningful */
  isRenderable: boolean;
  /** Overall geo level (finest available) */
  geoLevel: GeoLevel | null;
  geoLabel?: string;
  /** Disclaimer text */
  disclaimer: string;
}

/* ── Constants ───────────────────────────────────────── */

const MIN_DIMENSIONS_FOR_INDEX = 3;
const DIMENSION_IDS = ["servizi", "commerciale", "demografico", "qualita_territoriale", "mercato"] as const;

/* ── Dimension builders ──────────────────────────────── */

function buildServiziDimension(poi: PoiEnrichmentData | null): SubDimension {
  if (!poi || poi.sourceType === "unavailable" || poi.totalPois === 0) {
    return {
      id: "servizi", label: "Accessibilità e Servizi", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
      note: "Nessun dato POI disponibile per questa posizione",
    };
  }

  const cats = poi.categories ?? [];
  const hasTransport = cats.some(c => c.category === "transport" && c.count > 0);
  const hasHealth = cats.some(c => c.category === "health" && c.count > 0);
  const hasEducation = cats.some(c => c.category === "education" && c.count > 0);
  const hasShopping = cats.some(c => c.category === "shopping" && c.count > 0);
  const hasParks = cats.some(c => c.category === "parks" && c.count > 0);
  const hasCulture = cats.some(c => c.category === "culture" && c.count > 0);

  const categoryCount = [hasTransport, hasHealth, hasEducation, hasShopping, hasParks, hasCulture].filter(Boolean).length;
  
  // Score based on diversity and density
  let score = 0;
  score += Math.min(categoryCount * 15, 60); // up to 60 for diversity
  score += Math.min(poi.totalPois * 2, 40);  // up to 40 for density

  return {
    id: "servizi", label: "Accessibilità e Servizi",
    score: Math.min(score, 100),
    status: categoryCount >= 3 ? "disponibile" : "parziale",
    geoLevel: "zona", // POI is always coordinate-based radius
    sources: [poi.sourceLabel ?? "OpenStreetMap"],
    period: poi.sourceFreshness,
    note: `${poi.totalPois} servizi in ${categoryCount} categorie nel raggio di ${poi.searchRadius}m`,
  };
}

function buildCommercialeDimension(poi: PoiEnrichmentData | null): SubDimension {
  if (!poi || poi.sourceType === "unavailable" || poi.totalPois === 0) {
    return {
      id: "commerciale", label: "Tessuto Commerciale", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
    };
  }

  const shopping = poi.categories?.find(c => c.category === "shopping");
  const shopCount = shopping?.count ?? 0;
  const totalCats = poi.categories?.length ?? 0;

  if (shopCount === 0 && totalCats < 2) {
    return {
      id: "commerciale", label: "Tessuto Commerciale", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
      note: "Nessuna attività commerciale rilevata nell'area",
    };
  }

  let score = 0;
  score += Math.min(shopCount * 10, 40);
  score += Math.min(totalCats * 10, 30);
  score += Math.min(poi.totalPois, 30);

  return {
    id: "commerciale", label: "Tessuto Commerciale",
    score: Math.min(score, 100),
    status: shopCount >= 2 ? "disponibile" : "parziale",
    geoLevel: "zona",
    sources: [poi.sourceLabel ?? "OpenStreetMap"],
    note: `${shopCount} attività commerciali, ${totalCats} categorie merceologiche`,
  };
}

function buildDemograficoDimension(istat: IstatDemographicData | null): SubDimension {
  if (!istat || istat.sourceType === "unavailable" || istat.popolazione == null) {
    return {
      id: "demografico", label: "Contesto Demografico", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
    };
  }

  const geoLevel = istat.geoLevel ?? "comune";
  let score = 50; // base

  // Density bonus/malus
  if (istat.densita != null) {
    if (istat.densita > 3000) score += 15;
    else if (istat.densita > 1000) score += 10;
    else if (istat.densita > 300) score += 5;
  }

  // Youth presence bonus
  if (istat.percentualeStranieri != null && istat.percentualeStranieri > 5) {
    score += 5; // diversity indicator
  }

  // Age structure
  if (istat.indiceVecchiaia != null) {
    if (istat.indiceVecchiaia < 150) score += 10;
    else if (istat.indiceVecchiaia > 250) score -= 10;
  }

  const metricsAvailable = [istat.popolazione, istat.densita, istat.indiceVecchiaia, istat.percentualeStranieri]
    .filter(v => v != null).length;

  return {
    id: "demografico", label: "Contesto Demografico",
    score: Math.max(0, Math.min(score, 100)),
    status: metricsAvailable >= 3 ? "disponibile" : "parziale",
    geoLevel,
    geoLabel: istat.geoLabel ?? (istat.comuneLabel ? `Comune di ${istat.comuneLabel}` : undefined),
    sources: [istat.sourceLabel ?? "ISTAT"],
    period: istat.annoRilevazione ?? undefined,
    note: geoLevel === "comune"
      ? `Dato riferito all'intero comune${istat.comuneLabel ? ` di ${istat.comuneLabel}` : ""}`
      : `Dato riferito a ${istat.geoLabel ?? "zona sub-comunale"}`,
  };
}

function buildQualitaTerritorialeDimension(rischio: RischioZonaData | null): SubDimension {
  if (!rischio || rischio.sourceType === "unavailable" || rischio.scoreRischio == null) {
    return {
      id: "qualita_territoriale", label: "Qualità Territoriale", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
    };
  }

  // Invert risk score: low risk = high quality
  const qualityScore = 100 - rischio.scoreRischio;

  const components: string[] = [];
  if (rischio.idrogeologico) components.push(`idrogeologico: ${rischio.idrogeologico}`);
  if (rischio.sismico) components.push(`sismico: ${rischio.sismico}`);

  return {
    id: "qualita_territoriale", label: "Qualità Territoriale",
    score: Math.max(0, Math.min(qualityScore, 100)),
    status: "disponibile",
    geoLevel: "zona", // Risk is coordinate-based
    sources: [rischio.sourceLabel ?? "Fonti istituzionali"],
    note: components.length > 0 ? components.join(", ") : undefined,
  };
}

function buildMercatoDimension(omi: OmiZoneData | null): SubDimension {
  if (!omi || omi.sourceType === "unavailable") {
    return {
      id: "mercato", label: "Mercato e Vitalità Locale", score: null,
      status: "non_disponibile", geoLevel: null, sources: [],
    };
  }

  if (omi.quotazioneMinResidenziale == null || omi.quotazioneMaxResidenziale == null) {
    // Zone identified but no quotations
    return {
      id: "mercato", label: "Mercato e Vitalità Locale",
      score: null, status: "parziale",
      geoLevel: omi.polygonMatch ? "microzona" : "comune",
      sources: ["OMI / Agenzia delle Entrate"],
      note: "Zona identificata ma quotazioni non disponibili",
    };
  }

  const mid = (omi.quotazioneMinResidenziale + omi.quotazioneMaxResidenziale) / 2;
  const spread = omi.quotazioneMaxResidenziale - omi.quotazioneMinResidenziale;
  const spreadRatio = spread / mid;

  // Score based on market price level and spread
  let score = 50;
  if (mid > 3000) score += 20;
  else if (mid > 2000) score += 15;
  else if (mid > 1000) score += 5;
  
  // Narrow spread = more stable market
  if (spreadRatio < 0.3) score += 10;
  else if (spreadRatio > 0.6) score -= 5;

  const geoLevel: GeoLevel = omi.polygonMatch ? "microzona" : "comune";

  return {
    id: "mercato", label: "Mercato e Vitalità Locale",
    score: Math.max(0, Math.min(score, 100)),
    status: "disponibile",
    geoLevel,
    geoLabel: omi.zonaOmiLabel ?? undefined,
    sources: ["OMI / Agenzia delle Entrate"],
    period: omi.semestre ?? undefined,
    note: geoLevel === "comune"
      ? "Dato riferito alla media comunale"
      : `Zona OMI ${omi.zonaOmiLabel ?? omi.zonaOmi ?? ""}`,
  };
}

/* ── Score to band ───────────────────────────────────── */

function scoreToBand(score: number): NeighborhoodIndex["band"] {
  if (score >= 75) return "ottimo";
  if (score >= 60) return "buono";
  if (score >= 45) return "discreto";
  if (score >= 30) return "sufficiente";
  return "insufficiente";
}

/* ── Finest geo level from dimensions ────────────────── */

const GEO_RANK: Record<GeoLevel, number> = {
  microzona: 0, quartiere: 1, zona: 2, localita: 3, comune: 4, area_vasta: 5, stimato: 6,
};

function finestGeoLevel(dimensions: SubDimension[]): GeoLevel | null {
  const available = dimensions.filter(d => d.geoLevel != null);
  if (available.length === 0) return null;
  return available.reduce((best, d) => {
    if (!best.geoLevel) return d;
    return GEO_RANK[d.geoLevel!] < GEO_RANK[best.geoLevel!] ? d : best;
  }).geoLevel;
}

/* ── Main calculator ─────────────────────────────────── */

export function calculateNeighborhoodIndex(
  poi: PoiEnrichmentData | null,
  istat: IstatDemographicData | null,
  rischio: RischioZonaData | null,
  omi: OmiZoneData | null,
): NeighborhoodIndex {
  const dimensions: SubDimension[] = [
    buildServiziDimension(poi),
    buildCommercialeDimension(poi),
    buildDemograficoDimension(istat),
    buildQualitaTerritorialeDimension(rischio),
    buildMercatoDimension(omi),
  ];

  const available = dimensions.filter(d => d.score != null);
  const dimensionsAvailable = available.length;
  const dimensionsTotal = dimensions.length;
  const coveragePct = Math.round((dimensionsAvailable / dimensionsTotal) * 100);
  const isRenderable = dimensionsAvailable >= MIN_DIMENSIONS_FOR_INDEX;

  let score: number | null = null;
  let band: NeighborhoodIndex["band"] = null;

  if (isRenderable) {
    // Weighted average — servizi and demografico weigh more
    const weights: Record<string, number> = {
      servizi: 25,
      commerciale: 15,
      demografico: 25,
      qualita_territoriale: 20,
      mercato: 15,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const dim of available) {
      const w = weights[dim.id] ?? 15;
      weightedSum += (dim.score ?? 0) * w;
      totalWeight += w;
    }

    score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
    band = score != null ? scoreToBand(score) : null;
  }

  const finest = finestGeoLevel(dimensions);
  const finestDim = dimensions.find(d => d.geoLevel === finest);

  return {
    score,
    band,
    dimensionsAvailable,
    dimensionsTotal,
    coveragePct,
    dimensions,
    isRenderable,
    geoLevel: finest,
    geoLabel: finestDim?.geoLabel,
    disclaimer: "Indice elaborato da Sottra sulla base dei dati disponibili. Non costituisce certificazione né consulenza professionale.",
  };
}
