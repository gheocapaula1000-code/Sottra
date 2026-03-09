import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Building2, Home, TrendingUp, History, ChevronRight, Zap, Users, Rocket, Construction, AlertTriangle, MapPin } from "lucide-react";
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
  RischioZonaData, TrendDemograficoData, ScanResult, SourceMetadata,
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
    case "unavailable": return "stima";
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
        <SourceLabel text={data.sourceLabel || "Fonte ufficiale non trovata per l'indirizzo analizzato"} tier="stima" />
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
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Trend Demografico</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div><span className="text-muted-foreground">Età media</span><p className="font-medium text-foreground">{fmt(data.etaMedia)}</p></div>
        <div><span className="text-muted-foreground">Densità</span><p className="font-medium text-foreground">{fmt(data.densitaAbitanti)} ab/km²</p></div>
        <div><span className="text-muted-foreground">Flusso 12m</span><p className="font-medium text-foreground">{data.flussoResidenti12Mesi > 0 ? "+" : ""}{fmt(data.flussoResidenti12Mesi)}%</p></div>
        <div><span className="text-muted-foreground">Under 35</span><p className="font-medium text-foreground">{fmt(data.percentualeGiovani)}%</p></div>
      </div>
      <div className="space-y-2"><MiniBar label="Famiglie" value={data.percentualeFamiglie} /><MiniBar label="Stranieri" value={data.percentualeStranieri} /></div>
      <SourceLabel text="Elaborazione in fase di collegamento a fonte ISTAT" tier="stima" />
    </Section>
  );
}

function TimeViewCard({ data, loading }: { data: TimeViewData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Previsione Valore</span></div>
      <div className="grid grid-cols-3 gap-3 text-center text-sm mb-3">
        <div><span className="text-muted-foreground text-xs">5 anni</span><p className="font-bold text-foreground">{fmt(data.previsione5Anni)}%</p></div>
        <div><span className="text-muted-foreground text-xs">10 anni</span><p className="font-bold text-foreground">{fmt(data.previsione10Anni)}%</p></div>
        <div><span className="text-muted-foreground text-xs">20 anni</span><p className="font-bold text-foreground">{fmt(data.previsione20Anni)}%</p></div>
      </div>
      {data.progettiInArrivo.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Progetti in arrivo</p>
          {data.progettiInArrivo.map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-foreground"><Rocket className="h-3 w-3 text-primary" />{p}</div>)}
        </div>
      )}
      <SourceLabel text="Proiezione indicativa — non costituisce consulenza finanziaria" tier="stima" />
    </Section>
  );
}

function InfrastrutureCard({ data, loading }: { data: InfrastrutureData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const nearby = data.progetti.filter(p => p.distanzaKm <= 3);
  const statoBadge: Record<string, string> = { approvato: "bg-blue-500/20 text-blue-400 border-blue-500/30", in_costruzione: "bg-amber-500/20 text-amber-400 border-amber-500/30", completato: "bg-green-500/20 text-green-400 border-green-500/30" };
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><Construction className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Infrastrutture</span></div>
      {nearby.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun cantiere nelle vicinanze</p>
      ) : (
        <div className="space-y-2">
          {nearby.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div><span className="font-medium text-foreground">{p.nome}</span><span className="text-xs text-muted-foreground ml-2">{fmt(p.distanzaKm)} km</span></div>
              <Badge className={`text-[10px] ${statoBadge[p.stato] ?? ""}`}>{p.stato.replace("_", " ")}</Badge>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Cantieri aperti: {nearby.length}</span><span>Impatto: <span className="font-medium text-foreground capitalize">{data.impattoStimato}</span></span></div>
      <SourceLabel text="Elaborazione da Open Data comunali" tier="elaborato" />
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
  const lc: Record<string, string> = { nullo: "text-green-500", basso: "text-green-400", medio: "text-amber-400", alto: "text-red-500", zona4: "text-green-500", zona3: "text-green-400", zona2: "text-amber-400", zona1: "text-red-500" };
  return (
    <Section>
      <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground text-sm">Rischio Zona</span></div>
      <div className="flex items-start gap-4">
        <ScoreArc value={data.scoreRischio} />
        <div className="grid grid-cols-2 gap-3 text-sm flex-1">
          <div><span className="text-muted-foreground">Idrogeologico</span><p className={`font-medium capitalize ${lc[data.idrogeologico]}`}>{data.idrogeologico}</p></div>
          <div><span className="text-muted-foreground">Sismico</span><p className={`font-medium ${lc[data.sismico]}`}>{data.sismico.replace("zona", "Zona ")}</p></div>
          <div><span className="text-muted-foreground">Inquinamento</span><p className={`font-medium capitalize ${lc[data.inquinamento]}`}>{data.inquinamento}</p></div>
          <div><span className="text-muted-foreground">Alluvionale</span><p className={`font-medium ${data.alluvionale ? "text-red-500" : "text-green-500"}`}>{data.alluvionale ? "Sì" : "No"}</p></div>
        </div>
      </div>
      <SourceLabel text="Dato in corso di verifica — fonte ISPRA/INGV in attivazione" tier="stima" />
    </Section>
  );
}

function OpportunityCard({ data, loading }: { data: OpportunityData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const qs: Record<string, string> = { "Stella Nascente": "from-green-500/20 to-emerald-500/10 border-green-500/30", "Diamante Grezzo": "from-blue-500/20 to-cyan-500/10 border-blue-500/30", "Picco Raggiunto": "from-yellow-500/20 to-amber-500/10 border-yellow-500/30", "Allerta Rossa": "from-red-500/20 to-rose-500/10 border-red-500/30" };
  return (
    <Section className={`bg-gradient-to-br ${qs[data.quadrante] ?? ""}`}>
      <span className="font-semibold text-foreground text-sm">Indice Opportunità</span>
      <p className="text-4xl font-black text-foreground mt-2">{fmt(data.indice)}<span className="text-base font-normal text-muted-foreground">/100</span></p>
      <p className="text-sm font-medium text-foreground mt-1">{data.quadrante}</p>
      <p className="text-xs text-muted-foreground mt-2">{data.raccomandazione}</p>
      <SourceLabel text="Indice elaborato internamente — non costituisce consulenza finanziaria" tier="stima" />
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

          {/* Messaggio sezioni future */}
          <Section>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Altre sezioni in arrivo: dati catastali, energia, infrastrutture.
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
          {/* <TimeViewCard data={result.timeView.data as TimeViewData | null} loading={result.timeView.status === "loading"} /> */}
          {/* <InfrastrutureCard data={result.infrastrutture.data as InfrastrutureData | null} loading={result.infrastrutture.status === "loading"} /> */}
          {/* <OpportunityCard data={result.opportunity.data as OpportunityData | null} loading={result.opportunity.status === "loading"} /> */}
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
