import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface KmlIngestResult {
  ok: boolean;
  ingest?: {
    placemarksParsed: number;
    rowsUpserted: number;
    errors: number;
    errorDetails?: string[];
  };
  database?: { totalPolygons: number };
  error?: string;
}

export default function AdminOmiKmlIngest() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<KmlIngestResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      setError("Seleziona uno o più file KML");
      return;
    }

    setUploading(true);
    setError(null);
    setResults([]);

    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    const chunkResults: KmlIngestResult[] = [];

    setProgress(`0/${totalFiles} file elaborati`);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProgress(`${i + 1}/${totalFiles} — ${file.name}...`);

      try {
        const kmlData = await file.text();

        const { data, error: invokeError } = await supabase.functions.invoke("omi-kml-ingest", {
          body: { kmlData, anno: 2025, semestre: 1 },
        });

        if (invokeError) {
          chunkResults.push({ ok: false, error: `${file.name}: ${invokeError.message}` });
        } else {
          chunkResults.push(data as KmlIngestResult);
        }
      } catch (e) {
        chunkResults.push({ ok: false, error: `${file.name}: ${e instanceof Error ? e.message : String(e)}` });
      }
    }

    setResults(chunkResults);
    setProgress(`Completato — ${totalFiles} file elaborati`);
    setUploading(false);
  }, []);

  const totals = results.reduce(
    (acc, r) => {
      if (r.ingest) {
        acc.placemarksParsed += r.ingest.placemarksParsed;
        acc.rowsUpserted += r.ingest.rowsUpserted;
        acc.errors += r.ingest.errors;
      }
      if (!r.ok) acc.failedFiles++;
      return acc;
    },
    { placemarksParsed: 0, rowsUpserted: 0, errors: 0, failedFiles: 0 },
  );

  const lastDb = results.filter(r => r.database).pop()?.database;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <span className="text-xs font-semibold text-primary">Admin KML</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin")} aria-label="Torna">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </>
      } />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Import Poligoni OMI — File KML</h1>
        <p className="text-sm text-muted-foreground">
          Carica i file KML dei perimetri OMI (uno per comune). Puoi selezionare più file alla volta.
          I poligoni verranno estratti e salvati per il point-in-polygon reale.
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Carica KML
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".kml"
                multiple
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">Seleziona fino a 50 file KML alla volta</p>
            </div>

            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {uploading ? "Import in corso..." : "Avvia Import KML"}
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
                <StatBox label="Placemarks letti" value={totals.placemarksParsed} />
                <StatBox label="Zone salvate" value={totals.rowsUpserted} />
                <StatBox label="Errori" value={totals.errors} />
                <StatBox label="File falliti" value={totals.failedFiles} />
              </div>

              {lastDb && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Poligoni totali in DB:</span>{" "}
                    <strong>{lastDb.totalPolygons.toLocaleString("it-IT")}</strong>
                  </p>
                </div>
              )}

              {results.some(r => r.ingest?.errorDetails?.length) && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Errori dettaglio:</p>
                  {results.flatMap(r => r.ingest?.errorDetails ?? []).slice(0, 10).map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-lg font-bold text-foreground">{value.toLocaleString("it-IT")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
