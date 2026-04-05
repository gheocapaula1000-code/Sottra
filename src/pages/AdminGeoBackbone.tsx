import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import {
  ArrowLeft, RefreshCw, Loader2, Globe, Layers, Database,
  CheckCircle2, XCircle, AlertTriangle, MapPin, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { MACROZONE_DEFINITIONS } from "@/lib/macrozoneRegistry";
import {
  resolveFromInput,
  enrichWithCoverage,
  normalizedPath,
  geoLevelLabel,
  type GeoBackboneResult,
  type CanonicalGeoLevel,
  type CoverageStatus,
} from "@/lib/geoBackbone";

interface BackboneCounts {
  comuni: number;
  localita: number;
  asc: number;
  sezioni_r03: number;
  aggregati: number;
  omi_quotazioni: number;
  omi_polygons: number;
  comuni_with_sezioni: number;
  comuni_with_asc: number;
  comuni_with_aggregati: number;
  regioni_count: number;
  regioni_list: string[];
}

const EMPTY_COUNTS: BackboneCounts = {
  comuni: 0, localita: 0, asc: 0, sezioni_r03: 0, aggregati: 0,
  omi_quotazioni: 0, omi_polygons: 0,
  comuni_with_sezioni: 0, comuni_with_asc: 0, comuni_with_aggregati: 0,
  regioni_count: 0, regioni_list: [],
};

const coverageBadge = (status: CoverageStatus) => {
  switch (status) {
    case "available": return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Disponibile</Badge>;
    case "partial": return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">Parziale</Badge>;
    case "unavailable": return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive">Non disponibile</Badge>;
    default: return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Sconosciuto</Badge>;
  }
};

const AdminGeoBackbone = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<BackboneCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [testCode, setTestCode] = useState("015146");
  const [testResult, setTestResult] = useState<GeoBackboneResult | null>(null);
  const [testing, setTesting] = useState(false);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const [
        comuniRes, locRes, ascRes, sezRes, aggRes,
        omiQRes, omiPRes,
        comuniSezRes, comuniAscRes, comuniAggRes,
        regioniRes,
      ] = await Promise.all([
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "comune"),
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "localita"),
        supabase.from("sub_municipal_areas_2021").select("id", { count: "exact", head: true }),
        supabase.from("census_sections_r03_2021").select("id", { count: "exact", head: true }),
        supabase.from("r03_asc_aggregates_2021").select("id", { count: "exact", head: true }),
        supabase.from("omi_quotazioni").select("id", { count: "exact", head: true }),
        supabase.from("omi_polygons").select("id", { count: "exact", head: true }),
        // Distinct comuni with sezioni
        supabase.from("census_sections_r03_2021").select("comune_istat_code"),
        // Distinct comuni with ASC
        supabase.from("sub_municipal_areas_2021").select("comune_istat_code"),
        // Distinct comuni with aggregati
        supabase.from("r03_asc_aggregates_2021").select("comune_istat_code"),
        // Regioni
        supabase.from("territorial_registry" as any).select("regione_name").eq("geographic_level", "comune"),
      ]);

      const uniqueComuni = (data: any[] | null) => new Set((data ?? []).map((r: any) => r.comune_istat_code).filter(Boolean)).size;
      const regioni = new Set<string>();
      (regioniRes.data as any[] ?? []).forEach((r: any) => { if (r.regione_name) regioni.add(r.regione_name); });

      setCounts({
        comuni: comuniRes.count ?? 0,
        localita: locRes.count ?? 0,
        asc: ascRes.count ?? 0,
        sezioni_r03: sezRes.count ?? 0,
        aggregati: aggRes.count ?? 0,
        omi_quotazioni: omiQRes.count ?? 0,
        omi_polygons: omiPRes.count ?? 0,
        comuni_with_sezioni: uniqueComuni(comuniSezRes.data),
        comuni_with_asc: uniqueComuni(comuniAscRes.data),
        comuni_with_aggregati: uniqueComuni(comuniAggRes.data),
        regioni_count: regioni.size,
        regioni_list: [...regioni].sort(),
      });
    } catch (e) {
      toast.error("Errore caricamento contatori backbone");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const runTest = async () => {
    if (!testCode.trim()) return;
    setTesting(true);
    try {
      const base = resolveFromInput({ comune_istat_code: testCode.trim(), comune_name: testCode.trim() });

      // Fetch real coverage for this comune
      const [sezRes, ascRes, aggRes, omiRes] = await Promise.all([
        supabase.from("census_sections_r03_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", testCode.trim()),
        supabase.from("sub_municipal_areas_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", testCode.trim()),
        supabase.from("r03_asc_aggregates_2021").select("id", { count: "exact", head: true }).eq("comune_istat_code", testCode.trim()),
        supabase.from("omi_quotazioni").select("id", { count: "exact", head: true }).eq("codice_comune_catastale", testCode.trim()),
      ]);

      const enriched = enrichWithCoverage(base, {
        sezioni_count: sezRes.count ?? 0,
        asc_count: ascRes.count ?? 0,
        aggregati_count: aggRes.count ?? 0,
        omi_count: omiRes.count ?? 0,
      });

      setTestResult(enriched);
    } catch {
      toast.error("Errore test risoluzione");
    }
    setTesting(false);
  };

  const fmt = (n: number) => n.toLocaleString("it-IT");

  const backboneStatus = counts.comuni >= 7000 ? "pronto" : counts.comuni > 0 ? "parziale" : "vuoto";

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-6 space-y-4 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Geo Backbone — Diagnostica Nazionale</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadCounts} disabled={loading} className="h-8">
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Status Badge */}
            <div>
              <Badge variant="outline" className={`text-xs px-2.5 py-1 ${
                backboneStatus === "pronto" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                backboneStatus === "parziale" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              }`}>
                Backbone: {backboneStatus === "pronto" ? "✅ Pronto" : backboneStatus === "parziale" ? "⚠️ Parziale" : "❌ Vuoto"}
              </Badge>
            </div>

            {/* Level Counters */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Contatori per Livello
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                  {[
                    { label: "🏘️ Comuni", value: counts.comuni, sub: `${counts.regioni_count} regioni` },
                    { label: "📍 Località", value: counts.localita, sub: "ISTAT" },
                    { label: "🗺️ ASC", value: counts.asc, sub: "Sub-comunali 2021" },
                    { label: "📊 Sezioni R03", value: counts.sezioni_r03, sub: `${counts.comuni_with_sezioni} comuni` },
                    { label: "📈 Aggregati ASC", value: counts.aggregati, sub: `${counts.comuni_with_aggregati} comuni` },
                    { label: "🏠 OMI Quotazioni", value: counts.omi_quotazioni, sub: "Ref. only" },
                    { label: "🗺️ OMI Poligoni", value: counts.omi_polygons, sub: "Ref. only" },
                    { label: "🌍 Regioni", value: counts.regioni_count, sub: counts.regioni_count >= 20 ? "Completa" : "Parziale" },
                  ].map(item => (
                    <div key={item.label} className="rounded border p-2.5 space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-xl font-bold">{fmt(item.value)}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Coverage by level */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Copertura Nazionale per Livello
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-xs">
                  {([
                    ["Nazionale", "nazionale", true],
                    ["Macrozone (5)", "macrozona", true],
                    ["Regioni", "regione", counts.regioni_count >= 20],
                    ["Comuni", "comune", counts.comuni >= 7000],
                    ["Località", "localita", counts.localita > 0],
                    ["ASC Sub-comunali", "sub_comunale", counts.asc > 0],
                    ["Sezioni Censuarie", "sezione_censuaria", counts.sezioni_r03 > 0],
                    ["Aggregati R03→ASC", "derivato", counts.aggregati > 0],
                  ] as [string, string, boolean][]).map(([label, _level, ok]) => (
                    <div key={label} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground font-medium">{label}</span>
                      {ok ? (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Disponibile</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Non disponibile</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Macrozone Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Copertura Macrozone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
                  {MACROZONE_DEFINITIONS.map(mz => {
                    const regionNames = mz.regioni.map(r => r.nome_regione);
                    const covered = regionNames.filter(rn => counts.regioni_list.includes(rn));
                    return (
                      <div key={mz.code} className="rounded border p-2 space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">{mz.label}</p>
                        <p className="text-[10px] text-muted-foreground">{covered.length}/{regionNames.length} regioni</p>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                          covered.length === regionNames.length ? "bg-emerald-500/10 text-emerald-700" :
                          covered.length > 0 ? "bg-amber-500/10 text-amber-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {covered.length === regionNames.length ? "Completa" : covered.length > 0 ? "Parziale" : "Vuota"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Test Resolver */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Test Resolver
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
                    Risolvi
                  </Button>
                </div>

                {testResult && (
                  <div className="rounded border p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      {testResult.geo_resolution.resolved ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-semibold text-foreground">
                        {testResult.geo_identity.geo_label}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {geoLevelLabel(testResult.geo_identity.geo_level)}
                      </Badge>
                    </div>

                    <div className="grid gap-1.5 text-muted-foreground">
                      <div><span className="font-medium text-foreground">Percorso:</span> {normalizedPath(testResult.geo_hierarchy)}</div>
                      <div><span className="font-medium text-foreground">Metodo:</span> {testResult.geo_resolution.match_method}</div>
                      <div><span className="font-medium text-foreground">Confidenza:</span> {testResult.geo_resolution.match_confidence} ({(testResult.geo_resolution.confidence_score * 100).toFixed(0)}%)</div>
                      <div><span className="font-medium text-foreground">Profondità max:</span> {geoLevelLabel(testResult.geo_coverage.max_depth)}</div>
                      <div><span className="font-medium text-foreground">Qualità:</span> {(testResult.geo_coverage.quality_score * 100).toFixed(0)}%</div>
                    </div>

                    {/* Coverage layers */}
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <p className="font-medium text-foreground text-[11px]">Copertura Layer</p>
                      {([
                        ["Sezioni R03", testResult.geo_coverage.sezioni_r03],
                        ["ASC", testResult.geo_coverage.asc_areas],
                        ["Aggregati R03→ASC", testResult.geo_coverage.aggregati_r03],
                        ["Zona OMI", testResult.geo_coverage.zona_omi],
                      ] as [string, { status: CoverageStatus; record_count: number }][]).map(([label, layer]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="flex items-center gap-1.5">
                            {coverageBadge(layer.status)}
                            {layer.record_count > 0 && <span className="text-muted-foreground">({fmt(layer.record_count)})</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    {testResult.geo_resolution.warnings.length > 0 && (
                      <div className="pt-1 border-t border-border/50 space-y-0.5">
                        {testResult.geo_resolution.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-1 border-t border-border/50 text-[10px] text-muted-foreground font-mono">
                      {testResult.geo_resolution.debug_summary}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Regioni list */}
            {counts.regioni_list.length > 0 && (
              <div className="text-[10px] text-muted-foreground px-1">
                <span className="font-medium">Regioni con comuni:</span> {counts.regioni_list.join(", ")}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminGeoBackbone;
