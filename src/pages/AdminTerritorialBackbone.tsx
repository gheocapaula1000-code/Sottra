import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import {
  ArrowLeft, RefreshCw, Loader2, Database, Layers, Shield,
  CheckCircle2, XCircle, AlertTriangle, BarChart3, Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  resolveFromInput,
  enrichWithCoverage,
  geoLevelLabel,
  type GeoBackboneResult,
} from "@/lib/geoBackbone";
import {
  resolveTerritorialData,
  dataQualityLabel,
  qualityStatusLabel,
  qualityStatusColor,
  isDatasetUsable,
  type TerritorialDataResult,
  type DatasetBlock,
  type TerritorialDataQuality,
  type OverallQualityStatus,
  type CoverageMatrixEntry,
} from "@/lib/territorialDataBackbone";

/* ── Badge helpers ── */

const qualityBadge = (q: TerritorialDataQuality) => {
  const colors: Record<TerritorialDataQuality, string> = {
    official: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    territorial_verified: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    commercial_verified: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    commercial_partial: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    elaborated: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    unavailable: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-[10px] ${colors[q]}`}>{dataQualityLabel(q)}</Badge>;
};

const statusBadge = (status: OverallQualityStatus) => (
  <Badge variant="outline" className={`text-[10px] ${qualityStatusColor(status)}`}>
    {qualityStatusLabel(status)}
  </Badge>
);

const availBadge = (avail: string) => {
  if (avail === "available") return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Disponibile</Badge>;
  if (avail === "partial") return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">Parziale</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Non disponibile</Badge>;
};

/* ── Dataset Row ── */

const DatasetRow = ({ label, block }: { label: string; block: DatasetBlock }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 gap-2">
    <div className="min-w-0">
      <p className="text-xs font-medium text-foreground truncate">{label}</p>
      {block.note && <p className="text-[10px] text-muted-foreground truncate">{block.note}</p>}
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {availBadge(block.availability)}
      {block.availability !== "unavailable" && qualityBadge(block.quality)}
      {block.record_count > 0 && (
        <span className="text-[10px] text-muted-foreground">({block.record_count.toLocaleString("it-IT")})</span>
      )}
      {block.is_derived && (
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">Derivato</Badge>
      )}
    </div>
  </div>
);

/* ── Coverage Matrix Row ── */

const MatrixRow = ({ entry }: { entry: CoverageMatrixEntry }) => (
  <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
    <span className="text-xs font-medium text-foreground">{entry.level_label}</span>
    <div className="flex items-center gap-1.5">
      {entry.has_data ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
      ) : (
        <XCircle className="h-3 w-3 text-muted-foreground" />
      )}
      {entry.has_data && qualityBadge(entry.quality)}
      {entry.source_count > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {entry.official_source_count}u {entry.derived_source_count}d
        </span>
      )}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════ */

const AdminTerritorialBackbone = () => {
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState("015146");
  const [testResult, setTestResult] = useState<TerritorialDataResult | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!testCode.trim()) return;
    setTesting(true);
    try {
      const code = testCode.trim();
      const base = resolveFromInput({ comune_istat_code: code, comune_name: code });

      // Fetch real coverage
      const [sezRes, ascRes, aggRes, omiRes] = await Promise.all([
        supabase.from("census_sections_r03_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", code),
        supabase.from("sub_municipal_areas_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", code),
        supabase.from("r03_asc_aggregates_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", code),
        supabase.from("omi_quotazioni").select("id", { count: "exact", head: true }).eq("codice_comune_catastale", code),
      ]);

      const enriched = enrichWithCoverage(base, {
        sezioni_count: sezRes.count ?? 0,
        asc_count: ascRes.count ?? 0,
        aggregati_count: aggRes.count ?? 0,
        omi_count: omiRes.count ?? 0,
      });

      const result = resolveTerritorialData({ geo_result: enriched });
      setTestResult(result);
    } catch {
      toast.error("Errore risoluzione territoriale");
    }
    setTesting(false);
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-6 space-y-4 px-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Territorial Data Backbone — Fase 2</h1>
          </div>
        </div>

        {/* Resolver Input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Risoluzione Dati Territoriali
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Codice ISTAT Comune</label>
                <input
                  className="h-8 rounded border border-input bg-background px-2 text-sm w-32"
                  value={testCode}
                  onChange={e => setTestCode(e.target.value)}
                  placeholder="015146"
                />
              </div>
              <Button size="sm" onClick={runTest} disabled={testing} className="h-8">
                {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Analizza
              </Button>
            </div>

            {testResult && (
              <div className="space-y-4">
                {/* Identity & Scope */}
                <div className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {testResult.territorial_quality.overall_status !== "insufficient" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-semibold text-foreground text-sm">
                      {testResult.territorial_identity.geo_label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {geoLevelLabel(testResult.territorial_identity.geo_level)}
                    </Badge>
                    {statusBadge(testResult.territorial_quality.overall_status)}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div><span className="font-medium text-foreground">Percorso:</span> {testResult.territorial_identity.normalized_path}</div>
                    <div><span className="font-medium text-foreground">Livello effettivo:</span> {geoLevelLabel(testResult.territorial_scope.effective_level)}</div>
                    <div><span className="font-medium text-foreground">Max dettaglio:</span> {geoLevelLabel(testResult.territorial_scope.max_supported_detail)}</div>
                    {testResult.territorial_scope.fallback_applied && (
                      <div className="flex items-start gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>Fallback: {testResult.territorial_scope.fallback_reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Scores */}
                  <div className="flex gap-4 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground">Precisione:</span>{" "}
                      <span className="font-semibold">{(testResult.territorial_coverage.precision_score * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completezza:</span>{" "}
                      <span className="font-semibold">{(testResult.territorial_coverage.completeness_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Datasets */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" /> Famiglie di Dati
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-1">
                    <DatasetRow label="📊 Demografico" block={testResult.territorial_datasets.demographic} />
                    <DatasetRow label="🏘️ Struttura Territoriale" block={testResult.territorial_datasets.territorial_structure} />
                    <DatasetRow label="🗺️ Sub-Comunale" block={testResult.territorial_datasets.sub_municipal} />
                    <DatasetRow label="📋 Sezioni Censuarie" block={testResult.territorial_datasets.census_sections} />
                    <DatasetRow label="🏠 Linkage OMI" block={testResult.territorial_datasets.omi_linkage} />
                    <DatasetRow label="🌿 Ambientale" block={testResult.territorial_datasets.environmental} />
                    <DatasetRow label="🏪 Servizi" block={testResult.territorial_datasets.services} />
                    <DatasetRow label="🚌 Mobilità" block={testResult.territorial_datasets.mobility} />
                  </CardContent>
                </Card>

                {/* Coverage Matrix */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" /> Matrice Copertura per Livello
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-1">
                    {testResult.territorial_coverage.matrix.map(entry => (
                      <MatrixRow key={entry.level} entry={entry} />
                    ))}
                  </CardContent>
                </Card>

                {/* Sources */}
                {testResult.territorial_sources.length > 0 && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" /> Fonti Interrogate
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 space-y-1">
                      {testResult.territorial_sources.map((s, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0 text-xs gap-2">
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{s.source_label}</span>
                            <span className="text-muted-foreground ml-1.5">({s.source_key})</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {qualityBadge(s.source_type)}
                            {s.is_official && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Ufficiale</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{s.record_count.toLocaleString("it-IT")}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Warnings & Gaps */}
                {(testResult.territorial_quality.warnings.length > 0 || testResult.territorial_quality.blocking_gaps.length > 0) && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" /> Avvisi e Lacune
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 space-y-1">
                      {testResult.territorial_quality.blocking_gaps.map((g, i) => (
                        <div key={`gap-${i}`} className="flex items-start gap-1.5 text-xs text-destructive">
                          <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{g}</span>
                        </div>
                      ))}
                      {testResult.territorial_quality.warnings.map((w, i) => (
                        <div key={`warn-${i}`} className="flex items-start gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Summary */}
                <div className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Riepilogo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{testResult.territorial_summary.short_summary}</p>
                  {testResult.territorial_summary.key_gaps.length > 0 && (
                    <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                      <span className="font-medium text-foreground">Gap chiave:</span> {testResult.territorial_summary.key_gaps.join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminTerritorialBackbone;
