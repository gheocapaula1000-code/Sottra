import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import {
  ArrowLeft, Database, MapPin, Layers, AlertTriangle, CheckCircle2,
  XCircle, Search, BarChart3, GitCompare, Upload, FileText, Clock,
  RefreshCw, Loader2,
} from "lucide-react";
import { fetchSubMunicipalStats } from "@/lib/subMunicipalImporter";
import { findSubMunicipalArea, type SubMunicipalMatch } from "@/lib/pointInPolygon";
import { fetchR03Stats, validateAscSectionCoherence, type AscValidationReport } from "@/lib/r03Importer";
import { toast } from "sonner";

type Stats = NonNullable<Awaited<ReturnType<typeof fetchSubMunicipalStats>>>;
type R03Stats = NonNullable<Awaited<ReturnType<typeof fetchR03Stats>>>;

interface DatasetJob {
  id: string;
  dataset_type: string;
  status: string;
  file_name: string;
  file_size_bytes: number | null;
  records_total: number;
  records_imported: number;
  records_errors: number;
  records_skipped: number;
  import_batch_id: string | null;
  validation_result: Record<string, unknown>;
  error_log: unknown[];
  warnings: unknown[];
  stats: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

const DATASET_TYPES: Record<string, { label: string; description: string; accept: string }> = {
  COMUNI_ITALIA: { label: "Comuni Italia", description: "CSV anagrafe comuni ISTAT (PRO_COM_T, DEN_COM, COD_PRO, DEN_PRO, COD_REG, DEN_REG...)", accept: ".csv" },
  LOCALITA_ISTAT: { label: "Località ISTAT", description: "CSV località abitate ISTAT (PRO_COM_T, COD_LOC, DEN_LOC, TIPO_LOC...)", accept: ".csv" },
  ASC_2021: { label: "ASC 2021 Nazionale", description: "CSV con aree sub-comunali ISTAT 2021 (COD_ASC, DEN_ASC, PRO_COM_T, POP_RES...)", accept: ".csv" },
  R03_CSV_ASC1: { label: "R03 — ASC1 Mapping", description: "ASC1_R03_21.csv — mapping sezioni → ASC livello 1", accept: ".csv" },
  R03_CSV_ASC2: { label: "R03 — ASC2 Mapping", description: "ASC2_R03_21.csv — mapping sezioni → ASC livello 2", accept: ".csv" },
  R03_CSV_SEZ: { label: "R03 — Sezioni Lombardia", description: "SEZ_R03_21.csv — sezioni censuarie con P1, P14, A2, E3...", accept: ".csv" },
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  validated: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  validating: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ready_to_import: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  importing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  imported: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
};

// Job filter state
type JobFilter = { dataset?: string; regione?: string };

const AdminSubMunicipal = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [r03Stats, setR03Stats] = useState<R03Stats | null>(null);
  const [r03Loading, setR03Loading] = useState(true);
  const [ascValidation, setAscValidation] = useState<AscValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [testLat, setTestLat] = useState("45.4064");
  const [testLng, setTestLng] = useState("11.8768");
  const [testResult, setTestResult] = useState<SubMunicipalMatch | null | "no_match" | "error">(null);
  const [testing, setTesting] = useState(false);

  // Upload/jobs state
  const [jobs, setJobs] = useState<DatasetJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Debug trace for last operation
  const [debugTrace, setDebugTrace] = useState<{
    datasetType?: string;
    filePath?: string;
    uploadOk?: boolean;
    uploadError?: string;
    insertJobOk?: boolean;
    insertJobError?: string;
    jobId?: string;
    listJobsOk?: boolean;
    listJobsError?: string;
    lastError?: string;
    timestamp?: string;
  } | null>(null);

  // Aggregation state
  const [aggStats, setAggStats] = useState<{ aggregates: number; stats: any; sample: any[] } | null>(null);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggregating, setAggregating] = useState(false);

  // Filter state
  const [jobFilter, setJobFilter] = useState<JobFilter>({});

  const refreshAll = useCallback(() => {
    fetchSubMunicipalStats().then(s => { setStats(s); setLoading(false); });
    fetchR03Stats().then(s => { setR03Stats(s); setR03Loading(false); });
    loadJobs();
    loadAggStats();
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const loadAggStats = async () => {
    setAggLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("territorial-import", { body: { action: "get-aggregation-stats" } });
      if (!error && data?.ok) setAggStats({ aggregates: data.aggregates, stats: data.stats, sample: data.sample ?? [] });
    } catch { /* ignore */ }
    setAggLoading(false);
  };

  const runAggregation = async () => {
    setAggregating(true);
    try {
      const { data, error } = await supabase.functions.invoke("territorial-import", { body: { action: "aggregate-r03" } });
      if (error) toast.error(`Errore aggregazione: ${error.message}`);
      else if (data?.error) toast.error(data.error);
      else toast.success(`Aggregazione completata: ${data?.imported ?? 0} aggregati generati`);
      await loadAggStats();
    } catch { toast.error("Errore aggregazione"); }
    setAggregating(false);
  };

  const loadJobs = async (): Promise<{ ok: boolean; error?: string }> => {
    setJobsLoading(true);
    setJobsError(null);
    let result: { ok: boolean; error?: string } = { ok: false, error: "unknown" };
    try {
      const { data, error } = await supabase.functions.invoke("territorial-import", { body: { action: "list-jobs" } });
      if (error) {
        const msg = `Errore caricamento jobs: ${error.message}`;
        setJobsError(msg);
        toast.error(msg);
        result = { ok: false, error: msg };
      } else if (data?.error) {
        const msg = data.error.includes("Admin") || data.error.includes("owner")
          ? `Permessi insufficienti per list-jobs: ${data.error}`
          : `Errore list-jobs: ${data.error}`;
        setJobsError(msg);
        toast.error(msg);
        result = { ok: false, error: msg };
      } else if (data?.jobs) {
        setJobs(data.jobs);
        result = { ok: true };
      } else {
        const msg = "Risposta list-jobs inattesa (nessun array jobs)";
        setJobsError(msg);
        result = { ok: false, error: msg };
      }
    } catch (e: any) {
      const msg = `Errore rete list-jobs: ${e?.message ?? "sconosciuto"}`;
      setJobsError(msg);
      toast.error(msg);
      result = { ok: false, error: msg };
    }
    setJobsLoading(false);
    return result;
  };

  const handleUpload = async (datasetType: string, file: File) => {
    setUploading(datasetType);
    const trace: typeof debugTrace = { datasetType, timestamp: new Date().toISOString() };
    setDebugTrace(trace);

    // Phase 1: Storage upload
    const path = `imports/${datasetType}/${Date.now()}_${file.name}`;
    trace.filePath = path;
    try {
      const { error: upErr } = await supabase.storage.from("territorial-datasets").upload(path, file);
      if (upErr) {
        const msg = upErr.message.includes("policy")
          ? `Upload storage negato da policy RLS: ${upErr.message}`
          : upErr.message.includes("bucket")
          ? `Bucket 'territorial-datasets' non trovato o non accessibile`
          : `Upload storage fallito: ${upErr.message}`;
        trace.uploadOk = false;
        trace.uploadError = msg;
        trace.lastError = msg;
        setDebugTrace({ ...trace });
        toast.error(msg);
        setUploading(null);
        return;
      }
      trace.uploadOk = true;
    } catch (e: any) {
      trace.uploadOk = false;
      trace.uploadError = e?.message ?? "Errore rete";
      trace.lastError = trace.uploadError;
      setDebugTrace({ ...trace });
      toast.error(`Errore rete upload: ${trace.uploadError}`);
      setUploading(null);
      return;
    }

    // Phase 2: Insert job record
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data: insertData, error: jobErr } = await supabase.from("territorial_dataset_jobs" as any).insert({
        dataset_type: datasetType,
        file_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        created_by: userId,
      } as any).select("id").single();

      if (jobErr) {
        const msg = jobErr.message.includes("row-level security")
          ? `Creazione job negata da RLS — verifica permessi admin/owner: ${jobErr.message}`
          : `Creazione job fallita: ${jobErr.message}`;
        trace.insertJobOk = false;
        trace.insertJobError = msg;
        trace.lastError = msg;
        setDebugTrace({ ...trace });
        toast.error(msg);

        // Rollback: delete uploaded file
        toast.info("Rollback: rimozione file dallo storage...");
        await supabase.storage.from("territorial-datasets").remove([path]);

        setUploading(null);
        return;
      }

      trace.insertJobOk = true;
      trace.jobId = (insertData as any)?.id ?? "unknown";
    } catch (e: any) {
      trace.insertJobOk = false;
      trace.insertJobError = e?.message ?? "Errore rete";
      trace.lastError = trace.insertJobError;
      setDebugTrace({ ...trace });
      toast.error(`Errore rete creazione job: ${trace.insertJobError}`);
      // Rollback
      await supabase.storage.from("territorial-datasets").remove([path]);
      setUploading(null);
      return;
    }

    // Phase 3: Reload jobs
    toast.success(`File caricato: ${file.name} — Job ID: ${trace.jobId}`);
    const listResult = await loadJobs();
    trace.listJobsOk = listResult.ok;
    if (!listResult.ok) {
      trace.listJobsError = listResult.error ?? "Reload lista jobs fallito dopo insert";
      toast.warning(`Job creato (${trace.jobId}) ma lista non aggiornata — prova Aggiorna`);
    }
    setDebugTrace({ ...trace });
    setUploading(null);
  };

  const validateJob = async (jobId: string) => {
    setProcessing(jobId);
    try {
      const { data, error } = await supabase.functions.invoke("territorial-import", { body: { action: "validate-csv", jobId } });
      if (error) {
        const msg = error.message.includes("Failed to") ? "Edge function non raggiungibile — controlla la connessione" : `Errore validazione: ${error.message}`;
        toast.error(msg);
      } else if (data?.error) {
        const msg = data.error.includes("Admin") || data.error.includes("owner") ? `Permessi insufficienti per validate: ${data.error}` : data.error;
        toast.error(msg);
      } else {
        toast.success("Validazione completata — controlla i risultati prima di importare");
      }
      await loadJobs();
    } catch (e: any) { toast.error(`Errore rete validazione: ${e?.message ?? "sconosciuto"}`); }
    setProcessing(null);
  };

  const processJob = async (jobId: string) => {
    setProcessing(jobId);
    try {
      const { data, error } = await supabase.functions.invoke("territorial-import", { body: { action: "process-csv", jobId } });
      if (error) {
        const msg = error.message.includes("Failed to") ? "Edge function non raggiungibile — controlla la connessione" : `Errore import: ${error.message}`;
        toast.error(msg);
      } else if (data?.error) {
        const msg = data.error.includes("Admin") || data.error.includes("owner") ? `Permessi insufficienti per import: ${data.error}` : data.error;
        toast.error(msg);
      } else {
        toast.success(`Import completato: ${data?.imported ?? 0} record importati`);
      }
      await loadJobs();
      refreshAll();
    } catch (e: any) { toast.error(`Errore rete import: ${e?.message ?? "sconosciuto"}`); }
    setProcessing(null);
  };

  const runTest = async () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setTesting(true);
    setTestResult(null);
    try {
      const match = await findSubMunicipalArea(lat, lng);
      setTestResult(match ?? "no_match");
    } catch { setTestResult("error"); }
    setTesting(false);
  };

  const runAscValidation = async () => {
    setValidating(true);
    setAscValidation(null);
    try {
      const result = await validateAscSectionCoherence();
      setAscValidation(result);
    } catch { setAscValidation(null); }
    setValidating(false);
  };

  const isLayerActive = stats && stats.totalRecords > 0 && stats.withGeometry > 0;
  const isR03Present = r03Stats && r03Stats.totalSections > 0;

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Dataset Territoriali — Console Admin</h1>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} className="h-8">
            <RefreshCw className="h-3 w-3 mr-1" /> Aggiorna
          </Button>
        </div>

        {/* Status Banner */}
        <Card className={isLayerActive ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              {isLayerActive ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />}
              <div className="text-sm space-y-2">
                <p className={`font-medium ${isLayerActive ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {isLayerActive ? "Layer ASC attivo — collegato al resolver territoriale" : "Layer ASC non attivo — nessun dato caricato"}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <Database className="h-3 w-3" /> ASC: {stats?.totalRecords?.toLocaleString("it-IT") ?? 0} record
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isR03Present ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                    <BarChart3 className="h-3 w-3" /> R03: {r03Stats?.totalSections?.toLocaleString("it-IT") ?? 0} sezioni
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <MapPin className="h-3 w-3" /> Report: {isLayerActive ? "arricchimento attivo" : "solo OMI/ISTAT"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ UPLOAD SECTION ═══ */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Upload className="h-5 w-5" /> Carica Dataset
          </h2>
          <p className="text-xs text-muted-foreground">Carica file CSV ufficiali ISTAT per popolare le tabelle territoriali</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(DATASET_TYPES).map(([type, meta]) => (
            <Card key={type} className="border-dashed">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <div>
                  <input
                    type="file"
                    accept={meta.accept}
                    disabled={uploading !== null}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(type, f);
                      e.target.value = "";
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {uploading === type && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Caricamento...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ordine di import consigliato */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-foreground mb-1">Ordine di import consigliato per R03 Lombardia:</p>
            <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-0.5">
              <li>Carica <strong>ASC1_R03_21.csv</strong> e <strong>ASC2_R03_21.csv</strong> → lancia import per registrarli</li>
              <li>Carica <strong>SEZ_R03_21.csv</strong> → lancia import (usa automaticamente i mapping ASC)</li>
              <li>Per ASC nazionale: carica il CSV ASC_2021 con le aree sub-comunali</li>
            </ol>
          </CardContent>
        </Card>

        {/* ═══ JOBS SECTION ═══ */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5" /> Import Jobs
          </h2>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 pt-1">
            <select
              value={jobFilter.dataset ?? ""}
              onChange={e => setJobFilter(f => ({ ...f, dataset: e.target.value || undefined }))}
              className="h-7 text-xs rounded border bg-background px-2 text-foreground"
            >
              <option value="">Tutti i dataset</option>
              {Object.keys(DATASET_TYPES).map(dt => <option key={dt} value={dt}>{dt}</option>)}
            </select>
            <select
              value={jobFilter.regione ?? ""}
              onChange={e => setJobFilter(f => ({ ...f, regione: e.target.value || undefined }))}
              className="h-7 text-xs rounded border bg-background px-2 text-foreground"
            >
              <option value="">Tutte le regioni</option>
              {[...new Set(jobs.map(j => {
                const vr = (j.validation_result as any)?.region?.regioneRilevata;
                return vr || null;
              }).filter(Boolean))].sort().map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* Inline error for jobs */}
        {jobsError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{jobsError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug panel */}
        {debugTrace && (
          <Card className="border-muted bg-muted/20">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Debug — Ultimo tentativo ({debugTrace.timestamp})</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Dataset: <strong className="text-foreground">{debugTrace.datasetType ?? "—"}</strong></span>
                <span>Upload: <strong className={debugTrace.uploadOk ? "text-emerald-600" : debugTrace.uploadOk === false ? "text-destructive" : "text-foreground"}>
                  {debugTrace.uploadOk === true ? "OK" : debugTrace.uploadOk === false ? "FAIL" : "—"}
                </strong></span>
                <span>Job insert: <strong className={debugTrace.insertJobOk ? "text-emerald-600" : debugTrace.insertJobOk === false ? "text-destructive" : "text-foreground"}>
                  {debugTrace.insertJobOk === true ? "OK" : debugTrace.insertJobOk === false ? "FAIL" : "—"}
                </strong></span>
                <span>List-jobs: <strong className={debugTrace.listJobsOk ? "text-emerald-600" : debugTrace.listJobsOk === false ? "text-destructive" : "text-foreground"}>
                  {debugTrace.listJobsOk === true ? "OK" : debugTrace.listJobsOk === false ? "FAIL" : "—"}
                </strong></span>
                {debugTrace.jobId && <span className="col-span-2">Job ID: <strong className="text-foreground font-mono">{debugTrace.jobId}</strong></span>}
                {debugTrace.filePath && <span className="col-span-2 truncate">Path: <strong className="text-foreground font-mono">{debugTrace.filePath}</strong></span>}
                {debugTrace.lastError && <span className="col-span-4 text-destructive">Errore: {debugTrace.lastError}</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {jobsLoading && jobs.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : jobs.length === 0 && !jobsError ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nessun job di import</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {jobs
              .filter(job => {
                if (jobFilter.dataset && job.dataset_type !== jobFilter.dataset) return false;
                if (jobFilter.regione) {
                  const vr = (job.validation_result as any)?.region?.regioneRilevata;
                  if (vr !== jobFilter.regione) return false;
                }
                return true;
              })
              .map(job => {
              const vr = job.validation_result as any;
              const regionInfo = vr?.region;
              const isMonoRegione = regionInfo?.isMonoRegione;
              const regioneRilevata = regionInfo?.regioneRilevata;
              const multiWarning = regionInfo?.multiRegioneWarning;

              return (
              <Card key={job.id}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{job.file_name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[job.status] ?? ""}`}>{job.status}</Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{job.dataset_type}</Badge>
                        {regioneRilevata && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            {regioneRilevata}
                          </Badge>
                        )}
                        {isMonoRegione === false && regionInfo?.regioniCount > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            multi-regione ({regionInfo.regioniCount})
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {job.file_size_bytes && <span>{(job.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>}
                        <span>{new Date(job.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span>
                        {job.records_imported > 0 && <span className="text-emerald-600">{job.records_imported.toLocaleString("it-IT")} importati</span>}
                        {job.records_skipped > 0 && <span className="text-amber-600">{job.records_skipped.toLocaleString("it-IT")} skipped</span>}
                        {job.records_errors > 0 && <span className="text-destructive">{job.records_errors} errori</span>}
                      </div>
                      {multiWarning && (
                        <div className="mt-1 text-xs text-amber-600 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{multiWarning}</span>
                        </div>
                      )}
                      {Array.isArray(job.warnings) && job.warnings.length > 0 && !multiWarning && (
                        <div className="mt-1 text-xs text-amber-600">{job.warnings.map((w, i) => <span key={i} className="block">{String(w)}</span>)}</div>
                      )}

                      {/* Enhanced validation results */}
                      {job.status === "validated" && vr && (
                        <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1">
                          <p className="font-medium text-foreground">Risultato validazione:</p>
                          <p>Righe totali: {vr.totalRows ?? "—"}</p>

                          {/* Missing critical columns */}
                          {vr.missingCriticalColumns?.length > 0 && (
                            <div className="text-destructive font-medium">
                              ⚠ Colonne critiche mancanti: {vr.missingCriticalColumns.join("; ")}
                            </div>
                          )}

                          {/* Column mapping */}
                          {vr.headersFound && (
                            <div className="text-muted-foreground">
                              Colonne mappate: {Object.entries(vr.headersFound).map(([k, v]) => (
                                <span key={k} className={`inline-block mr-2 ${v ? "" : "text-destructive"}`}>{k}→{String(v ?? "❌")}</span>
                              ))}
                            </div>
                          )}

                          {/* Region info */}
                          {vr.region && (
                            <p>
                              Regioni ({vr.region.regioniCount}): {vr.region.regioni?.join(", ")}
                              {vr.region.isMonoRegione && <span className="text-emerald-600 ml-1">(mono-regione ✓)</span>}
                            </p>
                          )}

                          {/* Import preview */}
                          <div className="flex flex-wrap gap-3">
                            {vr.validRows != null && <span className="text-emerald-600">Valide: {vr.validRows}</span>}
                            {vr.invalidRows > 0 && <span className="text-destructive">Invalide: {vr.invalidRows}</span>}
                            {vr.duplicates > 0 && <span className="text-amber-600">Duplicati: {vr.duplicates}</span>}
                            {vr.noCode > 0 && <span className="text-destructive">Senza codice: {vr.noCode}</span>}
                            {vr.noName > 0 && <span className="text-destructive">Senza nome: {vr.noName}</span>}
                            {vr.noRegione > 0 && <span className="text-amber-600">Senza regione: {vr.noRegione}</span>}
                            {vr.withCoords != null && <span>Con coord: {vr.withCoords}</span>}
                            {vr.noCoords > 0 && <span className="text-amber-600">Senza coord: {vr.noCoords}</span>}
                          </div>

                          {vr.recordsToImport != null && (
                            <p className="font-medium">→ Record da importare: <span className="text-emerald-600">{vr.recordsToImport}</span> — Da scartare: <span className="text-amber-600">{vr.recordsToSkip}</span></p>
                          )}

                          {/* Skip reasons */}
                          {vr.skipReasons && Object.keys(vr.skipReasons).length > 0 && (
                            <div className="text-muted-foreground">
                              Motivi scarto: {Object.entries(vr.skipReasons).map(([k, v]) => <span key={k} className="mr-2">{k}: {String(v)}</span>)}
                            </div>
                          )}

                          {/* First errors */}
                          {vr.errors?.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-destructive cursor-pointer">Primi {vr.errors.length} errori</summary>
                              <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-destructive/20">
                                {vr.errors.slice(0, 20).map((e: any, i: number) => (
                                  <div key={i} className="text-destructive">Riga {e.row}: {e.reason}</div>
                                ))}
                              </div>
                            </details>
                          )}

                          {/* Preview rows */}
                          {vr.preview?.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground">Anteprima prime {vr.preview.length} righe</summary>
                              <div className="mt-1 overflow-x-auto max-h-40 overflow-y-auto">
                                <table className="text-[10px] border-collapse">
                                  <thead>
                                    <tr>
                                      {Object.keys(vr.preview[0]).slice(0, 8).map(h => (
                                        <th key={h} className="border px-1 py-0.5 bg-muted text-left font-medium">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vr.preview.slice(0, 10).map((row: any, ri: number) => (
                                      <tr key={ri}>
                                        {Object.keys(vr.preview[0]).slice(0, 8).map(h => (
                                          <td key={h} className="border px-1 py-0.5 truncate max-w-[120px]">{row[h] ?? ""}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}

                          {/* Legacy comuni/localita display for backward compat */}
                          {vr.comuni && !vr.validRows && (
                            <>
                              <p className="text-emerald-600">Valide: {vr.comuni.valid}</p>
                              {vr.comuni.noIstat > 0 && <p className="text-destructive">Senza codice ISTAT: {vr.comuni.noIstat}</p>}
                              <p>Con coordinate: {vr.comuni.withCoords} — Senza: {vr.comuni.withoutCoords}</p>
                              <p>Regioni ({vr.comuni.regioniCount}): {vr.comuni.regioni?.join(", ")}</p>
                            </>
                          )}
                          {vr.localita && !vr.validRows && (
                            <>
                              <p className="text-emerald-600">Valide: {vr.localita.valid}</p>
                              {vr.localita.noIstat > 0 && <p className="text-destructive">Senza codice ISTAT comune: {vr.localita.noIstat}</p>}
                              <p>Con centroidi: {vr.localita.withCoords} — Senza: {vr.localita.withoutCoords}</p>
                              <p>Comuni distinti: {vr.localita.comuni}</p>
                              <p>Regioni ({vr.localita.regioniCount}): {vr.localita.regioni?.join(", ")}</p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Import results */}
                      {job.status === "imported" && (job.stats as any)?.importResult && (
                        <div className="mt-1 flex gap-2 text-xs flex-wrap">
                          {(job.stats as any).importResult.processed != null && <span className="text-foreground">processed: {(job.stats as any).importResult.processed}</span>}
                          <span className="text-emerald-600">inserted: {(job.stats as any).importResult.inserted}</span>
                          <span className="text-blue-600">updated: {(job.stats as any).importResult.updated}</span>
                          <span className="text-amber-600">skipped: {(job.stats as any).importResult.skipped}</span>
                          {(job.stats as any).importResult.failed > 0 && <span className="text-destructive">failed: {(job.stats as any).importResult.failed}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {(job.status === "uploaded") && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => validateJob(job.id)} disabled={processing !== null}>
                          {processing === job.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Valida
                        </Button>
                      )}
                      {job.status === "validated" && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => processJob(job.id)} disabled={processing !== null}>
                          {processing === job.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Importa
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}

        {/* ═══ ASC STATS ═══ */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5" /> Layer ASC — Stato
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !stats || stats.totalRecords === 0 ? (
          <Card><CardContent className="py-8 text-center"><Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nessun dato ASC caricato. Usa la sezione upload sopra per caricare un dataset.</p></CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Record</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{stats.totalRecords.toLocaleString("it-IT")}</p><p className="text-xs text-muted-foreground">{stats.comuniDistinti} comuni</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Geometrie</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{stats.withGeometry.toLocaleString("it-IT")}</p><p className="text-xs text-muted-foreground">{stats.withCentroid} centroidi</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Popolazione</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{stats.withPopolazione.toLocaleString("it-IT")}</p><p className="text-xs text-muted-foreground">record con dato</p></CardContent>
            </Card>
            {Object.keys(stats.byLevel).length > 0 && (
              <Card className="md:col-span-3">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Per livello ASC</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {Object.entries(stats.byLevel).map(([k, v]) => <span key={k} className="text-muted-foreground">Livello {k}: <strong className="text-foreground">{v.toLocaleString("it-IT")}</strong></span>)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ R03 STATS ═══ */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> R03 Lombardia — Stato
          </h2>
        </div>

        {r03Loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !r03Stats || r03Stats.totalSections === 0 ? (
          <Card><CardContent className="py-8 text-center"><Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">Dataset R03 non importato. Carica i file CSV sopra.</p></CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Sezioni</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{r03Stats.totalSections.toLocaleString("it-IT")}</p><p className="text-xs text-muted-foreground">{r03Stats.comuniDistinti} comuni</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Popolazione</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{r03Stats.totalPopulation.toLocaleString("it-IT")}</p><p className="text-xs text-muted-foreground">{r03Stats.withPopulation} sezioni con dato</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Codici ASC</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm space-y-0.5">
                  <p className="text-muted-foreground">ASC1: <strong className="text-foreground">{r03Stats.asc1Distinti}</strong> ({r03Stats.sectionsWithAsc1} sez)</p>
                  <p className="text-muted-foreground">ASC2: <strong className="text-foreground">{r03Stats.asc2Distinti}</strong> ({r03Stats.sectionsWithAsc2} sez)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Geometrie</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Poligoni: {r03Stats.withGeometry} · Centroidi: {r03Stats.withCentroid}</p></CardContent>
            </Card>
          </div>
        )}

        {/* ═══ R03→ASC AGGREGATION ═══ */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Aggregazione R03 → ASC
          </h2>
          <p className="text-xs text-muted-foreground">Aggrega sezioni censuarie R03 verso aree sub-comunali ASC per il report pubblico</p>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                {aggLoading ? (
                  <p className="text-xs text-muted-foreground">Caricamento...</p>
                ) : aggStats && aggStats.aggregates > 0 ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{aggStats.aggregates} aggregati generati</p>
                    {aggStats.stats && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{aggStats.stats.comuni} comuni</span>
                        <span>disponibili: {aggStats.stats.available}</span>
                        <span>parziali: {aggStats.stats.partial}</span>
                        {aggStats.stats.byLevel && Object.entries(aggStats.stats.byLevel).map(([k, v]) => (
                          <span key={k}>ASC{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun aggregato. Importa prima le sezioni R03 e poi lancia l'aggregazione.</p>
                )}
              </div>
              <Button size="sm" className="h-8" onClick={runAggregation} disabled={aggregating || !isR03Present}>
                {aggregating ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Aggregazione...</> : "Genera aggregati"}
              </Button>
            </div>
            {aggStats && aggStats.sample && aggStats.sample.length > 0 && (
              <div className="rounded border p-2 text-xs space-y-1">
                <p className="font-medium text-foreground">Esempi aggregati:</p>
                {aggStats.sample.map((s: any, i: number) => (
                  <div key={i} className="text-muted-foreground">
                    ASC{s.asc_level} {s.asc_code} ({s.asc_name ?? "n/a"}) — {s.comune_name} — pop: {s.population_2021?.toLocaleString("it-IT") ?? "n/d"} — {s.coverage_status}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ VALIDATION ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> Validazione ASC ↔ Sezioni R03
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Confronta codici ASC nelle sezioni R03 con il layer ASC (scoped ai comuni R03).</p>
            <Button size="sm" onClick={runAscValidation} disabled={validating} className="h-8">
              {validating ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Validazione...</> : "Esegui validazione"}
            </Button>

            {ascValidation && (
              <div className="space-y-3">
                {ascValidation.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                    {ascValidation.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /><span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded bg-muted/30 border p-2 text-xs text-muted-foreground">
                  Perimetro: <strong className="text-foreground">solo comuni R03</strong> ({ascValidation.r03ComuniCovered} comuni)
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Sezioni</p><p className="font-bold">{ascValidation.totalSections.toLocaleString("it-IT")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Comuni</p><p className="font-bold">{ascValidation.r03ComuniCovered}</p></div>
                  <div><p className="text-xs text-muted-foreground">Senza ASC</p><p className="font-bold">{ascValidation.sectionsWithoutAscPct.toFixed(1)}%</p></div>
                </div>
                {[
                  { label: "ASC1", detail: ascValidation.asc1, pct: ascValidation.sectionsWithAsc1Pct },
                  { label: "ASC2", detail: ascValidation.asc2, pct: ascValidation.sectionsWithAsc2Pct },
                ].filter(l => l.detail.codesInSections.size > 0).map(({ label, detail, pct }) => (
                  <div key={label} className="rounded border p-2 text-xs space-y-1">
                    <p className="font-medium text-foreground">{label} — {pct.toFixed(1)}% sezioni coperte</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div><p className="text-muted-foreground">In sezioni</p><p className="font-semibold">{detail.codesInSections.size}</p></div>
                      <div><p className="text-muted-foreground">Nel layer</p><p className="font-semibold">{detail.codesInLayer.size}</p></div>
                      <div><p className="text-muted-foreground">Match</p><p className={`font-semibold ${detail.coveragePct > 50 ? "text-emerald-600" : "text-amber-600"}`}>{detail.matched.length} ({detail.coveragePct.toFixed(1)}%)</p></div>
                      <div><p className="text-muted-foreground">Mismatch</p><p className="font-semibold">{detail.unmatchedInSections.length}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ TEST TOOL ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" /> Test Point-in-Polygon ASC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Lat</label>
                <Input value={testLat} onChange={e => setTestLat(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Lng</label>
                <Input value={testLng} onChange={e => setTestLng(e.target.value)} className="h-8 text-sm" />
              </div>
              <Button size="sm" onClick={runTest} disabled={testing} className="h-8">
                {testing ? "..." : "Test"}
              </Button>
            </div>
            {testResult === "no_match" && (
              <div className="flex items-center gap-2 text-sm text-amber-600"><XCircle className="h-4 w-4" /><span>Nessun match ASC</span></div>
            )}
            {testResult === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" /><span>Errore</span></div>
            )}
            {testResult && testResult !== "no_match" && testResult !== "error" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium"><CheckCircle2 className="h-4 w-4" /> Match</div>
                <p><strong>Area:</strong> {testResult.area_name} · <strong>Codice:</strong> {testResult.area_code}</p>
                <p className="text-muted-foreground"><strong>Comune:</strong> {testResult.comune_name} · <strong>Livello:</strong> {testResult.asc_level ?? "n/a"}</p>
                {testResult.popolazione != null && <p className="text-muted-foreground"><strong>Popolazione:</strong> {testResult.popolazione.toLocaleString("it-IT")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminSubMunicipal;
