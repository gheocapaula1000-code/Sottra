import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const CHUNK_SIZE = 3000; // lines per chunk

interface IngestResult {
  ok: boolean;
  mode?: string;
  ingest?: {
    linesRead: number;
    rowsParsed: number;
    rowsInserted: number;
    rowsSkipped: number;
    skipReasons?: Record<string, number>;
    batchErrors?: number;
    errorDetails?: string[];
  };
  database?: Record<string, number>;
  error?: string;
}

export default function AdminOmiIngest() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"valori" | "zone">("valori");
  const [anno, setAnno] = useState("2025");
  const [semestre, setSemestre] = useState("1");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<IngestResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Seleziona un file CSV"); return; }

    setUploading(true);
    setError(null);
    setResults([]);

    try {
      const text = await file.text();
      const allLines = text.split("\n").filter(l => l.trim());

      // Strip title line if present (line 1 of OMI CSVs)
      let lines = allLines;
      if (lines.length > 0 && lines[0].split(";").length < 5) {
        lines = lines.slice(1);
      }

      if (lines.length < 2) {
        setError("Il CSV non contiene righe di dati");
        setUploading(false);
        return;
      }

      const header = lines[0];
      const dataLines = lines.slice(1);
      const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);

      setProgress(`0/${totalChunks} chunk — ${dataLines.length} righe totali`);

      const chunkResults: IngestResult[] = [];

      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = dataLines.slice(i, i + CHUNK_SIZE);
        const csvData = [header, ...chunk].join("\n");

        setProgress(`${chunkNum}/${totalChunks} chunk in corso...`);

        const { data, error: invokeError } = await supabase.functions.invoke("omi-ingest", {
          body: {
            csvData,
            anno: parseInt(anno),
            semestre: parseInt(semestre),
            mode,
          },
        });

        if (invokeError) {
          chunkResults.push({ ok: false, error: `Chunk ${chunkNum}: ${invokeError.message}` });
        } else {
          chunkResults.push(data as IngestResult);
        }
      }

      setResults(chunkResults);
      setProgress(`Completato — ${totalChunks} chunk elaborati`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }, [anno, semestre, mode]);

  // Aggregate results
  const totals = results.reduce(
    (acc, r) => {
      if (r.ingest) {
        acc.linesRead += r.ingest.linesRead;
        acc.rowsParsed += r.ingest.rowsParsed;
        acc.rowsInserted += r.ingest.rowsInserted;
        acc.rowsSkipped += r.ingest.rowsSkipped;
        acc.batchErrors += r.ingest.batchErrors ?? 0;
      }
      if (!r.ok) acc.failedChunks++;
      return acc;
    },
    { linesRead: 0, rowsParsed: 0, rowsInserted: 0, rowsSkipped: 0, batchErrors: 0, failedChunks: 0 },
  );

  const lastDb = results.filter(r => r.database).pop()?.database;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <span className="text-xs font-semibold text-primary">Admin OMI</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin")} aria-label="Torna">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </>
      } />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Import OMI — CSV Reale</h1>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Carica CSV OMI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                <Select value={mode} onValueChange={(v) => setMode(v as "valori" | "zone")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valori">Valori (quotazioni)</SelectItem>
                    <SelectItem value="zone">Zone (info zona)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Anno</label>
                <Select value={anno} onValueChange={setAnno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Semestre</label>
                <Select value={semestre} onValueChange={setSemestre}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1° semestre</SelectItem>
                    <SelectItem value="2">2° semestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {uploading ? "Importazione in corso..." : "Avvia Import"}
            </Button>

            {progress && (
              <p className="text-sm text-muted-foreground text-center">{progress}</p>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Risultato Import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <Stat label="Righe lette" value={totals.linesRead} />
                <Stat label="Righe valide" value={totals.rowsParsed} />
                <Stat label="Inserite/aggiornate" value={totals.rowsInserted} />
                <Stat label="Scartate" value={totals.rowsSkipped} />
              </div>

              {totals.batchErrors > 0 && (
                <p className="text-sm text-destructive">Errori batch: {totals.batchErrors}</p>
              )}
              {totals.failedChunks > 0 && (
                <p className="text-sm text-destructive">Chunk falliti: {totals.failedChunks}/{results.length}</p>
              )}

              {lastDb && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Stato DB dopo import:</p>
                  {Object.entries(lastDb).map(([k, v]) => (
                    <p key={k} className="text-sm text-foreground">
                      <span className="text-muted-foreground">{k}:</span> <strong>{v}</strong>
                    </p>
                  ))}
                </div>
              )}

              {/* Show skip reasons from first chunk that has them */}
              {results.find(r => r.ingest?.skipReasons)?.ingest?.skipReasons && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Motivi di scarto (primo chunk):</p>
                  {Object.entries(results.find(r => r.ingest?.skipReasons)!.ingest!.skipReasons!).map(([k, v]) => (
                    v > 0 && <p key={k} className="text-xs text-muted-foreground">{k}: {v}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-lg font-bold text-foreground">{value.toLocaleString("it-IT")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
