/**
 * Source Evaluation Registry — Sottra
 *
 * Typed evaluation model for candidate data source families.
 * Used for roadmap consultation, admin display, and integration planning.
 *
 * This module does NOT import any external data or introduce new pipelines.
 * It is purely a planning/classification tool.
 */

/* ── Evaluation Card Types ─────────────────────────────── */

export type RecommendedPriority = "P1" | "P2" | "P3" | "P4" | "P5";
export type RecommendedAction = "integrate_next" | "integrate_parallel" | "study_feasibility" | "defer" | "avoid_for_now";
export type RiskLevel = "low" | "medium" | "high";
export type Relevance = "high" | "medium" | "low" | "none";
export type AntiHallucinationFit = "excellent" | "good" | "caution" | "poor";

export interface SourceFamilyEvaluation {
  source_family: string;
  source_family_label: string;
  source_names: string[];
  source_type: string;
  officiality_level: string;
  likely_quality_label: string;
  geographic_coverage: string;
  geographic_levels_supported: string[];
  building_relevance: Relevance;
  zone_relevance: Relevance;
  address_relevance: Relevance;
  update_frequency: string;
  freshness_expectation: string;
  structured_access: RiskLevel;
  machine_readability: RiskLevel;
  licensing_risk: RiskLevel;
  dependency_risk: RiskLevel;
  stability_risk: RiskLevel;
  integration_complexity: RiskLevel;
  maintenance_cost: RiskLevel;
  anti_hallucination_fit: AntiHallucinationFit;
  notes: string;
  recommended_phase: string;
  recommended_priority: RecommendedPriority;
  recommended_action: RecommendedAction;
  backbone_alignment: {
    reuses_existing_taxonomy: boolean;
    requires_new_limitations: boolean;
    strengthens_layers: string[];
  };
}

/* ── Priority Metadata ─────────────────────────────────── */

export interface PriorityEntry {
  priority: RecommendedPriority;
  label: string;
  rationale: string;
  layer_strengthened: string;
  expected_quality: string;
  risk_summary: string;
  report_impact: string;
}

export const PRIORITY_ORDER: PriorityEntry[] = [
  {
    priority: "P1",
    label: "ANNCSU / Stradario Ufficiale",
    rationale: "Unica fonte che può rendere civic_supported_as_building_truth = true",
    layer_strengthened: "address (primario), building (secondario)",
    expected_quality: "official",
    risk_summary: "Medio — accesso da verificare con ISTAT",
    report_impact: "Civic verification diventa possibile; address_status può salire a verified",
  },
  {
    priority: "P2",
    label: "Basi Territoriali ISTAT Aggiornate",
    rationale: "Complemento naturale del backbone; costo minimo, impatto alto su zona",
    layer_strengthened: "zona (primario)",
    expected_quality: "official",
    risk_summary: "Basso — dati pubblici, formati noti",
    report_impact: "Sezioni area/territorio più complete e aggiornate",
  },
  {
    priority: "P3",
    label: "Registro Edifici (studio fattibilità)",
    rationale: "Necessario per building profile serio; accesso Catasto complesso",
    layer_strengthened: "building (primario)",
    expected_quality: "official (Catasto) o elaborated (OSM)",
    risk_summary: "Alto — accesso, formati proprietari, convenzioni necessarie",
    report_impact: "Unsupported claims edificio ridotti significativamente",
  },
  {
    priority: "P4",
    label: "Dati Mercato Aggiuntivi",
    rationale: "OMI già copre posizionamento; fonti commerciali portano rischio semantico",
    layer_strengthened: "zona (secondario)",
    expected_quality: "elaborated / commercial_partial",
    risk_summary: "Alto — rischio promozione commercial → official",
    report_impact: "Marginale rispetto a OMI già presente",
  },
  {
    priority: "P5",
    label: "Mobilità / Servizi / Ambiente",
    rationale: "Nice to have ma non critico; frammentazione alta",
    layer_strengthened: "zona (contestuale)",
    expected_quality: "elaborated",
    risk_summary: "Medio — frammentazione GTFS, variabilità formati",
    report_impact: "Arricchimento contesto, non core",
  },
];

/* ── Source Family Registry ────────────────────────────── */

export const SOURCE_FAMILIES: SourceFamilyEvaluation[] = [
  {
    source_family: "address_registry",
    source_family_label: "Stradario / Toponomastica / Civici",
    source_names: ["ANNCSU", "OpenCivitas", "OpenAddresses.io", "Dataset comunali aperti"],
    source_type: "official_data",
    officiality_level: "Istituzionale (ANNCSU = ISTAT + Agenzia Entrate)",
    likely_quality_label: "official",
    geographic_coverage: "Nazionale",
    geographic_levels_supported: ["civico", "via", "sezione_censuaria"],
    building_relevance: "high",
    zone_relevance: "medium",
    address_relevance: "high",
    update_frequency: "Annuale",
    freshness_expectation: "1–2 anni",
    structured_access: "medium",
    machine_readability: "low",
    licensing_risk: "medium",
    dependency_risk: "medium",
    stability_risk: "low",
    integration_complexity: "medium",
    maintenance_cost: "low",
    anti_hallucination_fit: "excellent",
    notes: "ANNCSU è l'unica fonte che può trasformare civic_supported_as_building_truth in true",
    recommended_phase: "Prossima integrazione",
    recommended_priority: "P1",
    recommended_action: "integrate_next",
    backbone_alignment: {
      reuses_existing_taxonomy: true,
      requires_new_limitations: false,
      strengthens_layers: ["address", "building"],
    },
  },
  {
    source_family: "territorial_public",
    source_family_label: "Dati Territoriali Pubblici Aggiuntivi",
    source_names: ["Basi territoriali ISTAT", "Confini comunali/provinciali", "Vincoli paesaggistici/idrogeologici"],
    source_type: "official_data",
    officiality_level: "Istituzionale",
    likely_quality_label: "official",
    geographic_coverage: "Nazionale",
    geographic_levels_supported: ["sezione_censuaria", "comune", "provincia"],
    building_relevance: "medium",
    zone_relevance: "high",
    address_relevance: "low",
    update_frequency: "Decennale (censimento), variabile (vincoli)",
    freshness_expectation: "5–10 anni per struttura",
    structured_access: "low",
    machine_readability: "low",
    licensing_risk: "low",
    dependency_risk: "low",
    stability_risk: "low",
    integration_complexity: "low",
    maintenance_cost: "low",
    anti_hallucination_fit: "excellent",
    notes: "Complemento naturale del backbone; costo bassissimo, valore alto",
    recommended_phase: "Dopo address registry o in parallelo",
    recommended_priority: "P2",
    recommended_action: "integrate_parallel",
    backbone_alignment: {
      reuses_existing_taxonomy: true,
      requires_new_limitations: false,
      strengthens_layers: ["zona"],
    },
  },
  {
    source_family: "building_registry",
    source_family_label: "Dati Edificio / Fabbricato",
    source_names: ["Catasto fabbricati (Agenzia Entrate)", "DBSN (IGM)", "OpenStreetMap buildings"],
    source_type: "official_data",
    officiality_level: "Istituzionale (Catasto), verificato geospaziale (OSM)",
    likely_quality_label: "official",
    geographic_coverage: "Nazionale (Catasto), variabile (OSM)",
    geographic_levels_supported: ["particella", "foglio", "sub_comunale"],
    building_relevance: "high",
    zone_relevance: "medium",
    address_relevance: "high",
    update_frequency: "Continuo (Catasto), variabile (OSM)",
    freshness_expectation: "Dati sempre aggiornati",
    structured_access: "high",
    machine_readability: "medium",
    licensing_risk: "high",
    dependency_risk: "high",
    stability_risk: "low",
    integration_complexity: "high",
    maintenance_cost: "medium",
    anti_hallucination_fit: "excellent",
    notes: "Catasto è la fonte ideale ma accesso complesso; OSM come ponte per volumetrie base",
    recommended_phase: "Dopo address registry + verifica accesso Catasto",
    recommended_priority: "P3",
    recommended_action: "study_feasibility",
    backbone_alignment: {
      reuses_existing_taxonomy: true,
      requires_new_limitations: true,
      strengthens_layers: ["building"],
    },
  },
  {
    source_family: "market_data",
    source_family_label: "Dati Mercato / Contesto Economico",
    source_names: ["Annunci immobiliari aggregati", "Indici CONSOB/Banca d'Italia"],
    source_type: "commercial_verified",
    officiality_level: "Commerciale / semi-ufficiale",
    likely_quality_label: "elaborated",
    geographic_coverage: "Nazionale (indici macro), variabile (annunci)",
    geographic_levels_supported: ["comune", "provincia", "zona"],
    building_relevance: "medium",
    zone_relevance: "high",
    address_relevance: "low",
    update_frequency: "Trimestrale/semestrale",
    freshness_expectation: "6–12 mesi",
    structured_access: "medium",
    machine_readability: "medium",
    licensing_risk: "high",
    dependency_risk: "medium",
    stability_risk: "medium",
    integration_complexity: "medium",
    maintenance_cost: "medium",
    anti_hallucination_fit: "caution",
    notes: "OMI già copre posizionamento; rischio promozione commercial → official",
    recommended_phase: "Dopo solidificazione address + building",
    recommended_priority: "P4",
    recommended_action: "defer",
    backbone_alignment: {
      reuses_existing_taxonomy: false,
      requires_new_limitations: true,
      strengthens_layers: ["zona"],
    },
  },
  {
    source_family: "contextual_services",
    source_family_label: "Mobilità / Servizi / Ambiente",
    source_names: ["GTFS trasporto pubblico", "ISPRA qualità ambientale", "ISTAT accessibilità servizi"],
    source_type: "territorial_verified",
    officiality_level: "Istituzionale (ISPRA), semi-ufficiale (GTFS)",
    likely_quality_label: "elaborated",
    geographic_coverage: "Nazionale (ISPRA), frammentata (GTFS)",
    geographic_levels_supported: ["comune", "fermata", "area"],
    building_relevance: "none",
    zone_relevance: "medium",
    address_relevance: "none",
    update_frequency: "Variabile",
    freshness_expectation: "1–3 anni",
    structured_access: "low",
    machine_readability: "low",
    licensing_risk: "low",
    dependency_risk: "medium",
    stability_risk: "medium",
    integration_complexity: "medium",
    maintenance_cost: "medium",
    anti_hallucination_fit: "good",
    notes: "Arricchimento nice-to-have; non critico per valore core; frammentazione GTFS alta",
    recommended_phase: "Fase futura, dopo P1–P3",
    recommended_priority: "P5",
    recommended_action: "avoid_for_now",
    backbone_alignment: {
      reuses_existing_taxonomy: true,
      requires_new_limitations: false,
      strengthens_layers: ["zona"],
    },
  },
];

/* ── Helper Functions ──────────────────────────────────── */

/** Returns families sorted by priority */
export function getFamiliesByPriority(): SourceFamilyEvaluation[] {
  return [...SOURCE_FAMILIES].sort((a, b) => a.recommended_priority.localeCompare(b.recommended_priority));
}

/** Returns families that should be integrated next */
export function getActionableFamilies(): SourceFamilyEvaluation[] {
  return SOURCE_FAMILIES.filter(f =>
    f.recommended_action === "integrate_next" || f.recommended_action === "integrate_parallel"
  );
}

/** Returns families to defer or avoid */
export function getDeferredFamilies(): SourceFamilyEvaluation[] {
  return SOURCE_FAMILIES.filter(f =>
    f.recommended_action === "defer" || f.recommended_action === "avoid_for_now"
  );
}

/** Returns families needing feasibility study */
export function getStudyFamilies(): SourceFamilyEvaluation[] {
  return SOURCE_FAMILIES.filter(f => f.recommended_action === "study_feasibility");
}

/** Checks if a family is compatible with anti-hallucination policy */
export function isAntiHallucinationCompatible(family: SourceFamilyEvaluation): boolean {
  return family.anti_hallucination_fit === "excellent" || family.anti_hallucination_fit === "good";
}

/** Returns the priority entry for a given priority level */
export function getPriorityDetail(priority: RecommendedPriority): PriorityEntry | undefined {
  return PRIORITY_ORDER.find(p => p.priority === priority);
}

/** Summary stats for the registry */
export function summarizeEvaluationRegistry(): {
  total: number;
  actionable: number;
  deferred: number;
  study: number;
  anti_hallucination_compatible: number;
} {
  return {
    total: SOURCE_FAMILIES.length,
    actionable: getActionableFamilies().length,
    deferred: getDeferredFamilies().length,
    study: getStudyFamilies().length,
    anti_hallucination_compatible: SOURCE_FAMILIES.filter(isAntiHallucinationCompatible).length,
  };
}
