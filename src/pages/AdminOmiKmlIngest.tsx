import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AppHeader from "@/components/AppHeader";
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, Play, RotateCcw, XCircle, Pause
} from "lucide-react";

/* ─── Types ─── */
interface FileResult {
  fileName: string;
  status: "pending" | "uploading" | "done" | "skipped" | "error";
  placemarks?: number;
  upserted?: number;
  errors?: number;
  errorMessage?: string;
  skippedReason?: string;
}

interface ImportState {
  batchId: string;
  totalFiles: number;
  completedFiles: FileResult[];
  currentIndex: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
}

function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = "sottra_kml_import_state";

function saveImportState(state: ImportState, pendingFileNames: string[]) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        batchId: state.batchId,
        completedFileNames: state.completedFiles.map((f) => f.fileName),
        pendingFileNames,
        totalFiles: state.totalFiles,
      })
    );
  } catch { /* ignore */ }
}

function loadImportState(): {
  batchId: string;
  completedFileNames: string[];
  pendingFileNames: string[];
  totalFiles: number;
} | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearImportState() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

/* ─── Component ─── */
export default function AdminOmiKmlIngest() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const [importState, setImportState] = useState<ImportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  const handleFileChange = useCallback(() => {
    const count = fileRef.current?.files?.length ?? 0;
    setSelectedCount(count);
  }, []);

  /* ─── Core import engine ─── */
  const processFiles = useCallback(
    async (files: File[], startIndex: number, batchId: string, priorResults: FileResult[]) => {
      abortRef.current = false;

      const state: ImportState = {
        batchId,
        totalFiles: priorResults.length + files.length,
        completedFiles: [...priorResults],
        currentIndex: startIndex,
        running: true,
        paused: false,
        finished: false,
      };
      setImportState({ ...state });

      for (let i = 0; i < files.length; i++) {
        if (abortRef.current) {
          state.paused = true;
          state.running = false;
          setImportState({ ...state });
          // Save remaining files for resume
          const remaining = files.slice(i).map((f) => f.name);
          saveImportState(state, remaining);
          return;
        }

        const file = files[i];
        state.currentIndex = startIndex + i;

        // Mark uploading
        const uploading: FileResult = { fileName: file.name, status: "uploading" };
        setImportState({
          ...state,
          completedFiles: [...state.completedFiles, uploading],
        });

        let result: FileResult;
        try {
          const kmlData = await file.text();

          const { data, error: invokeError } = await supabase.functions.invoke("omi-kml-ingest", {
            body: { kmlData, fileName: file.name, anno: 2025, semestre: 1, batchId },
          });

          if (invokeError) {
            result = { fileName: file.name, status: "error", errorMessage: invokeError.message };
          } else if (data?.skipped) {
            result = {
              fileName: file.name,
              status: "skipped",
              skippedReason: "Già importato (hash identico)",
            };
          } else {
            result = {
              fileName: file.name,
              status: data?.ingest?.errors > 0 ? "error" : "done",
              placemarks: data?.ingest?.placemarksParsed ?? 0,
              upserted: data?.ingest?.rowsUpserted ?? 0,
              errors: data?.ingest?.errors ?? 0,
              errorMessage: data?.ingest?.errorDetails?.join("; "),
            };
          }
        } catch (e) {
          result = {
            fileName: file.name,
            status: "error",
            errorMessage: e instanceof Error ? e.message : String(e),
          };
        }

        // Replace uploading entry with result
        state.completedFiles = [
          ...state.completedFiles.filter((f) => f.fileName !== file.name),
          result,
        ];
        setImportState({ ...state });

        // Save checkpoint for resume
        const remaining = files.slice(i + 1).map((f) => f.name);
        saveImportState(state, remaining);
      }

      state.running = false;
      state.finished = true;
      setImportState({ ...state });
      clearImportState();
    },
    []
  );

  /* ─── Start import ─── */
  const handleStartImport = useCallback(async () => {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      setError("Seleziona i file KML da importare");
      return;
    }
    setError(null);
    const batchId = generateBatchId();
    const fileArray = Array.from(files);
    await processFiles(fileArray, 0, batchId, []);
  }, [processFiles]);

  /* ─── Pause ─── */
  const handlePause = useCallback(() => {
    abortRef.current = true;
  }, []);

  /* ─── Resume ─── */
  const handleResume = useCallback(async () => {
    const saved = loadImportState();
    if (!saved) {
      setError("Nessun import da riprendere. Seleziona nuovi file.");
      return;
    }

    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      setError("Riseleziona gli stessi file KML per riprendere l'import");
      return;
    }

    const fileArray = Array.from(files);
    const pendingSet = new Set(saved.pendingFileNames);
    const pendingFiles = fileArray.filter((f) => pendingSet.has(f.name));

    if (pendingFiles.length === 0) {
      setError(
        `Nessun file pendente trovato. File attesi: ${saved.pendingFileNames.slice(0, 5).join(", ")}...`
      );
      return;
    }

    setError(null);

    // Rebuild prior results
    const priorResults: FileResult[] = saved.completedFileNames.map((name) => ({
      fileName: name,
      status: "done" as const,
    }));

    await processFiles(pendingFiles, priorResults.length, saved.batchId, priorResults);
  }, [processFiles]);

  /* ─── Reset ─── */
  const handleReset = useCallback(() => {
    setImportState(null);
    setError(null);
    setSelectedCount(0);
    clearImportState();
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  /* ─── Stats ─── */
  const stats = importState?.completedFiles.reduce(
    (acc, r) => {
      if (r.status === "done") acc.success++;
      if (r.status === "skipped") acc.skipped++;
      if (r.status === "error") acc.errors++;
      acc.placemarks += r.placemarks ?? 0;
      acc.upserted += r.upserted ?? 0;
      return acc;
    },
    { success: 0, skipped: 0, errors: 0, placemarks: 0, upserted: 0 }
  ) ?? { success: 0, skipped: 0, errors: 0, placemarks: 0, upserted: 0 };

  const progressPct = importState
    ? Math.round(
        ((importState.completedFiles.filter((f) => f.status !== "uploading").length) /
          Math.max(importState.totalFiles, 1)) *
          100
      )
    : 0;

  const hasSavedState = !!loadImportState();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader
        rightContent={
          <>
            <span className="text-xs font-semibold text-primary">Admin KML</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin")} aria-label="Torna">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
          </>
        }
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Import Massivo Poligoni OMI — KML</h1>
        <p className="text-sm text-muted-foreground">
          Seleziona centinaia di file KML OMI, avvia l'import automatico e lascia lavorare il sistema.
          L'import è idempotente (file già importati vengono saltati), rilanciabile e tollerante agli errori.
        </p>

        {/* ─── Upload Card ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Seleziona File KML
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".kml"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>{selectedCount}</strong> file selezionati
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Start */}
              <Button
                onClick={handleStartImport}
                disabled={importState?.running || selectedCount === 0}
                className="flex-1 min-w-[180px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Importa automaticamente tutti
              </Button>

              {/* Pause */}
              {importState?.running && (
                <Button variant="outline" onClick={handlePause}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausa
                </Button>
              )}

              {/* Resume */}
              {(hasSavedState || importState?.paused) && !importState?.running && (
                <Button variant="secondary" onClick={handleResume}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Riprendi import incompleto
                </Button>
              )}

              {/* Reset */}
              {importState && !importState.running && (
                <Button variant="ghost" onClick={handleReset}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Progress Card ─── */}
        {importState && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {importState.running ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : importState.finished ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Pause className="h-4 w-4 text-muted-foreground" />
                )}
                {importState.running
                  ? "Import in corso..."
                  : importState.paused
                  ? "Import in pausa"
                  : "Import completato"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {importState.completedFiles.filter((f) => f.status !== "uploading").length} / {importState.totalFiles} file
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <StatBox label="Successi" value={stats.success} color="text-primary" />
                <StatBox label="Saltati" value={stats.skipped} color="text-muted-foreground" />
                <StatBox label="Errori" value={stats.errors} color="text-destructive" />
                <StatBox label="Placemarks" value={stats.placemarks} />
                <StatBox label="Zone salvate" value={stats.upserted} />
              </div>

              {/* Current file */}
              {importState.running && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  ⏳ {importState.completedFiles.find((f) => f.status === "uploading")?.fileName ?? "..."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── File Log ─── */}
        {importState && importState.completedFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Log file ({importState.completedFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {importState.completedFiles.map((f, i) => (
                  <FileLogRow key={`${f.fileName}-${i}`} result={f} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */
function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className={`text-lg font-bold ${color ?? "text-foreground"}`}>
        {value.toLocaleString("it-IT")}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FileLogRow({ result }: { result: FileResult }) {
  const icon =
    result.status === "done" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
    ) : result.status === "skipped" ? (
      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    ) : result.status === "error" ? (
      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
    ) : (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
    );

  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-border/50 last:border-0">
      {icon}
      <span className="font-medium text-foreground truncate max-w-[200px]">{result.fileName}</span>
      {result.status === "done" && (
        <span className="text-muted-foreground">
          {result.placemarks} placemarks → {result.upserted} zone
        </span>
      )}
      {result.status === "skipped" && (
        <span className="text-muted-foreground">{result.skippedReason}</span>
      )}
      {result.status === "error" && result.errorMessage && (
        <span className="text-destructive truncate max-w-[400px]">{result.errorMessage}</span>
      )}
    </div>
  );
}
