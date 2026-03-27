import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import {
  ArrowLeft, Database, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Loader2, Shield, Layers, Activity, Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  type DataSourceEntry,
  summarizeRegistry,
  isSourcePublishable,
  getSourceSections,
  sourceGeoLevelLabel,
} from "@/lib/dataBackbone";
import { MACROZONE_DEFINITIONS } from "@/lib/macrozoneRegistry";

const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Attivo", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  pilot: { label: "Pilota", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: Activity },
  inactive: { label: "Inattivo", className: "bg-muted text-muted-foreground", icon: XCircle },
  deprecated: { label: "Ritirato", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

const COVERAGE_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: "Disponibile", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  partial: { label: "Parziale", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  unavailable: { label: "Non disponibile", className: "bg-muted text-muted-foreground" },
  not_determinable: { label: "Non determinabile", className: "bg-muted text-muted-foreground" },
};

const FAMILY_LABELS: Record<string, string> = {
  valori_immobiliari: "Valori Immobiliari",
  geometrie: "Geometrie",
  catalogo: "Catalogo",
  demografia: "Demografia",
  geometrie_territoriali: "Geometrie Territoriali",
  demografia_aggregata: "Demografia Aggregata",
  servizi: "Servizi",
  identificazione: "Identificazione",
  rischio: "Rischio",
  convergenza: "Convergenza",
  opportunita: "Opportunità",
  previsione: "Previsione",
  macrozone: "Macrozone",
  backbone_territoriale: "Backbone Territoriale",
  localita: "Località",
};

const AdminDataBackbone = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [entries, setEntries] = useState<DataSourceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backboneCounts, setBackboneCounts] = useState<{ comuni: number; localita: number; asc: number; regioni: string[] } | null>(null);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("data_source_registry" as any)
        .select("*")
        .order("source_family", { ascending: true })
        .order("source_key", { ascending: true });
      if (!error && data) setEntries(data as unknown as DataSourceEntry[]);
    } catch { /* ignore */ }

    // Load real counts from territorial_registry
    try {
      const [comuniRes, locRes, regioniRes] = await Promise.all([
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "comune"),
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "localita"),
        supabase.from("territorial_registry" as any).select("regione_name").eq("geographic_level", "comune"),
      ]);
      const regioni = new Set<string>();
      if (regioniRes.data) (regioniRes.data as any[]).forEach((r: any) => { if (r.regione_name) regioni.add(r.regione_name); });
      const ascRes = await supabase.from("sub_municipal_areas_2021").select("id", { count: "exact", head: true });
      setBackboneCounts({
        comuni: comuniRes.count ?? 0,
        localita: locRes.count ?? 0,
        asc: ascRes.count ?? 0,
        regioni: [...regioni].sort(),
      });
    } catch { /* ignore */ }

    setLoading(false);
  }, []);

  useEffect(() => { loadRegistry(); }, [loadRegistry]);

  const syncRegistryFromData = async () => {
    toast.info("Sincronizzazione registro con dati reali...");
    try {
      // Check actual record counts from key tables
      const checks = await Promise.all([
        supabase.from("omi_quotazioni").select("id", { count: "exact", head: true }),
        supabase.from("omi_polygons").select("id", { count: "exact", head: true }),
        supabase.from("omi_zone").select("id", { count: "exact", head: true }),
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "comune"),
        supabase.from("territorial_registry" as any).select("id", { count: "exact", head: true }).eq("geographic_level", "localita"),
        supabase.from("r03_asc_aggregates_2021").select("id", { count: "exact", head: true }),
        supabase.from("demographic_zones").select("id", { count: "exact", head: true }),
      ]);

      const counts: Record<string, number> = {
        omi_quotazioni: checks[0].count ?? 0,
        omi_polygons: checks[1].count ?? 0,
        omi_zone: checks[2].count ?? 0,
        asc_2021: checks[3].count ?? 0,
        r03_lombardia_2021: checks[4].count ?? 0,
        r03_asc_aggregates: checks[5].count ?? 0,
        demographic_zones: checks[6].count ?? 0,
      };

      // Update registry entries based on real counts
      for (const [sourceKey, count] of Object.entries(counts)) {
        const coverage = count > 0 ? "available" : "unavailable";
        const status = count > 0
          ? (sourceKey === "asc_2021" || sourceKey === "r03_lombardia_2021" || sourceKey === "r03_asc_aggregates" ? "pilot" : "active")
          : entries.find(e => e.source_key === sourceKey)?.dataset_status ?? "inactive";

        await supabase
          .from("data_source_registry" as any)
          .update({
            record_count: count,
            current_coverage_status: coverage,
            dataset_status: status,
            last_validated_at: new Date().toISOString(),
          } as any)
          .eq("source_key", sourceKey);
      }

      toast.success("Registro sincronizzato con dati reali");
      await loadRegistry();
    } catch (e) {
      toast.error("Errore sincronizzazione");
    }
  };

  const summary = summarizeRegistry(entries);

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container max-w-5xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Data Backbone — Stato Vero dei Dati</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={syncRegistryFromData} className="h-8">
              <RefreshCw className="h-3 w-3 mr-1" /> Sincronizza
            </Button>
            <Button variant="outline" size="sm" onClick={loadRegistry} className="h-8">
              <RefreshCw className="h-3 w-3 mr-1" /> Aggiorna
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Fonti Totali</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{summary.total}</p></CardContent>
              </Card>
              <Card className="border-emerald-500/20">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-emerald-600">Attive</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-600">{summary.active}</p></CardContent>
              </Card>
              <Card className="border-blue-500/20">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-blue-600">Pilota</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-600">{summary.pilot}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Inattive</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-muted-foreground">{summary.inactive}</p></CardContent>
              </Card>
            </div>

            {/* Coverage Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Copertura per Famiglia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.byFamily).map(([family, count]) => (
                    <div key={family} className="flex items-center gap-1.5 bg-muted/50 rounded px-2.5 py-1">
                      <span className="text-xs font-medium text-foreground">{FAMILY_LABELS[family] ?? family}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Territorial Backbone Overview — Real Counts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Backbone Territoriale Nazionale — Stato Reale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded border p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">🏘️ Comuni</p>
                    <p className="text-xl font-bold">{backboneCounts?.comuni?.toLocaleString("it-IT") ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {backboneCounts && backboneCounts.comuni > 0 ? `${backboneCounts.regioni.length} regioni` : "Non ancora importati"}
                    </p>
                  </div>
                  <div className="rounded border p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">📍 Località</p>
                    <p className="text-xl font-bold">{backboneCounts?.localita?.toLocaleString("it-IT") ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {backboneCounts && backboneCounts.localita > 0 ? "Località ufficiali ISTAT" : "Non ancora importate"}
                    </p>
                  </div>
                  <div className="rounded border p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">🗺️ ASC</p>
                    <p className="text-xl font-bold">{backboneCounts?.asc?.toLocaleString("it-IT") ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Aree sub-comunali 2021</p>
                  </div>
                  <div className="rounded border p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">📊 Piloti</p>
                    <p className="text-xl font-bold">
                      {entries.filter(e => e.dataset_status === "pilot").length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Con dati R03/censimento</p>
                  </div>
                </div>
                {backboneCounts && backboneCounts.regioni.length > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    <span className="font-medium">Regioni con comuni:</span> {backboneCounts.regioni.join(", ")}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Gerarchia: Microzona OMI → ASC → Località → Comune → Macrozona → Nazionale. Il report usa il livello più preciso disponibile.
                </p>
              </CardContent>
            </Card>

            {/* Macrozone Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Copertura Macrozone Italia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-5">
                  {MACROZONE_DEFINITIONS.map(mz => {
                    // Check if any source covers this macrozone
                    const coveringSources = entries.filter(e => {
                      if (e.geographic_scope === "nazionale" && (e.dataset_status === "active" || e.dataset_status === "pilot")) return true;
                      if (e.regions_supported?.some(r => mz.regioni.some(mr => mr.nome_regione.toLowerCase() === r.toLowerCase()))) return true;
                      return false;
                    });
                    const activeSources = coveringSources.filter(e => e.dataset_status === "active" || e.dataset_status === "pilot");
                    return (
                      <div key={mz.code} className="rounded border p-2 space-y-1">
                        <p className="text-xs font-semibold text-foreground">{mz.label}</p>
                        <p className="text-[10px] text-muted-foreground">{mz.regioni.map(r => r.nome_regione).join(", ")}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${activeSources.length > 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                            {activeSources.length} fonti attive
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Source Registry Table */}
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Database className="h-5 w-5" /> Registro Fonti
              </h2>
              <p className="text-xs text-muted-foreground">Tutte le fonti dati registrate con stato, copertura e sezioni del report alimentate</p>
            </div>

            <div className="space-y-2">
              {entries.map(entry => {
                const statusBadge = STATUS_BADGE[entry.dataset_status] ?? STATUS_BADGE.inactive;
                const coverageBadge = COVERAGE_BADGE[entry.current_coverage_status] ?? COVERAGE_BADGE.unavailable;
                const publishable = isSourcePublishable(entry);
                const sections = getSourceSections(entry);
                const StatusIcon = statusBadge.icon;

                return (
                  <Card key={entry.source_key} className={publishable ? "border-l-2 border-l-emerald-500" : ""}>
                    <CardContent className="pt-3 pb-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-sm font-semibold text-foreground">{entry.source_label}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadge.className}`}>
                                {statusBadge.label}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${coverageBadge.className}`}>
                                {coverageBadge.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="font-mono">{entry.source_key}</span>
                              <span>{entry.provider_label}</span>
                              <span>{entry.geographic_scope === "nazionale" ? "🇮🇹 Nazionale" : entry.geographic_scope === "regionale" ? `📍 ${entry.regions_supported?.join(", ") || "Regionale"}` : entry.geographic_scope === "macrozonale" ? "🗺️ Macrozona" : entry.geographic_scope}</span>
                              <span>Livello: {sourceGeoLevelLabel(entry)}</span>
                              {entry.record_count > 0 && <span className="text-emerald-600">{entry.record_count.toLocaleString("it-IT")} record</span>}
                              {entry.source_year && <span>Anno: {entry.source_year}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {publishable && <Shield className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                        </div>

                        {/* Sections fed */}
                        {sections.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Sezioni report:</span>
                            {sections.map(s => (
                              <span key={s} className="text-[10px] bg-primary/5 text-primary rounded px-1.5 py-0.5">{s}</span>
                            ))}
                          </div>
                        )}

                        {/* Import/validation timestamps */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          {entry.last_imported_at && (
                            <span>Ultimo import: {new Date(entry.last_imported_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span>
                          )}
                          {entry.last_validated_at && (
                            <span>Ultima validazione: {new Date(entry.last_validated_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span>
                          )}
                          {entry.notes && <span className="italic">{entry.notes}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Territorial Hierarchy Legend */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-foreground mb-2">Gerarchia territoriale e risoluzione dati</p>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <p><Shield className="h-3 w-3 inline mr-1 text-emerald-600" /> Bordo verde = fonte attiva nel report pubblico</p>
                  <p>📊 <strong>Logica di priorità:</strong> Microzona OMI → ASC/R03 → Località → Comune → Macrozona → Nazionale</p>
                  <p>🔍 <strong>Livello identificato vs dato:</strong> Il sistema distingue sempre dove si trova il punto (identificato) dal livello del dato disponibile</p>
                  <p>⚠️ Se il dato è meno preciso della posizione identificata, il report lo dichiara esplicitamente</p>
                  <p>🚫 Nessun dato viene mai promosso a un livello più fine di quello reale</p>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-7">
                  {["Microzona OMI", "Zona specifica", "Quartiere", "Località", "Comune", "Macrozona", "Nazionale"].map((level, i) => (
                    <div key={level} className="text-center">
                      <div className={`text-[10px] font-mono rounded px-1 py-0.5 ${i < 4 ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {level}
                      </div>
                      {i < 6 && <span className="text-[10px] text-muted-foreground">→</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDataBackbone;
