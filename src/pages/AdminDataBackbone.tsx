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
} from "@/lib/dataBackbone";

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
};

const AdminDataBackbone = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [entries, setEntries] = useState<DataSourceEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
        supabase.from("sub_municipal_areas_2021").select("id", { count: "exact", head: true }),
        supabase.from("census_sections_r03_2021").select("id", { count: "exact", head: true }),
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
                              <span>{entry.geographic_scope === "nazionale" ? "🇮🇹 Nazionale" : entry.geographic_scope === "regionale" ? `📍 ${entry.regions_supported?.join(", ") || "Regionale"}` : entry.geographic_scope}</span>
                              <span>Livello: {entry.geographic_level_supported}</span>
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

            {/* Report Exposure Legend */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-foreground mb-2">Legenda esposizione report</p>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <p><Shield className="h-3 w-3 inline mr-1 text-emerald-600" /> Bordo verde = fonte attiva nel report pubblico</p>
                  <p><CheckCircle2 className="h-3 w-3 inline mr-1 text-emerald-600" /> Attivo = fonte operativa e pubblicabile</p>
                  <p><Activity className="h-3 w-3 inline mr-1 text-blue-600" /> Pilota = fonte in fase sperimentale (solo aree coperte)</p>
                  <p><XCircle className="h-3 w-3 inline mr-1 text-muted-foreground" /> Inattivo = predisposto ma non ancora caricato/validato</p>
                  <p><AlertTriangle className="h-3 w-3 inline mr-1 text-amber-600" /> Parziale = disponibile ma con copertura incompleta</p>
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
