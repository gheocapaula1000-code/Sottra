/**
 * House Differentiation Engine — Sottra
 *
 * Evaluates how well a photographed building can be distinguished
 * from adjacent ones, using photo, geo, address, and zone data.
 *
 * CRITICAL CONSTRAINTS:
 * - building_truth_support stays FALSE
 * - "strong_building_candidate" ≠ verified building truth
 * - No invented cadastral/legal/structural data
 * - No false specificity from fallback or ambiguous signals
 */

/* ═══════════════════════════════════════════════════════════
   STATUS TAXONOMY
   ═══════════════════════════════════════════════════════════ */

export type OverallDifferentiationStatus =
  | "strong_building_candidate"
  | "building_candidate_with_ambiguity"
  | "address_supported_but_visually_ambiguous"
  | "zone_only_context"
  | "not_determinable";

export type SpecificityStrength = "strong" | "medium" | "weak" | "insufficient";

export type HouseVsAdjacentSeparation =
  | "likely_distinct"
  | "partially_distinct"
  | "visually_ambiguous"
  | "contiguous_context_only"
  | "not_determinable";

export type VisualUniquenessStatus = "unique" | "partially_unique" | "ambiguous" | "not_assessable";

export type AlignmentLevel =
  | "high_alignment"
  | "medium_alignment"
  | "low_alignment"
  | "conflicting_alignment"
  | "insufficient_alignment";

export type SignalType =
  | "direct_visual_signal"
  | "contextual_signal"
  | "supported_address_signal"
  | "ambiguous"
  | "not_determinable";

export type DifferentiationNarrativeMode = "full" | "partial" | "hidden";

/* ═══════════════════════════════════════════════════════════
   CONTRACT
   ═══════════════════════════════════════════════════════════ */

export interface HouseDiffIdentity {
  zone_geo_code: string;
  zone_geo_level: string;
  address_input_present: boolean;
  photo_input_present: boolean;
  geo_input_present: boolean;
  differentiation_scope_label: string;
}

export interface HouseDiffVisualSignals {
  facade_detected: boolean;
  frontage_detected: boolean;
  entrance_visibility_status: "visible" | "partially_visible" | "not_visible" | "not_assessable";
  civic_visibility_status: "visible" | "partially_visible" | "not_visible" | "not_assessable";
  signage_visibility_status: "visible" | "not_visible" | "not_assessable";
  building_edge_confidence: number;
  neighboring_buildings_presence: "none_visible" | "visible_distinct" | "visible_contiguous" | "not_assessable";
  visual_uniqueness_status: VisualUniquenessStatus;
  visual_notes: string[];
}

export interface HouseDiffAddressAlignment {
  street_support_status: "official" | "normalized" | "weak" | "none";
  civic_support_status: "official" | "candidate" | "weak" | "none";
  photo_address_alignment: AlignmentLevel;
  geo_address_alignment: AlignmentLevel;
  anncsu_alignment_status: "aligned" | "partial" | "none" | "not_available";
  address_specificity_level: "civic" | "street" | "zone" | "none";
  address_alignment_notes: string[];
}

export interface HouseDiffSpecificity {
  specificity_status: OverallDifferentiationStatus;
  specificity_strength: SpecificityStrength;
  house_vs_adjacent_separation: HouseVsAdjacentSeparation;
  likely_single_building_focus: boolean;
  likely_multi_building_ambiguity: boolean;
  false_specificity_risk: "low" | "medium" | "high";
  max_safe_claim_level: "building_candidate" | "address_area" | "zone_only";
}

export interface HouseDiffSummary {
  overall_differentiation_status: OverallDifferentiationStatus;
  differentiation_reasoning: string;
  usable_for_building_level_review: boolean;
  still_zone_dominant: boolean;
  narrative_mode: DifferentiationNarrativeMode;
  limitations: string[];
}

export interface HouseDifferentiationResult {
  identity: HouseDiffIdentity;
  visual_signals: HouseDiffVisualSignals;
  address_alignment: HouseDiffAddressAlignment;
  specificity: HouseDiffSpecificity;
  summary: HouseDiffSummary;
}

/* ═══════════════════════════════════════════════════════════
   INPUT
   ═══════════════════════════════════════════════════════════ */

export interface HouseDifferentiationInput {
  /** Photo data URL present */
  photo_present: boolean;
  /** GPS coordinates present */
  geo_present: boolean;
  /** Lat for proximity checks */
  lat: number | null;
  lng: number | null;

  /** Address from identification */
  address_raw: string | null;

  /** From AddressResolutionEngine */
  address_resolution: {
    street_match_status: string;
    civic_match_status: string;
    official_street_support: boolean;
    official_civic_support: boolean;
    building_truth_support: false;
    ambiguity_level: string;
    overall_address_quality: string;
    false_specificity_risk: string;
  } | null;

  /** From BuildingProfileEngine — subset */
  building_profile: {
    building_truth_supported: boolean;
    address_fact_level: string;
    zone_geo_level: string;
    zone_geo_code: string;
  } | null;

  /** From identify API — visual hints */
  identify_hints: {
    confidence: number;
    building_type?: string | null;
    facade_visible?: boolean;
    entrance_visible?: boolean;
    civic_visible?: boolean;
    neighboring_visible?: boolean;
    signage_visible?: boolean;
  } | null;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE
   ═══════════════════════════════════════════════════════════ */

export function buildHouseDifferentiation(input: HouseDifferentiationInput): HouseDifferentiationResult {
  const {
    photo_present, geo_present, lat, lng,
    address_raw, address_resolution, building_profile, identify_hints,
  } = input;

  const zoneCode = building_profile?.zone_geo_code ?? "unknown";
  const zoneLevel = building_profile?.zone_geo_level ?? "unknown";

  // ── Identity ──
  const identity: HouseDiffIdentity = {
    zone_geo_code: zoneCode,
    zone_geo_level: zoneLevel,
    address_input_present: !!address_raw,
    photo_input_present: photo_present,
    geo_input_present: geo_present,
    differentiation_scope_label: buildScopeLabel(photo_present, geo_present, !!address_raw),
  };

  // ── Visual Signals ──
  const visual = buildVisualSignals(identify_hints, photo_present);

  // ── Address Alignment ──
  const alignment = buildAddressAlignment(address_resolution, geo_present, photo_present, visual);

  // ── Specificity ──
  const specificity = buildSpecificity(visual, alignment, address_resolution);

  // ── Summary ──
  const summary = buildSummary(specificity, visual, alignment);

  return { identity, visual_signals: visual, address_alignment: alignment, specificity, summary };
}

/* ═══════════════════════════════════════════════════════════
   BUILDERS
   ═══════════════════════════════════════════════════════════ */

function buildScopeLabel(photo: boolean, geo: boolean, address: boolean): string {
  const parts: string[] = [];
  if (photo) parts.push("foto");
  if (geo) parts.push("geolocalizzazione");
  if (address) parts.push("indirizzo");
  return parts.length > 0
    ? `Differenziazione basata su ${parts.join(" + ")}`
    : "Input insufficiente per la differenziazione";
}

function buildVisualSignals(
  hints: HouseDifferentiationInput["identify_hints"],
  photoPresent: boolean,
): HouseDiffVisualSignals {
  if (!photoPresent || !hints) {
    return {
      facade_detected: false,
      frontage_detected: false,
      entrance_visibility_status: "not_assessable",
      civic_visibility_status: "not_assessable",
      signage_visibility_status: "not_assessable",
      building_edge_confidence: 0,
      neighboring_buildings_presence: "not_assessable",
      visual_uniqueness_status: "not_assessable",
      visual_notes: ["Foto non disponibile — segnali visivi non valutabili"],
    };
  }

  const confidence = hints.confidence ?? 0;
  const facade = hints.facade_visible ?? (confidence >= 0.5);
  const entrance = hints.entrance_visible ?? false;
  const civic = hints.civic_visible ?? false;
  const neighboring = hints.neighboring_visible ?? false;
  const signage = hints.signage_visible ?? false;

  const edgeConf = Math.min(confidence, 1);
  const notes: string[] = [];

  // Determine visual uniqueness
  let uniqueness: VisualUniquenessStatus = "not_assessable";
  if (facade && edgeConf >= 0.6 && !neighboring) {
    uniqueness = "unique";
  } else if (facade && edgeConf >= 0.4) {
    uniqueness = neighboring ? "partially_unique" : "unique";
  } else if (facade) {
    uniqueness = "ambiguous";
    notes.push("Facciata rilevata ma con confidenza visiva limitata");
  } else {
    uniqueness = "not_assessable";
    notes.push("Facciata non chiaramente rilevata");
  }

  if (neighboring) {
    notes.push("Edifici adiacenti visibili nella foto");
  }
  if (civic) {
    notes.push("Numero civico visibile nella foto");
  }

  return {
    facade_detected: facade,
    frontage_detected: facade && edgeConf >= 0.4,
    entrance_visibility_status: entrance ? "visible" : "not_assessable",
    civic_visibility_status: civic ? "visible" : "not_assessable",
    signage_visibility_status: signage ? "visible" : "not_assessable",
    building_edge_confidence: edgeConf,
    neighboring_buildings_presence: neighboring ? "visible_contiguous" : (facade ? "none_visible" : "not_assessable"),
    visual_uniqueness_status: uniqueness,
    visual_notes: notes,
  };
}

function buildAddressAlignment(
  ar: HouseDifferentiationInput["address_resolution"],
  geoPresent: boolean,
  photoPresent: boolean,
  visual: HouseDiffVisualSignals,
): HouseDiffAddressAlignment {
  if (!ar) {
    return {
      street_support_status: "none",
      civic_support_status: "none",
      photo_address_alignment: "insufficient_alignment",
      geo_address_alignment: geoPresent ? "medium_alignment" : "insufficient_alignment",
      anncsu_alignment_status: "not_available",
      address_specificity_level: "none",
      address_alignment_notes: ["Risoluzione indirizzo non disponibile"],
    };
  }

  const streetSupport: HouseDiffAddressAlignment["street_support_status"] =
    ar.official_street_support ? "official" :
    ar.street_match_status.includes("normalized") ? "normalized" :
    ar.street_match_status === "not_found" ? "none" : "weak";

  const civicSupport: HouseDiffAddressAlignment["civic_support_status"] =
    ar.official_civic_support ? "official" :
    ar.civic_match_status.includes("candidate") ? "candidate" :
    ar.civic_match_status === "not_found" ? "none" : "weak";

  // Photo-address alignment depends on visual civic visibility + address quality
  let photoAlign: AlignmentLevel = "insufficient_alignment";
  if (photoPresent && visual.civic_visibility_status === "visible" && civicSupport !== "none") {
    photoAlign = "high_alignment";
  } else if (photoPresent && visual.facade_detected && streetSupport !== "none") {
    photoAlign = "medium_alignment";
  } else if (photoPresent && visual.facade_detected) {
    photoAlign = "low_alignment";
  }

  // Geo-address alignment
  let geoAlign: AlignmentLevel = "insufficient_alignment";
  if (geoPresent && ar.overall_address_quality === "strong") {
    geoAlign = "high_alignment";
  } else if (geoPresent && ar.overall_address_quality === "moderate") {
    geoAlign = "medium_alignment";
  } else if (geoPresent) {
    geoAlign = "low_alignment";
  }

  // ANNCSU
  const anncsu: HouseDiffAddressAlignment["anncsu_alignment_status"] =
    ar.official_street_support && ar.official_civic_support ? "aligned" :
    ar.official_street_support ? "partial" : "none";

  // Address specificity level
  const addrSpec: HouseDiffAddressAlignment["address_specificity_level"] =
    civicSupport === "official" || civicSupport === "candidate" ? "civic" :
    streetSupport !== "none" ? "street" : "none";

  const notes: string[] = [];
  if (ar.false_specificity_risk === "high") {
    notes.push("Rischio di falsa specificità elevato — indirizzo da trattare con cautela");
  }
  if (ar.ambiguity_level === "high" || ar.ambiguity_level === "critical") {
    notes.push("Ambiguità alta nella risoluzione dell'indirizzo");
  }

  return {
    street_support_status: streetSupport,
    civic_support_status: civicSupport,
    photo_address_alignment: photoAlign,
    geo_address_alignment: geoAlign,
    anncsu_alignment_status: anncsu,
    address_specificity_level: addrSpec,
    address_alignment_notes: notes,
  };
}

function buildSpecificity(
  visual: HouseDiffVisualSignals,
  alignment: HouseDiffAddressAlignment,
  ar: HouseDifferentiationInput["address_resolution"],
): HouseDiffSpecificity {
  // Score: visual signals + address alignment
  let score = 0;

  // Visual contribution (max 5)
  if (visual.facade_detected) score += 1;
  if (visual.frontage_detected) score += 1;
  if (visual.civic_visibility_status === "visible") score += 1;
  if (visual.entrance_visibility_status === "visible") score += 1;
  if (visual.visual_uniqueness_status === "unique") score += 1;
  else if (visual.visual_uniqueness_status === "partially_unique") score += 0.5;

  // Address contribution (max 4)
  if (alignment.civic_support_status === "official") score += 2;
  else if (alignment.civic_support_status === "candidate") score += 1;
  if (alignment.street_support_status === "official") score += 1;
  if (alignment.anncsu_alignment_status === "aligned") score += 1;

  // Alignment bonus (max 2)
  if (alignment.photo_address_alignment === "high_alignment") score += 1;
  if (alignment.geo_address_alignment === "high_alignment") score += 1;

  // Penalties
  if (visual.neighboring_buildings_presence === "visible_contiguous") score -= 1.5;
  if (ar?.false_specificity_risk === "high") score -= 2;
  if (ar?.ambiguity_level === "high" || ar?.ambiguity_level === "critical") score -= 1;

  // Clamp
  score = Math.max(score, 0);

  // Determine status
  let status: OverallDifferentiationStatus;
  let strength: SpecificityStrength;
  let separation: HouseVsAdjacentSeparation;

  if (score >= 7) {
    status = "strong_building_candidate";
    strength = "strong";
    separation = "likely_distinct";
  } else if (score >= 5) {
    status = "building_candidate_with_ambiguity";
    strength = "medium";
    separation = "partially_distinct";
  } else if (score >= 3) {
    status = "address_supported_but_visually_ambiguous";
    strength = "weak";
    separation = "visually_ambiguous";
  } else if (score >= 1) {
    status = "zone_only_context";
    strength = "insufficient";
    separation = "contiguous_context_only";
  } else {
    status = "not_determinable";
    strength = "insufficient";
    separation = "not_determinable";
  }

  // Override: if neighboring buildings are contiguous and no civic visible, cap at ambiguity
  if (visual.neighboring_buildings_presence === "visible_contiguous" &&
      visual.civic_visibility_status !== "visible" &&
      status === "strong_building_candidate") {
    status = "building_candidate_with_ambiguity";
    strength = "medium";
    separation = "partially_distinct";
  }

  const falseRisk: "low" | "medium" | "high" =
    score >= 7 ? "low" :
    score >= 4 ? "medium" : "high";

  return {
    specificity_status: status,
    specificity_strength: strength,
    house_vs_adjacent_separation: separation,
    likely_single_building_focus: status === "strong_building_candidate",
    likely_multi_building_ambiguity:
      separation === "visually_ambiguous" || separation === "contiguous_context_only",
    false_specificity_risk: falseRisk,
    max_safe_claim_level:
      status === "strong_building_candidate" ? "building_candidate" :
      status === "building_candidate_with_ambiguity" ? "address_area" :
      "zone_only",
  };
}

function buildSummary(
  specificity: HouseDiffSpecificity,
  visual: HouseDiffVisualSignals,
  alignment: HouseDiffAddressAlignment,
): HouseDiffSummary {
  const status = specificity.specificity_status;

  // Reasoning
  const reasonParts: string[] = [];
  if (visual.facade_detected) reasonParts.push("facciata rilevata");
  if (visual.civic_visibility_status === "visible") reasonParts.push("civico visibile");
  if (alignment.anncsu_alignment_status === "aligned") reasonParts.push("supporto ANNCSU coerente");
  if (visual.neighboring_buildings_presence === "visible_contiguous") reasonParts.push("edifici contigui visibili");
  if (alignment.photo_address_alignment === "high_alignment") reasonParts.push("allineamento foto-indirizzo alto");

  const reasoning = reasonParts.length > 0
    ? `Valutazione basata su: ${reasonParts.join(", ")}`
    : "Base insufficiente per la differenziazione";

  // Narrative mode
  let narrativeMode: DifferentiationNarrativeMode;
  if (status === "strong_building_candidate" || status === "building_candidate_with_ambiguity") {
    narrativeMode = "full";
  } else if (status === "address_supported_but_visually_ambiguous" || status === "zone_only_context") {
    narrativeMode = "partial";
  } else {
    narrativeMode = "hidden";
  }

  // Limitations
  const limitations: string[] = [];
  if (!visual.facade_detected) limitations.push("Facciata non chiaramente rilevata");
  if (visual.neighboring_buildings_presence === "visible_contiguous") {
    limitations.push("Edifici contigui rendono la distinzione più complessa");
  }
  if (alignment.civic_support_status === "none") {
    limitations.push("Nessun supporto civico nella risoluzione indirizzo");
  }
  if (specificity.false_specificity_risk === "high") {
    limitations.push("Rischio di falsa specificità — il risultato resta prevalentemente di zona");
  }
  limitations.push("La differenziazione non equivale a una identificazione catastale o giuridica");

  return {
    overall_differentiation_status: status,
    differentiation_reasoning: reasoning,
    usable_for_building_level_review: status === "strong_building_candidate" || status === "building_candidate_with_ambiguity",
    still_zone_dominant: status === "zone_only_context" || status === "not_determinable",
    narrative_mode: narrativeMode,
    limitations,
  };
}

/* ═══════════════════════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════════════════════ */

export function differentiationStatusLabel(s: OverallDifferentiationStatus): string {
  const m: Record<OverallDifferentiationStatus, string> = {
    strong_building_candidate: "Immobile probabilmente distinto",
    building_candidate_with_ambiguity: "Candidato con ambiguità",
    address_supported_but_visually_ambiguous: "Indirizzo supportato, visivamente ambiguo",
    zone_only_context: "Lettura prevalentemente di zona",
    not_determinable: "Non determinabile",
  };
  return m[s];
}

export function specificityStrengthLabel(s: SpecificityStrength): string {
  const m: Record<SpecificityStrength, string> = {
    strong: "Alta",
    medium: "Media",
    weak: "Bassa",
    insufficient: "Non sufficiente",
  };
  return m[s];
}

export function specificityStrengthColor(s: SpecificityStrength): string {
  const m: Record<SpecificityStrength, string> = {
    strong: "text-emerald-400",
    medium: "text-primary",
    weak: "text-amber-400",
    insufficient: "text-muted-foreground",
  };
  return m[s];
}

export function separationLabel(s: HouseVsAdjacentSeparation): string {
  const m: Record<HouseVsAdjacentSeparation, string> = {
    likely_distinct: "Probabilmente distinto dal contesto adiacente",
    partially_distinct: "Parzialmente distinto",
    visually_ambiguous: "Visivamente ambiguo tra edifici vicini",
    contiguous_context_only: "Contesto contiguo — distinzione non possibile",
    not_determinable: "Non determinabile",
  };
  return m[s];
}

export function narrativeModeLabel(m: DifferentiationNarrativeMode): string {
  const labels: Record<DifferentiationNarrativeMode, string> = {
    full: "Completa",
    partial: "Parziale",
    hidden: "Non disponibile",
  };
  return labels[m];
}
