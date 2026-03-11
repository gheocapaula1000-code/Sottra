import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Building2, Home, TrendingUp, History, ChevronRight, Zap, Users, Rocket, Construction, AlertTriangle, MapPin, Compass, Target, Eye, ShieldCheck, TriangleAlert, Layers } from "lucide-react";
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
  ConvergenzaTerritorialeData,
  ScanResult, SourceMetadata,
  InfrastructureProject, InfrastructureSignal, InfrastructureDriverRisk,
} from "@/types";

/* ── helpers ─────────────────────────────────────────── */

/** Safely extract display text from a value that may be a string or an object with a label/message key */
function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.title === "string") return obj.title;
    if (typeof obj.name === "string") return obj.name;
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

/** Converte sourceType backend in DataTier */
function sourceTypeToTier(sourceType?: string): DataTier {
  switch (sourceType) {
    case "official": return "ufficiale";
    case "elaborated": return "elaborato";
    case "estimate": return "stima";
    case "unavailable": return "non_disponibile";
    default: return "elaborato";
  }
}

function SourceLabel({ text, tier }: { text: string; tier?: DataTier }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      {tier && <DataBadge tier={tier} />}
      <p className="text-[10px] text-muted-foreground/50">{text}</p>
    </div>
  );
}

function Section({ visible = true, children, className }: { visible?: boolean; children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-card border border-border p-4 transition-opacity duration-500", visible ? "opacity-100" : "opacity-0", className)}>{children}</div>;
}

function SectionSkeleton() {
  return <div className="rounded-xl bg-card border border-border p-4 space-y-3"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>;
}

function ScoreArc({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? "hsl(var(--chart-2))" : pct >= 40 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))";
  return (
    <svg width={size} height={size} className="block">
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

/* ── cards ────────────────────────────────────────────── */

function HeaderCard({ photo, identify, loading, lat, lng }: { photo: string; identify: IdentifyResult | null; loading: boolean; lat: number | null; lng: number | null }) {
  if (loading) return <SectionSkeleton />;
  return (
    <Section>
      <img src={photo} alt="Edificio" className="w-full aspect-video object-cover rounded-t-xl mb-3" />
      {identify && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">{identify.address}</h2>
          <p className="text-xs text-muted-foreground">ID: {identify.buildingId}</p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Attendibilità {Math.round(identify.confidence * 100)}%</Badge>
            {lat != null && lng != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{lat.toFixed(4)}, {lng.toFixed(4)}</span>}
          </div>
        </div>
      )}
    </Section>
  );
}

function PricingCard({ data, loading, error, message }: { data: PricingData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return <Section><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="font-semibold text-foreground text-sm">Prezzi di Mercato</span></div><p className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</p></Section>;
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || data.prezzoMq == null;
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Prezzi di Mercato</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dato non disponibile per questo comune"}</p>
        <SourceLabel text={data.sourceLabel || "Fonte ufficiale non trovata per l'indirizzo analizzato"} tier="non_disponibile" />
      </Section>
    );
  }

  const diff = (data.prezzoMq ?? 0) - (data.mediaZona ?? 0);
  const tier = sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || (tier === "ufficiale" ? "Fonte: Agenzia Entrate — OMI" : "Elaborazione da fonti di mercato");
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Prezzi di Mercato</span></div>
      <p className="text-2xl font-bold text-foreground">{fmtEur(data.prezzoMq)}<span className="text-sm font-normal text-muted-foreground">/m²</span></p>
      <p className="text-xs text-muted-foreground mt-1">Fascia: {fmtEur(data.prezzoMqMin)} – {fmtEur(data.prezzoMqMax)}</p>
      <div className="flex items-center gap-2 mt-2"><span className="text-xs text-muted-foreground">Media zona: {fmtEur(data.mediaZona)}</span><Badge variant={diff >= 0 ? "default" : "secondary"}>{diff >= 0 ? "Sopra" : "Sotto"} media</Badge></div>
      <p className="text-xs text-muted-foreground mt-2">Trend 5 anni: <span className="font-medium text-foreground">{data.trend5Anni != null && data.trend5Anni > 0 ? "+" : ""}{fmt(data.trend5Anni)}%</span></p>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mt-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function TrendDemograficoCard({ data, loading, error, message }: { data: TrendDemograficoData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Trend Demografico</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || data.etaMedia == null;
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Trend Demografico</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dato non disponibile per questo comune"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || (tier === "ufficiale" ? "Fonte: ISTAT" : "Elaborazione dati demografici");
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Trend Demografico</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div><span className="text-muted-foreground">Età media</span><p className="font-medium text-foreground">{fmt(data.etaMedia)}</p></div>
        <div><span className="text-muted-foreground">Densità</span><p className="font-medium text-foreground">{fmt(data.densitaAbitanti)} ab/km²</p></div>
        <div><span className="text-muted-foreground">Flusso 12m</span><p className="font-medium text-foreground">{data.flussoResidenti12Mesi != null && data.flussoResidenti12Mesi > 0 ? "+" : ""}{fmt(data.flussoResidenti12Mesi)}%</p></div>
        <div><span className="text-muted-foreground">Under 35</span><p className="font-medium text-foreground">{fmt(data.percentualeGiovani)}%</p></div>
      </div>
      <div className="space-y-2">
        <MiniBar label="Famiglie" value={data.percentualeFamiglie ?? 0} />
        <MiniBar label="Stranieri" value={data.percentualeStranieri ?? 0} />
      </div>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mt-2">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function TimeViewCard({ data, loading, error, message }: { data: TimeViewData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Eye className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Scenario Evolutivo</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || (!data.scenarioBand && data.previsione5Anni == null);
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Eye className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Scenario Evolutivo</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dati insufficienti per elaborare uno scenario evolutivo"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType) === "stima" ? "elaborato" as DataTier : sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || "Elaborazione da indicatori territoriali e infrastrutturali";
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const bandColors: Record<string, string> = {
    favorevole: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    moderatamente_favorevole: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    stabile: "from-slate-500/15 to-stone-500/10 border-slate-500/30",
    da_monitorare: "from-amber-500/15 to-yellow-500/10 border-amber-500/30",
  };
  const bandLabels: Record<string, string> = {
    favorevole: "Scenario favorevole",
    moderatamente_favorevole: "Scenario moderatamente favorevole",
    stabile: "Scenario stabile",
    da_monitorare: "Scenario da monitorare",
  };

  const bandClass = data.scenarioBand ? bandColors[data.scenarioBand] ?? "" : "";
  const bandLabel = data.scenarioBand ? bandLabels[data.scenarioBand] ?? data.scenarioBand : null;
  const drivers = (data.scenarioDrivers ?? []).slice(0, 3);
  const risks = (data.scenarioRisks ?? []).slice(0, 2);

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Scenario Evolutivo</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      {data.scenarioHorizon && (
        <p className="text-xs text-muted-foreground mb-3">Orizzonte: <span className="font-medium text-foreground">{data.scenarioHorizon}</span></p>
      )}

      {data.previsione5Anni != null && (
        <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4 rounded-lg bg-background/50 border border-border/50 p-3">
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">5 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione5Anni)}%</p></div>
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">10 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione10Anni)}%</p></div>
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">20 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione20Anni)}%</p></div>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori trainanti</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{toText(d)}</p>
            </div>
          ))}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di attenzione</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs text-foreground leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {(data.progettiInArrivo ?? []).length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Progetti in arrivo</p>
          {(data.progettiInArrivo ?? []).map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-foreground"><Rocket className="h-3 w-3 text-primary" />{toText(p)}</div>)}
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mb-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
      <p className="text-[9px] text-muted-foreground/40 mt-1">Le proiezioni sono indicative e non costituiscono consulenza finanziaria</p>
    </Section>
  );
}

function InfrastrutureCard({ data, loading, error, message }: { data: InfrastrutureData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Construction className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Infrastrutture e Reti</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || (data.infrastructureScore == null && !data.narrativeObservation);
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Construction className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Infrastrutture e Reti</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dati non disponibili per questa zona"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType) === "stima" ? "elaborato" as DataTier : sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || "Elaborazione da Open Data comunali e fonti pubbliche";
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const bandColors: Record<string, string> = {
    elevata: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    significativa: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    moderata: "from-amber-500/15 to-yellow-500/10 border-amber-500/30",
    contenuta: "from-orange-500/15 to-amber-500/10 border-orange-500/30",
    limitata: "from-stone-500/15 to-stone-400/10 border-stone-500/30",
  };
  const bandLabels: Record<string, string> = {
    elevata: "Copertura elevata",
    significativa: "Copertura significativa",
    moderata: "Copertura moderata",
    contenuta: "Copertura contenuta",
    limitata: "Copertura limitata",
  };

  const bandClass = data.infrastructureBand ? bandColors[data.infrastructureBand] ?? "" : "";
  const bandLabel = data.infrastructureBand ? bandLabels[data.infrastructureBand] ?? data.infrastructureBand : null;

  const toDriverRisk = (item: InfrastructureDriverRisk | string): InfrastructureDriverRisk =>
    typeof item === "string" ? { label: item } : item;
  const toSignal = (item: InfrastructureSignal | string): InfrastructureSignal =>
    typeof item === "string" ? { label: item } : item;
  const toProject = (item: InfrastructureProject | string): InfrastructureProject =>
    typeof item === "string" ? { label: item } : item;

  const drivers = (data.topDrivers ?? []).slice(0, 3).map(toDriverRisk);
  const risks = (data.topRisks ?? []).slice(0, 2).map(toDriverRisk);
  const infraProjects = (data.infrastructureProjects ?? []).slice(0, 3).map(toProject);
  const mobilitySignals = (data.mobilitySignals ?? []).slice(0, 2).map(toSignal);
  const connectivitySignals = (data.connectivitySignals ?? []).slice(0, 2).map(toSignal);
  const publicWorksSignals = (data.publicWorksSignals ?? []).slice(0, 2).map(toSignal);

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Construction className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Infrastrutture e Reti</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      {data.infrastructureScore != null && (
        <div className="flex items-center gap-3 mb-4">
          <ScoreArc value={data.infrastructureScore} />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.infrastructureScore >= 70
                ? "La zona mostra segnali infrastrutturali rilevanti. Il contesto è sostenuto da interventi e reti che meritano attenzione."
                : data.infrastructureScore >= 45
                  ? "Area con supporti infrastrutturali da non sottovalutare. Territorio con elementi di trasformazione concreti."
                  : "Contesto infrastrutturale contenuto. La zona presenta margini di sviluppo da monitorare nel tempo."
              }
            </p>
          </div>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori chiave</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs text-foreground leading-relaxed">{d.label}</p>
                {d.source && <p className="text-[10px] text-muted-foreground/60">{d.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {infraProjects.length > 0 && (
        <div className="rounded-lg bg-background/50 border border-border/50 p-3 mb-3 space-y-2.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opere e progetti</p>
          {infraProjects.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <Construction className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
              <div className="min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{p.label}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {p.status && <span className="text-[10px] text-muted-foreground">{p.status}</span>}
                  {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                  {p.impact && <span className="text-[10px] text-primary/80 font-medium">{p.impact}</span>}
                  {p.period && <span className="text-[10px] text-muted-foreground/60">{p.period}</span>}
                </div>
                {p.source && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{p.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(mobilitySignals.length > 0 || connectivitySignals.length > 0 || publicWorksSignals.length > 0) && (
        <div className="rounded-lg bg-background/50 border border-border/50 p-3 mb-3 space-y-3">
          {mobilitySignals.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Mobilità</p>
              {mobilitySignals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                  <div>
                    <span>{s.label}</span>
                    {s.source && <span className="text-[10px] text-muted-foreground/60 ml-1">· {s.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {connectivitySignals.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Connettività</p>
              {connectivitySignals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <Zap className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                  <div>
                    <span>{s.label}</span>
                    {s.source && <span className="text-[10px] text-muted-foreground/60 ml-1">· {s.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {publicWorksSignals.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Interventi pubblici</p>
              {publicWorksSignals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <Rocket className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                  <div>
                    <span>{s.label}</span>
                    {s.source && <span className="text-[10px] text-muted-foreground/60 ml-1">· {s.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di attenzione</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs text-foreground leading-relaxed">{r.label}</p>
                {r.source && <p className="text-[10px] text-muted-foreground/60">{r.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mb-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function RischioZonaCard({ data, loading, error, message }: { data: RischioZonaData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Rischio Zona</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || data.scoreRischio == null;
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Rischio Zona</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dato non disponibile per questo comune"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || (tier === "ufficiale" ? "Fonte: ISPRA IdroGEO + INGV" : "Elaborazione rischio zona");
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const lc: Record<string, string> = { nullo: "text-green-500", basso: "text-green-400", medio: "text-amber-400", alto: "text-red-500", zona4: "text-green-500", zona3: "text-green-400", zona2: "text-amber-400", zona1: "text-red-500" };

  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Rischio Zona</span></div>
      <div className="flex items-start gap-4">
        <ScoreArc value={data.scoreRischio ?? 0} />
        <div className="grid grid-cols-2 gap-3 text-sm flex-1">
          <div><span className="text-muted-foreground">Idrogeologico</span><p className={`font-medium capitalize ${data.idrogeologico ? lc[data.idrogeologico] : "text-muted-foreground"}`}>{data.idrogeologico ?? "—"}</p></div>
          <div><span className="text-muted-foreground">Sismico</span><p className={`font-medium ${data.sismico ? lc[data.sismico] : "text-muted-foreground"}`}>{data.sismico ? data.sismico.replace("zona", "Zona ") : "—"}</p></div>
          <div><span className="text-muted-foreground">Inquinamento</span><p className={`font-medium capitalize ${data.inquinamento ? lc[data.inquinamento] : "text-muted-foreground"}`}>{data.inquinamento ?? "—"}</p></div>
          <div><span className="text-muted-foreground">Alluvionale</span><p className={`font-medium ${data.alluvionale != null ? (data.alluvionale ? "text-red-500" : "text-green-500") : "text-muted-foreground"}`}>{data.alluvionale != null ? (data.alluvionale ? "Sì" : "No") : "—"}</p></div>
        </div>
      </div>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mt-2">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function SviluppoAreaCard({ data, loading, error, message }: { data: SviluppoAreaData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Compass className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Dinamica Territoriale</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || (data.areaDevelopmentScore == null && !data.narrativeObservation);
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Compass className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Dinamica Territoriale</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Copertura non disponibile per questa zona"}</p>
        <SourceLabel text={data.sourceLabel || "Dati insufficienti per l'elaborazione"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || "Elaborazione da fonti pubbliche";
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const bandColors: Record<string, string> = {
    elevata: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    significativa: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    moderata: "from-amber-500/15 to-yellow-500/10 border-amber-500/30",
    contenuta: "from-orange-500/15 to-amber-500/10 border-orange-500/30",
    limitata: "from-stone-500/15 to-stone-400/10 border-stone-500/30",
  };
  const bandLabels: Record<string, string> = {
    elevata: "Dinamica elevata",
    significativa: "Dinamica significativa",
    moderata: "Dinamica moderata",
    contenuta: "Dinamica contenuta",
    limitata: "Dinamica limitata",
  };

  const bandClass = data.areaDevelopmentBand ? bandColors[data.areaDevelopmentBand] ?? "" : "";
  const bandLabel = data.areaDevelopmentBand ? bandLabels[data.areaDevelopmentBand] ?? data.areaDevelopmentBand : null;
  const topSignals = (data.developmentSignals ?? []).filter(s => s.label).slice(0, 3);
  const highlights: string[] = [
    ...(data.infrastructureProjects ?? []).slice(0, 2),
    ...(data.connectivitySignals ?? []).slice(0, 1),
    ...(data.publicInvestmentSignals ?? []).slice(0, 1),
  ].slice(0, 3);

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Dinamica Territoriale</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      {data.areaDevelopmentScore != null && (
        <div className="flex items-center gap-3 mb-4">
          <ScoreArc value={data.areaDevelopmentScore} />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.areaDevelopmentScore >= 70
                ? "Il territorio mostra elementi di evoluzione concreti. I segnali emersi meritano una valutazione seria."
                : data.areaDevelopmentScore >= 45
                  ? "Contesto con fattori di trasformazione rilevanti. Zona da monitorare con attenzione."
                  : "Area con segnali contenuti di sviluppo. Il contesto attuale è stabile."
              }
            </p>
          </div>
        </div>
      )}

      {topSignals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Segnali rilevanti</p>
          {topSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className={cn(
                "mt-1 h-2 w-2 rounded-full shrink-0",
                s.relevance === "alta" ? "bg-emerald-500" : s.relevance === "media" ? "bg-sky-500" : "bg-muted-foreground/50"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{s.label}</p>
                {s.detail && <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="rounded-lg bg-background/50 border border-border/50 p-3 mb-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opere e investimenti</p>
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-foreground">
              <Construction className="h-3 w-3 shrink-0 text-primary/70" />
              <span>{toText(h)}</span>
            </div>
          ))}
        </div>
      )}

      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mb-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function OpportunityCard({ data, loading, error, message }: { data: OpportunityData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Indice Opportunità</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const scoreValue = data.score ?? data.indice ?? null;
  const isUnavailable = data.sourceType === "unavailable" || scoreValue == null;
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Target className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Indice Opportunità</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dati insufficienti per elaborare un indice di opportunità"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType) === "stima" ? "elaborato" as DataTier : sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || "Elaborazione da indicatori di contesto e mercato";
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const bandColors: Record<string, string> = {
    molto_forte: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    forte: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    interessante: "from-violet-500/15 to-indigo-500/10 border-violet-500/30",
    limitata: "from-stone-500/15 to-stone-400/10 border-stone-500/30",
  };
  const bandLabels: Record<string, string> = {
    molto_forte: "Opportunità molto forte",
    forte: "Opportunità forte",
    interessante: "Opportunità interessante",
    limitata: "Opportunità limitata",
  };

  const effectiveBand = data.band ?? null;
  const bandClass = effectiveBand ? bandColors[effectiveBand] ?? "" : "";
  const bandLabel = effectiveBand ? bandLabels[effectiveBand] ?? effectiveBand : (data.quadrante ?? null);

  const drivers = (data.drivers ?? []).slice(0, 3);
  const risks = (data.risks ?? []).slice(0, 2);
  const observation = data.observation ?? data.raccomandazione ?? null;

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Indice Opportunità</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <ScoreArc value={scoreValue} size={88} />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {scoreValue >= 70
              ? "Segnali convergenti da non sottovalutare. Il contesto presenta fattori favorevoli che meritano attenzione seria."
              : scoreValue >= 45
                ? "Quadro interessante da approfondire. Il contesto mostra elementi rilevanti da valutare con attenzione."
                : "Contesto con potenziale contenuto. La zona presenta elementi da monitorare nel tempo."
            }
          </p>
        </div>
      </div>

      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Driver principali</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{toText(d)}</p>
            </div>
          ))}
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di rischio</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-amber-500" />
              <p className="text-xs text-foreground leading-relaxed">{toText(r)}</p>
            </div>
          ))}
        </div>
      )}

      {observation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{observation}"</p>
        </div>
      )}

      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mb-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
      <p className="text-[9px] text-muted-foreground/40 mt-1">Indice elaborato — non costituisce consulenza finanziaria o raccomandazione d'investimento</p>
    </Section>
  );
}

/* ── Convergenza Territoriale Card ───────────────────── */

function ConvergenzaTerritorialeCard({ data, loading, error, message }: { data: ConvergenzaTerritorialeData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Layers className="h-4 w-4 text-destructive" /><span className="font-semibold text-foreground text-sm">Convergenza Territoriale</span></div>
      <span className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</span>
    </Section>
  );
  if (!data) return null;

  const isUnavailable = data.sourceType === "unavailable" || data.score == null;
  if (isUnavailable) {
    return (
      <Section>
        <div className="flex items-center gap-2 mb-3"><Layers className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Convergenza Territoriale</span></div>
        <p className="text-sm text-muted-foreground">{data.limitations?.[0] || "Dati insufficienti per elaborare la convergenza territoriale"}</p>
        <SourceLabel text={data.sourceLabel || "Copertura non disponibile"} tier="non_disponibile" />
      </Section>
    );
  }

  const tier = sourceTypeToTier(data.sourceType) === "stima" ? "elaborato" as DataTier : sourceTypeToTier(data.sourceType);
  const sourceText = data.sourceLabel || "Elaborazione da fonti strutturate e indicatori territoriali";
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  const bandColors: Record<string, string> = {
    molto_forte: "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
    forte: "from-sky-500/20 to-blue-500/10 border-sky-500/30",
    interessante: "from-violet-500/15 to-indigo-500/10 border-violet-500/30",
    debole: "from-stone-500/15 to-stone-400/10 border-stone-500/30",
  };
  const bandLabels: Record<string, string> = {
    molto_forte: "Convergenza molto forte",
    forte: "Convergenza forte",
    interessante: "Convergenza interessante",
    debole: "Convergenza debole",
  };

  const convergenceLevelLabels: Record<string, string> = {
    alta: "Elevata", media: "Media", bassa: "Bassa", insufficiente: "Insufficiente",
  };
  const coverageLevelLabels: Record<string, string> = {
    completa: "Completa", buona: "Buona", parziale: "Parziale", scarsa: "Scarsa",
  };

  const bandClass = data.band ? bandColors[data.band] ?? "" : "";
  const bandLabel = data.band ? bandLabels[data.band] ?? data.band : null;

  const positiveSignals = (data.topPositiveSignals ?? []).slice(0, 3);
  const negativeSignals = (data.topNegativeSignals ?? []).slice(0, 3);

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Convergenza Territoriale</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      {/* Score + summary */}
      <div className="flex items-center gap-3 mb-4">
        <ScoreArc value={data.score ?? 0} size={88} />
        <div className="flex-1 space-y-1.5">
          {data.convergenceLevel && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Convergenza:</span>
              <span className="font-medium text-foreground">{convergenceLevelLabels[data.convergenceLevel] ?? data.convergenceLevel}</span>
            </div>
          )}
          {data.coverageLevel && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Copertura dati:</span>
              <span className="font-medium text-foreground">{coverageLevelLabels[data.coverageLevel] ?? data.coverageLevel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Positive signals */}
      {positiveSignals.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Segnali favorevoli</p>
          {positiveSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs text-foreground leading-relaxed">{s.label}</p>
                {s.source && <p className="text-[10px] text-muted-foreground/60">{s.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Negative signals */}
      {negativeSignals.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contro-segnali</p>
          {negativeSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs text-foreground leading-relaxed">{s.label}</p>
                {s.source && <p className="text-[10px] text-muted-foreground/60">{s.source}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.confidenceReason && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{data.confidenceReason}"</p>
        </div>
      )}

      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
      <p className="text-[9px] text-muted-foreground/40 mt-1">Indice di convergenza elaborato — non costituisce consulenza o raccomandazione</p>
    </Section>
  );
}

/* ── page ─────────────────────────────────────────────── */

interface ResultState { photo: string; lat: number | null; lng: number | null; }

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

  // No photo at all
  if (!hasValidPhoto) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  // No valid GPS — blocked
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

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button onClick={() => navigate("/scan")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <span className="text-base font-bold text-foreground flex-1">Risultato</span>
        {scanning && <span className="text-xs text-muted-foreground animate-pulse">Elaborazione…</span>}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 px-5 pb-32 pt-2">
          {/* Identify error card */}
          {identifyFailed && (
            <Section className="border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-1">Identificazione non riuscita</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {result.identify.message || "Non è stato possibile identificare l'edificio. Assicurati che la foto sia nitida e ritenta."}
                  </p>
                  <Button size="sm" onClick={() => navigate("/scan")}>Nuova scansione</Button>
                </div>
              </div>
            </Section>
          )}

          <HeaderCard photo={state.photo} identify={identifyData} loading={result.identify.status === "loading"} lat={state.lat} lng={state.lng} />
          <PricingCard data={result.pricing.data as PricingData | null} loading={result.pricing.status === "loading"} error={result.pricing.status === "error"} message={result.pricing.message} />
          <ConvergenzaTerritorialeCard data={result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null} loading={result.convergenzaTerritoriale.status === "loading"} error={result.convergenzaTerritoriale.status === "error"} message={result.convergenzaTerritoriale.message} />
          <RischioZonaCard data={result.rischioZona.data as RischioZonaData | null} loading={result.rischioZona.status === "loading"} error={result.rischioZona.status === "error"} message={result.rischioZona.message} />
          <TrendDemograficoCard data={result.trendDemografico.data as TrendDemograficoData | null} loading={result.trendDemografico.status === "loading"} error={result.trendDemografico.status === "error"} message={result.trendDemografico.message} />
          <OpportunityCard data={result.opportunity.data as OpportunityData | null} loading={result.opportunity.status === "loading"} error={result.opportunity.status === "error"} message={result.opportunity.message} />
          <TimeViewCard data={result.timeView.data as TimeViewData | null} loading={result.timeView.status === "loading"} error={result.timeView.status === "error"} message={result.timeView.message} />
          <InfrastrutureCard data={result.infrastrutture.data as InfrastrutureData | null} loading={result.infrastrutture.status === "loading"} error={result.infrastrutture.status === "error"} message={result.infrastrutture.message} />
          <SviluppoAreaCard data={result.sviluppoArea.data as SviluppoAreaData | null} loading={result.sviluppoArea.status === "loading"} error={result.sviluppoArea.status === "error"} message={result.sviluppoArea.message} />

          {/* Moduli in valutazione */}
          <Section className="border-dashed border-border/60">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Construction className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Ulteriori moduli in valutazione</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dati catastali, classe energetica, dettagli condominiali, storico transazioni e annunci nella zona saranno disponibili progressivamente, man mano che le fonti saranno integrate e verificate.
                </p>
              </div>
            </div>
          </Section>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-lg border-t border-border px-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] pt-3 flex gap-3 z-40">
        <Button className="flex-1 min-h-[44px]" size="lg" onClick={() => navigate("/scan")}>Nuova scansione</Button>
        <Button variant="outline" size="lg" className="shrink-0" onClick={() => {
          if (!state) return;
          if (!identifyData) {
            toast({ title: "Scansione non salvabile", description: "L'identificazione dell'edificio non è riuscita.", variant: "destructive" });
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
          toast({ title: "Scansione salvata", description: "Trovi questa scansione nella cronologia." });
        }}><Bookmark className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default Result;
