import { useState, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeAnncsuRecord,
  summarizeAnncsuBatch,
  type AnncsuRawRecord,
  type AnncsuNormalizedRecord,
  type AnncsuBatchSummary,
} from "@/lib/anncsuSchema";
import {
  queryAnncsuByComune,
  queryAnncsuStreetCandidates,
  type AnncsuStreetRecord,
} from "@/lib/anncsuQueryLayer";

const readinessBadge = (status: string) => {
  switch (status) {
    case "ready": return <Badge className="bg-emerald-600 text-white">Pronto</Badge>;
    case "ready_with_warnings": return <Badge className="bg-amber-500 text-white">Con avvisi</Badge>;
    case "blocked": return <Badge variant="destructive">Bloccato</Badge>;
    case "review_needed": return <Badge className="bg-orange-500 text-white">Revisione</Badge>;
    case "partial_only": return <Badge variant="secondary">Parziale</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const jobStatusBadge = (status: string) => {
  switch (status) {
    case "imported": return <Badge className="bg-emerald-600 text-white">Importato</Badge>;
    case "importing": return <Badge className="bg-blue-500 text-white">In corso</Badge>;
    case "pending_next_chunk": return <Badge className="bg-amber-500 text-white">In pausa</Badge>;
    case "validated": return <Badge className="bg-cyan-600 text-white">Validato</Badge>;
    case "uploaded": return <Badge variant="secondary">Caricato</Badge>;
    case "failed": case "failed_stale": return <Badge variant="destructive">Fallito</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function AdminAnncsuReadiness() {
  // Single record inspection
  const [singleResult, setSingleResult] = useState<AnncsuNormalizedRecord | null>(null);
  const [batchSummary, setBatchSummary] = useState<AnncsuBatchSummary | null>(null);
  const [batchSample, setBatchSample] = useState<AnncsuNormalizedRecord[]>([]);
  const [codReg, setCodReg] = useState("03");
  const [codProv, setCodProv] = useState("015");
  const [codCom, setCodCom] = useState("015146");
  const [denomCom, setDenomCom] = useState("Milano");
  const [specie, setSpecie] = useState("Via");
  const [denomStrada, setDenomStrada] = useState("Roma");
  const [codStrada, setCodStrada] = useState("");
  const [civico, setCivico] = useState("42");
  const [esponente, setEsponente] = useState("");

  // Ingest state
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Query state
  const [queryComune, setQueryComune] = useState("015146");
  const [queryStreet, setQueryStreet] = useState("");
  const [queryResults, setQueryResults] = useState<AnncsuStreetRecord[]>([]);

  const handleNormalize = () => {
    const raw: AnncsuRawRecord = {};
    if (codReg) raw.COD_REG = codReg;
    if (codProv) raw.COD_PROV = codProv;
    if (codCom) raw.COD_COM = codCom;
    if (denomCom) raw.DENOM_COM = denomCom;
    if (specie) raw.SPECIE = specie;
    if (denomStrada) raw.DENOM_STRADA = denomStrada;
    if (codStrada) raw.COD_STRADA = codStrada;
    if (civico) raw.CIVICO = civico;
    if (esponente) raw.ESPONENTE = esponente;
    setSingleResult(normalizeAnncsuRecord(raw));
  };

  const handleDemoBatch = () => {
    const samples: AnncsuRawRecord[] = [
      { COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_COM: "Milano", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1", COD_STRADA: "001" },
      { COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_COM: "Milano", SPECIE: "Corso", DENOM_STRADA: "Buenos Aires", CIVICO: "33", ESPONENTE: "A" },
      { COD_REG: "12", COD_PROV: "058", COD_COM: "058091", DENOM_COM: "Roma", SPECIE: "P.zza", DENOM_STRADA: "Venezia", CIVICO: "11" },
      { COD_REG: "07", COD_PROV: "037", COD_COM: "037006", DENOM_COM: "Bologna", DENOM_STRADA: "Indipendenza" },
      { DENOM_STRADA: "Sconosciuta", CIVICO: "1" },
      { COD_COM: "015146", COD_REG: "03", COD_PROV: "015" },
    ];
    const normalized = samples.map((r) => normalizeAnncsuRecord(r));
    setBatchSample(normalized);
    setBatchSummary(summarizeAnncsuBatch(normalized));
  };

  // Load ANNCSU jobs
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data } = await supabase
        .from("territorial_dataset_jobs")
        .select("*")
        .eq("dataset_type", "ANNCSU_CSV")
        .order("created_at", { ascending: false })
        .limit(20);
      setJobs(data ?? []);
    } catch { /* ignore */ }
    setLoadingJobs(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading("upload");
    try {
      const path = `anncsu/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("territorial-datasets").upload(path, file);
      if (upErr) throw upErr;

      const { error: jobErr } = await supabase.from("territorial_dataset_jobs").insert({
        dataset_type: "ANNCSU_CSV",
        file_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        status: "uploaded",
      });
      if (jobErr) throw jobErr;
      toast.success(`File caricato: ${file.name}`);
      await loadJobs();
    } catch (err) {
      toast.error(`Upload fallito: ${err}`);
    }
    setActionLoading(null);
  };

  const handleValidate = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const { data, error } = await supabase.functions.invoke("anncsu-import", {
        body: { action: "validate", job_id: jobId },
      });
      if (error) throw error;
      toast.success(`Validazione completata: ${data.ingest_eligible}/${data.total} eligible`);
      await loadJobs();
    } catch (err) {
      toast.error(`Validazione fallita: ${err}`);
    }
    setActionLoading(null);
  };

  const handleImport = async (jobId: string, offset?: number) => {
    setActionLoading(jobId);
    try {
      const { data, error } = await supabase.functions.invoke("anncsu-import", {
        body: { action: "import", job_id: jobId, offset },
      });
      if (error) throw error;
      if (data.status === "pending_next_chunk") {
        toast.info(`Chunk completato — offset ${data.offset}/${data.total}. Riprendi per continuare.`);
      } else {
        toast.success(`Import completato: ${data.inserted} inseriti, ${data.errors} errori`);
      }
      await loadJobs();
    } catch (err) {
      toast.error(`Import fallito: ${err}`);
    }
    setActionLoading(null);
  };

  // Query stored data
  const handleQuery = async () => {
    if (!queryComune) return;
    const res = queryStreet
      ? await queryAnncsuStreetCandidates(queryComune, queryStreet, 30)
      : await queryAnncsuByComune(queryComune, 30);
    if (res.ok) {
      setQueryResults(res.records);
    } else {
      toast.error((res as { ok: false; error: string }).error);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ANNCSU — Stradario ufficiale</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Readiness, ingest controllato, quality gates e interrogazione dati ANNCSU.
          </p>
        </div>

        {/* Promotion Policy Banner */}
        <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⚠️ Policy P1: i flag di promozione restano bloccati a <code>false</code>.
              ANNCSU da solo NON qualifica per building truth né per precise location.
            </p>
          </CardContent>
        </Card>

        {/* ── INGEST SECTION ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ingest operativo</CardTitle>
            <CardDescription>Carica, valida e importa file CSV ANNCSU</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={actionLoading === "upload"} className="max-w-xs" />
              <Button variant="outline" onClick={loadJobs} disabled={loadingJobs}>
                {loadingJobs ? "Caricamento…" : "Aggiorna job"}
              </Button>
            </div>

            {jobs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Job recenti</h4>
                {jobs.map((j: Record<string, unknown>) => {
                  const jobId = j.id as string;
                  const status = j.status as string;
                  const stats = (j.stats ?? {}) as Record<string, unknown>;
                  return (
                    <div key={jobId} className="border rounded p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        {jobStatusBadge(status)}
                        <span className="font-mono text-xs">{(j.file_name as string) ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">
                          {j.records_total ? `${j.records_total} righe` : ""}
                          {j.records_imported ? ` · ${j.records_imported} importati` : ""}
                          {j.records_errors ? ` · ${j.records_errors} errori` : ""}
                        </span>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {status === "uploaded" && (
                          <Button size="sm" variant="outline" onClick={() => handleValidate(jobId)} disabled={actionLoading === jobId}>
                            Valida
                          </Button>
                        )}
                        {status === "validated" && (
                          <Button size="sm" onClick={() => handleImport(jobId)} disabled={actionLoading === jobId}>
                            Importa
                          </Button>
                        )}
                        {status === "pending_next_chunk" && (
                          <Button size="sm" onClick={() => handleImport(jobId, (stats.last_offset as number) ?? 0)} disabled={actionLoading === jobId}>
                            Riprendi da offset {(stats.last_offset as number) ?? 0}
                          </Button>
                        )}
                      </div>

                      {j.validation_result && typeof j.validation_result === "object" && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                          {JSON.stringify(j.validation_result, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── QUERY SECTION ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interrogazione dati ingestiti</CardTitle>
            <CardDescription>Cerca record ANNCSU per comune e strada (uso interno)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div>
                <Label className="text-xs">Comune ISTAT</Label>
                <Input value={queryComune} onChange={e => setQueryComune(e.target.value)} className="w-32" />
              </div>
              <div>
                <Label className="text-xs">Strada (opzionale)</Label>
                <Input value={queryStreet} onChange={e => setQueryStreet(e.target.value)} className="w-48" placeholder="es. Roma" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleQuery}>Cerca</Button>
              </div>
            </div>

            {queryResults.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{queryResults.length} risultati</p>
                {queryResults.slice(0, 20).map(r => (
                  <div key={r.id} className="flex items-center gap-2 flex-wrap text-xs border rounded p-2">
                    {readinessBadge(r.ingest_readiness)}
                    <span className="font-mono">{r.comune_istat_code}</span>
                    <span className="font-medium">{r.street_full_name ?? r.street_name}</span>
                    <span>{r.civic_full_label ?? "—"}</span>
                    {r.ambiguity_flags.length > 0 && (
                      <span className="text-amber-600 text-xs">⚠ {r.ambiguity_flags.join(", ")}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* ── READINESS / NORMALIZATION TEST ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ispezione singolo record</CardTitle>
            <CardDescription>Test normalizzazione e quality gates (nessun dato persistito)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">COD_REG</Label><Input value={codReg} onChange={e => setCodReg(e.target.value)} /></div>
              <div><Label className="text-xs">COD_PROV</Label><Input value={codProv} onChange={e => setCodProv(e.target.value)} /></div>
              <div><Label className="text-xs">COD_COM</Label><Input value={codCom} onChange={e => setCodCom(e.target.value)} /></div>
              <div><Label className="text-xs">DENOM_COM</Label><Input value={denomCom} onChange={e => setDenomCom(e.target.value)} /></div>
              <div><Label className="text-xs">SPECIE</Label><Input value={specie} onChange={e => setSpecie(e.target.value)} /></div>
              <div><Label className="text-xs">DENOM_STRADA</Label><Input value={denomStrada} onChange={e => setDenomStrada(e.target.value)} /></div>
              <div><Label className="text-xs">COD_STRADA</Label><Input value={codStrada} onChange={e => setCodStrada(e.target.value)} /></div>
              <div><Label className="text-xs">CIVICO</Label><Input value={civico} onChange={e => setCivico(e.target.value)} /></div>
              <div><Label className="text-xs">ESPONENTE</Label><Input value={esponente} onChange={e => setEsponente(e.target.value)} /></div>
            </div>
            <Button onClick={handleNormalize}>Normalizza</Button>

            {singleResult && (
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Readiness:</span>
                  {readinessBadge(singleResult.quality.ingest_readiness)}
                  <span className="text-sm font-medium ml-2">Geo:</span>
                  <Badge variant="outline">{singleResult.quality.geo_link_status}</Badge>
                  <span className="text-sm font-medium ml-2">Strada:</span>
                  <Badge variant="outline">{singleResult.street.street_status}</Badge>
                  <span className="text-sm font-medium ml-2">Civico:</span>
                  <Badge variant="outline">{singleResult.civic.civic_status}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-xs font-semibold mb-1">Geo</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.geo, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-1">Strada</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.street, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-1">Civico</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.civic, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-1">Quality</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.quality, null, 2)}</pre>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-1">Policy promozione</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.promotion_policy, null, 2)}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulazione batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={handleDemoBatch}>Batch di esempio (6 record)</Button>
            {batchSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div>Totale: <strong>{batchSummary.total_records}</strong></div>
                <div>Pronti: <strong className="text-emerald-600">{batchSummary.ready}</strong></div>
                <div>Avvisi: <strong className="text-amber-600">{batchSummary.ready_with_warnings}</strong></div>
                <div>Bloccati: <strong className="text-red-600">{batchSummary.blocked}</strong></div>
                <div>Eligible: <strong>{batchSummary.ingest_eligible_pct}%</strong></div>
              </div>
            )}
            {batchSample.length > 0 && (
              <div className="space-y-1">
                {batchSample.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap text-xs border rounded p-2">
                    {readinessBadge(r.quality.ingest_readiness)}
                    <span className="font-mono">{r.geo.comune_istat_code ?? "—"}</span>
                    <span>{r.street.street_full_name ?? "(—)"}</span>
                    <span>{r.civic.civic_full_label ?? "(—)"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
