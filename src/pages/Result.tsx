import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Building2, Home, TrendingUp, History, ChevronRight, Zap, Users, Rocket, Construction, AlertTriangle, MapPin, Compass, Target, Eye, ShieldCheck, TriangleAlert } from "lucide-react";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBuildingScan } from "@/hooks/useBuildingScan";
import { cn } from "@/lib/utils";
import { DataBadge, type DataTier } from "@/components/DataBadge";
import Watermark from "@/components/Watermark";
import type {
  IdentifyResult, CadastralData, PricingData, ListingsData,
  EnergyData, MoodScoreData, TimeViewData, OpportunityData,
  CondominioData, StoricoTransazioniData, InfrastrutureData,
  RischioZonaData, TrendDemograficoData, SviluppoAreaData, ScanResult, SourceMetadata,
} from "@/types";

/* ── helpers ─────────────────────────────────────────── */

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
    default: return "stima";
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
            <Badge variant="secondary">{Math.round(identify.confidence * 100)}% match</Badge>
            {lat != null && lng != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{lat.toFixed(4)}, {lng.toFixed(4)}</span>}
          </div>
        </div>
      )}
    </Section>
  );
}

function CadastralCard({ data, loading }: { data: CadastralData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Building2 className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Dati Catastali</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Anno</span><p className="font-medium text-foreground">{data.anno}</p></div>
        <div><span className="text-muted-foreground">Piani</span><p className="font-medium text-foreground">{data.piani}</p></div>
        <div><span className="text-muted-foreground">Unità</span><p className="font-medium text-foreground">{data.unitaImmobiliari}</p></div>
        <div><span className="text-muted-foreground">Rendita</span><p className="font-medium text-foreground">{fmtEur(data.renditaCatastale)}</p></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Foglio {data.foglio} · Particella {data.particella} · Sub {data.subalterno}</p>
      <SourceLabel text="Fonte in attivazione — collegamento a Sister/Catasto in corso" tier="stima" />
    </Section>
  );
}

function CondominioCard({ data, loading }: { data: CondominioData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const yn = (v: boolean) => v ? "Sì" : "No";
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Home className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Condominio</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Riscaldamento</span><p className="font-medium text-foreground capitalize">{data.tipoRiscaldamento}</p></div>
        <div><span className="text-muted-foreground">Stato</span><p className="font-medium text-foreground capitalize">{data.statoConservazione}</p></div>
        <div><span className="text-muted-foreground">Ascensore</span><p className="font-medium text-foreground">{yn(data.ascensore)}</p></div>
        <div><span className="text-muted-foreground">Posti auto</span><p className="font-medium text-foreground">{data.postiAuto}</p></div>
        <div><span className="text-muted-foreground">Portineria</span><p className="font-medium text-foreground">{yn(data.portineria)}</p></div>
        <div><span className="text-muted-foreground">Giardino</span><p className="font-medium text-foreground">{yn(data.giardino)}</p></div>
        {data.annoUltimaRistrutturazione && <div className="col-span-2"><span className="text-muted-foreground">Ultima ristrutturazione</span><p className="font-medium text-foreground">{data.annoUltimaRistrutturazione}</p></div>}
      </div>
      <SourceLabel text="Elaborazione da fonti pubbliche" tier="elaborato" />
    </Section>
  );
}

function PricingCard({ data, loading, error, message }: { data: PricingData | null; loading: boolean; error: boolean; message: string | null }) {
  if (loading) return <SectionSkeleton />;
  if (error) return <Section><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="font-semibold text-foreground text-sm">Prezzi di Mercato</span></div><p className="text-sm text-muted-foreground">{message || "Servizio non ancora disponibile"}</p></Section>;
  if (!data) return null;

  // Gestione unavailable
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
  const sourceText = data.sourceLabel || (tier === "ufficiale" ? "Fonte: Agenzia Entrate — OMI" : "Stima indicativa");
  const periodText = data.sourcePeriod ? ` (${data.sourcePeriod})` : "";

  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Prezzi di Mercato</span></div>
      <p className="text-2xl font-bold text-foreground">{fmtEur(data.prezzoMq)}<span className="text-sm font-normal text-muted-foreground">/m²</span></p>
      <p className="text-xs text-muted-foreground mt-1">Range: {fmtEur(data.prezzoMqMin)} – {fmtEur(data.prezzoMqMax)}</p>
      <div className="flex items-center gap-2 mt-2"><span className="text-xs text-muted-foreground">Media zona: {fmtEur(data.mediaZona)}</span><Badge variant={diff >= 0 ? "default" : "secondary"}>{diff >= 0 ? "Sopra" : "Sotto"} media</Badge></div>
      <p className="text-xs text-muted-foreground mt-2">Trend 5 anni: <span className="font-medium text-foreground">{data.trend5Anni != null && data.trend5Anni > 0 ? "+" : ""}{fmt(data.trend5Anni)}%</span></p>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/70 mt-1">{data.confidenceReason}</p>}
      <SourceLabel text={`${sourceText}${periodText}`} tier={tier} />
    </Section>
  );
}

function StoricoTransazioniCard({ data, loading }: { data: StoricoTransazioniData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><History className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Storico Transazioni</span></div>
      <div className="space-y-2">
        {data.transazioni.map((t, i) => (
          <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
            <div><Badge variant={t.tipo === "vendita" ? "default" : "secondary"} className="text-[10px] mr-2">{t.tipo}</Badge><span className="text-muted-foreground">{t.data}</span></div>
            <div className="text-right"><span className="font-medium text-foreground">{fmtEur(t.prezzo)}</span><span className="text-xs text-muted-foreground ml-1">{t.mq}m² · P{t.piano}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Media zona 12m: {fmtEur(data.mediaZona12Mesi)}/m²</span><span className="font-medium text-foreground">{data.variazione12Mesi > 0 ? "+" : ""}{fmt(data.variazione12Mesi)}%</span></div>
      <SourceLabel text="Stima indicativa — collegamento a fonte OMI in corso" tier="stima" />
    </Section>
  );
}

function ListingsCard({ data, loading }: { data: ListingsData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><ChevronRight className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Annunci Attivi</span></div>
      <div className="space-y-2">
        {data.annunci.map((a, i) => (
          <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 hover:bg-muted/50 -mx-1 px-1 rounded">
            <div className="flex items-center gap-2"><Badge variant={a.tipo === "vendita" ? "default" : "secondary"} className="text-[10px]">{a.tipo}</Badge><span className="font-medium text-foreground">{fmtEur(a.prezzo)}</span></div>
            <span className="text-xs text-muted-foreground">{a.mq}m² · {a.locali}loc · P{a.piano}</span>
          </a>
        ))}
      </div>
      <SourceLabel text="Elaborazione da portali immobiliari" tier="elaborato" />
    </Section>
  );
}

function EnergyCard({ data, loading }: { data: EnergyData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const classColors: Record<string, string> = { A: "text-green-500", B: "text-lime-500", C: "text-yellow-500", D: "text-amber-500", E: "text-orange-500", F: "text-red-400", G: "text-red-600" };
  const letter = data.classeEnergetica.charAt(0).toUpperCase();
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Zap className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Classe Energetica</span></div>
      <div className="flex items-center gap-4">
        <span className={`text-5xl font-black ${classColors[letter] ?? "text-muted-foreground"}`}>{data.classeEnergetica}</span>
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">EPgl: <span className="font-medium text-foreground">{fmt(data.epgl)} kWh/m²</span></p>
          <p className="text-muted-foreground">Media zona: <span className="font-medium text-foreground">{data.mediaZona}</span></p>
        </div>
      </div>
      <SourceLabel text="Valore indicativo — verificare con APE ufficiale" tier="stima" />
    </Section>
  );
}

function MoodScoreCard({ data, loading }: { data: MoodScoreData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><span className="font-semibold text-foreground text-sm">Mood Score</span></div>
      <div className="flex items-start gap-4">
        <ScoreArc value={data.score} />
        <div className="flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">Trend: <span className="font-medium text-foreground">{data.trend}</span></p>
          {Object.entries(data.categorie).map(([k, v]) => <MiniBar key={k} label={k} value={v} />)}
        </div>
      </div>
      <SourceLabel text="Indice elaborato internamente — non costituisce valutazione ufficiale" tier="elaborato" />
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Trend Demografico</span></div>
      <span className="text-sm text-muted-foreground">Dati in caricamento...</span>
    </Section>
  );

  // Gestione unavailable
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Eye className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Scenario Evolutivo</span></div>
      <span className="text-sm text-muted-foreground">Dati in elaborazione...</span>
    </Section>
  );

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

      {/* Legacy percentages if present */}
      {data.previsione5Anni != null && (
        <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4 rounded-lg bg-background/50 border border-border/50 p-3">
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">5 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione5Anni)}%</p></div>
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">10 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione10Anni)}%</p></div>
          <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider">20 anni</span><p className="font-bold text-foreground text-lg">{fmt(data.previsione20Anni)}%</p></div>
        </div>
      )}

      {/* Drivers */}
      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori trainanti</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
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

      {/* Narrative */}
      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">"{data.narrativeObservation}"</p>
        </div>
      )}

      {/* Projects */}
      {(data.progettiInArrivo ?? []).length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Progetti in arrivo</p>
          {(data.progettiInArrivo ?? []).map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-foreground"><Rocket className="h-3 w-3 text-primary" />{p}</div>)}
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Construction className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Infrastrutture e Reti</span></div>
      <span className="text-sm text-muted-foreground">Dati in elaborazione...</span>
    </Section>
  );

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

  const drivers = (data.topDrivers ?? []).slice(0, 3);
  const risks = (data.topRisks ?? []).slice(0, 2);

  // Collect signal highlights
  const signalSections: { label: string; icon: React.ReactNode; items: string[] }[] = [];
  const infraProjects = (data.infrastructureProjects ?? []).slice(0, 3);
  if (infraProjects.length > 0) signalSections.push({ label: "Opere e progetti", icon: <Construction className="h-3 w-3 shrink-0 text-primary/70" />, items: infraProjects });
  const mobility = (data.mobilitySignals ?? []).slice(0, 2);
  if (mobility.length > 0) signalSections.push({ label: "Mobilità", icon: <MapPin className="h-3 w-3 shrink-0 text-primary/70" />, items: mobility });
  const connectivity = (data.connectivitySignals ?? []).slice(0, 2);
  if (connectivity.length > 0) signalSections.push({ label: "Connettività", icon: <Zap className="h-3 w-3 shrink-0 text-primary/70" />, items: connectivity });
  const publicWorks = (data.publicWorksSignals ?? []).slice(0, 2);
  if (publicWorks.length > 0) signalSections.push({ label: "Interventi pubblici", icon: <Rocket className="h-3 w-3 shrink-0 text-primary/70" />, items: publicWorks });

  return (
    <Section className={`bg-gradient-to-br ${bandClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Construction className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Infrastrutture e Reti</span>
        </div>
        {bandLabel && <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>}
      </div>

      {/* Score prominente */}
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

      {/* Drivers */}
      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori chiave</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      )}

      {/* Signal sections */}
      {signalSections.length > 0 && (
        <div className="rounded-lg bg-background/50 border border-border/50 p-3 mb-3 space-y-3">
          {signalSections.map((section, si) => (
            <div key={si} className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{section.label}</p>
              {section.items.map((item, ii) => (
                <div key={ii} className="flex items-center gap-2 text-xs text-foreground">
                  {section.icon}
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
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

      {/* Narrative */}
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Rischio Zona</span></div>
      <span className="text-sm text-muted-foreground">Dati in caricamento...</span>
    </Section>
  );

  // Gestione unavailable
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Compass className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Dinamica Territoriale</span></div>
      <span className="text-sm text-muted-foreground">Dati in caricamento...</span>
    </Section>
  );

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

  // Band color mapping
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

  // Collect top 3 signals
  const topSignals = (data.developmentSignals ?? [])
    .filter(s => s.label)
    .slice(0, 3);

  // Collect infrastructure + connectivity + investments for highlights
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
        {bandLabel && (
          <Badge variant="secondary" className="text-[10px] font-medium">{bandLabel}</Badge>
        )}
      </div>

      {/* Score prominente */}
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

      {/* Top signals */}
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

      {/* Highlights: infra, connectivity, investments */}
      {highlights.length > 0 && (
        <div className="rounded-lg bg-background/50 border border-border/50 p-3 mb-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Opere e investimenti</p>
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-foreground">
              <Construction className="h-3 w-3 shrink-0 text-primary/70" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* Narrative observation */}
      {data.narrativeObservation && (
        <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5 mb-3">
          <p className="text-xs text-foreground/90 leading-relaxed italic">
            "{data.narrativeObservation}"
          </p>
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
  if (!data) return (
    <Section>
      <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Indice Opportunità</span></div>
      <span className="text-sm text-muted-foreground">Dati in elaborazione...</span>
    </Section>
  );

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

  // Fallback to legacy quadrante for band styling
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

      {/* Score prominente */}
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

      {/* Drivers */}
      {drivers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Driver principali</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
              <p className="text-xs text-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Elementi di rischio</p>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-amber-500" />
              <p className="text-xs text-foreground leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      )}

      {/* Observation */}
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

/* ── page ─────────────────────────────────────────────── */

interface ResultState { photo: string; lat: number | null; lng: number | null; gpsError?: boolean; }

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultState | null;
  const { result, scanning, scan } = useBuildingScan();
  const { saveScan } = useScanHistory();
  const { toast } = useToast();
  const started = useRef(false);

  useEffect(() => {
    if (!state?.photo || started.current) return;
    started.current = true;
    scan(state.photo, state.lat ?? 0, state.lng ?? 0);
  }, [state, scan]);

  if (!state?.photo) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Watermark rimosso — da riattivare con nome utente dinamico da auth */}
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button onClick={() => navigate("/scan")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <span className="text-base font-bold text-foreground flex-1">Risultato</span>
        {scanning && <span className="text-xs text-muted-foreground animate-pulse">Elaborazione…</span>}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 px-5 pb-32 pt-2">
          <HeaderCard photo={state.photo} identify={result.identify.data as IdentifyResult | null} loading={result.identify.status === "loading"} lat={state.lat} lng={state.lng} />
          <PricingCard data={result.pricing.data as PricingData | null} loading={result.pricing.status === "loading"} error={result.pricing.status === "error"} message={result.pricing.message} />

           <RischioZonaCard data={result.rischioZona.data as RischioZonaData | null} loading={result.rischioZona.status === "loading"} error={result.rischioZona.status === "error"} message={result.rischioZona.message} />
          <TrendDemograficoCard data={result.trendDemografico.data as TrendDemograficoData | null} loading={result.trendDemografico.status === "loading"} error={result.trendDemografico.status === "error"} message={result.trendDemografico.message} />

          <OpportunityCard data={result.opportunity.data as OpportunityData | null} loading={result.opportunity.status === "loading"} error={result.opportunity.status === "error"} message={result.opportunity.message} />
          <TimeViewCard data={result.timeView.data as TimeViewData | null} loading={result.timeView.status === "loading"} error={result.timeView.status === "error"} message={result.timeView.message} />

          <InfrastrutureCard data={result.infrastrutture.data as InfrastrutureData | null} loading={result.infrastrutture.status === "loading"} error={result.infrastrutture.status === "error"} message={result.infrastrutture.message} />

          <SviluppoAreaCard data={result.sviluppoArea.data as SviluppoAreaData | null} loading={result.sviluppoArea.status === "loading"} error={result.sviluppoArea.status === "error"} message={result.sviluppoArea.message} />

          {/* Messaggio sezioni future */}
          <Section>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Altre sezioni in arrivo: dati catastali, energia e dettagli condominiali.
              Il report distingue chiaramente tra dati ufficiali, dati elaborati e stime indicative.
            </p>
          </Section>

          {/* Card commentate — da riattivare con dati reali */}
          {/* <CadastralCard data={result.cadastral.data as CadastralData | null} loading={result.cadastral.status === "loading"} /> */}
          {/* <CondominioCard data={result.condominio.data as CondominioData | null} loading={result.condominio.status === "loading"} /> */}
          {/* <StoricoTransazioniCard data={result.storicoTransazioni.data as StoricoTransazioniData | null} loading={result.storicoTransazioni.status === "loading"} /> */}
          {/* <ListingsCard data={result.listings.data as ListingsData | null} loading={result.listings.status === "loading"} /> */}
          {/* <EnergyCard data={result.energy.data as EnergyData | null} loading={result.energy.status === "loading"} /> */}
          {/* <MoodScoreCard data={result.moodScore.data as MoodScoreData | null} loading={result.moodScore.status === "loading"} /> */}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-lg border-t border-border px-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] pt-3 flex gap-3">
        <Button className="flex-1" size="lg" onClick={() => navigate("/scan")}>Scansiona un altro</Button>
        <Button variant="outline" size="lg" className="shrink-0" onClick={() => {
          if (!state) return;
          const identify = result.identify.data as IdentifyResult | null;
          const mood = result.moodScore.data as MoodScoreData | null;
          saveScan({ photo: state.photo, address: identify?.address ?? "Indirizzo sconosciuto", lat: state.lat ?? null, lng: state.lng ?? null, moodScore: mood?.score ?? null, scanResult: result });
          toast({ title: "Scansione salvata", description: "Trovi questa scansione nella cronologia." });
        }}><Bookmark className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default Result;
