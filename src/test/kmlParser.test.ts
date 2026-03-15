import { describe, it, expect } from "vitest";

/* ─── KML Parser logic (mirrored from edge function for unit testing) ─── */

function parseCoordinateBlock(coordText: string): number[][] {
  const ring: number[][] = [];
  const points = coordText.trim().split(/\s+/).filter((s) => s.includes(","));
  for (const point of points) {
    const parts = point.split(",");
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lng) && !isNaN(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        ring.push([lng, lat]);
      }
    }
  }
  return ring;
}

function extractPolygons(content: string): number[][][] {
  const polygons: number[][][] = [];
  const polygonRegex = /<Polygon>([\s\S]*?)<\/Polygon>/gi;
  let polyMatch;
  while ((polyMatch = polygonRegex.exec(content)) !== null) {
    const polyContent = polyMatch[1];
    const outerMatch = polyContent.match(
      /<outerBoundaryIs>\s*<LinearRing>\s*<coordinates>\s*([\s\S]*?)\s*<\/coordinates>\s*<\/LinearRing>\s*<\/outerBoundaryIs>/i
    );
    if (outerMatch) {
      const ring = parseCoordinateBlock(outerMatch[1]);
      if (ring.length >= 3) polygons.push(ring);
    }
  }
  if (polygons.length === 0) {
    const coordsRegex = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/gi;
    let coordMatch;
    while ((coordMatch = coordsRegex.exec(content)) !== null) {
      const ring = parseCoordinateBlock(coordMatch[1]);
      if (ring.length >= 3) polygons.push(ring);
    }
  }
  return polygons;
}

interface ParsedPlacemark {
  codice_comune_catastale: string;
  zona_omi: string;
  comune_label: string;
  polygons: number[][][];
}

function parseKml(kmlText: string): ParsedPlacemark[] {
  const results: ParsedPlacemark[] = [];
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/gi;
  let pmMatch;
  while ((pmMatch = placemarkRegex.exec(kmlText)) !== null) {
    const pmContent = pmMatch[1];
    let codcom: string | null = null;
    let codzona: string | null = null;
    const codcomData = pmContent.match(/<Data\s+name="CODCOM"[\s\S]*?<value>(.*?)<\/value>/i);
    const codzonaData = pmContent.match(/<Data\s+name="CODZONA"[\s\S]*?<value>(.*?)<\/value>/i);
    if (codcomData) codcom = codcomData[1].trim();
    if (codzonaData) codzona = codzonaData[1].trim();
    if (!codcom) {
      const s = pmContent.match(/<SimpleData\s+name="CODCOM">(.*?)<\/SimpleData>/i);
      if (s) codcom = s[1].trim();
    }
    if (!codzona) {
      const s = pmContent.match(/<SimpleData\s+name="CODZONA">(.*?)<\/SimpleData>/i);
      if (s) codzona = s[1].trim();
    }
    if (!codcom || !codzona) continue;
    const nameMatch = pmContent.match(/<name>(.*?)<\/name>/i);
    const comuneLabel = nameMatch ? nameMatch[1].replace(/\s*-\s*Zona OMI.*$/i, "").trim() : "";
    const polygons = extractPolygons(pmContent);
    if (polygons.length > 0) {
      results.push({ codice_comune_catastale: codcom, zona_omi: codzona, comune_label: comuneLabel, polygons });
    }
  }
  return results;
}

/* ─── Tests ─── */

const VALID_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml><Document>
<Placemark>
  <name>Roma - Zona OMI B1</name>
  <ExtendedData>
    <Data name="CODCOM"><value>H501</value></Data>
    <Data name="CODZONA"><value>B1</value></Data>
  </ExtendedData>
  <Polygon>
    <outerBoundaryIs><LinearRing><coordinates>
      12.48,41.89,0 12.50,41.89,0 12.50,41.91,0 12.48,41.91,0 12.48,41.89,0
    </coordinates></LinearRing></outerBoundaryIs>
  </Polygon>
</Placemark>
</Document></kml>`;

const MULTI_POLYGON_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml><Document>
<Placemark>
  <name>Milano - Zona OMI C2</name>
  <ExtendedData>
    <Data name="CODCOM"><value>F205</value></Data>
    <Data name="CODZONA"><value>C2</value></Data>
  </ExtendedData>
  <MultiGeometry>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        9.18,45.46,0 9.20,45.46,0 9.20,45.48,0 9.18,45.48,0 9.18,45.46,0
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        9.21,45.47,0 9.23,45.47,0 9.23,45.49,0 9.21,45.49,0 9.21,45.47,0
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </MultiGeometry>
</Placemark>
</Document></kml>`;

const SIMPLE_DATA_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml><Document>
<Placemark>
  <name>Torino - Zona OMI D1</name>
  <ExtendedData><SchemaData>
    <SimpleData name="CODCOM">L219</SimpleData>
    <SimpleData name="CODZONA">D1</SimpleData>
  </SchemaData></ExtendedData>
  <Polygon>
    <outerBoundaryIs><LinearRing><coordinates>
      7.68,45.06,0 7.70,45.06,0 7.70,45.08,0 7.68,45.08,0 7.68,45.06,0
    </coordinates></LinearRing></outerBoundaryIs>
  </Polygon>
</Placemark>
</Document></kml>`;

const CORRUPT_KML = `<?xml version="1.0"?>
<kml><Document>
<Placemark>
  <name>Bad data</name>
  <ExtendedData></ExtendedData>
  <coordinates>not,valid,data</coordinates>
</Placemark>
</Document></kml>`;

const MIXED_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml><Document>
<Placemark>
  <name>Valid</name>
  <ExtendedData>
    <Data name="CODCOM"><value>A001</value></Data>
    <Data name="CODZONA"><value>B1</value></Data>
  </ExtendedData>
  <Polygon><outerBoundaryIs><LinearRing><coordinates>
    11.0,44.0,0 11.1,44.0,0 11.1,44.1,0 11.0,44.1,0 11.0,44.0,0
  </coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark>
<Placemark>
  <name>No metadata</name>
  <Polygon><outerBoundaryIs><LinearRing><coordinates>
    11.0,44.0,0 11.1,44.0,0 11.1,44.1,0 11.0,44.1,0
  </coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark>
</Document></kml>`;

describe("KML Parser", () => {
  it("parses standard Polygon with Data tags", () => {
    const result = parseKml(VALID_KML);
    expect(result).toHaveLength(1);
    expect(result[0].codice_comune_catastale).toBe("H501");
    expect(result[0].zona_omi).toBe("B1");
    expect(result[0].comune_label).toBe("Roma");
    expect(result[0].polygons).toHaveLength(1);
    expect(result[0].polygons[0].length).toBeGreaterThanOrEqual(3);
  });

  it("parses MultiPolygon (MultiGeometry)", () => {
    const result = parseKml(MULTI_POLYGON_KML);
    expect(result).toHaveLength(1);
    expect(result[0].codice_comune_catastale).toBe("F205");
    expect(result[0].polygons).toHaveLength(2);
  });

  it("parses SimpleData tags", () => {
    const result = parseKml(SIMPLE_DATA_KML);
    expect(result).toHaveLength(1);
    expect(result[0].codice_comune_catastale).toBe("L219");
    expect(result[0].zona_omi).toBe("D1");
  });

  it("skips corrupt/invalid placemarks without crashing", () => {
    const result = parseKml(CORRUPT_KML);
    expect(result).toHaveLength(0);
  });

  it("parses valid placemarks and skips invalid ones in mixed files", () => {
    const result = parseKml(MIXED_KML);
    expect(result).toHaveLength(1);
    expect(result[0].codice_comune_catastale).toBe("A001");
  });

  it("validates coordinate bounds", () => {
    const ring = parseCoordinateBlock("999,999,0 -999,-999,0 12.5,41.9,0");
    expect(ring).toHaveLength(1); // only valid point
    expect(ring[0]).toEqual([12.5, 41.9]);
  });

  it("handles empty KML", () => {
    expect(parseKml("")).toHaveLength(0);
    expect(parseKml("<kml></kml>")).toHaveLength(0);
  });
});

describe("Batching logic", () => {
  it("processes multiple placemarks from single file", () => {
    const multiPlacemark = `<kml><Document>
      <Placemark>
        <ExtendedData><Data name="CODCOM"><value>A001</value></Data><Data name="CODZONA"><value>B1</value></Data></ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>11,44,0 11.1,44,0 11.1,44.1,0 11,44.1,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
      <Placemark>
        <ExtendedData><Data name="CODCOM"><value>A002</value></Data><Data name="CODZONA"><value>C1</value></Data></ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>12,45,0 12.1,45,0 12.1,45.1,0 12,45.1,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    </Document></kml>`;
    const result = parseKml(multiPlacemark);
    expect(result).toHaveLength(2);
    expect(result[0].codice_comune_catastale).toBe("A001");
    expect(result[1].codice_comune_catastale).toBe("A002");
  });
});
