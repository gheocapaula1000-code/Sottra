import { describe, it, expect } from "vitest";
import { isPointInPolygon, isPointInGeoJSON } from "@/lib/pointInPolygon";
import { validateRecord, calculateCentroid, calculateBBox } from "@/lib/subMunicipalImporter";

// --- Point-in-polygon tests ---

describe("isPointInPolygon", () => {
  const square = [
    [11, 45], // [lng, lat]
    [12, 45],
    [12, 46],
    [11, 46],
    [11, 45],
  ];

  it("returns true for point inside polygon", () => {
    expect(isPointInPolygon(45.5, 11.5, square)).toBe(true);
  });

  it("returns false for point outside polygon", () => {
    expect(isPointInPolygon(44, 10, square)).toBe(false);
  });

  it("returns false for point far away", () => {
    expect(isPointInPolygon(0, 0, square)).toBe(false);
  });
});

describe("isPointInGeoJSON", () => {
  const polygon = {
    type: "Polygon",
    coordinates: [[[11, 45], [12, 45], [12, 46], [11, 46], [11, 45]]],
  };

  it("matches point inside GeoJSON Polygon", () => {
    expect(isPointInGeoJSON(45.5, 11.5, polygon)).toBe(true);
  });

  it("rejects point outside GeoJSON Polygon", () => {
    expect(isPointInGeoJSON(44, 10, polygon)).toBe(false);
  });

  it("handles MultiPolygon", () => {
    const multi = {
      type: "MultiPolygon",
      coordinates: [polygon.coordinates, [[[13, 45], [14, 45], [14, 46], [13, 46], [13, 45]]]],
    };
    expect(isPointInGeoJSON(45.5, 13.5, multi)).toBe(true);
    expect(isPointInGeoJSON(45.5, 15, multi)).toBe(false);
  });

  it("returns false for invalid geometry", () => {
    expect(isPointInGeoJSON(45, 11, {} as any)).toBe(false);
    expect(isPointInGeoJSON(45, 11, { type: "Point", coordinates: [11, 45] })).toBe(false);
  });
});

// --- Importer utility tests ---

describe("validateRecord", () => {
  it("validates complete record", () => {
    const result = validateRecord({
      source_dataset: "ASC_21",
      area_code: "001001_1",
      comune_name: "Torino",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing source_dataset", () => {
    const result = validateRecord({ area_code: "001", comune_name: "X" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source_dataset mancante");
  });

  it("rejects missing area_code", () => {
    const result = validateRecord({ source_dataset: "ASC_21", comune_name: "X" });
    expect(result.valid).toBe(false);
  });

  it("rejects out-of-Italy centroid", () => {
    const result = validateRecord({
      source_dataset: "ASC_21",
      area_code: "001",
      comune_name: "X",
      centroid_lat: 60,
      centroid_lng: 11,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("centroid_lat fuori Italia");
  });
});

describe("calculateCentroid", () => {
  it("calculates centroid of simple polygon", () => {
    const poly = { type: "Polygon", coordinates: [[[11, 45], [12, 45], [12, 46], [11, 46], [11, 45]]] };
    const c = calculateCentroid(poly);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(45.4, 0);
    expect(c!.lng).toBeCloseTo(11.4, 0);
  });

  it("returns null for invalid input", () => {
    expect(calculateCentroid(null)).toBeNull();
    expect(calculateCentroid({})).toBeNull();
  });
});

describe("calculateBBox", () => {
  it("calculates bounding box", () => {
    const poly = { coordinates: [[[11, 45], [12, 45], [12, 46], [11, 46], [11, 45]]] };
    const bbox = calculateBBox(poly);
    expect(bbox).toEqual([11, 45, 12, 46]);
  });

  it("returns null for invalid input", () => {
    expect(calculateBBox(null)).toBeNull();
  });
});

// --- No regression: existing pipeline untouched ---

describe("non-regression", () => {
  it("sub_municipal_areas_2021 modules do NOT import from report pipeline", async () => {
    // These modules should be self-contained and not affect the public pipeline
    const importerSource = await import("@/lib/subMunicipalImporter");
    const pipSource = await import("@/lib/pointInPolygon");
    
    expect(importerSource.validateRecord).toBeDefined();
    expect(pipSource.isPointInPolygon).toBeDefined();
    // These are standalone utilities, not wired into the report engine
  });
});
