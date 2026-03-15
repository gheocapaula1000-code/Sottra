/**
 * Modular report section card components.
 * Each card auto-hides when data is insufficient — no empty boxes.
 *
 * FROZEN: Do NOT touch OmiCard, OmiZoneData, or OMI pipeline.
 */

import { cn } from "@/lib/utils";
import { safeText } from "@/lib/safeRender";
import {
  Building2, Store, Map, Clock, FileText,
  CheckCircle2, TrendingUp, ShieldCheck, TriangleAlert,
  Camera, Landmark, TreePine, ListChecks, BookOpen,
  AlertCircle, CircleDot, MapPin, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldGrid, SourceMicroBadge } from "./ReportFieldDisplay";
import type {
  ProfiloRapidoData, ImmobileFacciataData, ContestoVicinatoData,
  PosizionamentoCommercialeData, ProfiloAreaData,
  ScenarioTemporaleData, SintesiFinaleData, TrasparenzaFontiData,
  FonteEntry, ReportField, PrioritaCriticitaData, PrioritaCriticaCategoria,
} from "@/types/report";
import { isSectionRenderable, sourceTypeLabels } from "@/types/report";

/* ── Layout primitives ──────────────────────────────────── */

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

function SectionHeader({ icon: Icon, title, badge, subtitle }: { icon: React.ElementType; title: string; badge?: string | null; subtitle?: string | null }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">{title}</span>
        </div>
        {badge && <Badge variant="secondary" className="text-[10px] font-medium">{badge}</Badge>}
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-1.5 ml-[42px]">{subtitle}</p>}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-4 w-28" /></div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/* ── A) Profilo Rapido ───────────────────────────────────── */

export function ProfiloRapidoCard({ data, loading }: { data: ProfiloRapidoData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isSectionRenderable(data as unknown as Record<string, unknown>)) return null;

  return (
    <Section gradient="from-slate-500/8 to-zinc-500/5 border-slate-500/15">
      <SectionHeader icon={ListChecks} title="Profilo Rapido" />
      <FieldGrid
        fields={[
          data.indirizzo,
          data.coordinate,
          data.tipologiaEdificio,
          data.annoCostruzioneStimato,
          data.pianiStimati,
          data.statoGenerale,
          data.zonaOmiRiferimento,
        ]}
        showSource
      />
    </Section>
  );
}

/* ── B) Immobile e Facciata ──────────────────────────────── */

export function ImmobileFacciataCard({ data, loading }: { data: ImmobileFacciataData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isSectionRenderable(data as unknown as Record<string, unknown>)) return null;

  return (
    <Section gradient="from-stone-500/8 to-zinc-500/5 border-stone-500/15">
      <SectionHeader icon={Building2} title="Immobile e Facciata" badge={data.statoConservazioneFacciata?.value ?? null} />
      <FieldGrid
        fields={[
          data.tipologiaFacciata,
          data.materialePrevalente,
          data.statoConservazioneFacciata,
          data.presenzaBalconi,
          data.presenzaAscensore,
          data.leggibilitaImmagine,
        ]}
        showSource
      />
      {data.noteVisive?.value && (data.noteVisive.availabilityStatus === "available" || data.noteVisive.availabilityStatus === "partial") && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mt-3">
          <p className="text-xs text-foreground/80 leading-relaxed">{safeText(data.noteVisive.value)}</p>
          <SourceMicroBadge sourceType={data.noteVisive.sourceType} className="mt-1" />
        </div>
      )}
    </Section>
  );
}

/* ── C) Contesto e Vicinato ──────────────────────────────── */

export function ContestoVicinatoCard({ data, loading }: { data: ContestoVicinatoData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isSectionRenderable(data as unknown as Record<string, unknown>)) return null;

  const servizi = data.elencoServiziRilevati;
  const hasServiziList = servizi?.value && Array.isArray(servizi.value) && servizi.value.length > 0 && servizi.availabilityStatus === "available";

  return (
    <Section gradient="from-emerald-500/8 to-green-500/5 border-emerald-500/15">
      <SectionHeader icon={TreePine} title="Contesto e Vicinato" />
      <FieldGrid
        fields={[
          data.prevalenzaContesto,
          data.tessutoUrbano,
          data.densitaEdiliziaPercepita,
          data.dotazioneServizi,
          data.vicinatoPercepito,
          data.livelloDecorositaUrbana,
          data.livelloServiziArea,
        ]}
        showSource
      />
      {hasServiziList && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Servizi rilevati</p>
          <div className="flex flex-wrap gap-1.5">
            {(servizi!.value as string[]).map((s, i) => (
              <span key={i} className="inline-flex items-center rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground font-medium">
                {s}
              </span>
            ))}
          </div>
          <SourceMicroBadge sourceType={servizi!.sourceType} className="mt-1" />
        </div>
      )}
    </Section>
  );
}

/* ── G) Posizionamento Commerciale ───────────────────────── */

export function PosizionamentoCommercialeCard({ data, loading }: { data: PosizionamentoCommercialeData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isSectionRenderable(data as unknown as Record<string, unknown>)) return null;

  const matchTrovato = data.matchAnnuncioTrovato?.value === true && data.matchAnnuncioTrovato.availabilityStatus === "available";

  return (
    <Section gradient="from-orange-500/8 to-amber-500/5 border-orange-500/15">
      <SectionHeader
        icon={Store}
        title="Posizionamento Commerciale"
        badge={data.statoCommercialeRilevato?.value ?? null}
      />

      {matchTrovato && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />Annuncio rilevato
          </span>
          {data.livelloConfidenzaMatchAnnuncio?.value && (
            <span className="text-[10px] text-muted-foreground">
              Affidabilità: {data.livelloConfidenzaMatchAnnuncio.value}
            </span>
          )}
        </div>
      )}

      <FieldGrid
        fields={[
          data.nomeAgenziaPrincipale,
          data.tipoReferente,
          data.prezzoRichiestoRilevato,
          data.canoneRichiestoRilevato,
          data.portaleOrigine,
          data.dataAnnuncioOAntichita,
        ]}
        showSource
      />

      {(data.multiagenziaRilevata?.value === true || data.esclusivaDichiarataNellAnnuncio?.value === true) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {data.esclusivaDichiarataNellAnnuncio?.value && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-400">
              Esclusiva dichiarata
            </span>
          )}
          {data.multiagenziaRilevata?.value && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Multi-agenzia rilevata
            </span>
          )}
        </div>
      )}

      {data.noteCommercialiSintetiche?.value && (data.noteCommercialiSintetiche.availabilityStatus === "available" || data.noteCommercialiSintetiche.availabilityStatus === "partial") && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mt-3">
          <p className="text-xs text-foreground/80 leading-relaxed">{safeText(data.noteCommercialiSintetiche.value)}</p>
          <SourceMicroBadge sourceType={data.noteCommercialiSintetiche.sourceType} className="mt-1" />
        </div>
      )}
    </Section>
  );
}

/* ── H) Profilo Area ─────────────────────────────────────── */

export function ProfiloAreaCard({ data, loading }: { data: ProfiloAreaData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || !isSectionRenderable(data as unknown as Record<string, unknown>)) return null;

  return (
    <Section gradient="from-teal-500/8 to-cyan-500/5 border-teal-500/15">
      <SectionHeader icon={Map} title="Profilo Area" />

      {/* Synthesis block at top if available */}
      {data.sintesiArea?.value && (data.sintesiArea.availabilityStatus === "available" || data.sintesiArea.availabilityStatus === "partial") && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2.5 mb-4">
          <p className="text-sm text-foreground leading-relaxed">{safeText(data.sintesiArea.value)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <SourceMicroBadge sourceType={data.sintesiArea.sourceType} />
            {data.sintesiArea.note && (
              <span className="text-[9px] text-muted-foreground/50">{data.sintesiArea.note}</span>
            )}
          </div>
        </div>
      )}

      <FieldGrid
        fields={[
          data.classificazioneArea,
          data.vocazioneTerritoriale,
          data.livelloUrbanizzazione,
          data.presenzaServiziPrimari,
          data.accessibilitaTrasporti,
          data.qualitaAmbientale,
        ]}
        showSource
      />
      {data.noteArea?.value && data.noteArea.availabilityStatus === "available" && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mt-3">
          <p className="text-xs text-foreground/80 leading-relaxed">{data.noteArea.value}</p>
        </div>
      )}
    </Section>
  );
}

/* ── I) Scenario 5/10/20 anni ────────────────────────────── */

export function ScenarioTemporaleCard({ data, loading }: { data: ScenarioTemporaleData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data?.scenari || data.scenari.length === 0) return null;

  const renderableScenari = data.scenari.filter(s =>
    s.variazioneStimataPct?.availabilityStatus === "available" ||
    s.narrativa?.availabilityStatus === "available"
  );
  if (renderableScenari.length === 0) return null;

  return (
    <Section gradient="from-indigo-500/8 to-violet-500/5 border-indigo-500/15">
      <SectionHeader icon={Clock} title="Scenario Temporale" badge="Proiezione" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        {renderableScenari.map((s) => (
          <div key={s.orizzonte} className="rounded-xl bg-background/40 border border-border/30 p-3 text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
            {s.variazioneStimataPct?.value != null && s.variazioneStimataPct.availabilityStatus === "available" ? (
              <p className={cn(
                "font-extrabold text-xl mt-1",
                (s.variazioneStimataPct.value as number) >= 0 ? "text-emerald-400" : "text-destructive",
              )}>
                {(s.variazioneStimataPct.value as number) > 0 ? "+" : ""}{s.variazioneStimataPct.value}%
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">—</p>
            )}
          </div>
        ))}
      </div>

      {renderableScenari.map((s) => {
        const drivers = s.driverPrincipali?.value;
        const risks = s.rischiPrincipali?.value;
        if (!drivers && !risks) return null;
        return (
          <div key={`dr-${s.orizzonte}`} className="space-y-2 mb-3">
            {Array.isArray(drivers) && drivers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fattori trainanti</p>
                {drivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                    <p className="text-xs text-foreground leading-relaxed">{safeText(d)}</p>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(risks) && risks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Rischi</p>
                {risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-foreground leading-relaxed">{safeText(r)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[9px] text-muted-foreground/30 mt-2">
        {data.disclaimer ?? "Le proiezioni sono scenari indicativi e non costituiscono consulenza finanziaria"}
      </p>
    </Section>
  );
}

/* ── J) Sintesi Finale — executive summary ───────────────── */

export function SintesiFinaleCard({ data, loading }: { data: SintesiFinaleData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data) return null;
  const forza = Array.isArray(data.puntiDiForza?.value) ? (data.puntiDiForza!.value as string[]) : [];
  const attenzione = Array.isArray(data.puntiDiAttenzione?.value) ? (data.puntiDiAttenzione!.value as string[]) : [];
  const hasContent = data.giudizioSintetico?.availabilityStatus === "available" || data.giudizioSintetico?.availabilityStatus === "partial" ||
    forza.length > 0 || attenzione.length > 0;
  if (!hasContent) return null;

  return (
    <Section gradient="from-primary/8 to-primary/3 border-primary/15">
      <SectionHeader icon={FileText} title="Sintesi Finale" subtitle="Quadro riepilogativo dell'analisi" />

      {/* Executive summary */}
      {data.giudizioSintetico?.value && (data.giudizioSintetico.availabilityStatus === "available" || data.giudizioSintetico.availabilityStatus === "partial") && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2.5 mb-4">
          <p className="text-sm text-foreground leading-relaxed">{safeText(data.giudizioSintetico.value)}</p>
          {data.giudizioSintetico.availabilityStatus === "partial" && (
            <p className="text-[9px] text-muted-foreground/50 mt-1">Quadro basato su dati parziali</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {forza.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Punti di forza</p>
            {forza.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                <p className="text-xs text-foreground leading-relaxed">{safeText(f)}</p>
              </div>
            ))}
          </div>
        )}
        {attenzione.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Punti di attenzione</p>
            {attenzione.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs text-foreground leading-relaxed">{safeText(a)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conclusive observation */}
      {data.raccomandazione?.value && data.raccomandazione.availabilityStatus === "available" && (
        <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2 mt-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Osservazione conclusiva</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{safeText(data.raccomandazione.value)}</p>
        </div>
      )}

      {/* Coverage analysis */}
      {data.coperturaAnalisi?.value && (
        <p className="text-[9px] text-muted-foreground/40 mt-3">{safeText(data.coperturaAnalisi.value)}</p>
      )}

      <p className="text-[9px] text-muted-foreground/30 mt-2">
        Le indicazioni non costituiscono consulenza finanziaria o immobiliare
      </p>
    </Section>
  );
}

/* ── L) Priorità / Criticità ─────────────────────────────── */

const categoriaConfig: Record<PrioritaCriticaCategoria, { icon: React.ElementType; color: string; label: string }> = {
  attenzione: { icon: TriangleAlert, color: "text-amber-500", label: "Attenzione" },
  da_verificare: { icon: AlertCircle, color: "text-sky-400", label: "Da verificare" },
  copertura_parziale: { icon: CircleDot, color: "text-muted-foreground", label: "Copertura parziale" },
  elemento_favorevole: { icon: CheckCircle2, color: "text-emerald-500", label: "Elemento favorevole" },
};

export function PrioritaCriticitaCard({ data, loading }: { data: PrioritaCriticitaData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data?.items || data.items.length === 0) return null;

  return (
    <Section gradient="from-amber-500/6 to-orange-500/3 border-amber-500/12">
      <SectionHeader icon={AlertCircle} title="Priorità e Criticità" subtitle="Elementi che meritano attenzione" />

      <div className="space-y-2">
        {data.items.map((item, i) => {
          const config = categoriaConfig[item.categoria];
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-background/40 border border-border/20 px-3 py-2">
              <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">{safeText(item.testo)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-[9px] font-medium", config.color)}>{config.label}</span>
                  <SourceMicroBadge sourceType={item.sourceType} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── K) Trasparenza Fonti ────────────────────────────────── */

const categoriaIcons: Record<string, React.ElementType> = {
  immagine: Camera,
  dato_ufficiale: Landmark,
  dato_territoriale: Map,
  dato_mercato: TrendingUp,
  scenario: Clock,
  elaborazione: BookOpen,
};

export function TrasparenzaFontiCard({ data }: { data: TrasparenzaFontiData | null }) {
  if (!data?.fonti || data.fonti.length === 0) return null;

  return (
    <Section className="border-border/40">
      <SectionHeader icon={BookOpen} title="Trasparenza Fonti" />
      <div className="space-y-2">
        {data.fonti.map((fonte, i) => {
          const Icon = categoriaIcons[fonte.categoria] ?? BookOpen;
          return (
            <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border/20 last:border-0">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-muted/50 shrink-0 mt-0.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{fonte.categoriaLabel}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {fonte.provider && <span className="text-[10px] text-muted-foreground">{fonte.provider}</span>}
                  {fonte.periodo && <span className="text-[10px] text-muted-foreground/60">{fonte.periodo}</span>}
                  {fonte.copertura && <span className="text-[10px] text-muted-foreground/40">{fonte.copertura}</span>}
                </div>
                {fonte.dettaglio && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{fonte.dettaglio}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
