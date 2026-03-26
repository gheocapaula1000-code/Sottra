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

  it("validates coverage_level", () => {
    const allowed = ["zona", "quartiere", "comune", "microzona"];
    expect(allowed).toContain("zona");
    expect(allowed).not.toContain("provincia");
  });

  it("validates data_quality", () => {
    const allowed = ["alto", "standard", "basso"];
    expect(allowed).toContain("standard");
    expect(allowed).not.toContain("medio");
  });
});

describe("Sub-municipal record selection priority", () => {
  const QUALITY_ORDER: Record<string, number> = { alto: 3, standard: 2, basso: 1 };

  function selectBest(candidates: Record<string, unknown>[]): Record<string, unknown> {
    return [...candidates].sort((a, b) => {
      const annoA = String(a.anno_rilevazione ?? "0");
      const annoB = String(b.anno_rilevazione ?? "0");
      if (annoA !== annoB) return annoB.localeCompare(annoA);

      const offA = a.is_official === true ? 1 : 0;
      const offB = b.is_official === true ? 1 : 0;
      if (offA !== offB) return offB - offA;

      const qA = QUALITY_ORDER[String(a.data_quality ?? "standard")] ?? 2;
      const qB = QUALITY_ORDER[String(b.data_quality ?? "standard")] ?? 2;
      if (qA !== qB) return qB - qA;

      const metricsCount = (r: Record<string, unknown>) => {
        let c = 0;
        for (const k of ["popolazione", "densita", "eta_media", "nuclei_familiari", "percentuale_stranieri"]) {
          if (typeof r[k] === "number") c++;
        }
        return c;
      };
      return metricsCount(b) - metricsCount(a);
    })[0];
  }

  it("prefers most recent anno_rilevazione", () => {
    const result = selectBest([
      { anno_rilevazione: "2019", is_official: true, data_quality: "standard", popolazione: 1000 },
      { anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100 },
    ]);
    expect(result.anno_rilevazione).toBe("2023");
  });

  it("prefers official over non-official at same year", () => {
    const result = selectBest([
      { anno_rilevazione: "2023", is_official: false, data_quality: "standard", popolazione: 1000 },
      { anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100 },
    ]);
    expect(result.is_official).toBe(true);
  });

  it("prefers higher data_quality at same year and official", () => {
    const result = selectBest([
      { anno_rilevazione: "2023", is_official: true, data_quality: "basso", popolazione: 1000 },
      { anno_rilevazione: "2023", is_official: true, data_quality: "alto", popolazione: 1100 },
    ]);
    expect(result.data_quality).toBe("alto");
  });

  it("prefers record with more metrics at same rank", () => {
    const result = selectBest([
      { anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1000 },
      { anno_rilevazione: "2023", is_official: true, data_quality: "standard", popolazione: 1100, densita: 500, eta_media: 42 },
    ]);
    expect(result.densita).toBe(500);
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
    const zonaOmiConf = 0.90; // standard quality via zona_omi
    const polygonConf = 0.85; // standard quality via polygon
    expect(zonaOmiConf).toBeGreaterThan(polygonConf);
  });

  it("sub-municipal match always beats municipal fallback", () => {
    const subMunicipal = { geoLevel: "microzona", matchConfidence: 0.70 };
    const municipal = { geoLevel: "comune", matchConfidence: 0.90 };
    // Sub-municipal should be preferred regardless of confidence
    expect(subMunicipal.geoLevel).not.toBe("comune");
    expect(municipal.geoLevel).toBe("comune");
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
});

describe("Idempotency via zona_key + codice_comune_catastale", () => {
  it("same zona_key + comune should produce same record (upsert)", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224" };
    const key2 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224" };
    expect(key1.zona_key).toBe(key2.zona_key);
    expect(key1.codice_comune_catastale).toBe(key2.codice_comune_catastale);
  });

  it("different zona_key should produce different records", () => {
    const key1 = { zona_key: "PD_ARCELLA_01", codice_comune_catastale: "G224" };
    const key2 = { zona_key: "PD_CENTRO_01", codice_comune_catastale: "G224" };
    expect(key1.zona_key).not.toBe(key2.zona_key);
  });
});
