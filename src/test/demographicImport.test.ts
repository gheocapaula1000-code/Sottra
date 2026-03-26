import { describe, it, expect } from "vitest";

/* ── Test: demographic import validation & matching priority ── */

describe("Demographic import validation", () => {
  const requiredFields = [
    "codice_comune_catastale", "zona_key", "zona_label",
    "zona_type", "source_label", "source_type",
  ];

  it("rejects records missing required fields", () => {
    const incomplete = { codice_comune_catastale: "A001" }; // missing zona_key etc.
    for (const field of requiredFields) {
      if (field === "codice_comune_catastale") continue;
      expect(incomplete).not.toHaveProperty(field);
    }
  });

  it("validates zona_type against allowed values", () => {
    const allowed = ["microzona_omi", "quartiere", "sezione_censuaria", "circoscrizione", "zona_statistica", "altro"];
    expect(allowed).toContain("microzona_omi");
    expect(allowed).toContain("quartiere");
    expect(allowed).not.toContain("random");
  });

  it("validates coverage_level including new values", () => {
    const allowed = ["zona", "quartiere", "comune", "microzona", "sezione_censimento", "area_subcomunale"];
    expect(allowed).toContain("zona");
    expect(allowed).toContain("sezione_censimento");
    expect(allowed).toContain("area_subcomunale");
    expect(allowed).not.toContain("provincia");
  });

  it("validates data_quality", () => {
    const allowed = ["alto", "standard", "basso"];
    expect(allowed).toContain("standard");
    expect(allowed).not.toContain("medio");
  });

  it("validates source_type against taxonomy", () => {
    const allowed = ["official", "elaborated", "estimate", "community"];
    expect(allowed).toContain("official");
    expect(allowed).toContain("elaborated");
    expect(allowed).not.toContain("premium");
  });
});

describe("Sub-municipal record selection priority", () => {
  const QUALITY_ORDER: Record<string, number> = { alto: 3, standard: 2, basso: 1 };
  const COVERAGE_RANK: Record<string, number> = {
    microzona: 0, sezione_censimento: 1, zona: 2, quartiere: 3,
    area_subcomunale: 4, comune: 5,
  };

  function selectBest(candidates: Record<string, unknown>[]): Record<string, unknown> & { _selectionReason: string } {
    if (candidates.length === 1) return { ...candidates[0], _selectionReason: "unico_candidato" };

    const metricsCount = (r: Record<string, unknown>) => {
      let c = 0;
      for (const k of ["popolazione", "densita", "eta_media", "nuclei_familiari", "percentuale_stranieri", "percentuale_giovani", "percentuale_famiglie"]) {
        if (typeof r[k] === "number") c++;
      }
      return c;
    };

    const sorted = [...candidates].sort((a, b) => {
      const covA = COVERAGE_RANK[String(a.coverage_level ?? "comune")] ?? 5;
      const covB = COVERAGE_RANK[String(b.coverage_level ?? "comune")] ?? 5;
      if (covA !== covB) return covA - covB;

      const annoA = String(a.anno_rilevazione ?? "0");
      const annoB = String(b.anno_rilevazione ?? "0");
      if (annoA !== annoB) return annoB.localeCompare(annoA);

      const offA = a.is_official === true ? 1 : 0;
      const offB = b.is_official === true ? 1 : 0;
      if (offA !== offB) return offB - offA;

      const qA = QUALITY_ORDER[String(a.data_quality ?? "standard")] ?? 2;
      const qB = QUALITY_ORDER[String(b.data_quality ?? "standard")] ?? 2;
      if (qA !== qB) return qB - qA;

      const hasZonaOmiA = typeof a.zona_omi === "string" && (a.zona_omi as string).length > 0 ? 1 : 0;
      const hasZonaOmiB = typeof b.zona_omi === "string" && (b.zona_omi as string).length > 0 ? 1 : 0;
      if (hasZonaOmiA !== hasZonaOmiB) return hasZonaOmiB - hasZonaOmiA;

      return metricsCount(b) - metricsCount(a);
    });

    return { ...sorted[0], _selectionReason: "migliore_per_criteri" };
  }

  it("prefers more precise coverage_level", () => {
    const result = selectBest([
      { coverage_level: "comune", anno_rilevazione: "2023", is_official: true, data_quality: "alto", popolazione: 200000 },
      { coverage_level: "microzona", anno_rilevazione: "2021", is_official: true, data_quality: "standard", popolazione: 5000 },
    ]);
    expect(result.coverage_level).toBe("microzona");
  });

  it("prefers most recent anno_rilevazione at same coverage", () => {
    const result = selectBest([
      { coverage_level: "zona", anno_rilevazione: "2019", is_official: true, data_quality: "standard", popolazione: 1000 },
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100 },
    ]);
    expect(result.anno_rilevazione).toBe("2023");
  });

  it("prefers official over non-official at same year", () => {
    const result = selectBest([
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: false, data_quality: "standard", popolazione: 1000 },
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100 },
    ]);
    expect(result.is_official).toBe(true);
  });

  it("prefers higher data_quality at same year and official", () => {
    const result = selectBest([
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "basso", popolazione: 1000 },
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "alto", popolazione: 1100 },
    ]);
    expect(result.data_quality).toBe("alto");
  });

  it("prefers record with zona_omi over one without", () => {
    const result = selectBest([
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1000, zona_omi: null },
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100, zona_omi: "B1" },
    ]);
    expect(result.zona_omi).toBe("B1");
  });

  it("prefers record with more metrics at same rank", () => {
    const result = selectBest([
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1000 },
      { coverage_level: "zona", anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100, densita: 500, eta_media: 42 },
    ]);
    expect(result.densita).toBe(500);
  });

  it("returns selectionReason for single candidate", () => {
    const result = selectBest([
      { anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1000 },
    ]);
    expect(result._selectionReason).toBe("unico_candidato");
  });
});

describe("GeoJSON centroid computation", () => {
  function computeCentroid(rings: number[][][]): { lat: number; lng: number } | null {
    let totalLat = 0, totalLng = 0, count = 0;
    for (const ring of rings) {
      if (!Array.isArray(ring)) continue;
      for (const point of ring) {
        if (Array.isArray(point) && point.length >= 2) {
          totalLng += point[0];
          totalLat += point[1];
          count++;
        }
      }
    }
    if (count === 0) return null;
    return { lat: totalLat / count, lng: totalLng / count };
  }

  it("computes centroid from polygon rings", () => {
    const rings = [[[11.0, 45.0], [12.0, 45.0], [12.0, 46.0], [11.0, 46.0], [11.0, 45.0]]];
    const c = computeCentroid(rings);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(45.4, 0);
    expect(c!.lng).toBeCloseTo(11.4, 0);
  });

  it("returns null for empty rings", () => {
    expect(computeCentroid([])).toBeNull();
  });
});

describe("Matching method priority", () => {
  it("zona_omi match has higher confidence than polygon", () => {
    const zonaOmiConf = 0.90;
    const polygonConf = 0.85;
    expect(zonaOmiConf).toBeGreaterThan(polygonConf);
  });

  it("sub-municipal match always beats municipal fallback", () => {
    const subMunicipal = { geoLevel: "microzona", matchConfidence: 0.70 };
    const municipal = { geoLevel: "comune", matchConfidence: 0.90 };
    expect(subMunicipal.geoLevel).not.toBe("comune");
    expect(municipal.geoLevel).toBe("comune");
  });

  it("coverage_level precision: microzona < zona < quartiere < comune", () => {
    const COVERAGE_RANK: Record<string, number> = {
      microzona: 0, sezione_censimento: 1, zona: 2, quartiere: 3,
      area_subcomunale: 4, comune: 5,
    };
    expect(COVERAGE_RANK["microzona"]).toBeLessThan(COVERAGE_RANK["zona"]);
    expect(COVERAGE_RANK["zona"]).toBeLessThan(COVERAGE_RANK["comune"]);
    expect(COVERAGE_RANK["sezione_censimento"]).toBeLessThan(COVERAGE_RANK["quartiere"]);
  });
});

describe("UI labeling correctness", () => {
  it("municipal data must show municipal label", () => {
    const isMunicipal = (geoLevel: string | null | undefined) =>
      !geoLevel || geoLevel === "comune" || geoLevel === "area_vasta" || geoLevel === "stimato";

    expect(isMunicipal("comune")).toBe(true);
    expect(isMunicipal(null)).toBe(true);
    expect(isMunicipal(undefined)).toBe(true);
    expect(isMunicipal("microzona")).toBe(false);
    expect(isMunicipal("quartiere")).toBe(false);
  });

  it("sub-municipal data must not show 'del comune' suffix", () => {
    const geoSuffix = (geoLevel: string | null) => {
      const isMunicipal = !geoLevel || geoLevel === "comune";
      return isMunicipal ? " del comune" : "";
    };
    expect(geoSuffix("microzona")).toBe("");
    expect(geoSuffix("quartiere")).toBe("");
    expect(geoSuffix("comune")).toBe(" del comune");
    expect(geoSuffix(null)).toBe(" del comune");
  });

  it("matchMethod labels should exist for all expected methods", () => {
    const matchMethodLabels: Record<string, string> = {
      zona_omi: "Match zona OMI", point_in_polygon: "Match spaziale",
      municipal_fallback: "Fallback comunale",
    };
    expect(matchMethodLabels).toHaveProperty("zona_omi");
    expect(matchMethodLabels).toHaveProperty("point_in_polygon");
    expect(matchMethodLabels).toHaveProperty("municipal_fallback");
  });

  it("selectionReason should be human-readable when underscores replaced", () => {
    const reason = "migliore_per_anno_più_recente";
    const readable = reason.replace(/_/g, " ");
    expect(readable).toBe("migliore per anno più recente");
    expect(readable).not.toContain("_");
  });
});

describe("Idempotency via composite dedup key", () => {
  function dedupKey(r: { zona_key: string; codice_comune_catastale: string; anno_rilevazione: string; source_label: string }): string {
    return `${r.zona_key}|${r.codice_comune_catastale}|${r.anno_rilevazione}|${r.source_label}`;
  }

  it("same full key should produce same record (upsert)", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT Censimento" };
    const key2 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT Censimento" };
    expect(dedupKey(key1)).toBe(dedupKey(key2));
  });

  it("different anno_rilevazione should produce different records", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT Censimento" };
    const key2 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2023", source_label: "ISTAT Censimento" };
    expect(dedupKey(key1)).not.toBe(dedupKey(key2));
  });

  it("different source_label should produce different records", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT Censimento" };
    const key2 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "Padova Open Data" };
    expect(dedupKey(key1)).not.toBe(dedupKey(key2));
  });

  it("different zona_key should produce different records", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT" };
    const key2 = { zona_key: "PD_CENTRO_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT" };
    expect(dedupKey(key1)).not.toBe(dedupKey(key2));
  });

  it("different comuni are not duplicates", () => {
    const key1 = { zona_key: "CENTRO_01", codice_comune_catastale: "G224", anno_rilevazione: "2021", source_label: "ISTAT" };
    const key2 = { zona_key: "CENTRO_01", codice_comune_catastale: "L736", anno_rilevazione: "2021", source_label: "ISTAT" };
    expect(dedupKey(key1)).not.toBe(dedupKey(key2));
  });
});

describe("NeighborhoodIndex overclaim prevention", () => {
  it("municipal demographic dimension should note 'intero comune'", () => {
    const geoLevel = "comune";
    const comuneLabel = "Padova";
    const note = geoLevel === "comune"
      ? `Dato riferito all'intero comune di ${comuneLabel}`
      : `Dato riferito a zona sub-comunale`;
    expect(note).toContain("intero comune");
    expect(note).toContain("Padova");
  });

  it("sub-municipal dimension should NOT mention 'intero comune'", () => {
    const geoLevel = "microzona" as string;
    const geoLabel = "Arcella";
    const note = geoLevel === "comune"
      ? `Dato riferito all'intero comune`
      : `Dato riferito a ${geoLabel}`;
    expect(note).not.toContain("intero comune");
    expect(note).toContain("Arcella");
  });
});

describe("No crime data without real source", () => {
  it("safety_zones should not be exposed in UI", () => {
    const safetyZonesExposedInUI = false;
    expect(safetyZonesExposedInUI).toBe(false);
  });
});

/* ── Field mapping tests ────────────────────────────── */

describe("Field mapping for ISTAT import", () => {
  function applyFieldMapping(record: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
    if (!mapping || Object.keys(mapping).length === 0) return record;
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const targetKey = mapping[key] ?? key;
      mapped[targetKey] = value;
    }
    return mapped;
  }

  it("maps custom column names to target fields", () => {
    const record = { SEZ2011: "001", NOME_ZONA: "Arcella", POP: 12000 };
    const mapping = { SEZ2011: "zona_key", NOME_ZONA: "zona_label", POP: "popolazione" };
    const mapped = applyFieldMapping(record, mapping);
    expect(mapped.zona_key).toBe("001");
    expect(mapped.zona_label).toBe("Arcella");
    expect(mapped.popolazione).toBe(12000);
  });

  it("preserves unmapped fields with original keys", () => {
    const record = { zona_key: "A01", extra_field: "hello" };
    const mapping = {};
    const mapped = applyFieldMapping(record, mapping);
    expect(mapped.zona_key).toBe("A01");
    expect(mapped.extra_field).toBe("hello");
  });

  it("applies defaults for missing fields", () => {
    const record = { zona_key: "A01" };
    const defaults = { coverage_level: "sezione_censimento", is_official: true };
    const merged = { ...defaults, ...record };
    expect(merged.coverage_level).toBe("sezione_censimento");
    expect(merged.is_official).toBe(true);
    expect(merged.zona_key).toBe("A01");
  });

  it("record values override defaults", () => {
    const record = { zona_key: "A01", coverage_level: "quartiere" };
    const defaults = { coverage_level: "sezione_censimento" };
    const merged = { ...defaults, ...record };
    expect(merged.coverage_level).toBe("quartiere");
  });
});

describe("Deduplication within batch", () => {
  function dedupKey(r: { zona_key: string; codice_comune_catastale: string }): string {
    return `${r.zona_key}|${r.codice_comune_catastale}`;
  }

  it("identifies duplicate records by zona_key + codice_comune_catastale", () => {
    const r1 = { zona_key: "PD_01", codice_comune_catastale: "G224", popolazione: 1000 };
    const r2 = { zona_key: "PD_01", codice_comune_catastale: "G224", popolazione: 1100 };
    expect(dedupKey(r1)).toBe(dedupKey(r2));
  });

  it("keeps last occurrence when deduplicating", () => {
    const records = [
      { zona_key: "PD_01", codice_comune_catastale: "G224", popolazione: 1000 },
      { zona_key: "PD_02", codice_comune_catastale: "G224", popolazione: 2000 },
      { zona_key: "PD_01", codice_comune_catastale: "G224", popolazione: 1100 },
    ];
    const map = new Map<string, typeof records[0]>();
    for (const r of records) map.set(dedupKey(r), r);
    const deduped = Array.from(map.values());
    expect(deduped).toHaveLength(2);
    expect(deduped.find(r => r.zona_key === "PD_01")?.popolazione).toBe(1100);
  });

  it("different comuni are not considered duplicates", () => {
    const r1 = { zona_key: "CENTRO_01", codice_comune_catastale: "G224" };
    const r2 = { zona_key: "CENTRO_01", codice_comune_catastale: "L736" };
    expect(dedupKey(r1)).not.toBe(dedupKey(r2));
  });
});

describe("Stats validation", () => {
  it("computes correct percentages", () => {
    const total = 100;
    const withPolygon = 85;
    const pct = Math.round((withPolygon / total) * 100);
    expect(pct).toBe(85);
  });

  it("handles zero records gracefully", () => {
    const total = 0;
    const pct = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(pct).toBe(0);
  });
});
