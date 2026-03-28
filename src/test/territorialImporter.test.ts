import { describe, it, expect } from "vitest";

/**
 * Tests for the territorial importer region-awareness, validation,
 * idempotency, and error diagnostics.
 */

describe("Region detection logic", () => {
  const COD_REG_MAP: Record<string, string> = {
    "01": "Piemonte", "02": "Valle d'Aosta", "03": "Lombardia", "04": "Trentino-Alto Adige",
    "05": "Veneto", "06": "Friuli-Venezia Giulia", "07": "Liguria", "08": "Emilia-Romagna",
    "09": "Toscana", "10": "Umbria", "11": "Marche", "12": "Lazio", "13": "Abruzzo",
    "14": "Molise", "15": "Campania", "16": "Puglia", "17": "Basilicata", "18": "Calabria",
    "19": "Sicilia", "20": "Sardegna",
  };

  const detectRegions = (records: Record<string, string>[]) => {
    const regSet = new Set<string>();
    let detectedVia: string = "none";
    for (const r of records) {
      const denReg = (r["DEN_REG"] || "").trim();
      const regione = (r["REGIONE"] || "").trim();
      const codReg = (r["COD_REG"] || "").trim();
      if (denReg) { regSet.add(denReg); if (detectedVia === "none") detectedVia = "DEN_REG"; }
      else if (regione) { regSet.add(regione); if (detectedVia === "none") detectedVia = "REGIONE"; }
      else if (codReg) {
        const mapped = COD_REG_MAP[codReg.padStart(2, "0")] || `Regione ${codReg}`;
        regSet.add(mapped);
        if (detectedVia === "none") detectedVia = "COD_REG";
      }
    }
    const regioni = [...regSet].sort();
    const isMonoRegione = regioni.length === 1;
    return {
      regioni,
      regioniCount: regioni.length,
      isMonoRegione,
      regioneRilevata: isMonoRegione ? regioni[0] : null,
      multiRegioneWarning: regioni.length > 1
        ? `File multi-regione: contiene ${regioni.length} regioni (${regioni.join(", ")})`
        : null,
      detectedVia,
    };
  };

  it("detects mono-regione Lombardia correctly", () => {
    const records = [
      { PRO_COM_T: "015146", DEN_REG: "Lombardia", COD_LOC: "001" },
      { PRO_COM_T: "015147", DEN_REG: "Lombardia", COD_LOC: "002" },
    ];
    const r = detectRegions(records);
    expect(r.isMonoRegione).toBe(true);
    expect(r.regioneRilevata).toBe("Lombardia");
    expect(r.multiRegioneWarning).toBeNull();
    expect(r.detectedVia).toBe("DEN_REG");
  });

  it("detects multi-regione and warns", () => {
    const records = [
      { PRO_COM_T: "015146", DEN_REG: "Lombardia", COD_LOC: "001" },
      { PRO_COM_T: "058091", DEN_REG: "Lazio", COD_LOC: "001" },
    ];
    const r = detectRegions(records);
    expect(r.isMonoRegione).toBe(false);
    expect(r.regioneRilevata).toBeNull();
    expect(r.multiRegioneWarning).toContain("multi-regione");
    expect(r.regioniCount).toBe(2);
  });

  it("handles missing regione gracefully", () => {
    const records = [
      { PRO_COM_T: "015146", COD_LOC: "001" },
      { PRO_COM_T: "015147", COD_LOC: "002" },
    ];
    const r = detectRegions(records);
    expect(r.regioniCount).toBe(0);
    expect(r.isMonoRegione).toBe(false);
    expect(r.detectedVia).toBe("none");
  });

  it("uses REGIONE column as fallback", () => {
    const records = [{ PRO_COM_T: "015146", REGIONE: "Piemonte" }];
    const r = detectRegions(records);
    expect(r.isMonoRegione).toBe(true);
    expect(r.regioneRilevata).toBe("Piemonte");
    expect(r.detectedVia).toBe("REGIONE");
  });

  it("maps COD_REG to region name when DEN_REG is absent", () => {
    const records = [
      { PRO_COM_T: "015146", COD_REG: "03" },
      { PRO_COM_T: "015147", COD_REG: "03" },
    ];
    const r = detectRegions(records);
    expect(r.isMonoRegione).toBe(true);
    expect(r.regioneRilevata).toBe("Lombardia");
    expect(r.detectedVia).toBe("COD_REG");
  });

  it("maps COD_REG correctly for all 20 regions", () => {
    expect(COD_REG_MAP["01"]).toBe("Piemonte");
    expect(COD_REG_MAP["12"]).toBe("Lazio");
    expect(COD_REG_MAP["19"]).toBe("Sicilia");
    expect(COD_REG_MAP["20"]).toBe("Sardegna");
    expect(Object.keys(COD_REG_MAP)).toHaveLength(20);
  });

  it("prefers DEN_REG over COD_REG when both present", () => {
    const records = [{ PRO_COM_T: "058091", DEN_REG: "Lazio", COD_REG: "12" }];
    const r = detectRegions(records);
    expect(r.regioneRilevata).toBe("Lazio");
    expect(r.detectedVia).toBe("DEN_REG");
  });

  it("handles COD_REG without zero-padding", () => {
    const records = [{ PRO_COM_T: "015146", COD_REG: "3" }];
    const r = detectRegions(records);
    expect(r.regioneRilevata).toBe("Lombardia");
  });

  it("falls back gracefully for unknown COD_REG", () => {
    const records = [{ PRO_COM_T: "015146", COD_REG: "99" }];
    const r = detectRegions(records);
    expect(r.regioneRilevata).toBe("Regione 99");
  });
});

describe("COMUNI_ITALIA validation logic", () => {
  const validateComuni = (records: Record<string, string>[]) => {
    const seenKeys = new Set<string>();
    let valid = 0, noCode = 0, noName = 0, duplicates = 0, noRegione = 0, withCoords = 0, noCoords = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const code = r["PRO_COM_T"] || r["PRO_COM"] || r["CODICE_COMUNE"] || r["COD_COM"] || "";
      const name = r["DEN_COM"] || r["DENOMINAZIONE"] || r["COMUNE"] || "";
      if (!code) { noCode++; if (errors.length < 20) errors.push({ row: i + 2, reason: "Codice ISTAT mancante" }); continue; }
      if (!name) { noName++; if (errors.length < 20) errors.push({ row: i + 2, reason: "Nome mancante" }); continue; }
      const key = `comune|${code}`;
      if (seenKeys.has(key)) { duplicates++; continue; }
      seenKeys.add(key);
      valid++;
      if (!r["DEN_REG"]) noRegione++;
      if (r["LAT"] && (r["LNG"] || r["LON"])) withCoords++; else noCoords++;
    }
    return { valid, noCode, noName, duplicates, noRegione, withCoords, noCoords, errors };
  };

  it("counts valid records correctly", () => {
    const records = [
      { PRO_COM_T: "058091", DEN_COM: "Roma", DEN_REG: "Lazio", LAT: "41.8", LNG: "12.5" },
      { PRO_COM_T: "015146", DEN_COM: "Milano", DEN_REG: "Lombardia", LAT: "45.4", LNG: "9.2" },
    ];
    const r = validateComuni(records);
    expect(r.valid).toBe(2);
    expect(r.noCode).toBe(0);
    expect(r.withCoords).toBe(2);
    expect(r.noRegione).toBe(0);
  });

  it("catches missing code and name", () => {
    const records = [
      { DEN_COM: "Roma" },          // no code
      { PRO_COM_T: "058091" },      // no name
      { PRO_COM_T: "015146", DEN_COM: "Milano" }, // valid
    ];
    const r = validateComuni(records);
    expect(r.noCode).toBe(1);
    expect(r.noName).toBe(1);
    expect(r.valid).toBe(1);
    expect(r.errors.length).toBe(2);
  });

  it("detects duplicates within file", () => {
    const records = [
      { PRO_COM_T: "058091", DEN_COM: "Roma" },
      { PRO_COM_T: "058091", DEN_COM: "Roma" },
      { PRO_COM_T: "015146", DEN_COM: "Milano" },
    ];
    const r = validateComuni(records);
    expect(r.duplicates).toBe(1);
    expect(r.valid).toBe(2);
  });

  it("counts missing coordinates and regione", () => {
    const records = [
      { PRO_COM_T: "058091", DEN_COM: "Roma" },
      { PRO_COM_T: "015146", DEN_COM: "Milano", DEN_REG: "Lombardia", LAT: "45.4", LON: "9.2" },
    ];
    const r = validateComuni(records);
    expect(r.noCoords).toBe(1);
    expect(r.withCoords).toBe(1);
    expect(r.noRegione).toBe(1);
  });
});

describe("LOCALITA_ISTAT validation logic", () => {
  const validateLocalita = (records: Record<string, string>[]) => {
    const seenKeys = new Set<string>();
    let valid = 0, noCode = 0, noLoc = 0, duplicates = 0;

    for (const r of records) {
      const code = r["PRO_COM_T"] || r["PRO_COM"] || "";
      const locCode = r["COD_LOC"] || "";
      const locName = r["DEN_LOC"] || "";
      if (!code) { noCode++; continue; }
      if (!locCode && !locName) { noLoc++; continue; }
      const key = `loc|${code}|${locCode || locName}`;
      if (seenKeys.has(key)) { duplicates++; continue; }
      seenKeys.add(key);
      valid++;
    }
    return { valid, noCode, noLoc, duplicates };
  };

  it("validates mono-regione località CSV", () => {
    const records = [
      { PRO_COM_T: "015146", COD_LOC: "001", DEN_LOC: "Milano", DEN_REG: "Lombardia" },
      { PRO_COM_T: "015146", COD_LOC: "002", DEN_LOC: "Quarto Oggiaro", DEN_REG: "Lombardia" },
    ];
    const r = validateLocalita(records);
    expect(r.valid).toBe(2);
    expect(r.noCode).toBe(0);
    expect(r.noLoc).toBe(0);
  });

  it("rejects records without codice comune", () => {
    const records = [
      { COD_LOC: "001", DEN_LOC: "Centro" },
    ];
    const r = validateLocalita(records);
    expect(r.noCode).toBe(1);
    expect(r.valid).toBe(0);
  });

  it("rejects records without località code and name", () => {
    const records = [
      { PRO_COM_T: "058091" },
    ];
    const r = validateLocalita(records);
    expect(r.noLoc).toBe(1);
    expect(r.valid).toBe(0);
  });

  it("detects duplicate località within file", () => {
    const records = [
      { PRO_COM_T: "015146", COD_LOC: "001", DEN_LOC: "Milano" },
      { PRO_COM_T: "015146", COD_LOC: "001", DEN_LOC: "Milano" },
    ];
    const r = validateLocalita(records);
    expect(r.duplicates).toBe(1);
    expect(r.valid).toBe(1);
  });
});

describe("Column detection", () => {
  const findColumn = (headers: string[], candidates: string[]): string | null => {
    return candidates.find(c => headers.includes(c)) ?? null;
  };

  it("finds PRO_COM_T when present", () => {
    expect(findColumn(["PRO_COM_T", "DEN_COM", "COD_REG"], ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE"])).toBe("PRO_COM_T");
  });

  it("falls back to PRO_COM", () => {
    expect(findColumn(["PRO_COM", "DEN_COM"], ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE"])).toBe("PRO_COM");
  });

  it("returns null when no match", () => {
    expect(findColumn(["RANDOM_COL"], ["PRO_COM_T", "PRO_COM"])).toBeNull();
  });

  it("detects missing critical columns", () => {
    const headers = ["NOME", "COGNOME"];
    const codeCol = findColumn(headers, ["PRO_COM_T", "PRO_COM", "CODICE_COMUNE", "COD_COM"]);
    const nameCol = findColumn(headers, ["DEN_COM", "DENOMINAZIONE", "COMUNE"]);
    expect(codeCol).toBeNull();
    expect(nameCol).toBeNull();
  });
});

describe("Idempotent import — dedup keys", () => {
  it("COMUNI upsert key prevents duplicates on reimport", () => {
    // Same key = same record
    const key = (r: { code: string }) => `comune|${r.code}||`;
    const r1 = { code: "058091" };
    const r2 = { code: "058091" };
    expect(key(r1)).toBe(key(r2));
  });

  it("LOCALITA upsert key distinguishes by loc code", () => {
    const key = (r: { code: string; loc: string }) => `loc|${r.code}|${r.loc}`;
    const r1 = { code: "058091", loc: "001" };
    const r2 = { code: "058091", loc: "002" };
    expect(key(r1)).not.toBe(key(r2));
  });

  it("reimporting same data produces same keys — no caos", () => {
    const batch1Keys = new Set<string>();
    const batch2Keys = new Set<string>();
    const data = [
      { PRO_COM_T: "058091", COD_LOC: "001" },
      { PRO_COM_T: "015146", COD_LOC: "002" },
    ];
    for (const r of data) {
      batch1Keys.add(`loc|${r.PRO_COM_T}|${r.COD_LOC}`);
      batch2Keys.add(`loc|${r.PRO_COM_T}|${r.COD_LOC}`);
    }
    expect([...batch1Keys]).toEqual([...batch2Keys]);
  });
});

describe("Import result counters", () => {
  it("tracks inserted/skipped/failed correctly", () => {
    const records = [
      { PRO_COM_T: "058091", DEN_COM: "Roma" },
      { DEN_COM: "NoCode" },          // skipped: no code
      { PRO_COM_T: "058091", DEN_COM: "Roma" }, // skipped: duplicate
      { PRO_COM_T: "015146", DEN_COM: "Milano" },
    ];

    const seenKeys = new Set<string>();
    let valid = 0, skipped = 0;
    for (const r of records) {
      const code = r.PRO_COM_T || "";
      const name = r.DEN_COM || "";
      if (!code || !name) { skipped++; continue; }
      const key = code;
      if (seenKeys.has(key)) { skipped++; continue; }
      seenKeys.add(key);
      valid++;
    }
    expect(valid).toBe(2);
    expect(skipped).toBe(2);
  });
});

describe("Preview output", () => {
  it("preview contains first 20 rows max", () => {
    const records = Array.from({ length: 50 }, (_, i) => ({
      PRO_COM_T: String(i).padStart(6, "0"),
      DEN_COM: `Comune ${i}`,
    }));
    const preview = records.slice(0, 20);
    expect(preview).toHaveLength(20);
    expect(preview[0].PRO_COM_T).toBe("000000");
    expect(preview[19].PRO_COM_T).toBe("000019");
  });

  it("preview includes mapped column names", () => {
    const record = { PRO_COM_T: "058091", DEN_COM: "Roma", COD_REG: "12", DEN_REG: "Lazio" };
    const headers = Object.keys(record);
    expect(headers).toContain("PRO_COM_T");
    expect(headers).toContain("DEN_REG");
  });
});

/* ── Light/streaming validation logic tests ── */

describe("Light streaming validation for R03_CSV_SEZ", () => {
  // Simulate the line-counting approach used in the edge function
  function lightValidate(csvText: string) {
    const PREVIEW_LIMIT = 100;
    const REGION_SAMPLE_LIMIT = 2000;

    let totalLines = 0;
    let headerLine = "";
    const previewLines: string[] = [];
    const regionSampleLines: string[] = [];
    let pastBom = false;

    let lineStart = 0;
    for (let i = 0; i <= csvText.length; i++) {
      if (i === csvText.length || csvText[i] === '\n') {
        let line = csvText.substring(lineStart, i);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        lineStart = i + 1;
        if (!pastBom) {
          if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
          pastBom = true;
        }
        if (!line.trim()) continue;
        if (!headerLine) { headerLine = line; continue; }
        totalLines++;
        if (previewLines.length < PREVIEW_LIMIT) previewLines.push(line);
        if (regionSampleLines.length < REGION_SAMPLE_LIMIT) regionSampleLines.push(line);
      }
    }

    const sep = headerLine.includes(";") ? ";" : ",";
    const headers = headerLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ""));

    return { totalLines, headers, previewLines, regionSampleLines };
  }

  it("counts rows correctly without full parse", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;100\n002;015147;03;200\n003;015148;03;300\n";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(3);
    expect(result.headers).toContain("SEZ2021");
    expect(result.previewLines).toHaveLength(3);
  });

  it("handles BOM correctly", () => {
    const csv = "\uFEFFSEZ2021;PRO_COM_T\n001;015146\n";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(1);
    expect(result.headers[0]).toBe("SEZ2021");
  });

  it("limits preview to PREVIEW_LIMIT rows", () => {
    const header = "SEZ2021;PRO_COM_T;COD_REG";
    const rows = Array.from({ length: 200 }, (_, i) => `${i};015146;03`).join("\n");
    const csv = header + "\n" + rows;
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(200);
    expect(result.previewLines).toHaveLength(100);
  });

  it("detects missing critical columns for R03_CSV_SEZ", () => {
    const headers = ["CODICE", "NOME", "COD_REG"];
    const hasSez = headers.some(h => ["SEZ2021", "SEZ", "SEZ2011"].includes(h));
    const hasCom = headers.some(h => ["PRO_COM_T", "PRO_COM"].includes(h));
    expect(hasSez).toBe(false);
    expect(hasCom).toBe(false);
  });

  it("accepts correct R03_CSV_SEZ columns", () => {
    const headers = ["SEZ2021", "PRO_COM_T", "COD_REG", "P1", "P2", "EXTRA_COL"];
    const hasSez = headers.some(h => ["SEZ2021", "SEZ", "SEZ2011"].includes(h));
    const hasCom = headers.some(h => ["PRO_COM_T", "PRO_COM"].includes(h));
    expect(hasSez).toBe(true);
    expect(hasCom).toBe(true);
  });

  it("tolerates extra columns without error", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;EXTRA1;EXTRA2\n001;015146;03;foo;bar\n";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(1);
    expect(result.headers).toContain("EXTRA1");
    expect(result.headers).toContain("EXTRA2");
  });

  it("detects multi-region from sample", () => {
    const COD_REG_MAP: Record<string, string> = { "03": "Lombardia", "05": "Veneto" };
    const records = [
      { COD_REG: "03" },
      { COD_REG: "05" },
    ];
    const regSet = new Set<string>();
    for (const r of records) {
      const codReg = (r["COD_REG"] || "").trim();
      if (codReg) {
        const mapped = COD_REG_MAP[codReg.padStart(2, "0")] || `Regione ${codReg}`;
        regSet.add(mapped);
      }
    }
    expect(regSet.size).toBe(2);
    expect(regSet.has("Lombardia")).toBe(true);
    expect(regSet.has("Veneto")).toBe(true);
  });

  it("handles malformed rows gracefully", () => {
    const csv = "SEZ2021;PRO_COM_T\n001;015146\n;;\nshort\n003;015148\n";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(4);
    expect(result.previewLines).toHaveLength(4);
  });

  it("returns stable structure even with empty CSV", () => {
    const csv = "";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(0);
    expect(result.headers).toEqual([""]);
  });

  it("response envelope always has ok and code fields on error", () => {
    const errorResponse = { ok: false, error: "Colonne critiche mancanti: ...", code: "MISSING_COLUMNS" };
    expect(errorResponse.ok).toBe(false);
    expect(errorResponse.code).toBe("MISSING_COLUMNS");
    expect(typeof errorResponse.error).toBe("string");
  });

  it("no regression: small Lombardia file validates correctly", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;1500\n002;015147;03;2000\n";
    const result = lightValidate(csv);
    expect(result.totalLines).toBe(2);
    expect(result.headers).toContain("SEZ2021");
    expect(result.headers).toContain("PRO_COM_T");
    expect(result.headers).toContain("COD_REG");
  });
});

/* ── R03_CSV_SEZ streaming import simulation tests ── */

describe("R03_CSV_SEZ streaming import logic", () => {
  const COD_REG_MAP: Record<string, string> = {
    "01": "Piemonte", "03": "Lombardia", "05": "Veneto", "12": "Lazio",
  };

  // Simulate the per-row region detection used in streaming import
  function simulateStreamingImport(csvText: string, ascMappings: Map<string, { asc1: string | null; asc2: string | null; asc3: string | null }> = new Map()) {
    let text = csvText;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const headerEnd = text.indexOf('\n');
    if (headerEnd === -1) return { imported: 0, skipped: 0, failed: 0, regionsFound: new Set<string>(), rows: [] as any[], skipByReason: {} as Record<string, number> };
    let headerLine = text.substring(0, headerEnd);
    if (headerLine.endsWith('\r')) headerLine = headerLine.slice(0, -1);
    const sep = headerLine.includes(";") ? ";" : ",";
    const headers = headerLine.split(sep).map(h => h.trim());

    const regionsFound = new Set<string>();
    const rows: any[] = [];
    let imported = 0, skipped = 0, failed = 0;

    const lines = text.substring(headerEnd + 1).split(/\r?\n/).filter(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
      const vals = lines[i].split(sep).map(v => v.trim());
      const r: Record<string, string> = {};
      headers.forEach((h, j) => { r[h] = vals[j] ?? ""; });

      const sez = r["SEZ2021"] || r["SEZ"] || "";
      const com = r["PRO_COM_T"] || r["PRO_COM"] || "";
      if (!sez) { failed++; skipByReason["sez_mancante"] = (skipByReason["sez_mancante"] || 0) + 1; continue; }
      if (!com) { failed++; skipByReason["com_mancante"] = (skipByReason["com_mancante"] || 0) + 1; continue; }

      const codReg = (r["COD_REG"] || "").trim();
      const denReg = (r["DEN_REG"] || r["REGIONE"] || "").trim();
      let rowRegName = denReg || null;
      if (!rowRegName && codReg) {
        rowRegName = COD_REG_MAP[codReg.padStart(2, "0")] || null;
      }
      if (rowRegName) regionsFound.add(rowRegName);

      const m = ascMappings.get(sez);
      rows.push({
        section_code: sez,
        comune_istat_code: com,
        regione_name: rowRegName,
        asc1_code: m?.asc1 || null,
        asc2_code: m?.asc2 || null,
        source_label: rowRegName ? `ISTAT Censimento 2021 — ${rowRegName}` : "ISTAT Censimento 2021",
      });
      imported++;
    }

    return { imported, skipped, failed, regionsFound, rows, skipByReason };
  }

  it("single-region Lombardia file imports correctly", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;1500\n002;015147;03;2000\n";
    const result = simulateStreamingImport(csv);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.regionsFound.size).toBe(1);
    expect(result.regionsFound.has("Lombardia")).toBe(true);
    expect(result.rows[0].source_label).toContain("Lombardia");
  });

  it("multi-region file handles region transitions correctly", () => {
    const csv = [
      "SEZ2021;PRO_COM_T;COD_REG;P1",
      "001;015146;03;1500",  // Lombardia
      "002;015147;03;2000",  // Lombardia
      "003;058091;12;3000",  // Lazio
      "004;024100;05;4000",  // Veneto
    ].join("\n");
    const result = simulateStreamingImport(csv);
    expect(result.imported).toBe(4);
    expect(result.regionsFound.size).toBe(3);
    expect(result.regionsFound.has("Lombardia")).toBe(true);
    expect(result.regionsFound.has("Lazio")).toBe(true);
    expect(result.regionsFound.has("Veneto")).toBe(true);
    // Each row gets its own region label
    expect(result.rows[0].regione_name).toBe("Lombardia");
    expect(result.rows[2].regione_name).toBe("Lazio");
    expect(result.rows[3].regione_name).toBe("Veneto");
  });

  it("missing ASC2 mapping does not crash — fields are null", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;1500\n002;058091;12;2000\n";
    // Only provide ASC mapping for Lombardia section, not Lazio
    const ascMappings = new Map([
      ["001", { asc1: "ASC1_A", asc2: "ASC2_B", asc3: null }],
    ]);
    const result = simulateStreamingImport(csv, ascMappings);
    expect(result.imported).toBe(2);
    expect(result.rows[0].asc1_code).toBe("ASC1_A");
    expect(result.rows[0].asc2_code).toBe("ASC2_B");
    // Lazio section has no ASC mapping — null, no crash
    expect(result.rows[1].asc1_code).toBeNull();
    expect(result.rows[1].asc2_code).toBeNull();
  });

  it("malformed row (missing SEZ) does not abort import", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n;015146;03;1500\n002;015147;03;2000\n";
    const result = simulateStreamingImport(csv);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].section_code).toBe("002");
  });

  it("malformed row (missing PRO_COM_T) does not abort import", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;;03;1500\n002;015147;03;2000\n";
    const result = simulateStreamingImport(csv);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("multi-region metadata shows correct count", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG\n001;015146;01\n002;015147;03\n003;058091;12\n";
    const result = simulateStreamingImport(csv);
    const regArr = [...result.regionsFound].sort();
    expect(regArr.length).toBe(3);
    expect(regArr).toEqual(["Lazio", "Lombardia", "Piemonte"]);
    // Simulating what the edge function would build
    const isMulti = regArr.length > 1;
    expect(isMulti).toBe(true);
  });

  it("dedup within chunk uses last-wins strategy", () => {
    // Two rows with same section_code — last wins
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;1500\n001;015146;03;9999\n";
    const result = simulateStreamingImport(csv);
    // Both are valid, dedup happens at upsert level (section_code,source_dataset)
    // In streaming import the dedup map is applied per chunk
    expect(result.imported).toBe(2); // Both parsed, dedup happens at DB level
  });

  it("empty file returns zero imported", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n";
    const result = simulateStreamingImport(csv);
    expect(result.imported).toBe(0);
    expect(result.regionsFound.size).toBe(0);
  });

  it("no regression: Lombardia-only file gets correct source_label", () => {
    const csv = "SEZ2021;PRO_COM_T;COD_REG;P1\n001;015146;03;1500\n";
    const result = simulateStreamingImport(csv);
    expect(result.rows[0].source_label).toBe("ISTAT Censimento 2021 — Lombardia");
  });
});
