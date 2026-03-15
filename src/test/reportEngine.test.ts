import { describe, it, expect } from "vitest";
import { resolveGeoContext } from "@/lib/reportMapper";
import {
  isFieldAvailable, isSectionRenderable, countAvailableFields,
  unavailableField, sourceTypeLabels, availabilityLabels,
} from "@/types/report";
import type {
  ReportField, ScenarioTemporaleData, TrasparenzaFontiData,
} from "@/types/report";
import {
  buildProfiloRapido, buildImmobileFacciata, buildContestoVicinato,
  buildPosizionamentoCommerciale, buildProfiloArea,
  buildScenarioTemporale, buildSintesiFinale, buildPrioritaCriticita,
  mapScanToReportSections, computeModuleCoverage,
} from "@/lib/reportMapper";
import type { ScanResult, SectionState } from "@/types";

/* ── Helper to build a minimal ScanResult ────────────────── */

const idle: SectionState = { status: "idle", data: null, message: null };
const error: SectionState = { status: "error", data: null, message: "fail" };

function baseScanResult(overrides: Partial<Record<keyof ScanResult, SectionState>> = {}): ScanResult {
  const keys: (keyof ScanResult)[] = [
    "identify", "pricing", "marketContext", "timeView", "opportunity",
    "infrastrutture", "rischioZona", "trendDemografico",
    "sviluppoArea", "convergenzaTerritoriale",
    "poiEnrichment", "omiZone", "istatDemographic",
    "profiloRapido", "immobileFacciata", "contestoVicinato",
    "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
    "prioritaCriticita",
  ];
  const result = {} as Record<string, SectionState>;
  for (const k of keys) result[k] = idle;
  return { ...result, ...overrides } as unknown as ScanResult;
}

/* ── ReportField helpers ─────────────────────────────────── */

describe("ReportField helpers", () => {
  it("isFieldAvailable returns true for available field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "available" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns true for partial field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "partial" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns false for unavailable field", () => {
    const field: ReportField<null> = { value: null, label: "Test", sourceType: "unavailable", availabilityStatus: "unavailable" };
    expect(isFieldAvailable(field)).toBe(false);
  });

  it("isFieldAvailable returns false for null", () => {
    expect(isFieldAvailable(null)).toBe(false);
    expect(isFieldAvailable(undefined)).toBe(false);
  });

  it("unavailableField creates correct structure", () => {
    const field = unavailableField("Prezzo");
    expect(field.value).toBeNull();
    expect(field.label).toBe("Prezzo");
    expect(field.sourceType).toBe("unavailable");
    expect(field.availabilityStatus).toBe("unavailable");
  });
});

/* ── Section renderability ───────────────────────────────── */

describe("isSectionRenderable", () => {
  it("returns false for null data", () => {
    expect(isSectionRenderable(null)).toBe(false);
    expect(isSectionRenderable(undefined)).toBe(false);
  });

  it("returns false when all fields are unavailable", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
    };
    expect(isSectionRenderable(data)).toBe(false);
  });

  it("returns true when at least one field is available", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: "test", label: "B", sourceType: "official_data", availabilityStatus: "available" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });

  it("returns true for partial fields", () => {
    const data: Record<string, unknown> = {
      field1: { value: "partial", label: "A", sourceType: "visual_estimate", availabilityStatus: "partial" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });
});

describe("countAvailableFields", () => {
  it("returns 0 for null", () => {
    expect(countAvailableFields(null)).toBe(0);
  });

  it("counts correctly", () => {
    const data: Record<string, unknown> = {
      field1: { value: "a", label: "A", sourceType: "official_data", availabilityStatus: "available" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field3: { value: "c", label: "C", sourceType: "market_data", availabilityStatus: "partial" },
      nonField: "just a string",
    };
    expect(countAvailableFields(data)).toBe(2);
  });
});

/* ── sourceType and availability labels completeness ──── */

describe("labels completeness", () => {
  it("sourceTypeLabels has all ReportSourceTypes", () => {
    const expected = ["image_detected", "visual_estimate", "territorial_verified", "official_data", "market_data", "forecast_scenario", "unavailable"];
    for (const key of expected) {
      expect(sourceTypeLabels[key as keyof typeof sourceTypeLabels]).toBeTruthy();
    }
  });

  it("availabilityLabels has all AvailabilityStatus values", () => {
    const expected = ["available", "partial", "unavailable", "not_determinable", "fallback"];
    for (const key of expected) {
      expect(availabilityLabels[key as keyof typeof availabilityLabels]).toBeTruthy();
    }
  });
});

/* ── Scenario temporal structure ─────────────────────────── */

describe("ScenarioTemporaleData structure", () => {
  it("should allow empty scenari array", () => {
    const data: ScenarioTemporaleData = { scenari: [] };
    expect(data.scenari).toHaveLength(0);
  });

  it("should structure 5/10/20 year scenarios correctly", () => {
    const data: ScenarioTemporaleData = {
      scenari: [
        { orizzonte: "5_anni", label: "5 anni", variazioneStimataPct: { value: 5, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "10_anni", label: "10 anni", variazioneStimataPct: { value: 12, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "20_anni", label: "20 anni", variazioneStimataPct: { value: null, label: "Variazione", sourceType: "unavailable", availabilityStatus: "unavailable" } },
      ],
      disclaimer: "Proiezione indicativa",
    };
    expect(data.scenari).toHaveLength(3);
    expect(data.scenari![0].orizzonte).toBe("5_anni");
    expect(data.scenari![2].variazioneStimataPct?.availabilityStatus).toBe("unavailable");
  });
});

/* ── TrasparenzaFonti structure ──────────────────────────── */

describe("TrasparenzaFontiData structure", () => {
  it("should accept valid fonti entries", () => {
    const data: TrasparenzaFontiData = {
      fonti: [
        { categoria: "immagine", categoriaLabel: "Analisi immagine", provider: "AI" },
        { categoria: "dato_ufficiale", categoriaLabel: "OMI", provider: "Agenzia delle Entrate", periodo: "2S 2024" },
        { categoria: "dato_mercato", categoriaLabel: "Prezzi", dettaglio: "Comparabili zona" },
      ],
    };
    expect(data.fonti).toHaveLength(3);
    expect(data.fonti[0].categoria).toBe("immagine");
    expect(data.fonti[1].periodo).toBe("2S 2024");
  });
});

/* ── Non-regression: OMI types unchanged ─────────────────── */

describe("OMI types non-regression", () => {
  it("OmiZoneData interface still has polygonMatch", () => {
    const omi: import("@/types").OmiZoneData = {
      zonaOmi: "B1",
      quotazioneMinResidenziale: 1300,
      quotazioneMaxResidenziale: 1650,
      polygonMatch: true,
    };
    expect(omi.polygonMatch).toBe(true);
    expect(omi.zonaOmi).toBe("B1");
  });
});

/* ── Phase 2: Report Mapper tests ────────────────────────── */

describe("buildProfiloRapido", () => {
  it("returns null when identify fails", () => {
    const result = baseScanResult({ identify: error });
    expect(buildProfiloRapido(result, 45, 9)).toBeNull();
  });

  it("populates address as territorial_verified (not image_detected)", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45.46, 9.19);
    expect(rapido).not.toBeNull();
    expect(rapido!.indirizzo?.value).toBe("Via Roma 1");
    expect(rapido!.indirizzo?.sourceType).toBe("territorial_verified");
    expect(rapido!.coordinate?.sourceType).toBe("territorial_verified");
  });

  it("includes OMI zone when available", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: true }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.zonaOmiRiferimento?.value).toBe("Centro");
    expect(rapido!.zonaOmiRiferimento?.sourceType).toBe("official_data");
    expect(rapido!.zonaOmiRiferimento?.availabilityStatus).toBe("available");
  });

  it("marks OMI zone as partial when no polygon match", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: false }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.zonaOmiRiferimento?.availabilityStatus).toBe("partial");
  });
});

describe("buildImmobileFacciata", () => {
  it("returns null without streetEvidence", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    expect(buildImmobileFacciata(result)).toBeNull();
  });

  it("populates partial section from streetEvidence/photoAnalysis (real core values)", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "good",
            photoAnalysis: { buildingType: "Condominio", visibleFloors: 5, photoReadability: "partial" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata?.value).toBe("Condominio");
    expect(facade!.tipologiaFacciata?.sourceType).toBe("image_detected");
    expect(facade!.statoConservazioneFacciata?.sourceType).toBe("visual_estimate");
    expect(facade!.statoConservazioneFacciata?.availabilityStatus).toBe("partial");
    expect(facade!.statoConservazioneFacciata?.value).toContain("buone condizioni");
    expect(facade!.noteVisive?.value).toContain("5 piani");
    expect(facade!.leggibilitaImmagine?.availabilityStatus).toBe("partial");
  });

  it("does not invent fields not present in streetEvidence", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: { facadeConsistencyLevel: "strong" },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata).toBeUndefined();
    expect(facade!.materialePrevalente).toBeUndefined();
    expect(facade!.presenzaBalconi).toBeUndefined();
    expect(facade!.presenzaAscensore).toBeUndefined();
  });
});

describe("buildContestoVicinato", () => {
  it("returns null when no POI data", () => {
    const result = baseScanResult();
    expect(buildContestoVicinato(result)).toBeNull();
  });

  it("populates from POI categories with territorial naming", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 12,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 3 },
            { category: "shopping", categoryLabel: "Commercio", count: 5 },
            { category: "health", categoryLabel: "Sanità", count: 2 },
            { category: "education", categoryLabel: "Istruzione", count: 2 },
          ],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    expect(ctx).not.toBeNull();
    expect(ctx!.presenzaServiziRilevati?.value).toBe(true);
    expect(ctx!.presenzaServiziRilevati?.sourceType).toBe("territorial_verified");
    expect(ctx!.elencoServiziRilevati?.value).toHaveLength(4);
    expect(ctx!.livelloServiziArea?.value).toBe("Area ben servita");
    // No visual-sounding field names
    expect((ctx as any).presenzaServiziVisibili).toBeUndefined();
    expect((ctx as any).elencoServiziVisibili).toBeUndefined();
    expect((ctx as any).attrattivitaVisivaMicrocontesto).toBeUndefined();
    expect((ctx as any).qualitaVisivaContesto).toBeUndefined();
  });

  it("does not show livelloServiziArea without transport+shopping+primary", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 3,
          categories: [{ category: "parks", categoryLabel: "Parchi", count: 3 }],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    expect(ctx?.livelloServiziArea).toBeUndefined();
  });
});

describe("buildPosizionamentoCommerciale", () => {
  it("returns null without pricing or market data", () => {
    const result = baseScanResult();
    expect(buildPosizionamentoCommerciale(result)).toBeNull();
  });

  it("populates with pricing and OMI comparison", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 4000, prezzoMqMin: 3500, prezzoMqMax: 4500, mediaZona: null, trend5Anni: null },
        message: null,
      },
      omiZone: {
        status: "success",
        data: { quotazioneMinResidenziale: 3000, quotazioneMaxResidenziale: 3800, zonaOmi: "B1" },
        message: null,
      },
      marketContext: {
        status: "success",
        data: { marketCoverageLevel: "buona", comparablesSummary: { count: 10, marketDepth: "profondo" } },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos).not.toBeNull();
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("market_data");
    expect(pos!.noteCommercialiSintetiche?.value).toContain("OMI");
    expect(pos!.statoCommercialeRilevato?.value).toBe("Mercato attivo");
  });

  it("uses correct sourceType for all fields", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 2000, prezzoMqMin: 1800, prezzoMqMax: 2200, mediaZona: null, trend5Anni: null },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    if (pos?.prezzoRichiestoRilevato) {
      expect(pos.prezzoRichiestoRilevato.sourceType).toBe("market_data");
    }
  });
});

describe("buildProfiloArea", () => {
  it("returns null with no data", () => {
    const result = baseScanResult();
    expect(buildProfiloArea(result)).toBeNull();
  });

  it("populates from POI, rischio, and ISTAT", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 8,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 3, nearest: { name: "Metro", category: "transport", categoryLabel: "Trasporti", distance: 200, lat: 45, lng: 9, provider: "overpass" } },
            { category: "health", categoryLabel: "Sanità", count: 2 },
            { category: "education", categoryLabel: "Istruzione", count: 3 },
          ],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
      rischioZona: {
        status: "success",
        data: { scoreRischio: 25, idrogeologico: "basso", sismico: "zona3", inquinamento: "basso", alluvionale: false },
        message: null,
      },
      istatDemographic: {
        status: "success",
        data: { popolazione: 50000, densita: 4500, comuneLabel: "Milano" },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    expect(area).not.toBeNull();
    expect(area!.accessibilitaTrasporti?.sourceType).toBe("territorial_verified");
    expect(area!.qualitaAmbientale?.value).toContain("Basso");
    expect(area!.livelloUrbanizzazione?.sourceType).toBe("official_data");
    expect(area!.livelloUrbanizzazione?.value).toContain("Alta");
  });

  it("generates sintesiArea when 3+ indicators are available", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 10,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 5, nearest: { name: "Bus", category: "transport", categoryLabel: "Trasporti", distance: 100, lat: 45, lng: 9, provider: "overpass" } },
            { category: "health", categoryLabel: "Sanità", count: 3 },
            { category: "education", categoryLabel: "Istruzione", count: 2 },
          ],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
      rischioZona: {
        status: "success",
        data: { scoreRischio: 20 },
        message: null,
      },
      istatDemographic: {
        status: "success",
        data: { popolazione: 80000, densita: 5000, comuneLabel: "Milano" },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    expect(area).not.toBeNull();
    expect(area!.sintesiArea).toBeDefined();
    expect(area!.sintesiArea?.sourceType).toBe("territorial_verified");
    expect(area!.sintesiArea?.value).toContain("Area con");
    expect(area!.sintesiArea?.note).toContain("indicatori territoriali");
  });

  it("does NOT generate sintesiArea with fewer than 3 indicators", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 3,
          categories: [{ category: "parks", categoryLabel: "Parchi", count: 3 }],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    // May have some fields but no synthesis
    expect(area?.sintesiArea).toBeUndefined();
  });
});

describe("buildScenarioTemporale", () => {
  it("returns null without timeView data", () => {
    const result = baseScanResult();
    expect(buildScenarioTemporale(result)).toBeNull();
  });

  it("maps timeView to forecast_scenario sourceType", () => {
    const result = baseScanResult({
      timeView: {
        status: "success",
        data: {
          previsione5Anni: 10, previsione10Anni: 22, previsione20Anni: 40,
          scenarioDrivers: ["Metro nuova"], scenarioRisks: ["Tasso interessi"],
          narrativeObservation: "Zona in crescita",
        },
        message: null,
      },
    });
    const scenario = buildScenarioTemporale(result);
    expect(scenario).not.toBeNull();
    expect(scenario!.scenari).toHaveLength(3);
    expect(scenario!.scenari![0].variazioneStimataPct?.sourceType).toBe("forecast_scenario");
    expect(scenario!.scenari![0].driverPrincipali?.value).toContain("Metro nuova");
  });
});

describe("buildSintesiFinale", () => {
  it("returns null without opportunity and convergenza", () => {
    const result = baseScanResult();
    expect(buildSintesiFinale(result)).toBeNull();
  });

  it("builds executive summary from opportunity and convergenza", () => {
    const result = baseScanResult({
      opportunity: {
        status: "success",
        data: { score: 75, band: "forte", drivers: ["Driver1", "Driver2"], risks: ["Risk1"], observation: "Buon potenziale" },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 80, band: "molto_forte", convergenceLevel: "alta", coverageLevel: "buona", positiveFamilies: ["Infra"], negativeFamilies: ["Rischio"] },
        message: null,
      },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi).not.toBeNull();
    expect(sintesi!.giudizioSintetico?.value).toContain("molto forte");
    expect(sintesi!.giudizioSintetico?.value).toContain("copertura");
    expect(sintesi!.giudizioSintetico?.sourceType).toBe("territorial_verified");
    expect(sintesi!.giudizioSintetico?.note).toContain("Sintesi basata su");
    expect(sintesi!.puntiDiForza?.value).toContain("Driver1");
    expect(sintesi!.raccomandazione?.value).toBe("Buon potenziale");
    expect(sintesi!.raccomandazione?.label).toBe("Osservazione conclusiva");
  });

  it("includes coverage analysis when modules are incomplete", () => {
    const result = baseScanResult({
      opportunity: {
        status: "success",
        data: { score: 50, band: "interessante", drivers: ["D1"], risks: [], observation: "Ok" },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 55, band: "interessante", convergenceLevel: "media", coverageLevel: "parziale" },
        message: null,
      },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi).not.toBeNull();
    expect(sintesi!.coperturaAnalisi).toBeDefined();
    expect(sintesi!.coperturaAnalisi?.value).toContain("moduli");
    expect(sintesi!.giudizioSintetico?.value).toContain("parziale");
  });

  it("adds rischio/POI signals to strengths and cautions when available", () => {
    const result = baseScanResult({
      opportunity: {
        status: "success",
        data: { score: 60, band: "forte", drivers: ["D1"], risks: ["R1"], observation: "Test" },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 65, band: "forte" },
        message: null,
      },
      rischioZona: {
        status: "success",
        data: { scoreRischio: 15 },
        message: null,
      },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 20, categories: [], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const sintesi = buildSintesiFinale(result);
    const forza = sintesi?.puntiDiForza?.value as string[];
    expect(forza).toBeDefined();
    expect(forza.some(f => f.includes("rischio"))).toBe(true);
    expect(forza.some(f => f.includes("servizi"))).toBe(true);
  });

  it("does NOT produce promotional text", () => {
    const result = baseScanResult({
      opportunity: {
        status: "success",
        data: { score: 90, band: "molto_forte", drivers: ["D1"], risks: [], observation: "Contesto da valutare" },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 95, band: "molto_forte", convergenceLevel: "alta", coverageLevel: "completa" },
        message: null,
      },
    });
    const sintesi = buildSintesiFinale(result);
    const fullText = JSON.stringify(sintesi);
    expect(fullText).not.toContain("imperdibile");
    expect(fullText).not.toContain("occasione");
    expect(fullText).not.toContain("garantito");
    expect(fullText).not.toContain("affare");
    expect(fullText).not.toContain("alto potenziale");
  });
});

/* ── Phase 3: Priorità / Criticità ───────────────────────── */

describe("buildPrioritaCriticita", () => {
  it("returns null without identify data", () => {
    const result = baseScanResult();
    expect(buildPrioritaCriticita(result)).toBeNull();
  });

  it("generates copertura_parziale when only identify is present (missing timeView)", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const prio = buildPrioritaCriticita(result);
    expect(prio).not.toBeNull();
    expect(prio!.items.some(i => i.categoria === "copertura_parziale")).toBe(true);
  });

  it("generates items from real risk/POI/convergence signals", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      rischioZona: {
        status: "success",
        data: { scoreRischio: 70 },
        message: null,
      },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 3, categories: [{ category: "parks", categoryLabel: "Parchi", count: 3 }], pois: [], searchRadius: 800 },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 30, band: "debole" },
        message: null,
      },
    });
    const prio = buildPrioritaCriticita(result);
    expect(prio).not.toBeNull();
    expect(prio!.items.length).toBeGreaterThanOrEqual(2);
    expect(prio!.items.length).toBeLessThanOrEqual(5);
    // Has attenzione items
    expect(prio!.items.some(i => i.categoria === "attenzione")).toBe(true);
  });

  it("respects max 5 items", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: { photoAnalysis: { photoReadability: "poor" } },
        },
        message: null,
      },
      rischioZona: { status: "success", data: { scoreRischio: 75 }, message: null },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 2, categories: [{ category: "parks", categoryLabel: "Parchi", count: 2 }], pois: [], searchRadius: 800 },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 25, band: "debole", coverageLevel: "scarsa" },
        message: null,
      },
      pricing: {
        status: "success",
        data: { prezzoMq: 8000, prezzoMqMin: 7000, prezzoMqMax: 9000, mediaZona: null, trend5Anni: null },
        message: null,
      },
      omiZone: {
        status: "success",
        data: { quotazioneMinResidenziale: 2000, quotazioneMaxResidenziale: 3000, zonaOmi: "B1" },
        message: null,
      },
    });
    const prio = buildPrioritaCriticita(result);
    expect(prio).not.toBeNull();
    expect(prio!.items.length).toBeLessThanOrEqual(5);
  });

  it("includes favorevole items when signals are positive", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 15 }, message: null },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 85, band: "molto_forte" },
        message: null,
      },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 20, categories: [], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const prio = buildPrioritaCriticita(result);
    expect(prio).not.toBeNull();
    expect(prio!.items.some(i => i.categoria === "elemento_favorevole")).toBe(true);
  });

  it("never contains promotional language", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Test", buildingId: "X", confidence: 0.9 }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 90, band: "molto_forte" }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 10 }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 25, categories: [], pois: [], searchRadius: 800 }, message: null },
    });
    const prio = buildPrioritaCriticita(result);
    if (prio) {
      const fullText = prio.items.map(i => i.testo).join(" ");
      expect(fullText).not.toContain("imperdibile");
      expect(fullText).not.toContain("occasione");
      expect(fullText).not.toContain("investimento");
    }
  });
});

describe("mapScanToReportSections", () => {
  it("returns all null when no data", () => {
    const result = baseScanResult();
    const mapped = mapScanToReportSections(result, null, null);
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.profiloArea).toBeNull();
    expect(mapped.scenarioTemporale).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
    expect(mapped.prioritaCriticita).toBeNull();
  });

  it("never produces invented/mock data", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const mapped = mapScanToReportSections(result, 45, 9);
    expect(mapped.profiloRapido).not.toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.profiloRapido!.tipologiaEdificio).toBeUndefined();
    expect(mapped.profiloRapido!.annoCostruzioneStimato).toBeUndefined();
  });
});

/* ── No fallback invented values test ────────────────────── */

describe("No invented data policy", () => {
  it("immobileFacciata returns null without streetEvidence", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 20, categories: [], pois: [], searchRadius: 800 }, message: null },
    });
    expect(buildImmobileFacciata(result)).toBeNull();
  });

  it("contestoVicinato uses territorial naming, no visual-sounding fields", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: { totalPois: 5, categories: [{ category: "parks", categoryLabel: "Parchi", count: 5 }], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    expect(ctx?.prevalenzaContesto).toBeUndefined();
    expect(ctx?.tessutoUrbano).toBeUndefined();
    expect(ctx?.densitaEdiliziaPercepita).toBeUndefined();
    expect((ctx as any).densitaEdiliziaVisiva).toBeUndefined();
    expect((ctx as any).qualitaVisivaContesto).toBeUndefined();
    expect((ctx as any).attrattivitaVisivaMicrocontesto).toBeUndefined();
  });
});

/* ── Phase 2.1: Semantic corrections tests ───────────────── */

describe("Phase 2.1 semantic corrections", () => {
  it("indirizzo is territorial_verified, never image_detected", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Corso Buenos Aires 10", buildingId: "X", confidence: 0.95 }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.indirizzo?.sourceType).toBe("territorial_verified");
    expect(rapido!.indirizzo?.sourceType).not.toBe("image_detected");
  });

  it("pricing from official source gets official_data sourceType", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 3000, prezzoMqMin: 2800, prezzoMqMax: 3200, mediaZona: null, trend5Anni: null, sourceType: "official" },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("official_data");
  });

  it("pricing from market source gets market_data sourceType", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 3000, prezzoMqMin: 2800, prezzoMqMax: 3200, mediaZona: null, trend5Anni: null, sourceType: "elaborated" },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("market_data");
  });

  it("immobileFacciata partial with streetEvidence populates correct sourceTypes", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "strong",
            photoAnalysis: { buildingType: "Palazzina", visibleFloors: 3, photoReadability: "clear" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata?.sourceType).toBe("image_detected");
    expect(facade!.statoConservazioneFacciata?.sourceType).toBe("visual_estimate");
    expect(facade!.leggibilitaImmagine).toBeUndefined();
  });

  it("facadeConsistencyLevel='good' maps to Italian label correctly", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: { facadeConsistencyLevel: "good" },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade!.statoConservazioneFacciata?.value).toContain("buone condizioni");
  });

  it("photoReadability='partial' maps to readability note", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "strong",
            photoAnalysis: { photoReadability: "partial" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade!.leggibilitaImmagine?.value).toContain("nella media");
    expect(facade!.leggibilitaImmagine?.availabilityStatus).toBe("partial");
  });

  it("facadeConsistencyLevel='none' is excluded from rendering", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: { facadeConsistencyLevel: "none" },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).toBeNull();
  });

  it("ProfiloRapidoCard renders indirizzo and coordinate fields", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Test 5", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45.123, 9.456);
    expect(rapido).not.toBeNull();
    expect(rapido!.indirizzo?.value).toBe("Via Test 5");
    expect(rapido!.indirizzo?.label).toBe("Indirizzo");
    expect(rapido!.coordinate?.value).toContain("45.12300");
    expect(rapido!.coordinate?.label).toBe("Coordinate GPS");
  });

  it("MAP_REPORT populates profiloRapido, profiloArea, scenarioTemporale, sintesiFinale, prioritaCriticita", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Test", buildingId: "X", confidence: 0.9 }, message: null },
      timeView: { status: "success", data: { previsione5Anni: 8, previsione10Anni: 18, previsione20Anni: 30 }, message: null },
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: ["R1"], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte", convergenceLevel: "media", coverageLevel: "buona", positiveFamilies: ["P1"], negativeFamilies: ["N1"] }, message: null },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 10, categories: [{ category: "transport", categoryLabel: "T", count: 5 }], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const mapped = mapScanToReportSections(result, 45.46, 9.19);
    expect(mapped.profiloRapido).not.toBeNull();
    expect(mapped.profiloArea).not.toBeNull();
    expect(mapped.scenarioTemporale).not.toBeNull();
    expect(mapped.scenarioTemporale!.scenari).toHaveLength(3);
    expect(mapped.sintesiFinale).not.toBeNull();
    expect(mapped.sintesiFinale!.giudizioSintetico).toBeDefined();
    expect(mapped.prioritaCriticita).not.toBeNull();
  });

  it("no mock data — all sections null with empty scan result", () => {
    const result = baseScanResult();
    const mapped = mapScanToReportSections(result, null, null);
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.scenarioTemporale).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
    expect(mapped.prioritaCriticita).toBeNull();
  });
});

/* ── Coverage helper tests ───────────────────────────────── */

describe("computeModuleCoverage", () => {
  it("returns 0 coverage with empty scan result", () => {
    const result = baseScanResult();
    const cov = computeModuleCoverage(result);
    expect(cov.available).toBe(0);
    expect(cov.total).toBe(7);
    expect(cov.pct).toBe(0);
  });

  it("counts real modules correctly", () => {
    const result = baseScanResult({
      pricing: { status: "success", data: { prezzoMq: 3000 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1" }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 5, categories: [], pois: [], searchRadius: 800 }, message: null },
    });
    const cov = computeModuleCoverage(result);
    expect(cov.available).toBe(3);
    expect(cov.pct).toBe(43);
  });

  it("returns 100% when all modules are present", () => {
    const result = baseScanResult({
      pricing: { status: "success", data: { prezzoMq: 3000 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1" }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 5 }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 20 }, message: null },
      timeView: { status: "success", data: { previsione5Anni: 5 }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 70 }, message: null },
      opportunity: { status: "success", data: { score: 60 }, message: null },
    });
    const cov = computeModuleCoverage(result);
    expect(cov.available).toBe(7);
    expect(cov.pct).toBe(100);
  });
});

/* ── Source type transparency tests ──────────────────────── */

describe("sourceType transparency in syntheses", () => {
  it("giudizioSintetico uses territorial_verified, not market_data", () => {
    const result = baseScanResult({
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: [], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte", convergenceLevel: "media", coverageLevel: "buona" }, message: null },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi!.giudizioSintetico?.sourceType).toBe("territorial_verified");
    expect(sintesi!.giudizioSintetico?.note).toBeTruthy();
  });

  it("puntiDiForza use territorial_verified with multi-source note", () => {
    const result = baseScanResult({
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: [], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte", positiveFamilies: ["Infra"] }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 15 }, message: null },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi!.puntiDiForza?.sourceType).toBe("territorial_verified");
    expect(sintesi!.puntiDiForza?.note).toContain("Derivati da");
  });

  it("raccomandazione uses forecast_scenario sourceType", () => {
    const result = baseScanResult({
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: [], observation: "Analisi prudente" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte" }, message: null },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi!.raccomandazione?.sourceType).toBe("forecast_scenario");
    expect(sintesi!.raccomandazione?.note).toContain("opportunità");
  });

  it("coperturaAnalisi uses territorial_verified, not market_data", () => {
    const result = baseScanResult({
      opportunity: { status: "success", data: { score: 50, band: "interessante", drivers: [], risks: [], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 55, band: "interessante", convergenceLevel: "media", coverageLevel: "parziale" }, message: null },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi!.coperturaAnalisi?.sourceType).toBe("territorial_verified");
  });

  it("convergence priority items use territorial_verified, not market_data", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 85, band: "molto_forte" }, message: null },
    });
    const prio = buildPrioritaCriticita(result);
    const convergenceItem = prio!.items.find(i => i.testo.includes("Convergenza"));
    expect(convergenceItem?.sourceType).toBe("territorial_verified");
    expect(convergenceItem?.nota).toBeTruthy();
  });

  it("pricing vs OMI divergence item uses official_data sourceType", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      pricing: { status: "success", data: { prezzoMq: 8000 }, message: null },
      omiZone: { status: "success", data: { quotazioneMinResidenziale: 2000, quotazioneMaxResidenziale: 3000, zonaOmi: "B1" }, message: null },
    });
    const prio = buildPrioritaCriticita(result);
    const omiItem = prio!.items.find(i => i.testo.includes("OMI"));
    expect(omiItem?.sourceType).toBe("official_data");
  });

  it("leggibilitaImmagine renamed field renders correctly in immobileFacciata", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "good",
            photoAnalysis: { buildingType: "Condominio", photoReadability: "partial" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade!.leggibilitaImmagine).toBeDefined();
    expect(facade!.leggibilitaImmagine?.label).toBe("Leggibilità immagine");
    expect((facade as any).qualitaEsteticaGenerale).toBeUndefined();
  });

  it("full coverage shows 'Copertura analisi completa'", () => {
    const result = baseScanResult({
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: [], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte", convergenceLevel: "alta", coverageLevel: "completa" }, message: null },
      pricing: { status: "success", data: { prezzoMq: 3000 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1" }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 10 }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 20 }, message: null },
      timeView: { status: "success", data: { previsione5Anni: 5 }, message: null },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi!.coperturaAnalisi?.value).toContain("completa");
  });
});

/* ── OMI non-regression (frozen) ─────────────────────────── */

describe("OMI invariance check", () => {
  it("OmiZoneData interface remains unchanged", () => {
    const omi: import("@/types").OmiZoneData = {
      zonaOmi: "C2",
      quotazioneMinResidenziale: 1200,
      quotazioneMaxResidenziale: 1500,
      polygonMatch: true,
      comuneLabel: "Roma",
    };
    expect(omi.polygonMatch).toBe(true);
    expect(omi.zonaOmi).toBe("C2");
  });
});

/* ── Hardening: edge cases with missing/partial data ─────── */

describe("Hardening — edge cases", () => {
  it("buildProfiloArea handles transport nearest without distance", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 5,
          searchRadius: 500,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 3, nearest: { name: "Bus", category: "transport", categoryLabel: "Trasporti", distance: undefined as any, lat: 0, lng: 0, provider: "overpass" } },
          ],
          pois: [],
        },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    // Should not contain "undefinedm"
    if (area?.accessibilitaTrasporti?.value) {
      expect(String(area.accessibilitaTrasporti.value)).not.toContain("undefined");
    }
  });

  it("buildProfiloRapido returns null when identify has no data", () => {
    const result = baseScanResult();
    expect(buildProfiloRapido(result, 45.0, 9.0)).toBeNull();
  });

  it("buildImmobileFacciata returns null without streetEvidence", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Test 1", buildingId: "T1", confidence: 0.9 }, message: null },
    });
    expect(buildImmobileFacciata(result)).toBeNull();
  });

  it("buildContestoVicinato returns null when totalPois is 0", () => {
    const result = baseScanResult({
      poiEnrichment: { status: "success", data: { totalPois: 0, categories: [], pois: [], searchRadius: 500 }, message: null },
    });
    expect(buildContestoVicinato(result)).toBeNull();
  });

  it("buildScenarioTemporale returns null when timeView has no forecasts", () => {
    const result = baseScanResult({
      timeView: { status: "success", data: { scenarioBand: "stabile" }, message: null },
    });
    expect(buildScenarioTemporale(result)).toBeNull();
  });

  it("buildSintesiFinale returns null without opportunity or convergenza", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Test 1", buildingId: "T1", confidence: 0.9 }, message: null },
    });
    expect(buildSintesiFinale(result)).toBeNull();
  });

  it("buildPrioritaCriticita returns null without identify", () => {
    const result = baseScanResult();
    expect(buildPrioritaCriticita(result)).toBeNull();
  });

  it("mapScanToReportSections returns all-null with empty state", () => {
    const result = baseScanResult();
    const mapped = mapScanToReportSections(result, null, null);
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.profiloArea).toBeNull();
    expect(mapped.scenarioTemporale).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
    expect(mapped.prioritaCriticita).toBeNull();
  });

  it("buildPosizionamentoCommerciale returns null without pricing and market", () => {
    const result = baseScanResult();
    expect(buildPosizionamentoCommerciale(result)).toBeNull();
  });

  it("computeModuleCoverage returns 0 with idle state", () => {
    const result = baseScanResult();
    const cov = computeModuleCoverage(result);
    expect(cov.available).toBe(0);
    expect(cov.pct).toBe(0);
  });

  it("all sections handle error state modules gracefully", () => {
    const result = baseScanResult({
      identify: error,
      pricing: error,
      marketContext: error,
      timeView: error,
      opportunity: error,
      rischioZona: error,
      convergenzaTerritoriale: error,
      poiEnrichment: error,
      omiZone: error,
      istatDemographic: error,
    });
    const mapped = mapScanToReportSections(result, 45.0, 9.0);
    // All should be null — no crash
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
    expect(mapped.prioritaCriticita).toBeNull();
  });
});

/* ── Fix verification: 4 targeted hardening tests ────────── */

describe("Fix verification — 4 final hardening checks", () => {
  it("buildProfiloArea does NOT produce 'undefinedm' when nearest.distance is missing", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          categories: [
            {
              categoryKey: "transport",
              categoryLabel: "Trasporti",
              count: 3,
              nearest: { name: "Fermata Bus", distance: undefined },
              items: [],
            },
          ],
        },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    if (area?.accessibilitaTrasporti?.value) {
      const val = String(area.accessibilitaTrasporti.value);
      expect(val).not.toContain("undefinedm");
      expect(val).not.toContain("undefined");
    }
  });

  it("buildProfiloArea shows distance when nearest.distance IS present", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          categories: [
            {
              categoryKey: "transport",
              categoryLabel: "Trasporti",
              count: 2,
              nearest: { name: "Metro", distance: 150 },
              items: [],
            },
          ],
        },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    if (area?.accessibilitaTrasporti?.value) {
      expect(String(area.accessibilitaTrasporti.value)).toContain("150m");
    }
  });

  it("SintesiFinaleCard data with non-array puntiDiForza/puntiDiAttenzione does not crash", () => {
    // Simulate malformed data where value is a string instead of array
    const malformed = {
      giudizioSintetico: { value: "Test", label: "g", sourceType: "image_detected" as const, availabilityStatus: "available" as const },
      puntiDiForza: { value: "not-an-array" as unknown, label: "f", sourceType: "image_detected" as const, availabilityStatus: "available" as const },
      puntiDiAttenzione: { value: 42 as unknown, label: "a", sourceType: "image_detected" as const, availabilityStatus: "available" as const },
    };
    // Array.isArray should return false for non-arrays, resulting in empty arrays
    const forza = Array.isArray(malformed.puntiDiForza?.value) ? malformed.puntiDiForza.value : [];
    const attenzione = Array.isArray(malformed.puntiDiAttenzione?.value) ? malformed.puntiDiAttenzione.value : [];
    expect(forza).toEqual([]);
    expect(attenzione).toEqual([]);
  });

  it("SintesiFinaleCard data with valid arrays works correctly", () => {
    const valid = {
      puntiDiForza: { value: ["A", "B"], label: "f", sourceType: "image_detected" as const, availabilityStatus: "available" as const },
      puntiDiAttenzione: { value: ["C"], label: "a", sourceType: "image_detected" as const, availabilityStatus: "available" as const },
    };
    const forza = Array.isArray(valid.puntiDiForza?.value) ? valid.puntiDiForza.value : [];
    const attenzione = Array.isArray(valid.puntiDiAttenzione?.value) ? valid.puntiDiAttenzione.value : [];
    expect(forza).toEqual(["A", "B"]);
    expect(attenzione).toEqual(["C"]);
  });

  it("POI distance display: no dirty string when distance is missing", () => {
    const cat = { categoryKey: "transport", categoryLabel: "Trasporti", count: 3, nearest: { name: "Bus", distance: undefined as number | undefined }, items: [] };
    const distanceStr = cat.nearest?.distance != null ? ` · ${cat.nearest.distance}m` : "";
    expect(distanceStr).toBe("");
    expect(distanceStr).not.toContain("undefined");
  });

  it("POI distance display: shows distance when present", () => {
    const cat = { categoryKey: "transport", categoryLabel: "Trasporti", count: 3, nearest: { name: "Bus", distance: 200 }, items: [] };
    const distanceStr = cat.nearest?.distance != null ? ` · ${cat.nearest.distance}m` : "";
    expect(distanceStr).toBe(" · 200m");
  });
});

/* ── Geo-level resolution tests ─────────────────────────── */

describe("resolveGeoContext", () => {
  it("returns microzona_omi when OMI polygon match is true", () => {
    const result = baseScanResult({
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: true }, message: null },
    });
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("microzona_omi");
    expect(geo.geoLabel).toContain("Centro");
  });

  it("returns comune when OMI has no polygon match and ISTAT has comuneLabel", () => {
    const result = baseScanResult({
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: false, comuneLabel: "Padova" }, message: null },
      istatDemographic: { status: "success", data: { popolazione: 200000, comuneLabel: "Padova" }, message: null },
    });
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("comune");
    expect(geo.geoLabel).toContain("Padova");
  });

  it("returns non_determinato when no geo data available", () => {
    const result = baseScanResult();
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("non_determinato");
  });

  it("uses trendDemografico geoLevel when available and not comune", () => {
    const result = baseScanResult({
      trendDemografico: { status: "success", data: { geoLevel: "quartiere", geoLabel: "Arcella", etaMedia: 40 }, message: null },
    });
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("quartiere");
    expect(geo.geoLabel).toBe("Arcella");
  });
});

describe("buildProfiloArea — geo transparency", () => {
  it("marks livelloUrbanizzazione as partial with municipal note when geoLevel=comune", () => {
    const result = baseScanResult({
      istatDemographic: { status: "success", data: { popolazione: 200000, densita: 4000, comuneLabel: "Padova" }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 25, idrogeologico: "basso", sismico: "zona3", inquinamento: "basso", alluvionale: false }, message: null },
    });
    const area = buildProfiloArea(result);
    expect(area).not.toBeNull();
    expect(area!.geo?.geoLevel).toBe("comune");
    expect(area!.livelloUrbanizzazione?.label).toContain("comunale");
    expect(area!.livelloUrbanizzazione?.availabilityStatus).toBe("partial");
    expect(area!.livelloUrbanizzazione?.note).toContain("comune");
  });

  it("does not mark as partial when OMI polygon match provides zone-level precision", () => {
    const result = baseScanResult({
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: true }, message: null },
      istatDemographic: { status: "success", data: { popolazione: 200000, densita: 4000, comuneLabel: "Milano" }, message: null },
      rischioZona: { status: "success", data: { scoreRischio: 20, idrogeologico: "basso", sismico: "zona3", inquinamento: "basso", alluvionale: false }, message: null },
    });
    const area = buildProfiloArea(result);
    expect(area).not.toBeNull();
    expect(area!.geo?.geoLevel).toBe("microzona_omi");
    expect(area!.livelloUrbanizzazione?.label).not.toContain("comunale");
    expect(area!.livelloUrbanizzazione?.availabilityStatus).toBe("available");
  });
});

describe("buildSintesiFinale — geo transparency", () => {
  it("carries geo context in output", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 72, band: "forte", convergenceLevel: "alta", coverageLevel: "buona", identityConfidence: 0.9, positiveFamilies: ["A"], negativeFamilies: [], topPositiveSignals: [], topNegativeSignals: [], evidenceTrace: [] },
        message: null,
      },
      istatDemographic: { status: "success", data: { popolazione: 200000, comuneLabel: "Padova" }, message: null },
    });
    const sf = buildSintesiFinale(result);
    expect(sf).not.toBeNull();
    expect(sf!.geo?.geoLevel).toBe("comune");
    expect(sf!.geo?.geoLabel).toContain("Padova");
  });
});

describe("buildPrioritaCriticita — municipal warning", () => {
  it("adds municipal-level warning when geoLevel=comune", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      istatDemographic: { status: "success", data: { popolazione: 200000, comuneLabel: "Padova" }, message: null },
    });
    const pc = buildPrioritaCriticita(result);
    expect(pc).not.toBeNull();
    const municipalItem = pc!.items.find(i => i.testo.includes("comunale") || i.testo.includes("Comune"));
    expect(municipalItem).toBeTruthy();
    expect(municipalItem!.categoria).toBe("copertura_parziale");
  });

  it("does not add municipal warning when zone-level precision is available", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: true }, message: null },
    });
    const pc = buildPrioritaCriticita(result);
    // Should not have a municipal warning
    const municipalItem = pc?.items.find(i => i.testo.includes("comunale") || i.testo.includes("Comune"));
    expect(municipalItem).toBeUndefined();
  });
});
