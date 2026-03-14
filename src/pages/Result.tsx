import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, TrendingUp, Users, Rocket, Construction, AlertTriangle, MapPin, Compass, Target, Eye, ShieldCheck, TriangleAlert, Layers, Camera, CheckCircle2, BarChart3, Gem } from "lucide-react";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { isValidGps, isValidImageDataUrl } from "@/lib/imageUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBuildingScan } from "@/hooks/useBuildingScan";
import { cn } from "@/lib/utils";
import { DataBadge, type DataTier } from "@/components/DataBadge";
import Watermark from "@/components/Watermark";
import type {
  IdentifyResult, PricingData,
  TimeViewData, OpportunityData,
  InfrastrutureData,
  RischioZonaData, TrendDemograficoData, SviluppoAreaData,
  ConvergenzaTerritorialeData, MarketContextData, ComparablesSummary,
  ScanResult, SourceMetadata, PoiEnrichmentData,
  InfrastructureProject, InfrastructureSignal, InfrastructureDriverRisk,
} from "@/types";
import { isRenderableTrendDemografico, getAvailableDemographicMetricCount } from "@/lib/demographic";

/* ── helpers ─────────────────────────────────────────── */

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    for (const k of ["label", "message", "text", "title", "name"]) {
      if (typeof obj[k] === "string") return obj[k] as string;
    }
    return "";
  }
  return String(v);
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function sourceTypeToTier(sourceType?: string): DataTier {
  switch (sourceType) {
    case "official": return "ufficiale";
    case "verified_geo": return "geo_verificato";
    case "premium": return "premium";
    case "commercial_verified": return "mercato_verificato";
    case "commercial_partial": return "mercato_parziale";
    case "elaborated": return "elaborato";
    case "estimate": return "elaborato";
    case "derived": return "elaborato";
    case "unavailable": return "non_disponibile";
    default: return "elaborato";
  }
}

/* ── layout primitives ───────────────────────────────── */

function SourceTag({ meta }: { meta?: SourceMetadata }) {
  if (!meta) return null;
  const tier = sourceTypeToTier(meta.sourceType);
  if (tier === "non_disponibile") return null;
  const defaultLabels: Partial<Record<DataTier, string>> = {
    ufficiale: "Fonte istituzionale verificata",
    mercato_verificato: "Fonte di mercato verificata",
    mercato_parziale: "Copertura di mercato parziale",
    elaborato: "Elaborazione da fonti verificate",
  };
  const label = meta.sourceLabel || defaultLabels[tier] || "Elaborazione da fonti verificate";
  const period = meta.sourcePeriod ? ` · ${meta.sourcePeriod}` : "";
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <DataBadge tier={tier} />
      <p className="text-[10px] text-muted-foreground/60 leading-tight">{label}{period}</p>
    </div>
  );
}

function Section({ children, className, gradient }: { children: React.ReactNode; className?: string; gradient?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-card p-5 transition-opacity duration-500",
      gradient && `bg-gradient-to-br ${gradient}`,
      className,
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string | null }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-foreground text-sm tracking-tight">{title}</span>
      </div>
      {badge && <Badge variant="secondary" className="text-[10px] font-medium">{badge}</Badge>}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function ScoreArc({ value, size = 88, stroke = 7 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? "hsl(142 71% 45%)" : pct >= 40 ? "hsl(var(--primary))" : "hsl(var(--destructive))";
  return (
    <svg width={size} height={size} className="block shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">{pct}</text>
    </svg>
  );
}

function MiniBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span className="font-medium text-foreground">{fmt(value)}%</span></div>
      <div className="h-1.5 w-full rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ── Section publishability ──────────────────────────── */

function isSectionPublishable(status: string, data: unknown): boolean {
  if (status === "loading") return true;
  if (status === "error" || !data) return false;
  if (typeof data === "object" && data !== null && (data as Record<string, unknown>).sourceType === "unavailable") return false;
  return true;
}

/* ── cards ────────────────────────────────────────────── */

function HeaderCard({ photo, identify, loading, lat, lng, lowConfidence }: { photo: string; identify: IdentifyResult | null; loading: boolean; lat: number | null; lng: number | null; lowConfidence: boolean }) {
  if (loading) return <SectionSkeleton />;
  return (
    <Section className="p-0 overflow-hidden">
      <div className="relative">
        <img src={photo} alt="Edificio acquisito" className="w-full aspect-[16/10] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
      </div>
      {identify && (
        <div className="px-5 pb-5 -mt-10 relative z-10">
          {!lowConfidence && identify.address && (
            <h2 className="text-lg font-bold text-foreground leading-snug">{identify.address}</h2>
          )}
          {lowConfidence && identify.address && (
            <h2 className="text-lg font-bold text-foreground/60 leading-snug">{identify.address}</h2>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {!lowConfidence && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />Identificazione verificata
              </span>
            )}
            {lat != null && lng != null && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <MapPin className="h-3 w-3" />{lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function PricingCard({ data, loading }: { data: PricingData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.prezzoMq == null) return null;

  const hasMediaZona = data.mediaZona != null;
  const hasTrend = data.trend5Anni != null;

  return (
    <Section>
      <SectionHeader icon={TrendingUp} title="Prezzi di Mercato" />
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-extrabold text-foreground tracking-tight">{fmtEur(data.prezzoMq)}</span>
        <span className="text-sm text-muted-foreground font-medium">/m²</span>
      </div>
      <div className={cn("grid gap-3 text-sm mb-3", hasMediaZona ? "grid-cols-2" : "grid-cols-1")}>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Fascia</span>
          <p className="font-semibold text-foreground text-sm mt-0.5">{fmtEur(data.prezzoMqMin)} – {fmtEur(data.prezzoMqMax)}</p>
        </div>
        {hasMediaZona && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Media zona</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">{fmtEur(data.mediaZona)}</p>
          </div>
        )}
      </div>
      {hasTrend && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Trend 5 anni</span>
          <span className={cn("font-bold", data.trend5Anni! >= 0 ? "text-emerald-400" : "text-destructive")}>
            {data.trend5Anni! > 0 ? "+" : ""}{fmt(data.trend5Anni)}%
          </span>
        </div>
      )}
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mt-2">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
    </Section>
  );
}

function ConvergenzaTerritorialeCard({ data, loading }: { data: ConvergenzaTerritorialeData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.score == null) return null;

  const tier = sourceTypeToTier(data.sourceType);
  const bandColors: Record<string, string> = {
    molto_forte: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    forte: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    interessante: "from-violet-500/10 to-indigo-500/5 border-violet-500/20",
    debole: "from-stone-500/10 to-stone-400/5 border-stone-500/20",
  };
  const bandLabels: Record<string, string> = { molto_forte: "Molto forte", forte: "Forte", interessante: "Interessante", debole: "Debole" };
  const convergenceLabels: Record<string, string> = { alta: "Elevata", media: "Media", bassa: "Bassa", insufficiente: "Insufficiente" };
  const coverageLabels: Record<string, string> = { completa: "Completa", buona: "Buona", parziale: "Parziale", scarsa: "Scarsa" };

  const positiveSignals = (data.topPositiveSignals ?? []).slice(0, 3);
  const negativeSignals = (data.topNegativeSignals ?? []).slice(0, 3);

  return (
    <Section gradient={data.band ? bandColors[data.band] ?? "" : ""}>
      <SectionHeader icon={Layers} title="Convergenza Territoriale" badge={data.band ? bandLabels[data.band] : null} />
      <div className="flex items-center gap-4 mb-4">
        <ScoreArc value={data.score} />
        <div className="flex-1 space-y-1">
          {data.convergenceLevel && (
            <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Convergenza</span><span className="font-semibold text-foreground">{convergenceLabels[data.convergenceLevel] ?? data.convergenceLevel}</span></div>
          )}
          {data.coverageLevel && (
            <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Copertura dati</span><span className="font-semibold text-foreground">{coverageLabels[data.coverageLevel] ?? data.coverageLevel}</span></div>
          )}
        </div>
      </div>

      {positiveSignals.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Segnali favorevoli</p>
          {positiveSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <div><p className="text-xs text-foreground leading-relaxed">{s.label}</p>{s.source && <p className="text-[10px] text-muted-foreground/50">{s.source}</p>}</div>
            </div>
          ))}
        </div>
      )}

      {negativeSignals.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contro-segnali</p>
          {negativeSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <div><p className="text-xs text-foreground leading-relaxed">{s.label}</p>{s.source && <p className="text-[10px] text-muted-foreground/50">{s.source}</p>}</div>
            </div>
          ))}
        </div>
      )}

      {data.confidenceReason && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{data.confidenceReason}"</p>
        </div>
      )}
      <SourceTag meta={data} />
      <p className="text-[9px] text-muted-foreground/30 mt-1">Indice di convergenza elaborato — non costituisce consulenza</p>
    </Section>
  );
}

function RischioZonaCard({ data, loading }: { data: RischioZonaData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.scoreRischio == null) return null;

  const lc: Record<string, string> = { nullo: "text-emerald-400", basso: "text-emerald-400", medio: "text-amber-400", alto: "text-red-400", zona4: "text-emerald-400", zona3: "text-emerald-400", zona2: "text-amber-400", zona1: "text-red-400" };

  return (
    <Section>
      <SectionHeader icon={AlertTriangle} title="Rischio Zona" />
      <div className="flex items-start gap-4">
        <ScoreArc value={data.scoreRischio} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm flex-1">
          <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Idrogeologico</span><p className={cn("font-semibold capitalize text-sm", data.idrogeologico ? lc[data.idrogeologico] : "text-muted-foreground")}>{data.idrogeologico ?? "—"}</p></div>
          <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sismico</span><p className={cn("font-semibold text-sm", data.sismico ? lc[data.sismico] : "text-muted-foreground")}>{data.sismico ? data.sismico.replace("zona", "Zona ") : "—"}</p></div>
          <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Inquinamento</span><p className={cn("font-semibold capitalize text-sm", data.inquinamento ? lc[data.inquinamento] : "text-muted-foreground")}>{data.inquinamento ?? "—"}</p></div>
          <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Alluvionale</span><p className={cn("font-semibold text-sm", data.alluvionale != null ? (data.alluvionale ? "text-red-400" : "text-emerald-400") : "text-muted-foreground")}>{data.alluvionale != null ? (data.alluvionale ? "Sì" : "No") : "—"}</p></div>
        </div>
      </div>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mt-3">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
    </Section>
  );
}

function GeoLevelTag({ geoLevel, geoLabel }: { geoLevel?: string | null; geoLabel?: string | null }) {
  if (!geoLevel) return null;
  const labels: Record<string, string> = {
    microzona: "Dato di microzona",
    quartiere: "Dato di quartiere",
    zona: "Zona stimata dell'immobile",
    comune: "Dato riferito al comune",
    area_vasta: "Dato di area vasta",
    stimato: "Zona stimata",
  };
  const text = labels[geoLevel] ?? "Dato territoriale";
  return (
    <p className="text-[10px] text-muted-foreground/60 mb-3 flex items-center gap-1">
      <MapPin className="h-3 w-3" />
      {text}{geoLabel ? ` · ${geoLabel}` : ""}
    </p>
  );
}


function TrendDemograficoCard({ data, loading }: { data: TrendDemograficoData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!isRenderableTrendDemografico(data)) return null;
  // data is guaranteed non-null by the check above
  const d = data!;

  // Build only non-null metric tiles
  const metrics: { label: string; value: string }[] = [];
  if (d.etaMedia != null) metrics.push({ label: "Età media", value: fmt(d.etaMedia) });
  if (d.densitaAbitanti != null) metrics.push({ label: "Densità", value: `${fmt(d.densitaAbitanti)} ab/km²` });
  if (d.flussoResidenti12Mesi != null) metrics.push({ label: "Flusso 12m", value: `${d.flussoResidenti12Mesi > 0 ? "+" : ""}${fmt(d.flussoResidenti12Mesi)}%` });
  if (d.percentualeGiovani != null) metrics.push({ label: "Under 35", value: `${fmt(d.percentualeGiovani)}%` });

  const hasBars = d.percentualeFamiglie != null || d.percentualeStranieri != null;
  const totalVisibleItems = getAvailableDemographicMetricCount(d);

  return (
    <Section>
      <SectionHeader icon={Users} title="Trend Demografico" />
      <GeoLevelTag geoLevel={d.geoLevel} geoLabel={d.geoLabel} />
      {metrics.length > 0 && (
        <div className={cn("grid gap-3 mb-4", metrics.length >= 2 ? "grid-cols-2" : "grid-cols-1")}>
          {metrics.map((item, i) => (
            <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
              <p className="font-bold text-foreground text-sm mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      )}
      {hasBars && (
        <div className="space-y-2">
          {d.percentualeFamiglie != null && <MiniBar label="Famiglie" value={d.percentualeFamiglie} />}
          {d.percentualeStranieri != null && <MiniBar label="Stranieri" value={d.percentualeStranieri} />}
        </div>
      )}
      {d.geoLevel === "comune" && (
        <p className="text-[10px] text-amber-400/70 mt-2">Dato riferito al livello comunale — la zona specifica potrebbe variare</p>
      )}
      {totalVisibleItems <= 2 && totalVisibleItems > 0 && (
        <p className="text-[10px] text-muted-foreground/50 mt-2">Alcuni indicatori non sono disponibili per questa zona</p>
      )}
      {d.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mt-3">{d.confidenceReason}</p>}
      <SourceTag meta={d} />
    </Section>
  );
}

function OpportunityCard({ data, loading }: { data: OpportunityData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const scoreValue = data.score ?? data.indice ?? null;
  if (data.sourceType === "unavailable" || scoreValue == null) return null;

  const bandColors: Record<string, string> = {
    molto_forte: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    forte: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    interessante: "from-violet-500/10 to-indigo-500/5 border-violet-500/20",
    limitata: "from-stone-500/10 to-stone-400/5 border-stone-500/20",
  };
  const bandLabels: Record<string, string> = { molto_forte: "Molto forte", forte: "Forte", interessante: "Interessante", limitata: "Limitata" };
  const effectiveBand = data.band ?? null;
  const drivers = (data.drivers ?? []).slice(0, 3);
  const risks = (data.risks ?? []).slice(0, 2);
  const observation = data.observation ?? data.raccomandazione ?? null;

  return (
    <Section gradient={effectiveBand ? bandColors[effectiveBand] ?? "" : ""}>
      <SectionHeader icon={Target} title="Indice Opportunità" badge={effectiveBand ? bandLabels[effectiveBand] : (data.quadrante ?? null)} />
      <div className="flex items-center gap-4 mb-4">
        <ScoreArc value={scoreValue} />
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          {scoreValue >= 70
            ? "Segnali convergenti rilevanti. Fattori favorevoli che meritano attenzione."
            : scoreValue >= 45
              ? "Quadro interessante. Elementi da valutare con attenzione."
              : "Potenziale contenuto. Elementi da monitorare nel tempo."
          }
        </p>
      </div>

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Driver principali</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2"><div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" /><p className="text-xs text-foreground leading-relaxed">{toText(d)}</p></div>
          ))}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di rischio</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2"><div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-amber-500" /><p className="text-xs text-foreground leading-relaxed">{toText(r)}</p></div>
          ))}
        </div>
      )}

      {observation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{observation}"</p>
        </div>
      )}
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mb-1">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
      <p className="text-[9px] text-muted-foreground/30 mt-1">Indice elaborato — non costituisce consulenza finanziaria</p>
    </Section>
  );
}

function TimeViewCard({ data, loading }: { data: TimeViewData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || (!data.scenarioBand && data.previsione5Anni == null)) return null;

  const bandColors: Record<string, string> = {
    favorevole: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    moderatamente_favorevole: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    stabile: "from-slate-500/10 to-stone-500/5 border-slate-500/20",
    da_monitorare: "from-amber-500/10 to-yellow-500/5 border-amber-500/20",
  };
  const bandLabels: Record<string, string> = {
    favorevole: "Favorevole", moderatamente_favorevole: "Moderatamente favorevole", stabile: "Stabile", da_monitorare: "Da monitorare",
  };

  const drivers = (data.scenarioDrivers ?? []).slice(0, 3);
  const risks = (data.scenarioRisks ?? []).slice(0, 2);

  return (
    <Section gradient={data.scenarioBand ? bandColors[data.scenarioBand] ?? "" : ""}>
      <SectionHeader icon={Eye} title="Scenario Evolutivo" badge={data.scenarioBand ? bandLabels[data.scenarioBand] : null} />

      {data.scenarioHorizon && (
        <p className="text-xs text-muted-foreground mb-3">Orizzonte: <span className="font-semibold text-foreground">{data.scenarioHorizon}</span></p>
      )}

      {data.previsione5Anni != null && (
        <div className="grid grid-cols-3 gap-2 text-center mb-4 rounded-xl bg-background/40 border border-border/30 p-3">
          {[
            { label: "5 anni", value: data.previsione5Anni },
            { label: "10 anni", value: data.previsione10Anni },
            { label: "20 anni", value: data.previsione20Anni },
          ].map((item, i) => (
            <div key={i}>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
              <p className="font-extrabold text-foreground text-xl mt-0.5">{fmt(item.value)}%</p>
            </div>
          ))}
        </div>
      )}

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori trainanti</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2"><ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" /><p className="text-xs text-foreground leading-relaxed">{toText(d)}</p></div>
          ))}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di attenzione</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2"><TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" /><p className="text-xs text-foreground leading-relaxed">{toText(r)}</p></div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {(data.progettiInArrivo ?? []).length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Progetti in arrivo</p>
          {(data.progettiInArrivo ?? []).map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-foreground"><Rocket className="h-3 w-3 text-primary" />{toText(p)}</div>)}
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mb-1">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
      <p className="text-[9px] text-muted-foreground/30 mt-1">Le proiezioni sono indicative e non costituiscono consulenza finanziaria</p>
    </Section>
  );
}

function InfrastrutureCard({ data, loading }: { data: InfrastrutureData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || (data.infrastructureScore == null && !data.narrativeObservation)) return null;

  const bandColors: Record<string, string> = {
    elevata: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    significativa: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    moderata: "from-amber-500/10 to-yellow-500/5 border-amber-500/20",
    contenuta: "from-orange-500/10 to-amber-500/5 border-orange-500/20",
    limitata: "from-stone-500/10 to-stone-400/5 border-stone-500/20",
  };
  const bandLabels: Record<string, string> = { elevata: "Elevata", significativa: "Significativa", moderata: "Moderata", contenuta: "Contenuta", limitata: "Limitata" };

  const toDriverRisk = (item: InfrastructureDriverRisk | string): InfrastructureDriverRisk => typeof item === "string" ? { label: item } : item;
  const toSignal = (item: InfrastructureSignal | string): InfrastructureSignal => typeof item === "string" ? { label: item } : item;
  const toProject = (item: InfrastructureProject | string): InfrastructureProject => typeof item === "string" ? { label: item } : item;

  const drivers = (data.topDrivers ?? []).slice(0, 3).map(toDriverRisk);
  const risks = (data.topRisks ?? []).slice(0, 2).map(toDriverRisk);
  const infraProjects = (data.infrastructureProjects ?? []).slice(0, 3).map(toProject);
  const mobilitySignals = (data.mobilitySignals ?? []).slice(0, 2).map(toSignal);
  const connectivitySignals = (data.connectivitySignals ?? []).slice(0, 2).map(toSignal);
  const publicWorksSignals = (data.publicWorksSignals ?? []).slice(0, 2).map(toSignal);

  return (
    <Section gradient={data.infrastructureBand ? bandColors[data.infrastructureBand] ?? "" : ""}>
      <SectionHeader icon={Construction} title="Infrastrutture e Reti" badge={data.infrastructureBand ? bandLabels[data.infrastructureBand] : null} />

      {data.infrastructureScore != null && (
        <div className="flex items-center gap-4 mb-4">
          <ScoreArc value={data.infrastructureScore} />
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            {data.infrastructureScore >= 70
              ? "Segnali infrastrutturali rilevanti. Contesto sostenuto da interventi e reti significativi."
              : data.infrastructureScore >= 45
                ? "Supporti infrastrutturali da non sottovalutare. Territorio con trasformazioni concrete."
                : "Contesto infrastrutturale contenuto. Margini di sviluppo da monitorare."
            }
          </p>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori chiave</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2"><ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" /><div><p className="text-xs text-foreground leading-relaxed">{d.label}</p>{d.source && <p className="text-[10px] text-muted-foreground/50">{d.source}</p>}</div></div>
          ))}
        </div>
      )}

      {infraProjects.length > 0 && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opere e progetti</p>
          {infraProjects.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <Construction className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
              <div className="min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{p.label}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {p.status && <span className="text-[10px] text-muted-foreground">{p.status}</span>}
                  {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                  {p.impact && <span className="text-[10px] text-primary/70 font-medium">{p.impact}</span>}
                  {p.period && <span className="text-[10px] text-muted-foreground/50">{p.period}</span>}
                </div>
                {p.source && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{p.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(mobilitySignals.length > 0 || connectivitySignals.length > 0 || publicWorksSignals.length > 0) && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3 space-y-2.5">
          {[
            { title: "Mobilità", items: mobilitySignals, Icon: MapPin },
            { title: "Connettività", items: connectivitySignals, Icon: Construction },
            { title: "Interventi pubblici", items: publicWorksSignals, Icon: Rocket },
          ].filter(g => g.items.length > 0).map((g, gi) => (
            <div key={gi} className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{g.title}</p>
              {g.items.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <g.Icon className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
                  <div><span>{s.label}</span>{s.source && <span className="text-[10px] text-muted-foreground/50 ml-1">· {s.source}</span>}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di attenzione</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2"><TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" /><div><p className="text-xs text-foreground leading-relaxed">{r.label}</p>{r.source && <p className="text-[10px] text-muted-foreground/50">{r.source}</p>}</div></div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mb-1">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
    </Section>
  );
}

function SviluppoAreaCard({ data, loading }: { data: SviluppoAreaData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || (data.areaDevelopmentScore == null && !data.narrativeObservation)) return null;

  const bandColors: Record<string, string> = {
    elevata: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    significativa: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    moderata: "from-amber-500/10 to-yellow-500/5 border-amber-500/20",
    contenuta: "from-orange-500/10 to-amber-500/5 border-orange-500/20",
    limitata: "from-stone-500/10 to-stone-400/5 border-stone-500/20",
  };
  const bandLabels: Record<string, string> = { elevata: "Elevata", significativa: "Significativa", moderata: "Moderata", contenuta: "Contenuta", limitata: "Limitata" };

  const topSignals = (data.developmentSignals ?? []).filter(s => s.label).slice(0, 3);
  const highlights: string[] = [
    ...(data.infrastructureProjects ?? []).slice(0, 2),
    ...(data.connectivitySignals ?? []).slice(0, 1),
    ...(data.publicInvestmentSignals ?? []).slice(0, 1),
  ].slice(0, 3);

  return (
    <Section gradient={data.areaDevelopmentBand ? bandColors[data.areaDevelopmentBand] ?? "" : ""}>
      <SectionHeader icon={Compass} title="Dinamica Territoriale" badge={data.areaDevelopmentBand ? bandLabels[data.areaDevelopmentBand] : null} />

      {data.areaDevelopmentScore != null && (
        <div className="flex items-center gap-4 mb-4">
          <ScoreArc value={data.areaDevelopmentScore} />
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            {data.areaDevelopmentScore >= 70
              ? "Territorio con elementi di evoluzione concreti. Segnali da valutare seriamente."
              : data.areaDevelopmentScore >= 45
                ? "Contesto con fattori di trasformazione rilevanti. Zona da monitorare."
                : "Area con segnali contenuti. Contesto attuale stabile."
            }
          </p>
        </div>
      )}

      {topSignals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Segnali rilevanti</p>
          {topSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className={cn("mt-1 h-2 w-2 rounded-full shrink-0", s.relevance === "alta" ? "bg-emerald-500" : s.relevance === "media" ? "bg-sky-500" : "bg-muted-foreground/40")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{s.label}</p>
                {s.detail && <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opere e investimenti</p>
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-foreground"><Construction className="h-3 w-3 shrink-0 text-primary/60" /><span>{toText(h)}</span></div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mb-1">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
    </Section>
  );
}

/* ── Market Context Card ──────────────────────────────── */

function isMarketPublishable(data: MarketContextData | null): boolean {
  if (!data) return false;
  const st = data.sourceType;
  if (st === "unavailable") return false;
  // Must have at least comparables or signals
  const hasComparables = data.comparablesSummary != null && data.comparablesSummary.count != null && data.comparablesSummary.count > 0;
  const hasSignals = (data.marketSignals ?? []).length > 0;
  return hasComparables || hasSignals;
}

function MarketContextCard({ data, loading }: { data: MarketContextData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isMarketPublishable(data)) return null;

  const coverageLabels: Record<string, string> = { completa: "Completa", buona: "Buona", parziale: "Parziale", scarsa: "Scarsa" };
  const isPartial = data.sourceType === "commercial_partial";

  return (
    <Section gradient="from-indigo-500/10 to-violet-500/5 border-indigo-500/15">
      <SectionHeader icon={BarChart3} title="Mercato Locale" badge={data.marketCoverageLevel ? coverageLabels[data.marketCoverageLevel] : null} />

      {data.comparablesSummary && data.comparablesSummary.count != null && data.comparablesSummary.count > 0 && (
        <ComparablesBlock comp={data.comparablesSummary} isPartial={isPartial} />
      )}

      {(data.marketSignals ?? []).length > 0 && (
        <MarketSignalsBlock signals={data.marketSignals!} />
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3 mt-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mt-2">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
      {isPartial && <p className="text-[9px] text-muted-foreground/30 mt-1">Analisi basata su copertura parziale — dati indicativi</p>}
    </Section>
  );
}

function ComparablesBlock({ comp, isPartial }: { comp: ComparablesSummary; isPartial: boolean }) {
  const depthLabels: Record<string, string> = { profondo: "Profondo", sufficiente: "Sufficiente", limitato: "Limitato" };
  const freshnessLabels: Record<string, string> = { recente: "Recente", moderata: "Moderata", datata: "Datata" };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-foreground tracking-tight">{comp.count}</span>
        <span className="text-xs text-muted-foreground font-medium">comparabili analizzati</span>
      </div>

      {(comp.q1PricePerSqm != null || comp.medianPricePerSqm != null) && (
        <div className="grid grid-cols-2 gap-2">
          {comp.medianPricePerSqm != null && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mediana €/m²</span>
              <p className="font-bold text-foreground text-sm mt-0.5">{fmtEur(comp.medianPricePerSqm)}</p>
            </div>
          )}
          {comp.q1PricePerSqm != null && comp.q3PricePerSqm != null && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Intervallo</span>
              <p className="font-bold text-foreground text-sm mt-0.5">{fmtEur(comp.q1PricePerSqm)} – {fmtEur(comp.q3PricePerSqm)}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {comp.marketDepth && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Profondità:</span>
            <span className="font-semibold text-foreground">{depthLabels[comp.marketDepth] ?? comp.marketDepth}</span>
          </div>
        )}
        {comp.marketFreshness && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Freschezza:</span>
            <span className="font-semibold text-foreground">{freshnessLabels[comp.marketFreshness] ?? comp.marketFreshness}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MarketSignalsBlock({ signals }: { signals: { key: string; label: string; value?: string | number | null; detail?: string | null }[] }) {
  const publishable = signals.filter(s => s.label && s.value != null).slice(0, 5);
  if (publishable.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Segnali di mercato</p>
      {publishable.map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          <Gem className="h-3 w-3 mt-0.5 shrink-0 text-indigo-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground">{s.label}</span>
              <span className="text-xs text-primary font-semibold">{String(s.value)}</span>
            </div>
            {s.detail && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── POI Enrichment Card ─────────────────────────────── */

function PoiEnrichmentCard({ data, loading }: { data: PoiEnrichmentData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.totalPois === 0) return null;

  const categoryIcons: Record<string, React.ElementType> = {
    transport: MapPin, education: Users, health: AlertTriangle,
    shopping: Gem, parks: Compass, culture: Eye,
  };

  return (
    <Section gradient="from-cyan-500/10 to-teal-500/5 border-cyan-500/15">
      <SectionHeader icon={MapPin} title="Servizi e POI nelle vicinanze" badge={`${data.totalPois} trovati`} />
      <p className="text-xs text-muted-foreground mb-3">Raggio di ricerca: {data.searchRadius}m</p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.categories.slice(0, 6).map((cat, i) => {
          const Icon = categoryIcons[cat.category] ?? MapPin;
          return (
            <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{cat.categoryLabel}</p>
                <p className="text-[10px] text-muted-foreground">{cat.count} · {cat.nearest ? `${cat.nearest.distance}m` : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      {data.attributionNote && (
        <p className="text-[9px] text-muted-foreground/40 mt-1">{data.attributionNote}</p>
      )}
      <SourceTag meta={data} />
    </Section>
  );
}


function LowConfidenceCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Section className="border-amber-500/20 bg-amber-500/5">
      <div className="flex flex-col items-center text-center gap-4 py-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <Camera className="h-7 w-7 text-amber-400" />
        </div>
        <div className="space-y-2 max-w-xs">
          <p className="text-sm font-semibold text-foreground">Acquisizione non ancora sufficiente per il report</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Per completare l'analisi, ripeti lo scatto includendo meglio facciata e civico.</p>
        </div>
        <Button onClick={onRetry} size="lg" className="min-h-[48px] w-full max-w-[240px]">
          <Camera className="h-4 w-4 mr-2" />Riprova lo scatto
        </Button>
      </div>
    </Section>
  );
}

/* ── Report quality footer ───────────────────────────── */

function ReportFooter({ excludedCount, totalPublished }: { excludedCount: number; totalPublished: number }) {
  return (
    <div className="space-y-2 pt-2">
      {totalPublished > 0 && (
        <p className="text-center text-[10px] text-muted-foreground/40">
          Report basato su {totalPublished} {totalPublished === 1 ? "modulo verificato" : "moduli verificati"}
          {excludedCount > 0 && ` · ${excludedCount} ${excludedCount === 1 ? "elemento escluso" : "elementi esclusi"} dai controlli di pubblicazione`}
        </p>
      )}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────── */

interface ResultState { photo: string; lat: number | null; lng: number | null; }

const LOW_CONFIDENCE_THRESHOLD = 0.4;

const isDev = import.meta.env.DEV;
function devLog(...args: unknown[]) { if (isDev) console.log("[RESULT]", ...args); }

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultState | null;
  const { result, scanning, scan } = useBuildingScan();
  const { saveScan } = useScanHistory();
  const { toast } = useToast();
  const started = useRef(false);

  const hasValidPhoto = isValidImageDataUrl(state?.photo);
  const hasValidCoords = isValidGps(state?.lat, state?.lng);

  useEffect(() => {
    if (!hasValidPhoto || !hasValidCoords || started.current) return;
    started.current = true;
    devLog("identify start", { lat: state!.lat, lng: state!.lng });
    scan(state!.photo, state!.lat!, state!.lng!);
  }, [state, scan, hasValidPhoto, hasValidCoords]);

  if (!hasValidPhoto) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  if (!hasValidCoords) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <MapPin className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-2">Posizione non disponibile</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
          Per analizzare correttamente l'edificio serve la posizione del dispositivo. Consenti la geolocalizzazione e riprova.
        </p>
        <Button className="min-h-[48px]" onClick={() => navigate("/scan")}>Torna alla scansione</Button>
      </div>
    );
  }

  const identifyFailed = result.identify.status === "error";
  const identifyData = result.identify.data as IdentifyResult | null;
  const identifyDone = result.identify.status === "success";
  const lowConfidence = identifyDone && identifyData != null && identifyData.confidence < LOW_CONFIDENCE_THRESHOLD;

  // Count publishable vs excluded
  const moduleKeys: (keyof ScanResult)[] = ["pricing", "marketContext", "convergenzaTerritoriale", "rischioZona", "trendDemografico", "opportunity", "timeView", "infrastrutture", "sviluppoArea"];
  const completedModules = moduleKeys.filter(k => result[k].status !== "loading" && result[k].status !== "idle");
  const publishedCount = completedModules.filter(k => isSectionPublishable(result[k].status, result[k].data)).length;
  const excludedCount = completedModules.length - publishedCount;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button onClick={() => navigate("/scan")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <span className="text-base font-bold text-foreground flex-1">Report</span>
        {scanning && <span className="text-[11px] text-primary font-medium animate-pulse">Elaborazione in corso…</span>}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 px-4 sm:px-5 pb-32 pt-2">
          {/* Identify error — premium retry prompt */}
          {identifyFailed && (
            <Section className="border-destructive/20 bg-destructive/5">
              <div className="flex flex-col items-center text-center gap-4 py-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <Camera className="h-7 w-7 text-destructive" />
                </div>
                <div className="space-y-2 max-w-xs">
                  <p className="text-sm font-semibold text-foreground">Scatto non ancora sufficiente per l'analisi</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Per pubblicare il report, ripeti lo scatto inquadrando la facciata intera e il civico.</p>
                </div>
                <Button size="lg" className="min-h-[48px]" onClick={() => navigate("/scan")}>
                  <Camera className="h-4 w-4 mr-2" />Riprova lo scatto
                </Button>
              </div>
            </Section>
          )}

          <HeaderCard photo={state.photo} identify={identifyData} loading={result.identify.status === "loading"} lat={state.lat} lng={state.lng} lowConfidence={lowConfidence} />

          {lowConfidence && <LowConfidenceCard onRetry={() => navigate("/scan")} />}

          {!lowConfidence && !identifyFailed && (
            <>
              {/* Tier 1 — verified / official data first */}
              <PricingCard data={result.pricing.data as PricingData | null} loading={result.pricing.status === "loading"} />

              {/* Tier 1.5 — Market layer (premium, only if publishable) */}
              <MarketContextCard data={result.marketContext.data as MarketContextData | null} loading={result.marketContext.status === "loading"} />

              <RischioZonaCard data={result.rischioZona.data as RischioZonaData | null} loading={result.rischioZona.status === "loading"} />
              <TrendDemograficoCard data={result.trendDemografico.data as TrendDemograficoData | null} loading={result.trendDemografico.status === "loading"} />

              {/* Tier 2 — synthetic indices & elaborated insights */}
              <ConvergenzaTerritorialeCard data={result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null} loading={result.convergenzaTerritoriale.status === "loading"} />
              <OpportunityCard data={result.opportunity.data as OpportunityData | null} loading={result.opportunity.status === "loading"} />
              <TimeViewCard data={result.timeView.data as TimeViewData | null} loading={result.timeView.status === "loading"} />
              <InfrastrutureCard data={result.infrastrutture.data as InfrastrutureData | null} loading={result.infrastrutture.status === "loading"} />
              <SviluppoAreaCard data={result.sviluppoArea.data as SviluppoAreaData | null} loading={result.sviluppoArea.status === "loading"} />

              {/* Discrete quality footer */}
              {!scanning && <ReportFooter excludedCount={excludedCount} totalPublished={publishedCount} />}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border/50 px-4 sm:px-5 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-3 flex gap-3 z-40">
        <Button className="flex-1 min-h-[48px]" size="lg" onClick={() => navigate("/scan")}>Nuova scansione</Button>
        <Button variant="outline" size="lg" className="shrink-0 min-h-[48px]" onClick={() => {
          if (!state) return;
          if (!identifyData) {
            toast({ title: "Report non salvabile", description: "L'identificazione dell'edificio non è ancora completa.", variant: "destructive" });
            return;
          }
          const convergenza = result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null;
          saveScan({
            photo: state.photo,
            address: identifyData.address ?? "Indirizzo sconosciuto",
            lat: state.lat ?? null,
            lng: state.lng ?? null,
            moodScore: null,
            convergenzaTerritoriale: convergenza ? {
              score: convergenza.score,
              band: convergenza.band,
              convergenceLevel: convergenza.convergenceLevel,
              coverageLevel: convergenza.coverageLevel,
            } : null,
            scanResult: result,
          });
          toast({ title: "Report salvato", description: "Trovi questo report nella cronologia." });
        }}><Bookmark className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default Result;
