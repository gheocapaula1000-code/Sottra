import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertTriangle, Trash2, BarChart3, Layers, Settings2, Database } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Types ──────────────────────────────────────────── */

interface PreviewRecord {
  zona_key: string;
  zona_label: string;
  zona_type: string;
  codice_comune_catastale: string;
  comune_label?: string;
  coverage_level?: string;
  anno_rilevazione?: string | null;
  source_label?: string;
  is_official?: boolean;
  popolazione: number | null;
  hasCentroid: boolean;
  hasPolygon: boolean;
  hasZonaOmi?: boolean;
}

interface ValidationResult {
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  duplicatesInBatch?: number;
  dedupedCount?: number;
  invalidDetails: { index: number; zona_key: string; errors: string[] }[];
  preview: PreviewRecord[];
  sourceColumns?: string[];
  distinctComuni?: number;
  coverageLevels?: string[];
  anniRilevazione?: string[];
  sourceLabels?: string[];
  withPolygon?: number;
  withCentroid?: number;
  withZonaOmi?: number;
  dedupKey?: string;
}

interface ImportResult {
  ok: boolean;
  batchId: string;
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  insertedOrUpdated: number;
  duplicatesInBatch?: number;
  dedupedCount?: number;
  errors?: string[];
}

interface BatchInfo {
  batchId: string;
  recordCount: number;
  comuniCount: number;
  sources: string[];
  coverageLevels?: string[];
  anni?: string[];
  createdAt?: string;
}

interface StatsResult {
  totalRecords: number;
  distinctComuni: number;
  coverageBreakdown: Record<string, number>;
  annoBreakdown: Record<string, number>;
  officialBreakdown: { official: number; nonOfficial: number };
  sourceBreakdown: Record<string, number>;
  withPolygon: number;
  withPolygonPct: number;
  withCentroid: number;
  withCentroidPct: number;
  matchableViaZonaOmi: number;
  matchableViaPolygon: number;
}

const TARGET_FIELDS = [
  "codice_comune_catastale", "zona_key", "zona_label", "zona_type",
  "coverage_level", "data_quality", "is_official", "source_label",
  "source_type", "anno_rilevazione", "codice_comune_istat", "comune_label",
  "zona_omi", "popolazione", "nuclei_familiari", "densita", "eta_media",
  "indice_vecchiaia", "percentuale_stranieri", "percentuale_giovani",
  "percentuale_famiglie", "flusso_residenti_12m", "centroid_lat", "centroid_lng",
  "notes",
];

/** Robust RFC 4180-ish CSV parser: handles quoted fields, internal separators, newlines inside quotes */
function parseCSVRows(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++; // skip \n
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

type Phase = "upload" | "validating" | "mapping" | "preview" | "importing" | "done" | "error";

const AdminDemographicImport = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<"geojson" | "csv">("csv");
  const [rawData, setRawData] = useState<unknown>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({
    coverage_level: "sezione_censimento",
    data_quality: "standard",
    is_official: "true",
    source_label: "ISTAT Censimento",
    source_type: "official",
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [error, setError] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => setLog(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

  /* ── File parsing ──────────────────────────── */

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");
    addLog(`File selezionato: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    try {
      const text = await file.text();
      let parsed: unknown;
      let columns: string[] = [];
      const isGeoJson = file.name.endsWith(".geojson") || file.name.endsWith(".json");

      if (isGeoJson) {
        parsed = JSON.parse(text);
        setFileFormat("geojson");
        addLog("Formato rilevato: GeoJSON");
        // Extract columns from first feature
        const geo = parsed as Record<string, unknown>;
        if (geo.type === "FeatureCollection" && Array.isArray(geo.features) && geo.features.length > 0) {
          const props = ((geo.features[0] as Record<string, unknown>).properties ?? {}) as Record<string, unknown>;
          columns = Object.keys(props);
        }
      } else {
        // Robust CSV parsing: handles quoted fields, internal commas/semicolons, BOM, empty rows
        let cleanText = text;
        // Strip UTF-8 BOM
        if (cleanText.charCodeAt(0) === 0xFEFF) cleanText = cleanText.slice(1);

        // Detect separator: semicolon vs comma (check first line)
        const firstLine = cleanText.split(/\r?\n/)[0] ?? "";
        const sep = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";

        const allRows = parseCSVRows(cleanText, sep);
        if (allRows.length < 2) throw new Error("CSV vuoto o senza header");

        const headers = allRows[0].map(h => h.trim());
        columns = headers;
        addLog(`CSV: ${allRows.length - 1} righe, separatore "${sep}", colonne: ${headers.join(", ")}`);

        const records = [];
        for (let i = 1; i < allRows.length; i++) {
          const values = allRows[i];
          if (values.length === 1 && values[0].trim() === "") continue; // skip empty rows
          const obj: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            const val = (values[idx] ?? "").trim();
            if (val !== "" && !isNaN(Number(val))) {
              obj[h] = Number(val);
            } else if (val.toLowerCase() === "true") {
              obj[h] = true;
            } else if (val.toLowerCase() === "false") {
              obj[h] = false;
            } else {
              obj[h] = val || null;
            }
          });
          records.push(obj);
        }
        parsed = records;
        setFileFormat("csv");
      }

      setRawData(parsed);
      setSourceColumns(columns);

      // Auto-map columns that match target fields exactly
      const autoMap: Record<string, string> = {};
      for (const col of columns) {
        if (TARGET_FIELDS.includes(col)) {
          autoMap[col] = col;
        }
      }
      setFieldMapping(autoMap);

      addLog(`Colonne sorgente: ${columns.join(", ")}`);
      addLog(`Auto-mapping: ${Object.keys(autoMap).length}/${columns.length} colonne mappate`);
      setPhase("mapping");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
      addLog(`Errore: ${msg}`);
    }
  };

  /* ── Validation ────────────────────────────── */

  const runValidation = async () => {
    setPhase("validating");
    addLog("Invio validazione al backend...");

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("demographic-import", {
        body: {
          action: "validate",
          records: rawData,
          format: fileFormat === "geojson" ? "geojson" : "csv",
          fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
          defaults: Object.fromEntries(
            Object.entries(defaults).filter(([, v]) => v !== "")
              .map(([k, v]) => [k, v === "true" ? true : v === "false" ? false : v])
          ),
        },
      });

      if (invokeErr) throw new Error(invokeErr.message);
      if (!data?.ok) throw new Error(data?.error || "Validazione fallita");

      setValidation(data as ValidationResult);
      setPhase("preview");
      addLog(`Validazione: ${data.validCount} validi, ${data.invalidCount} scartati, ${data.distinctComuni ?? "?"} comuni`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
      addLog(`Errore: ${msg}`);
    }
  };

  /* ── Import ────────────────────────────────── */

  const handleImport = async () => {
    if (!rawData) return;
    setPhase("importing");
    addLog("Avvio import...");

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("demographic-import", {
        body: {
          action: "import",
          records: rawData,
          format: fileFormat === "geojson" ? "geojson" : "csv",
          batchId: crypto.randomUUID(),
          fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
          defaults: Object.fromEntries(
            Object.entries(defaults).filter(([, v]) => v !== "")
              .map(([k, v]) => [k, v === "true" ? true : v === "false" ? false : v])
          ),
        },
      });

      if (invokeErr) throw new Error(invokeErr.message);

      setImportResult(data as ImportResult);
      setPhase("done");
      addLog(`Import completato: ${data.insertedOrUpdated} inseriti/aggiornati, ${data.duplicatesInBatch ?? 0} duplicati rimossi (batch: ${data.batchId})`);

      if (data.errors?.length) {
        data.errors.forEach((e: string) => addLog(`⚠ ${e}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
      addLog(`Errore import: ${msg}`);
    }
  };

  /* ── Batches ───────────────────────────────── */

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("demographic-import", {
        body: { action: "list-batches" },
      });
      if (error) throw error;
      setBatches(data?.batches ?? []);
    } catch (err) {
      addLog(`Errore caricamento batch: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const rollbackBatch = async (batchId: string) => {
    if (!confirm(`Eliminare tutti i record del batch ${batchId.slice(0, 8)}...?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("demographic-import", {
        body: { action: "rollback", batchId },
      });
      if (error) throw error;
      addLog(`Rollback: ${data.deletedCount} record eliminati (batch ${batchId.slice(0, 8)}...)`);
      loadBatches();
    } catch (err) {
      addLog(`Errore rollback: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /* ── Stats ─────────────────────────────────── */

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("demographic-import", {
        body: { action: "stats" },
      });
      if (error) throw error;
      setStats(data as StatsResult);
      addLog(`Stats: ${data.totalRecords} record, ${data.distinctComuni} comuni`);
    } catch (err) {
      addLog(`Errore stats: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /* ── Reset ─────────────────────────────────── */

  const reset = () => {
    setPhase("upload");
    setFileName("");
    setRawData(null);
    setSourceColumns([]);
    setFieldMapping({});
    setValidation(null);
    setImportResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateMapping = (sourceCol: string, targetCol: string) => {
    setFieldMapping(prev => {
      const next = { ...prev };
      if (targetCol === "__ignore__") {
        delete next[sourceCol];
      } else {
        next[sourceCol] = targetCol;
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <span className="text-xs font-semibold text-primary">Admin</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin")} aria-label="Torna ad admin">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </>
      } />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Import Dati Demografici Sub-Comunali</h1>
          <p className="text-sm text-muted-foreground mt-1">Carica dataset GeoJSON o CSV per popolare demographic_zones</p>
        </div>

        {/* Upload */}
        {(phase === "upload" || phase === "error") && (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Seleziona un file GeoJSON o CSV</p>
                  <p className="text-xs text-muted-foreground">Campi richiesti: codice_comune_catastale, zona_key, zona_label, zona_type, source_label, source_type</p>
                </div>
                <input ref={fileRef} type="file" accept=".geojson,.json,.csv" className="hidden" onChange={handleFile} />
                <Button onClick={() => fileRef.current?.click()} className="min-h-[44px]">
                  <FileText className="h-4 w-4 mr-2" />Carica file
                </Button>
                {error && (
                  <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Field Mapping */}
        {phase === "mapping" && sourceColumns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Mapping campi — {fileName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">Associa le colonne sorgente ai campi target di demographic_zones. Le colonne con nome identico sono mappate automaticamente.</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {sourceColumns.map(col => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-foreground min-w-[120px] truncate" title={col}>{col}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select value={fieldMapping[col] ?? "__ignore__"} onValueChange={v => updateMapping(col, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">— ignora —</SelectItem>
                        {TARGET_FIELDS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Defaults */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Valori predefiniti (applicati se non presenti nel file)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">coverage_level</Label>
                    <Select value={defaults.coverage_level} onValueChange={v => setDefaults(p => ({ ...p, coverage_level: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["sezione_censimento", "area_subcomunale", "microzona", "quartiere", "zona", "comune"].map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">data_quality</Label>
                    <Select value={defaults.data_quality} onValueChange={v => setDefaults(p => ({ ...p, data_quality: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alto">alto</SelectItem>
                        <SelectItem value="standard">standard</SelectItem>
                        <SelectItem value="basso">basso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">source_label</Label>
                    <Input className="h-8 text-xs" value={defaults.source_label} onChange={e => setDefaults(p => ({ ...p, source_label: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">source_type</Label>
                    <Select value={defaults.source_type} onValueChange={v => setDefaults(p => ({ ...p, source_type: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">official</SelectItem>
                        <SelectItem value="elaborated">elaborated</SelectItem>
                        <SelectItem value="estimate">estimate</SelectItem>
                        <SelectItem value="community">community</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">anno_rilevazione</Label>
                    <Input className="h-8 text-xs" placeholder="es. 2021" value={defaults.anno_rilevazione ?? ""} onChange={e => setDefaults(p => ({ ...p, anno_rilevazione: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">is_official</Label>
                    <Select value={defaults.is_official} onValueChange={v => setDefaults(p => ({ ...p, is_official: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sì (ufficiale)</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={runValidation} className="min-h-[44px]">
                  <CheckCircle2 className="h-4 w-4 mr-2" />Valida con questo mapping
                </Button>
                <Button variant="outline" onClick={reset} className="min-h-[44px]">Annulla</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validating */}
        {phase === "validating" && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-4" />
              <p className="text-sm text-foreground">Validazione in corso: {fileName}</p>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {phase === "preview" && validation && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Riepilogo validazione — {fileName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{validation.totalRecords}</p>
                    <p className="text-xs text-muted-foreground">Totali</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-primary">{validation.validCount}</p>
                    <p className="text-xs text-muted-foreground">Validi (insert/update)</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-destructive">{validation.invalidCount}</p>
                    <p className="text-xs text-muted-foreground">Scartati</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{validation.distinctComuni ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">Comuni distinti</p>
                  </div>
                  {(validation.duplicatesInBatch ?? 0) > 0 && (
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-2xl font-bold text-muted-foreground">{validation.duplicatesInBatch}</p>
                      <p className="text-xs text-muted-foreground">Duplicati intra-batch</p>
                    </div>
                  )}
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2">
                  {validation.coverageLevels?.map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px]">coverage: {c}</Badge>
                  ))}
                  {validation.anniRilevazione?.map(a => (
                    <Badge key={a} variant="outline" className="text-[10px]">anno: {a}</Badge>
                  ))}
                  {validation.withPolygon != null && (
                    <Badge variant="outline" className="text-[10px]">
                      {validation.withPolygon}/{validation.validCount} con poligono
                    </Badge>
                  )}
                  {validation.withZonaOmi != null && (
                    <Badge variant="outline" className="text-[10px]">
                      {validation.withZonaOmi} con zona_omi
                    </Badge>
                  )}
                </div>

                {/* Preview table */}
                {validation.preview.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Anteprima (primi 10 record validi)</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Zona</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs">Comune</TableHead>
                            <TableHead className="text-xs">Coverage</TableHead>
                            <TableHead className="text-xs">Anno</TableHead>
                            <TableHead className="text-xs">Fonte</TableHead>
                            <TableHead className="text-xs">Pop.</TableHead>
                            <TableHead className="text-xs">Geom</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validation.preview.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium max-w-[140px] truncate">{r.zona_label}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{r.zona_type}</Badge></TableCell>
                              <TableCell className="text-xs">{r.codice_comune_catastale}</TableCell>
                              <TableCell className="text-xs">{r.coverage_level ?? "—"}</TableCell>
                              <TableCell className="text-xs">{r.anno_rilevazione && r.anno_rilevazione !== "0000" ? r.anno_rilevazione : "—"}</TableCell>
                              <TableCell className="text-xs">
                                <span className="truncate max-w-[80px] inline-block">{r.source_label ?? "—"}</span>
                                {r.is_official && <Badge variant="default" className="text-[9px] h-4 ml-1">uff.</Badge>}
                              </TableCell>
                              <TableCell className="text-xs">{r.popolazione ?? "—"}</TableCell>
                              <TableCell className="text-xs">
                                {r.hasPolygon ? <CheckCircle2 className="h-3.5 w-3.5 text-primary inline" /> : "—"}
                                {r.hasZonaOmi && <span className="ml-1 text-[10px] text-primary">OMI</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Invalid details */}
                {validation.invalidDetails.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">Record scartati ({validation.invalidCount})</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {validation.invalidDetails.map((inv, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                          <span><span className="font-mono text-muted-foreground">#{inv.index}</span> {inv.zona_key}: {inv.errors.join("; ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleImport} disabled={validation.validCount === 0} className="min-h-[44px]">
                    <Upload className="h-4 w-4 mr-2" />Importa {validation.validCount} record
                  </Button>
                  <Button variant="outline" onClick={() => setPhase("mapping")} className="min-h-[44px]">Modifica mapping</Button>
                  <Button variant="outline" onClick={reset} className="min-h-[44px]">Annulla</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Importing */}
        {phase === "importing" && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-4" />
              <p className="text-sm text-foreground">Import in corso...</p>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {phase === "done" && importResult && (
          <Card>
            <CardContent className="py-8 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <p className="text-lg font-bold text-foreground">Import completato</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-2xl font-bold text-foreground">{importResult.insertedOrUpdated}</p>
                  <p className="text-xs text-muted-foreground">Inseriti/Aggiornati</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-2xl font-bold text-muted-foreground">{importResult.invalidCount}</p>
                  <p className="text-xs text-muted-foreground">Scartati</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-2xl font-bold text-muted-foreground">{importResult.duplicatesInBatch ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Duplicati rimossi</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-mono text-muted-foreground break-all">{importResult.batchId.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">Batch ID</p>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  {importResult.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                </div>
              )}
              <Button onClick={reset} className="min-h-[44px]">Nuovo import</Button>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Statistiche demographic_zones
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadStats}>Aggiorna</Button>
            </div>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <p className="text-sm text-muted-foreground">Clicca "Aggiorna" per caricare le statistiche</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{stats.totalRecords}</p>
                    <p className="text-xs text-muted-foreground">Record totali</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{stats.distinctComuni}</p>
                    <p className="text-xs text-muted-foreground">Comuni coperti</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{stats.withPolygonPct}%</p>
                    <p className="text-xs text-muted-foreground">Con geometria</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-2xl font-bold text-foreground">{stats.matchableViaZonaOmi}</p>
                    <p className="text-xs text-muted-foreground">Match via zona_omi</p>
                  </div>
                </div>

                {/* Breakdowns */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {Object.keys(stats.coverageBreakdown).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Per coverage_level</p>
                      <div className="space-y-1">
                        {Object.entries(stats.coverageBreakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-foreground">{k}</span>
                            <span className="font-mono text-muted-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.keys(stats.annoBreakdown).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Per anno</p>
                      <div className="space-y-1">
                        {Object.entries(stats.annoBreakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-foreground">{k}</span>
                            <span className="font-mono text-muted-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.keys(stats.sourceBreakdown).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Per fonte</p>
                      <div className="space-y-1">
                        {Object.entries(stats.sourceBreakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-foreground truncate max-w-[180px]">{k}</span>
                            <span className="font-mono text-muted-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Ufficialità</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground flex items-center gap-1">
                          <Badge variant="default" className="text-[9px] h-4">ufficiale</Badge>
                        </span>
                        <span className="font-mono text-muted-foreground">{stats.officialBreakdown.official}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground flex items-center gap-1">
                          <Badge variant="secondary" className="text-[9px] h-4">non ufficiale</Badge>
                        </span>
                        <span className="font-mono text-muted-foreground">{stats.officialBreakdown.nonOfficial}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Batch importati
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadBatches}>Carica</Button>
            </div>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clicca "Carica" per visualizzare i batch esistenti</p>
            ) : (
              <div className="space-y-2">
                {batches.map(b => (
                  <div key={b.batchId} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-xs font-mono text-foreground">{b.batchId.slice(0, 12)}...</p>
                      <p className="text-[10px] text-muted-foreground">
                        {b.recordCount} record · {b.comuniCount} comuni · {b.sources.join(", ")}
                        {b.coverageLevels?.length ? ` · ${b.coverageLevels.join(", ")}` : ""}
                        {b.anni?.length ? ` · ${b.anni.join(", ")}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => rollbackBatch(b.batchId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log */}
        {log.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Log operazioni</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-[11px] text-muted-foreground">
                {log.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AdminDemographicImport;
