import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertTriangle, Trash2, BarChart3, Layers } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ValidationResult {
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  invalidDetails: { index: number; zona_key: string; errors: string[] }[];
  preview: {
    zona_key: string;
    zona_label: string;
    zona_type: string;
    codice_comune_catastale: string;
    popolazione: number | null;
    hasCentroid: boolean;
    hasPolygon: boolean;
  }[];
}

interface ImportResult {
  ok: boolean;
  batchId: string;
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  insertedOrUpdated: number;
  errors?: string[];
}

interface BatchInfo {
  batchId: string;
  recordCount: number;
  comuniCount: number;
  sources: string[];
}

type Phase = "upload" | "validating" | "preview" | "importing" | "done" | "error";

const AdminDemographicImport = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<"geojson" | "csv">("csv");
  const [rawData, setRawData] = useState<unknown>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [error, setError] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => setLog(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");
    setPhase("validating");
    addLog(`File selezionato: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    try {
      const text = await file.text();
      let parsed: unknown;
      const isGeoJson = file.name.endsWith(".geojson") || file.name.endsWith(".json");

      if (isGeoJson) {
        parsed = JSON.parse(text);
        setFileFormat("geojson");
        addLog("Formato rilevato: GeoJSON");
      } else {
        // CSV parsing
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) throw new Error("CSV vuoto o senza header");
        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
        addLog(`CSV: ${lines.length - 1} righe, colonne: ${headers.join(", ")}`);

        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
          const obj: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            const val = values[idx] ?? "";
            // Try to parse numbers
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

      // Send to validation endpoint
      addLog("Invio validazione al backend...");
      const { data, error: invokeErr } = await supabase.functions.invoke("demographic-import", {
        body: {
          action: "validate",
          records: parsed,
          format: isGeoJson ? "geojson" : "csv",
        },
      });

      if (invokeErr) throw new Error(invokeErr.message);
      if (!data?.ok) throw new Error(data?.error || "Validazione fallita");

      setValidation(data as ValidationResult);
      setPhase("preview");
      addLog(`Validazione: ${data.validCount} validi, ${data.invalidCount} scartati`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
      addLog(`Errore: ${msg}`);
    }
  };

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
        },
      });

      if (invokeErr) throw new Error(invokeErr.message);

      setImportResult(data as ImportResult);
      setPhase("done");
      addLog(`Import completato: ${data.insertedOrUpdated} record inseriti/aggiornati (batch: ${data.batchId})`);

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

  const reset = () => {
    setPhase("upload");
    setFileName("");
    setRawData(null);
    setValidation(null);
    setImportResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
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
          <p className="text-sm text-muted-foreground mt-1">Carica dataset GeoJSON o CSV per popolare la tabella demographic_zones</p>
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
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{validation.totalRecords}</p>
                    <p className="text-xs text-muted-foreground">Totali</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-500">{validation.validCount}</p>
                    <p className="text-xs text-muted-foreground">Validi</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{validation.invalidCount}</p>
                    <p className="text-xs text-muted-foreground">Scartati</p>
                  </div>
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
                            <TableHead className="text-xs">Pop.</TableHead>
                            <TableHead className="text-xs">Poligono</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validation.preview.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium">{r.zona_label}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{r.zona_type}</Badge></TableCell>
                              <TableCell className="text-xs">{r.codice_comune_catastale}</TableCell>
                              <TableCell className="text-xs">{r.popolazione ?? "—"}</TableCell>
                              <TableCell>{r.hasPolygon ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="text-[10px] text-muted-foreground">No</span>}</TableCell>
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
                    <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">Record scartati</p>
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
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="text-lg font-bold text-foreground">Import completato</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{importResult.insertedOrUpdated}</p>
                  <p className="text-xs text-muted-foreground">Inseriti/Aggiornati</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{importResult.invalidCount}</p>
                  <p className="text-xs text-muted-foreground">Scartati</p>
                </div>
                <div>
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
                      <p className="text-[10px] text-muted-foreground">{b.recordCount} record · {b.comuniCount} comuni · {b.sources.join(", ")}</p>
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
