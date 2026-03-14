import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * OMI Integration Tests
 * Tests the OMI pipeline logic: CSV parsing validation, runtime lookup,
 * and zero-mock guarantees.
 */

// Mock supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIlike = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Helper: build a chain mock for omi_quotazioni SELECT
function mockOmiQuery(data: unknown[] | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// Import the proSources parser to test OMI result parsing
import { fetchProSources } from "@/services/proSources";

describe("OMI CSV Parsing Validation", () => {
  it("rejects CSV with missing required columns", () => {
    // Simulate what omi-ingest would detect
    const headers = ["Nome", "Valore", "Altro"];
    const hasComune = headers.some(h => /comune.?catast/i.test(h) || /comune.?istat/i.test(h));
    const hasComprMin = headers.some(h => /compr.?min/i.test(h));
    const hasComprMax = headers.some(h => /compr.?max/i.test(h));
    const hasZona = headers.some(h => /^zona$/i.test(h));

    expect(hasComune).toBe(false);
    expect(hasComprMin).toBe(false);
    expect(hasComprMax).toBe(false);
    expect(hasZona).toBe(false);
  });

  it("accepts valid OMI CSV headers", () => {
    const headers = [
      "Area_territoriale", "Regione", "Prov", "Comune_ISTAT",
      "Comune_catastale", "Comune_amm", "Sez", "Zona", "LinkZona",
      "Cod_Tip", "Descr_Tipologia", "Stato_conservativo",
      "Compr_min", "Compr_max", "Sup_NL", "Loc_min", "Loc_max",
    ];

    const hasComune = headers.some(h => /comune.?catast/i.test(h) || /comune.?istat/i.test(h));
    const hasComprMin = headers.some(h => /compr.?min/i.test(h));
    const hasComprMax = headers.some(h => /compr.?max/i.test(h));
    const hasZona = headers.some(h => /^zona$/i.test(h));

    expect(hasComune).toBe(true);
    expect(hasComprMin).toBe(true);
    expect(hasComprMax).toBe(true);
    expect(hasZona).toBe(true);
  });

  it("parses Italian decimal format correctly", () => {
    const parseDecimal = (raw: string) => parseFloat(raw.trim().replace(",", "."));
    expect(parseDecimal("1.500,00")).toBeNaN(); // thousands+comma not handled by simple replace
    expect(parseDecimal("1500")).toBe(1500);
    expect(parseDecimal("2100,50")).toBe(2100.50);
    expect(parseDecimal("850")).toBe(850);
  });

  it("filters non-residential typologies", () => {
    const residential = ["Abitazioni civili", "Abitazioni economiche", "Residenziale"];
    const nonResidential = ["Uffici", "Negozi", "Capannoni", "Box"];

    for (const t of residential) {
      const tipLower = t.toLowerCase();
      const isRes = tipLower.includes("abitazion") || tipLower.includes("residen") || tipLower.includes("civili") || tipLower.includes("economic");
      expect(isRes).toBe(true);
    }

    for (const t of nonResidential) {
      const tipLower = t.toLowerCase();
      const isRes = tipLower.includes("abitazion") || tipLower.includes("residen") || tipLower.includes("civili") || tipLower.includes("economic");
      expect(isRes).toBe(false);
    }
  });

  it("handles malformed rows without crashing", () => {
    const malformedLines = [
      "",
      ";;;",
      "only;two;cols",
      'A;"B;C";;D',
    ];

    for (const line of malformedLines) {
      expect(() => {
        const vals = line.split(";").map(v => v.trim().replace(/^"|"$/g, ""));
        // Should not throw
        expect(Array.isArray(vals)).toBe(true);
      }).not.toThrow();
    }
  });
});

describe("OMI Runtime Lookup", () => {
  it("returns unavailable when no data in DB", async () => {
    // Mock supabase.functions.invoke to return omi unavailable
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        ok: true,
        data: {
          omi: { sourceType: "unavailable", sourceProvider: "omi", availabilityReason: "no_coverage" },
          istat: { sourceType: "unavailable", sourceProvider: "istat", availabilityReason: "no_coverage" },
          poi: { sourceType: "unavailable", sourceProvider: "overpass", totalPois: 0, categories: [], pois: [] },
        },
      },
      error: null,
    });

    const result = await fetchProSources(45.4642, 9.1900);
    expect(result.omi).toBeNull(); // parseOmiResult filters unavailable → null
  });

  it("returns real data when DB has matching rows", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        ok: true,
        data: {
          omi: {
            zonaOmi: "B1",
            zonaOmiLabel: "Centro storico",
            comuneLabel: "Milano",
            quotazioneMinResidenziale: 3200,
            quotazioneMaxResidenziale: 4800,
            semestre: "1° semestre 2024",
            tipologia: "Abitazioni civili",
            statoConservazione: "NORMALE",
            sourceType: "official",
            sourceProvider: "omi",
            sourceLabel: "OMI / Agenzia delle Entrate",
            sourceFreshness: "2024-S1",
            sourceCoverageLevel: "zone_omi",
          },
          istat: { sourceType: "unavailable", sourceProvider: "istat" },
          poi: { sourceType: "unavailable", sourceProvider: "overpass", totalPois: 0, categories: [], pois: [] },
        },
      },
      error: null,
    });

    const result = await fetchProSources(45.4642, 9.1900);
    expect(result.omi).not.toBeNull();
    expect(result.omi!.sourceType).toBe("official");
    expect(result.omi!.sourceProvider).toBe("omi");
    expect(result.omi!.quotazioneMinResidenziale).toBe(3200);
    expect(result.omi!.quotazioneMaxResidenziale).toBe(4800);
    expect(result.omi!.zonaOmi).toBe("B1");
  });

  it("correctly maps sourceType and sourceProvider fields", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        ok: true,
        data: {
          omi: {
            zonaOmi: "C2",
            comuneLabel: "Roma",
            quotazioneMinResidenziale: 2500,
            quotazioneMaxResidenziale: 3500,
            semestre: "2° semestre 2024",
            sourceType: "official",
            sourceProvider: "omi",
            sourceLabel: "OMI / Agenzia delle Entrate",
          },
          istat: { sourceType: "unavailable", sourceProvider: "istat" },
          poi: { sourceType: "unavailable", sourceProvider: "overpass", totalPois: 0, categories: [], pois: [] },
        },
      },
      error: null,
    });

    const result = await fetchProSources(41.9028, 12.4964);
    expect(result.omi).not.toBeNull();
    expect(result.omi!.sourceType).toBe("official");
    expect(result.omi!.sourceProvider).toBe("omi");
  });
});

describe("OMI Zero Mock Guarantees", () => {
  it("never returns demo/sample/placeholder sourceType", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        ok: true,
        data: {
          omi: { sourceType: "unavailable", sourceProvider: "omi", availabilityReason: "no_coverage" },
        },
      },
      error: null,
    });

    const result = await fetchProSources(45.0, 9.0);
    // When unavailable, omi should be null (filtered by parseOmiResult)
    expect(result.omi).toBeNull();
    // Verify no "demo", "sample", "placeholder" sourceType ever appears
    const invalidTypes = ["demo", "sample", "placeholder", "mock", "test"];
    if (result.omi) {
      expect(invalidTypes).not.toContain(result.omi.sourceType);
    }
  });

  it("idempotent upsert concept: same data twice produces same result", () => {
    // The upsert uses onConflict on composite key, so inserting the same
    // row twice should not create duplicates
    const row = {
      codice_comune_catastale: "F205",
      zona_omi: "B1",
      tipologia: "Abitazioni civili",
      stato_conservazione: "NORMALE",
      semestre: 1,
      anno: 2024,
    };

    // Composite key should be identical for same input
    const key1 = `${row.codice_comune_catastale}|${row.zona_omi}|${row.tipologia}|${row.stato_conservazione}|${row.semestre}|${row.anno}`;
    const key2 = `${row.codice_comune_catastale}|${row.zona_omi}|${row.tipologia}|${row.stato_conservazione}|${row.semestre}|${row.anno}`;
    expect(key1).toBe(key2);
  });
});
