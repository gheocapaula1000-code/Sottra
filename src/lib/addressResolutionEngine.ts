/**
 * Address Resolution Engine — Sottra Phase 5
 *
 * Provides rigorous address/civic normalization and resolution
 * WITHOUT promoting geocoding or text parsing to building truth.
 *
 * Every match is explicitly qualified with method, confidence,
 * ambiguity level, and support status.
 */

import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel } from "@/lib/geoBackbone";
import type { FactSupportLevel } from "@/lib/buildingProfileEngine";

/* ═══════════════════════════════════════════════════════════
   ADDRESS STATUS TAXONOMY
   ═══════════════════════════════════════════════════════════ */

export type StreetMatchStatus =
  | "exact_match"
  | "normalized_match"
  | "fuzzy_match"
  | "coordinate_assisted"
  | "contextual_only"
  | "not_found"
  | "not_determinable"
  | "unsupported_claim";

export type CivicMatchStatus =
  | "exact_match"
  | "partial_match"
  | "ambiguous"
  | "not_found"
  | "not_determinable"
  | "not_introduced_from_source"
  | "unsupported_claim";

export type AddressResolutionStatus =
  | "resolved"
  | "partially_resolved"
  | "unresolved"
  | "degraded"
  | "not_determinable";

export type AmbiguityLevel = "none" | "low" | "medium" | "high" | "critical";

/* ═══════════════════════════════════════════════════════════
   ADDRESS IDENTITY
   ═══════════════════════════════════════════════════════════ */

export interface AddressIdentity {
  raw_input: string;
  normalized_address_string: string;
  normalized_street_name: string | null;
  normalized_street_type: string | null;
  normalized_locality: string | null;
  normalized_comune: string | null;
  normalized_province: string | null;
  normalized_region: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS NORMALIZATION
   ═══════════════════════════════════════════════════════════ */

export interface AddressNormalization {
  normalization_applied: string[];
  tokens_removed: string[];
  tokens_standardized: string[];
  house_number_raw: string | null;
  house_number_normalized: string | null;
  staircase_raw: string | null;
  internal_raw: string | null;
  unresolved_tokens: string[];
  ambiguity_flags: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS RESOLUTION
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolution {
  resolution_status: AddressResolutionStatus;
  matched_geo_scope: CanonicalGeoLevel;
  matched_street_status: StreetMatchStatus;
  matched_street_name: string | null;
  matched_street_confidence: number;
  matched_by: "exact" | "normalized" | "fuzzy" | "coordinate_assisted" | "contextual_only" | "none";
  candidate_count: number;
  ambiguity_level: AmbiguityLevel;
  geo_anchor: string | null;
  territorial_anchor: string | null;
  building_anchor: string | null;
  unresolved_reason: string | null;
}

/* ═══════════════════════════════════════════════════════════
   CIVIC RESOLUTION
   ═══════════════════════════════════════════════════════════ */

export interface CivicResolution {
  civic_status: CivicMatchStatus;
  civic_input_present: boolean;
  civic_normalized: string | null;
  civic_match_status: CivicMatchStatus;
  civic_confidence: number;
  civic_ambiguity: AmbiguityLevel;
  civic_supported_as_precise_location: boolean;
  civic_supported_as_building_truth: boolean;
  civic_reasoning_summary: string;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS QUALITY
   ═══════════════════════════════════════════════════════════ */

export interface AddressQuality {
  overall_address_quality: "strong" | "moderate" | "weak" | "none";
  street_match_strength: "strong" | "moderate" | "weak" | "none";
  civic_match_strength: "strong" | "moderate" | "weak" | "none";
  source_chain_clarity: "high" | "medium" | "low";
  geocoding_dependency_level: "none" | "low" | "medium" | "high";
  overprecision_risk: "low" | "medium" | "high";
  false_specificity_risk: "low" | "medium" | "high";
  key_warnings: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS LIMITATIONS
   ═══════════════════════════════════════════════════════════ */

export interface AddressLimitations {
  missing_official_address_registry: boolean;
  missing_civic_registry: boolean;
  ambiguous_street_name: boolean;
  duplicate_candidates: boolean;
  geocoding_only: boolean;
  text_only: boolean;
  no_precise_building_link: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS SUMMARY
   ═══════════════════════════════════════════════════════════ */

export interface AddressSummary {
  executive_summary: string;
  analytical_summary: string;
  safe_user_summary: string;
  next_best_step: string;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS REPORTABILITY
   ═══════════════════════════════════════════════════════════ */

export type AddressReportSectionKey =
  | "address_precision"
  | "street_match"
  | "civic_match"
  | "address_limitations"
  | "false_precision_risk";

export interface AddressSectionReportability {
  can_render: boolean;
  render_mode: "full" | "partial" | "hidden";
  reason: string;
  source_basis: string | null;
}

export interface AddressReportability {
  sections: Record<AddressReportSectionKey, AddressSectionReportability>;
}

/* ═══════════════════════════════════════════════════════════
   FULL ADDRESS RESOLUTION RESULT
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolutionResult {
  address_identity: AddressIdentity;
  address_normalization: AddressNormalization;
  address_resolution: AddressResolution;
  civic_resolution: CivicResolution;
  address_quality: AddressQuality;
  address_limitations: AddressLimitations;
  address_summary: AddressSummary;
  address_reportability: AddressReportability;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE INPUT
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolutionInput {
  raw_address: string;
  comune?: string | null;
  provincia?: string | null;
  regione?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Already-resolved geo level from backbone */
  resolved_geo_level?: CanonicalGeoLevel | null;
}

/* ═══════════════════════════════════════════════════════════
   ITALIAN STREET TYPE NORMALIZATION
   ═══════════════════════════════════════════════════════════ */

const STREET_TYPE_MAP: Record<string, string> = {
  "v.": "Via", "v": "Via", "via": "Via",
  "vle": "Viale", "viale": "Viale", "v.le": "Viale",
  "c.so": "Corso", "corso": "Corso",
  "p.za": "Piazza", "p.zza": "Piazza", "piazza": "Piazza", "pza": "Piazza",
  "l.go": "Largo", "largo": "Largo",
  "vic.": "Vicolo", "vicolo": "Vicolo",
  "str.": "Strada", "strada": "Strada",
  "c.le": "Cortile", "cortile": "Cortile",
  "p.le": "Piazzale", "piazzale": "Piazzale",
  "s.da": "Strada",
  "trav.": "Traversa", "traversa": "Traversa",
  "borgata": "Borgata",
  "contrada": "Contrada", "c.da": "Contrada",
  "loc.": "Località", "località": "Località", "localita": "Località",
  "fraz.": "Frazione", "frazione": "Frazione",
};

const NOISE_TOKENS = new Set([
  "italia", "italy", "it", "snc", "s.n.c.", "s.n.c",
  "int.", "interno", "sc.", "scala", "piano", "p.",
]);

/* ═══════════════════════════════════════════════════════════
   NORMALIZATION LOGIC
   ═══════════════════════════════════════════════════════════ */

interface ParsedAddress {
  streetType: string | null;
  streetName: string | null;
  houseNumber: string | null;
  staircaseRaw: string | null;
  internalRaw: string | null;
  locality: string | null;
  normalized: string;
  applied: string[];
  removed: string[];
  standardized: string[];
  unresolved: string[];
  ambiguityFlags: string[];
}

function parseAndNormalize(raw: string, comune?: string | null): ParsedAddress {
  const applied: string[] = [];
  const removed: string[] = [];
  const standardized: string[] = [];
  const unresolved: string[] = [];
  const ambiguityFlags: string[] = [];

  if (!raw || !raw.trim()) {
    return {
      streetType: null, streetName: null, houseNumber: null,
      staircaseRaw: null, internalRaw: null, locality: null,
      normalized: "", applied: [], removed: [], standardized: [],
      unresolved: ["input_vuoto"], ambiguityFlags: ["no_input"],
    };
  }

  // 1. Basic cleanup
  let text = raw.trim();
  text = text.replace(/\s+/g, " ");
  text = text.replace(/[""]/g, '"');
  applied.push("whitespace_normalization");

  // 2. Remove trailing country/region noise
  const lowerFull = text.toLowerCase();
  for (const noise of NOISE_TOKENS) {
    if (lowerFull.endsWith(` ${noise}`) || lowerFull === noise) {
      text = text.slice(0, text.length - noise.length).trim().replace(/,\s*$/, "");
      removed.push(noise);
    }
  }

  // 3. Split by comma for multi-part addresses
  const parts = text.split(",").map(p => p.trim()).filter(Boolean);
  let mainPart = parts[0] || "";
  const extraParts = parts.slice(1);

  // 4. Extract staircase / internal from extra parts
  let staircaseRaw: string | null = null;
  let internalRaw: string | null = null;
  for (const ep of extraParts) {
    const lower = ep.toLowerCase();
    if (/^(sc\.?|scala)\s/i.test(lower)) {
      staircaseRaw = ep;
    } else if (/^(int\.?|interno)\s/i.test(lower)) {
      internalRaw = ep;
    }
  }

  // 5. Extract house number (last token if numeric-like)
  let houseNumber: string | null = null;
  const mainTokens = mainPart.split(/\s+/);
  if (mainTokens.length >= 2) {
    const last = mainTokens[mainTokens.length - 1];
    // Match patterns like "12", "12A", "12/B", "12bis"
    if (/^\d+[a-zA-Z\/]*$/.test(last) || /^\d+\s*bis$/i.test(last)) {
      houseNumber = last;
      mainTokens.pop();
      mainPart = mainTokens.join(" ");
    }
  }

  // 6. Extract and normalize street type
  let streetType: string | null = null;
  if (mainTokens.length >= 1) {
    const firstLower = mainTokens[0].toLowerCase().replace(/\.$/, "").replace(/\.$/, "");
    const firstWithDot = mainTokens[0].toLowerCase();
    const mapped = STREET_TYPE_MAP[firstLower] || STREET_TYPE_MAP[firstWithDot];
    if (mapped) {
      streetType = mapped;
      mainTokens.shift();
      standardized.push(`${firstLower} → ${mapped}`);
      applied.push("street_type_normalization");
    }
  }

  // 7. Remaining tokens = street name
  const streetName = mainTokens.join(" ").trim() || null;

  // 8. Build normalized string
  const normalizedParts: string[] = [];
  if (streetType) normalizedParts.push(streetType);
  if (streetName) normalizedParts.push(streetName);
  if (houseNumber) normalizedParts.push(houseNumber);
  const normalized = normalizedParts.join(" ");

  // 9. Detect ambiguity
  if (!streetType && streetName) {
    ambiguityFlags.push("tipo_strada_mancante");
  }
  if (streetName && streetName.length <= 2) {
    ambiguityFlags.push("nome_strada_troppo_corto");
  }
  if (!houseNumber) {
    ambiguityFlags.push("civico_assente");
  }
  if (extraParts.length > 2) {
    ambiguityFlags.push("indirizzo_complesso");
  }

  // 10. Locality from extra parts (non staircase/internal)
  let locality: string | null = null;
  for (const ep of extraParts) {
    const lower = ep.toLowerCase();
    if (!/^(sc\.?|scala|int\.?|interno)\s/i.test(lower) && ep !== staircaseRaw && ep !== internalRaw) {
      // Could be locality or city
      if (!comune || lower !== comune.toLowerCase()) {
        locality = ep;
      }
    }
  }

  return {
    streetType, streetName, houseNumber,
    staircaseRaw, internalRaw, locality,
    normalized, applied, removed, standardized,
    unresolved, ambiguityFlags,
  };
}

/* ═══════════════════════════════════════════════════════════
   STREET MATCH LOGIC
   ═══════════════════════════════════════════════════════════ */

function resolveStreetMatch(
  parsed: ParsedAddress,
  hasCoords: boolean,
): { status: StreetMatchStatus; confidence: number; matchedBy: AddressResolution["matched_by"] } {
  // Without an official street registry, we can only do text-based normalization
  // The system is honest about this limitation

  if (!parsed.streetName) {
    return { status: "not_found", confidence: 0, matchedBy: "none" };
  }

  if (!parsed.streetType) {
    // Street name present but no type — contextual at best
    if (hasCoords) {
      return { status: "coordinate_assisted", confidence: 0.3, matchedBy: "coordinate_assisted" };
    }
    return { status: "contextual_only", confidence: 0.2, matchedBy: "contextual_only" };
  }

  // We have street type + name from text
  // Without a registry to verify against, this is at best a normalized match
  if (hasCoords) {
    return { status: "coordinate_assisted", confidence: 0.5, matchedBy: "coordinate_assisted" };
  }

  return { status: "normalized_match", confidence: 0.4, matchedBy: "normalized" };
}

/* ═══════════════════════════════════════════════════════════
   CIVIC MATCH LOGIC
   ═══════════════════════════════════════════════════════════ */

function resolveCivicMatch(
  parsed: ParsedAddress,
  streetConfidence: number,
): CivicResolution {
  const civicPresent = !!parsed.houseNumber;

  if (!civicPresent) {
    return {
      civic_status: "not_found",
      civic_input_present: false,
      civic_normalized: null,
      civic_match_status: "not_found",
      civic_confidence: 0,
      civic_ambiguity: "none",
      civic_supported_as_precise_location: false,
      civic_supported_as_building_truth: false,
      civic_reasoning_summary: "Nessun numero civico presente nell'input.",
    };
  }

  // Civic is present in text — but without a registry it cannot be verified
  const civicNormalized = parsed.houseNumber!.toUpperCase();

  // CRITICAL RULE: civic text presence ≠ building truth
  // Without an official civic registry, we can only say "parsed from text"
  const confidence = Math.min(streetConfidence * 0.8, 0.4);
  const ambiguity: AmbiguityLevel = confidence >= 0.3 ? "medium" : "high";

  return {
    civic_status: "partial_match",
    civic_input_present: true,
    civic_normalized: civicNormalized,
    civic_match_status: "partial_match",
    civic_confidence: Math.round(confidence * 100) / 100,
    civic_ambiguity: ambiguity,
    civic_supported_as_precise_location: false,
    // NEVER promote to building truth without official registry
    civic_supported_as_building_truth: false,
    civic_reasoning_summary:
      `Civico "${civicNormalized}" estratto dal testo. Senza registro civici ufficiale, il match resta parziale e non viene promosso a verità sullo stabile.`,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN ENGINE
   ═══════════════════════════════════════════════════════════ */

export function resolveAddress(input: AddressResolutionInput): AddressResolutionResult {
  const hasCoords = input.lat != null && input.lng != null;
  const parsed = parseAndNormalize(input.raw_address, input.comune);

  // --- Identity ---
  const address_identity: AddressIdentity = {
    raw_input: input.raw_address,
    normalized_address_string: parsed.normalized,
    normalized_street_name: parsed.streetName,
    normalized_street_type: parsed.streetType,
    normalized_locality: parsed.locality || input.comune || null,
    normalized_comune: input.comune || null,
    normalized_province: input.provincia || null,
    normalized_region: input.regione || null,
  };

  // --- Normalization ---
  const address_normalization: AddressNormalization = {
    normalization_applied: parsed.applied,
    tokens_removed: parsed.removed,
    tokens_standardized: parsed.standardized,
    house_number_raw: parsed.houseNumber,
    house_number_normalized: parsed.houseNumber?.toUpperCase() || null,
    staircase_raw: parsed.staircaseRaw,
    internal_raw: parsed.internalRaw,
    unresolved_tokens: parsed.unresolved,
    ambiguity_flags: parsed.ambiguityFlags,
  };

  // --- Street resolution ---
  const streetMatch = resolveStreetMatch(parsed, hasCoords);

  // --- Civic resolution ---
  const civic_resolution = resolveCivicMatch(parsed, streetMatch.confidence);

  // --- Resolution status ---
  let resolutionStatus: AddressResolutionStatus = "not_determinable";
  if (streetMatch.status === "not_found" && !civic_resolution.civic_input_present) {
    resolutionStatus = "unresolved";
  } else if (streetMatch.confidence >= 0.5) {
    resolutionStatus = civic_resolution.civic_confidence >= 0.3 ? "resolved" : "partially_resolved";
  } else if (streetMatch.confidence > 0) {
    resolutionStatus = "partially_resolved";
  } else {
    resolutionStatus = "degraded";
  }

  const ambiguityLevel: AmbiguityLevel =
    parsed.ambiguityFlags.length === 0 ? "none"
    : parsed.ambiguityFlags.length <= 1 ? "low"
    : parsed.ambiguityFlags.length <= 2 ? "medium"
    : "high";

  const address_resolution: AddressResolution = {
    resolution_status: resolutionStatus,
    matched_geo_scope: input.resolved_geo_level || "comune",
    matched_street_status: streetMatch.status,
    matched_street_name: parsed.streetType && parsed.streetName
      ? `${parsed.streetType} ${parsed.streetName}` : parsed.streetName,
    matched_street_confidence: streetMatch.confidence,
    matched_by: streetMatch.matchedBy,
    candidate_count: streetMatch.status !== "not_found" ? 1 : 0,
    ambiguity_level: ambiguityLevel,
    geo_anchor: hasCoords ? `${input.lat!.toFixed(4)},${input.lng!.toFixed(4)}` : null,
    territorial_anchor: input.comune || null,
    building_anchor: null, // Never assumed without evidence
    unresolved_reason: streetMatch.status === "not_found"
      ? "Nessun nome strada identificato nell'input" : null,
  };

  // --- Quality ---
  const streetStrength: AddressQuality["street_match_strength"] =
    streetMatch.confidence >= 0.5 ? "moderate"
    : streetMatch.confidence > 0 ? "weak"
    : "none";

  const civicStrength: AddressQuality["civic_match_strength"] =
    civic_resolution.civic_confidence >= 0.3 ? "weak" // Never "strong" without registry
    : civic_resolution.civic_input_present ? "weak"
    : "none";

  const overallQuality: AddressQuality["overall_address_quality"] =
    streetStrength === "moderate" && civicStrength !== "none" ? "moderate"
    : streetStrength === "moderate" || streetStrength === "weak" ? "weak"
    : "none";

  const warnings: string[] = [];
  if (!parsed.streetType) warnings.push("Tipo strada non identificato");
  if (!parsed.houseNumber) warnings.push("Numero civico assente");
  if (parsed.ambiguityFlags.length > 0) {
    warnings.push(`Ambiguità rilevate: ${parsed.ambiguityFlags.join(", ")}`);
  }
  warnings.push("Nessun registro stradario/civici ufficiale disponibile");

  const address_quality: AddressQuality = {
    overall_address_quality: overallQuality,
    street_match_strength: streetStrength,
    civic_match_strength: civicStrength,
    source_chain_clarity: "low", // Always low without official registry
    geocoding_dependency_level: hasCoords ? "medium" : "none",
    overprecision_risk: civic_resolution.civic_supported_as_building_truth ? "low" : "high",
    false_specificity_risk: overallQuality === "none" ? "high" : "medium",
    key_warnings: warnings,
  };

  // --- Limitations ---
  const address_limitations: AddressLimitations = {
    missing_official_address_registry: true, // Project has no official registry
    missing_civic_registry: true,
    ambiguous_street_name: parsed.ambiguityFlags.includes("tipo_strada_mancante"),
    duplicate_candidates: false,
    geocoding_only: hasCoords && !parsed.streetName,
    text_only: !hasCoords && !!parsed.streetName,
    no_precise_building_link: true, // Always true without registry
    blocking_gaps: [
      "Registro stradario ufficiale non disponibile",
      "Registro civici ufficiale non disponibile",
    ],
    transparency_notes: [
      "L'indirizzo è stato normalizzato da testo, non verificato contro un registro ufficiale.",
      civic_resolution.civic_input_present
        ? "Il civico è stato estratto dal testo ma non è supportato come verità sullo stabile."
        : "Nessun civico presente nell'input.",
      hasCoords
        ? "Le coordinate assistono la localizzazione ma non validano l'indirizzo."
        : "Nessuna coordinata disponibile per assistere il match.",
    ],
  };

  // --- Summary ---
  const streetDesc = parsed.streetType && parsed.streetName
    ? `${parsed.streetType} ${parsed.streetName}`
    : parsed.streetName || "non identificata";
  const civicDesc = parsed.houseNumber || "assente";

  const executive_summary = resolutionStatus === "resolved" || resolutionStatus === "partially_resolved"
    ? `Indirizzo interpretato: ${streetDesc} ${civicDesc}${input.comune ? `, ${input.comune}` : ""}. Match ${resolutionStatus === "resolved" ? "parziale con civico" : "solo strada"}.`
    : `Indirizzo non risolvibile in modo affidabile dall'input fornito.`;

  const analytical_summary = [
    `Input: "${input.raw_address}"`,
    `Strada: ${streetMatch.status} (confidence ${Math.round(streetMatch.confidence * 100)}%)`,
    `Civico: ${civic_resolution.civic_match_status}`,
    `Ambiguità: ${ambiguityLevel}`,
    `Registro ufficiale: non disponibile`,
  ].join(". ") + ".";

  const safe_user_summary = resolutionStatus === "unresolved"
    ? "L'indirizzo fornito non è stato identificato in modo sufficiente."
    : `L'indirizzo "${parsed.normalized || input.raw_address}" è stato interpretato dal testo. Questa interpretazione non equivale a una verifica ufficiale dell'indirizzo.`;

  const address_summary: AddressSummary = {
    executive_summary,
    analytical_summary,
    safe_user_summary,
    next_best_step: "L'introduzione di un registro stradario ufficiale migliorerebbe significativamente la precisione del match indirizzo.",
  };

  // --- Reportability ---
  const hasStreet = streetMatch.status !== "not_found";
  const hasCivic = civic_resolution.civic_input_present;

  const sr = (can: boolean, mode: "full" | "partial" | "hidden", reason: string, source: string | null): AddressSectionReportability =>
    ({ can_render: can, render_mode: mode, reason, source_basis: source });

  const address_reportability: AddressReportability = {
    sections: {
      address_precision: sr(
        hasStreet,
        hasStreet && streetMatch.confidence >= 0.4 ? "partial" : hasStreet ? "partial" : "hidden",
        hasStreet ? "Strada identificata dal testo" : "Nessuna strada identificata",
        "text_parsing",
      ),
      street_match: sr(
        hasStreet,
        streetMatch.confidence >= 0.5 ? "partial" : hasStreet ? "partial" : "hidden",
        hasStreet ? `Match: ${streetMatch.status}` : "Nessun match",
        "text_normalization",
      ),
      civic_match: sr(
        hasCivic,
        hasCivic ? "partial" : "hidden",
        hasCivic ? "Civico presente ma non verificato" : "Civico assente",
        "text_parsing",
      ),
      address_limitations: sr(
        true, "full",
        "Limitazioni sempre rilevanti per layer indirizzo",
        null,
      ),
      false_precision_risk: sr(
        true,
        address_quality.overprecision_risk === "high" ? "full" : "partial",
        `Rischio sovraprecisione: ${address_quality.overprecision_risk}`,
        null,
      ),
    },
  };

  return {
    address_identity,
    address_normalization,
    address_resolution,
    civic_resolution,
    address_quality,
    address_limitations,
    address_summary,
    address_reportability,
  };
}

/* ═══════════════════════════════════════════════════════════
   HELPERS for Building Profile integration
   ═══════════════════════════════════════════════════════════ */

export function addressFactSupportLevel(res: AddressResolutionResult): FactSupportLevel {
  const q = res.address_quality.overall_address_quality;
  if (q === "strong") return "direct"; // Currently unreachable without registry
  if (q === "moderate") return "contextual";
  if (q === "weak") return "derived";
  return "unavailable";
}

export function addressQualityLabel(q: AddressQuality["overall_address_quality"]): string {
  switch (q) {
    case "strong": return "Forte";
    case "moderate": return "Moderata";
    case "weak": return "Debole";
    case "none": return "Non disponibile";
  }
}

export function streetMatchLabel(s: StreetMatchStatus): string {
  switch (s) {
    case "exact_match": return "Match esatto";
    case "normalized_match": return "Match normalizzato";
    case "fuzzy_match": return "Match approssimativo";
    case "coordinate_assisted": return "Assistito da coordinate";
    case "contextual_only": return "Solo contestuale";
    case "not_found": return "Non trovato";
    case "not_determinable": return "Non determinabile";
    case "unsupported_claim": return "Affermazione non supportata";
  }
}

export function civicMatchLabel(s: CivicMatchStatus): string {
  switch (s) {
    case "exact_match": return "Match esatto";
    case "partial_match": return "Match parziale";
    case "ambiguous": return "Ambiguo";
    case "not_found": return "Non trovato";
    case "not_determinable": return "Non determinabile";
    case "not_introduced_from_source": return "Non da fonte ufficiale";
    case "unsupported_claim": return "Affermazione non supportata";
  }
}
