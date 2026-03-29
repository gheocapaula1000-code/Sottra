/**
 * Renovation Cost Engine — Sottra WOW Layer
 *
 * Produces a commercial-grade renovation cost estimate with range.
 * Does NOT produce a technical cost breakdown (computo metrico).
 * Does NOT invent structural data. Shows ranges and declares limits.
 */

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export type EstimateMode = "photo_contextual" | "contextual_only" | "unavailable";
export type EstimateStrength = "indicative" | "contextual" | "weak" | "insufficient";
export type RenovationNarrativeMode = "full" | "partial" | "hidden";

export interface RenovationIdentity {
  zone_geo_code: string;
  zone_geo_level: string;
  estimate_basis: string;
  input_support_level: "photo_and_context" | "context_only" | "minimal";
}

export interface RenovationEstimate {
  renovation_cost_min: number | null;
  renovation_cost_max: number | null;
  renovation_cost_mid: number | null;
  renovation_scope_label: string;
  estimate_mode: EstimateMode;
  confidence_level: number;
  source_basis: string;
}

export interface RenovationQuality {
  photo_support_used: boolean;
  contextual_only: boolean;
  structural_unknowns_present: boolean;
  estimate_strength: EstimateStrength;
  transparency_notes: string[];
}

export interface RenovationResult {
  renovation_identity: RenovationIdentity;
  renovation_estimate: RenovationEstimate;
  renovation_quality: RenovationQuality;
}

/* ═══════════════════════════════════════════════════════════
   NARRATIVE MODE
   ═══════════════════════════════════════════════════════════ */

export function renovationNarrativeMode(r: RenovationResult): RenovationNarrativeMode {
  if (r.renovation_estimate.estimate_mode === "unavailable") return "hidden";
  if (r.renovation_estimate.renovation_cost_mid == null) return "hidden";
  if (r.renovation_quality.estimate_strength === "insufficient") return "hidden";
  if (r.renovation_quality.estimate_strength === "indicative" || r.renovation_quality.estimate_strength === "contextual") return "full";
  return "partial";
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function estimateStrengthLabel(s: EstimateStrength): string {
  const m: Record<EstimateStrength, string> = { indicative: "Indicativa", contextual: "Contestuale", weak: "Debole", insufficient: "Insufficiente" };
  return m[s];
}

/* ═══════════════════════════════════════════════════════════
   COST RANGES — Italian market reference bands (€/m²)
   Conservative commercial ranges, NOT technical specs.
   ═══════════════════════════════════════════════════════════ */

interface CostBand {
  label: string;
  min_per_sqm: number;
  max_per_sqm: number;
}

const RENOVATION_BANDS: Record<string, CostBand> = {
  light: { label: "Ristrutturazione leggera", min_per_sqm: 250, max_per_sqm: 500 },
  medium: { label: "Ristrutturazione media", min_per_sqm: 500, max_per_sqm: 900 },
  heavy: { label: "Ristrutturazione pesante", min_per_sqm: 900, max_per_sqm: 1500 },
};

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export interface RenovationEngineInput {
  zone_geo_code: string;
  zone_geo_level: string;
  /** Photo analysis hints from identify */
  hasPhoto: boolean;
  visibleFloors?: number | null;
  buildingType?: string | null;
  facadeConsistencyLevel?: string | null;
  photoReadability?: string | null;
  /** Zone value context */
  value_per_sqm_mid?: number | null;
}

export function buildRenovationEstimate(input: RenovationEngineInput): RenovationResult {
  const {
    zone_geo_code, zone_geo_level, hasPhoto,
    visibleFloors, buildingType, facadeConsistencyLevel,
    photoReadability, value_per_sqm_mid,
  } = input;

  // ── Determine band based on available signals ──
  let selectedBand: CostBand;
  let estimateMode: EstimateMode;
  let inputSupportLevel: RenovationIdentity["input_support_level"];
  let confidence = 0;

  const facadeWeak = facadeConsistencyLevel === "weak" || facadeConsistencyLevel === "none";
  const facadeStrong = facadeConsistencyLevel === "strong" || facadeConsistencyLevel === "good";
  const photoOk = hasPhoto && photoReadability !== "poor";

  if (photoOk) {
    estimateMode = "photo_contextual";
    inputSupportLevel = "photo_and_context";

    if (facadeWeak) {
      selectedBand = RENOVATION_BANDS.heavy;
      confidence = 0.4;
    } else if (facadeStrong) {
      selectedBand = RENOVATION_BANDS.light;
      confidence = 0.5;
    } else {
      selectedBand = RENOVATION_BANDS.medium;
      confidence = 0.45;
    }
  } else if (value_per_sqm_mid != null) {
    estimateMode = "contextual_only";
    inputSupportLevel = "context_only";
    selectedBand = RENOVATION_BANDS.medium;
    confidence = 0.3;
  } else {
    // Insufficient data
    return {
      renovation_identity: {
        zone_geo_code,
        zone_geo_level,
        estimate_basis: "Dati insufficienti",
        input_support_level: "minimal",
      },
      renovation_estimate: {
        renovation_cost_min: null,
        renovation_cost_max: null,
        renovation_cost_mid: null,
        renovation_scope_label: "Non stimabile",
        estimate_mode: "unavailable",
        confidence_level: 0,
        source_basis: "Nessuna base per la stima",
      },
      renovation_quality: {
        photo_support_used: false,
        contextual_only: false,
        structural_unknowns_present: true,
        estimate_strength: "insufficient",
        transparency_notes: ["Dati insufficienti per produrre una stima dei costi di ristrutturazione"],
      },
    };
  }

  const estimatedSqm = visibleFloors != null && visibleFloors > 0
    ? Math.max(visibleFloors * 85, 60) // rough per-floor avg
    : 90; // default reference area

  const costMin = Math.round(selectedBand.min_per_sqm * estimatedSqm);
  const costMax = Math.round(selectedBand.max_per_sqm * estimatedSqm);
  const costMid = Math.round((costMin + costMax) / 2);

  // ── Strength ──
  let strength: EstimateStrength;
  if (confidence >= 0.45) strength = "indicative";
  else if (confidence >= 0.3) strength = "contextual";
  else strength = "weak";

  // ── Transparency ──
  const notes: string[] = [];
  notes.push("Stima commerciale orientativa, non sostituisce un computo metrico professionale");
  if (!photoOk) notes.push("Stima basata solo su contesto zona — senza supporto foto");
  if (facadeWeak) notes.push("La facciata suggerisce possibili interventi significativi");
  notes.push("I costi reali dipendono da stato interno, impianti, normativa locale e scelte progettuali");
  if (estimatedSqm === 90) notes.push("Superficie di riferimento stimata (90 m²) — dato reale non disponibile");

  return {
    renovation_identity: {
      zone_geo_code,
      zone_geo_level,
      estimate_basis: selectedBand.label,
      input_support_level: inputSupportLevel,
    },
    renovation_estimate: {
      renovation_cost_min: costMin,
      renovation_cost_max: costMax,
      renovation_cost_mid: costMid,
      renovation_scope_label: selectedBand.label,
      estimate_mode: estimateMode,
      confidence_level: confidence,
      source_basis: photoOk
        ? "Stima basata su analisi foto e contesto zona"
        : "Stima basata su contesto zona e range di mercato",
    },
    renovation_quality: {
      photo_support_used: photoOk,
      contextual_only: !photoOk,
      structural_unknowns_present: true,
      estimate_strength: strength,
      transparency_notes: notes,
    },
  };
}
