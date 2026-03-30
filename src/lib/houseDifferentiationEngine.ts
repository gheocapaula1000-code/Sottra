/**
 * House Differentiation Engine — Sottra (Boosted)
 *
 * Evaluates how well a photographed building can be distinguished
 * from adjacent ones, using photo, geo, address, and zone data.
 *
 * CRITICAL CONSTRAINTS:
 * - building_truth_support stays FALSE
 * - "strong_building_candidate" ≠ verified building truth
 * - No invented cadastral/legal/structural data
 * - No false specificity from fallback or ambiguous signals
 * - strong candidate requires CONVERGENCE of multiple signal sources
 * - NO single-source promotion
 */

/* ═══════════════════════════════════════════════════════════
   STATUS TAXONOMY (Boosted — finer granularity)
   ═══════════════════════════════════════════════════════════ */

export type OverallDifferentiationStatus =
  | "strong_building_candidate"
  | "building_candidate_with_limited_ambiguity"
  | "building_candidate_with_ambiguity"
  | "address_supported_but_visually_ambiguous"
  | "visually_ambiguous_context"
  | "zone_only_context"
  | "not_determinable";

export type SpecificityStrength = "strong" | "medium" | "weak" | "insufficient";

export type HouseVsAdjacentSeparation =
  | "likely_distinct"
  | "moderately_distinct"
  | "weakly_distinct"
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

export type SignalStrength = "strong" | "medium" | "weak" | "not_determinable";

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

/** Boosted visual structure signals */
export interface VisualStructureSignals {
  single_facade_likelihood: SignalStrength;
  multi_facade_likelihood: SignalStrength;
  continuous_building_row_presence: SignalStrength;
  detached_building_likelihood: SignalStrength;
  entrance_prominence: SignalStrength;
  gate_or_access_visibility: SignalStrength;
  civic_plate_visibility: SignalStrength;
  storefront_or_signage_presence: SignalStrength;
  corner_building_hint: SignalStrength;
  frontage_clarity: SignalStrength;
}

/** Context separation signals */
export interface ContextSeparationSignals {
  neighboring_buildings_count_hint: "none" | "few" | "many" | "not_determinable";
  left_right_boundary_clarity: SignalStrength;
  facade_width_hint: "narrow" | "medium" | "wide" | "not_determinable";
  immediate_context_clutter: "low" | "medium" | "high" | "not_determinable";
  visual_focus_strength: SignalStrength;
  likely_same_building_extent: SignalStrength;
  likely_adjacent_building_confusion: SignalStrength;
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
  /** Boosted structure signals */
  structure: VisualStructureSignals;
  /** Boosted context separation */
  context_separation: ContextSeparationSignals;
}

/** Boosted alignment diagnostics */
export interface AlignmentDiagnostics {
  photo_geo_alignment: AlignmentLevel;
  photo_address_alignment: AlignmentLevel;
  geo_address_alignment: AlignmentLevel;
  anncsu_photo_alignment: AlignmentLevel;
  overall_alignment_status: AlignmentLevel;
  alignment_conflict_flags: string[];
  alignment_notes: string[];
}

export interface HouseDiffAddressAlignment {
  street_support_status: "official" | "normalized" | "weak" | "none";
  civic_support_status: "official" | "candidate" | "weak" | "none";
  photo_address_alignment: AlignmentLevel;
  geo_address_alignment: AlignmentLevel;
  anncsu_alignment_status: "aligned" | "partial" | "none" | "not_available";
  address_specificity_level: "civic" | "street" | "zone" | "none";
  address_alignment_notes: string[];
  /** Boosted alignment diagnostics */
  diagnostics: AlignmentDiagnostics;
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
  photo_present: boolean;
  geo_present: boolean;
  lat: number | null;
  lng: number | null;
  address_raw: string | null;
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
  building_profile: {
    building_truth_supported: boolean;
    address_fact_level: string;
    zone_geo_level: string;
    zone_geo_code: string;
  } | null;
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
    photo_present, geo_present,
    address_raw, address_resolution, building_profile, identify_hints,
  } = input;

  const zoneCode = building_profile?.zone_geo_code ?? "unknown";
  const zoneLevel = building_profile?.zone_geo_level ?? "unknown";

  const identity: HouseDiffIdentity = {
    zone_geo_code: zoneCode,
    zone_geo_level: zoneLevel,
    address_input_present: !!address_raw,
    photo_input_present: photo_present,
    geo_input_present: geo_present,
    differentiation_scope_label: buildScopeLabel(photo_present, geo_present, !!address_raw),
  };

  const visual = buildVisualSignals(identify_hints, photo_present);
  const alignment = buildAddressAlignment(address_resolution, geo_present, photo_present, visual);
  const specificity = buildSpecificity(visual, alignment, address_resolution, photo_present, geo_present);
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
  const nullStructure: VisualStructureSignals = {
    single_facade_likelihood: "not_determinable",
    multi_facade_likelihood: "not_determinable",
    continuous_building_row_presence: "not_determinable",
    detached_building_likelihood: "not_determinable",
    entrance_prominence: "not_determinable",
    gate_or_access_visibility: "not_determinable",
    civic_plate_visibility: "not_determinable",
    storefront_or_signage_presence: "not_determinable",
    corner_building_hint: "not_determinable",
    frontage_clarity: "not_determinable",
  };
  const nullContext: ContextSeparationSignals = {
    neighboring_buildings_count_hint: "not_determinable",
    left_right_boundary_clarity: "not_determinable",
    facade_width_hint: "not_determinable",
    immediate_context_clutter: "not_determinable",
    visual_focus_strength: "not_determinable",
    likely_same_building_extent: "not_determinable",
    likely_adjacent_building_confusion: "not_determinable",
  };

  if (!photoPresent || !hints) {
    return {
      facade_detected: false, frontage_detected: false,
      entrance_visibility_status: "not_assessable",
      civic_visibility_status: "not_assessable",
      signage_visibility_status: "not_assessable",
      building_edge_confidence: 0,
      neighboring_buildings_presence: "not_assessable",
      visual_uniqueness_status: "not_assessable",
      visual_notes: ["Foto non disponibile — segnali visivi non valutabili"],
      structure: nullStructure, context_separation: nullContext,
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

  // Visual uniqueness
  let uniqueness: VisualUniquenessStatus = "not_assessable";
  if (facade && edgeConf >= 0.6 && !neighboring) {
    uniqueness = "unique";
  } else if (facade && edgeConf >= 0.4) {
    uniqueness = neighboring ? "partially_unique" : "unique";
  } else if (facade) {
    uniqueness = "ambiguous";
    notes.push("Facciata rilevata ma con confidenza visiva limitata");
  } else {
    notes.push("Facciata non chiaramente rilevata");
  }

  if (neighboring) notes.push("Edifici adiacenti visibili nella foto");
  if (civic) notes.push("Numero civico visibile nella foto");

  // ── Boosted structure signals ──
  const structure: VisualStructureSignals = {
    single_facade_likelihood:
      facade && !neighboring && edgeConf >= 0.6 ? "strong" :
      facade && !neighboring ? "medium" :
      facade && neighboring ? "weak" : "not_determinable",
    multi_facade_likelihood:
      neighboring && facade ? "medium" :
      neighboring ? "strong" : "not_determinable",
    continuous_building_row_presence:
      neighboring ? "medium" : "not_determinable",
    detached_building_likelihood:
      facade && !neighboring && edgeConf >= 0.7 ? "strong" :
      facade && !neighboring && edgeConf >= 0.5 ? "medium" : "not_determinable",
    entrance_prominence:
      entrance ? (edgeConf >= 0.6 ? "strong" : "medium") : "not_determinable",
    gate_or_access_visibility:
      entrance ? "medium" : "not_determinable",
    civic_plate_visibility:
      civic ? "strong" : "not_determinable",
    storefront_or_signage_presence:
      signage ? "medium" : "not_determinable",
    corner_building_hint: "not_determinable", // requires multi-angle — never invent
    frontage_clarity:
      facade && edgeConf >= 0.7 ? "strong" :
      facade && edgeConf >= 0.4 ? "medium" :
      facade ? "weak" : "not_determinable",
  };

  // ── Context separation ──
  const contextSep: ContextSeparationSignals = {
    neighboring_buildings_count_hint:
      !neighboring ? "none" :
      edgeConf < 0.5 ? "many" : "few",
    left_right_boundary_clarity:
      !neighboring && facade && edgeConf >= 0.6 ? "strong" :
      facade && edgeConf >= 0.4 ? "medium" : "weak",
    facade_width_hint: "not_determinable", // can't estimate real width from photo
    immediate_context_clutter:
      neighboring && edgeConf < 0.5 ? "high" :
      neighboring ? "medium" : "low",
    visual_focus_strength:
      facade && edgeConf >= 0.7 && !neighboring ? "strong" :
      facade && edgeConf >= 0.4 ? "medium" : "weak",
    likely_same_building_extent:
      facade && !neighboring ? "strong" : "weak",
    likely_adjacent_building_confusion:
      neighboring && !civic ? "strong" :
      neighboring && civic ? "medium" : "not_determinable",
  };

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
    structure,
    context_separation: contextSep,
  };
}

function buildAddressAlignment(
  ar: HouseDifferentiationInput["address_resolution"],
  geoPresent: boolean,
  photoPresent: boolean,
  visual: HouseDiffVisualSignals,
): HouseDiffAddressAlignment {
  if (!ar) {
    const emptyDiag: AlignmentDiagnostics = {
      photo_geo_alignment: geoPresent && photoPresent ? "medium_alignment" : "insufficient_alignment",
      photo_address_alignment: "insufficient_alignment",
      geo_address_alignment: geoPresent ? "medium_alignment" : "insufficient_alignment",
      anncsu_photo_alignment: "insufficient_alignment",
      overall_alignment_status: "insufficient_alignment",
      alignment_conflict_flags: [],
      alignment_notes: ["Risoluzione indirizzo non disponibile"],
    };
    return {
      street_support_status: "none", civic_support_status: "none",
      photo_address_alignment: "insufficient_alignment",
      geo_address_alignment: geoPresent ? "medium_alignment" : "insufficient_alignment",
      anncsu_alignment_status: "not_available",
      address_specificity_level: "none",
      address_alignment_notes: ["Risoluzione indirizzo non disponibile"],
      diagnostics: emptyDiag,
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

  // Photo-address alignment — STRICTER
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

  // ANNCSU-photo alignment — new
  let anncsuPhotoAlign: AlignmentLevel = "insufficient_alignment";
  if (anncsu === "aligned" && visual.civic_visibility_status === "visible") {
    anncsuPhotoAlign = "high_alignment";
  } else if (anncsu === "partial" && visual.facade_detected) {
    anncsuPhotoAlign = "medium_alignment";
  } else if (anncsu !== "not_available" && anncsu !== "none") {
    anncsuPhotoAlign = "low_alignment";
  }

  // Photo-geo alignment
  let photoGeoAlign: AlignmentLevel = "insufficient_alignment";
  if (photoPresent && geoPresent && visual.facade_detected && ar.overall_address_quality === "strong") {
    photoGeoAlign = "high_alignment";
  } else if (photoPresent && geoPresent && visual.facade_detected) {
    photoGeoAlign = "medium_alignment";
  } else if (photoPresent && geoPresent) {
    photoGeoAlign = "low_alignment";
  }

  // Address specificity
  const addrSpec: HouseDiffAddressAlignment["address_specificity_level"] =
    civicSupport === "official" || civicSupport === "candidate" ? "civic" :
    streetSupport !== "none" ? "street" : "none";

  // ── Conflict detection ──
  const conflictFlags: string[] = [];
  const diagNotes: string[] = [];

  if (ar.false_specificity_risk === "high") {
    conflictFlags.push("false_specificity_risk_high");
    diagNotes.push("Rischio di falsa specificità elevato — indirizzo da trattare con cautela");
  }
  if (ar.ambiguity_level === "high" || ar.ambiguity_level === "critical") {
    conflictFlags.push("address_ambiguity_high");
    diagNotes.push("Ambiguità alta nella risoluzione dell'indirizzo");
  }
  // Conflicting: photo facade detected but geo/address weak
  if (visual.facade_detected && geoAlign === "low_alignment" && photoAlign === "low_alignment") {
    conflictFlags.push("photo_strong_address_weak");
    diagNotes.push("Foto mostra facciata ma l'indirizzo è debole");
  }
  // Conflicting: address strong but photo vague
  if (!visual.facade_detected && geoAlign === "high_alignment") {
    conflictFlags.push("address_strong_photo_vague");
    diagNotes.push("Indirizzo forte ma la foto non mostra facciata chiara");
  }

  // ── Overall alignment — requires convergence ──
  const alignScores: number[] = [
    photoAlign === "high_alignment" ? 3 : photoAlign === "medium_alignment" ? 2 : photoAlign === "low_alignment" ? 1 : 0,
    geoAlign === "high_alignment" ? 3 : geoAlign === "medium_alignment" ? 2 : geoAlign === "low_alignment" ? 1 : 0,
    anncsuPhotoAlign === "high_alignment" ? 3 : anncsuPhotoAlign === "medium_alignment" ? 2 : anncsuPhotoAlign === "low_alignment" ? 1 : 0,
    photoGeoAlign === "high_alignment" ? 3 : photoGeoAlign === "medium_alignment" ? 2 : photoGeoAlign === "low_alignment" ? 1 : 0,
  ];
  const avgAlign = alignScores.reduce((a, b) => a + b, 0) / alignScores.length;
  let overallAlign: AlignmentLevel;
  if (conflictFlags.length > 0 && avgAlign < 2) {
    overallAlign = "conflicting_alignment";
  } else if (avgAlign >= 2.5) {
    overallAlign = "high_alignment";
  } else if (avgAlign >= 1.5) {
    overallAlign = "medium_alignment";
  } else if (avgAlign >= 0.5) {
    overallAlign = "low_alignment";
  } else {
    overallAlign = "insufficient_alignment";
  }

  const diagnostics: AlignmentDiagnostics = {
    photo_geo_alignment: photoGeoAlign,
    photo_address_alignment: photoAlign,
    geo_address_alignment: geoAlign,
    anncsu_photo_alignment: anncsuPhotoAlign,
    overall_alignment_status: overallAlign,
    alignment_conflict_flags: conflictFlags,
    alignment_notes: diagNotes,
  };

  return {
    street_support_status: streetSupport,
    civic_support_status: civicSupport,
    photo_address_alignment: photoAlign,
    geo_address_alignment: geoAlign,
    anncsu_alignment_status: anncsu,
    address_specificity_level: addrSpec,
    address_alignment_notes: diagNotes,
    diagnostics,
  };
}

function buildSpecificity(
  visual: HouseDiffVisualSignals,
  alignment: HouseDiffAddressAlignment,
  ar: HouseDifferentiationInput["address_resolution"],
  photoPresent: boolean,
  geoPresent: boolean,
): HouseDiffSpecificity {
  // ── CONVERGENCE-based scoring ──
  // Three independent signal sources: visual, address, geo-alignment
  let visualScore = 0;   // max ~5
  let addressScore = 0;  // max ~4
  let alignScore = 0;    // max ~3

  // Visual contribution
  if (visual.facade_detected) visualScore += 1;
  if (visual.frontage_detected) visualScore += 0.5;
  if (visual.civic_visibility_status === "visible") visualScore += 1.5;
  if (visual.entrance_visibility_status === "visible") visualScore += 0.5;
  if (visual.visual_uniqueness_status === "unique") visualScore += 1.5;
  else if (visual.visual_uniqueness_status === "partially_unique") visualScore += 0.5;

  // Structure bonus
  if (visual.structure.single_facade_likelihood === "strong") visualScore += 0.5;
  if (visual.context_separation.visual_focus_strength === "strong") visualScore += 0.5;

  // Address contribution
  if (alignment.civic_support_status === "official") addressScore += 2;
  else if (alignment.civic_support_status === "candidate") addressScore += 1;
  if (alignment.street_support_status === "official") addressScore += 1;
  if (alignment.anncsu_alignment_status === "aligned") addressScore += 1;

  // Alignment contribution
  const diag = alignment.diagnostics;
  if (diag.overall_alignment_status === "high_alignment") alignScore += 3;
  else if (diag.overall_alignment_status === "medium_alignment") alignScore += 2;
  else if (diag.overall_alignment_status === "low_alignment") alignScore += 1;

  // ── PENALTIES ──
  // Contiguous buildings
  if (visual.neighboring_buildings_presence === "visible_contiguous") {
    visualScore -= 1.5;
  }
  // Adjacent building confusion
  if (visual.context_separation.likely_adjacent_building_confusion === "strong") {
    visualScore -= 1;
  }
  // Context clutter
  if (visual.context_separation.immediate_context_clutter === "high") {
    visualScore -= 0.5;
  }
  // False specificity risk
  if (ar?.false_specificity_risk === "high") addressScore -= 2;
  if (ar?.ambiguity_level === "high" || ar?.ambiguity_level === "critical") addressScore -= 1;
  // Conflict penalty
  if (diag.alignment_conflict_flags.length > 0) alignScore -= 1;

  // Clamp
  visualScore = Math.max(visualScore, 0);
  addressScore = Math.max(addressScore, 0);
  alignScore = Math.max(alignScore, 0);

  const totalScore = visualScore + addressScore + alignScore;

  // ── CONVERGENCE CHECK — no single-source promotion ──
  const sourcesAboveThreshold =
    (visualScore >= 2 ? 1 : 0) +
    (addressScore >= 2 ? 1 : 0) +
    (alignScore >= 1.5 ? 1 : 0);

  // Determine status
  let status: OverallDifferentiationStatus;
  let strength: SpecificityStrength;
  let separation: HouseVsAdjacentSeparation;

  if (totalScore >= 8 && sourcesAboveThreshold >= 2) {
    status = "strong_building_candidate";
    strength = "strong";
    separation = "likely_distinct";
  } else if (totalScore >= 6 && sourcesAboveThreshold >= 2) {
    status = "building_candidate_with_limited_ambiguity";
    strength = "medium";
    separation = "moderately_distinct";
  } else if (totalScore >= 5) {
    status = "building_candidate_with_ambiguity";
    strength = "medium";
    separation = "weakly_distinct";
  } else if (totalScore >= 3) {
    status = "address_supported_but_visually_ambiguous";
    strength = "weak";
    separation = "visually_ambiguous";
  } else if (totalScore >= 1.5) {
    status = "visually_ambiguous_context";
    strength = "weak";
    separation = "visually_ambiguous";
  } else if (totalScore >= 0.5) {
    status = "zone_only_context";
    strength = "insufficient";
    separation = "contiguous_context_only";
  } else {
    status = "not_determinable";
    strength = "insufficient";
    separation = "not_determinable";
  }

  // ══ ANTI-FALSE-DISTINCTION OVERRIDES ══

  // 1. Contiguous + no civic visible = cap at ambiguity
  if (visual.neighboring_buildings_presence === "visible_contiguous" &&
      visual.civic_visibility_status !== "visible" &&
      (status === "strong_building_candidate" || status === "building_candidate_with_limited_ambiguity")) {
    status = "building_candidate_with_ambiguity";
    strength = "medium";
    separation = "weakly_distinct";
  }

  // 2. Multiple buildings in frame + weak visual focus = downgrade
  if (visual.context_separation.likely_adjacent_building_confusion === "strong" &&
      visual.context_separation.visual_focus_strength !== "strong") {
    if (status === "strong_building_candidate" || status === "building_candidate_with_limited_ambiguity") {
      status = "building_candidate_with_ambiguity";
      strength = "medium";
      separation = "weakly_distinct";
    }
  }

  // 3. Visual focus weak = never strong candidate
  if (visual.context_separation.visual_focus_strength === "weak" &&
      status === "strong_building_candidate") {
    status = "building_candidate_with_limited_ambiguity";
    strength = "medium";
    separation = "moderately_distinct";
  }

  // 4. Photo present but no facade = cap
  if (photoPresent && !visual.facade_detected &&
      (status === "strong_building_candidate" || status === "building_candidate_with_limited_ambiguity")) {
    status = "address_supported_but_visually_ambiguous";
    strength = "weak";
    separation = "visually_ambiguous";
  }

  // 5. Single-source promotion block (ANNCSU alone, geo alone, photo alone)
  if (sourcesAboveThreshold < 2 &&
      (status === "strong_building_candidate" || status === "building_candidate_with_limited_ambiguity")) {
    status = "building_candidate_with_ambiguity";
    strength = "medium";
    separation = "weakly_distinct";
  }

  const falseRisk: "low" | "medium" | "high" =
    status === "strong_building_candidate" && sourcesAboveThreshold >= 2 ? "low" :
    totalScore >= 5 ? "medium" : "high";

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
      status === "building_candidate_with_limited_ambiguity" ? "building_candidate" :
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

  const reasonParts: string[] = [];
  if (visual.facade_detected) reasonParts.push("facciata rilevata");
  if (visual.civic_visibility_status === "visible") reasonParts.push("civico visibile");
  if (alignment.anncsu_alignment_status === "aligned") reasonParts.push("supporto ANNCSU coerente");
  if (visual.neighboring_buildings_presence === "visible_contiguous") reasonParts.push("edifici contigui visibili");
  if (alignment.diagnostics.overall_alignment_status === "high_alignment") reasonParts.push("allineamento convergente alto");
  if (visual.structure.single_facade_likelihood === "strong") reasonParts.push("facciata singola probabile");
  if (alignment.diagnostics.alignment_conflict_flags.length > 0) reasonParts.push("conflitti di allineamento rilevati");

  const reasoning = reasonParts.length > 0
    ? `Valutazione basata su: ${reasonParts.join(", ")}`
    : "Base insufficiente per la differenziazione";

  // Narrative mode
  let narrativeMode: DifferentiationNarrativeMode;
  if (status === "strong_building_candidate" || status === "building_candidate_with_limited_ambiguity" || status === "building_candidate_with_ambiguity") {
    narrativeMode = "full";
  } else if (status === "address_supported_but_visually_ambiguous" || status === "visually_ambiguous_context" || status === "zone_only_context") {
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
  if (visual.context_separation.likely_adjacent_building_confusion === "strong") {
    limitations.push("Possibile confusione con edifici adiacenti");
  }
  if (alignment.civic_support_status === "none") {
    limitations.push("Nessun supporto civico nella risoluzione indirizzo");
  }
  if (alignment.diagnostics.alignment_conflict_flags.length > 0) {
    limitations.push("Conflitti di allineamento tra foto, geo e indirizzo");
  }
  if (specificity.false_specificity_risk === "high") {
    limitations.push("Rischio di falsa specificità — il risultato resta prevalentemente di zona");
  }
  limitations.push("La differenziazione non equivale a una identificazione catastale o giuridica");

  return {
    overall_differentiation_status: status,
    differentiation_reasoning: reasoning,
    usable_for_building_level_review:
      status === "strong_building_candidate" ||
      status === "building_candidate_with_limited_ambiguity" ||
      status === "building_candidate_with_ambiguity",
    still_zone_dominant:
      status === "zone_only_context" || status === "visually_ambiguous_context" || status === "not_determinable",
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
    building_candidate_with_limited_ambiguity: "Candidato con ambiguità limitata",
    building_candidate_with_ambiguity: "Candidato con ambiguità",
    address_supported_but_visually_ambiguous: "Indirizzo supportato, visivamente ambiguo",
    visually_ambiguous_context: "Contesto visivamente ambiguo",
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
    moderately_distinct: "Moderatamente distinto",
    weakly_distinct: "Debolmente distinto",
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
