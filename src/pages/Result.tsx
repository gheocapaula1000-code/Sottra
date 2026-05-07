import { useEffect, useRef, Component, type ReactNode, type ErrorInfo } from "react";
import AppHeader from "@/components/AppHeader";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, TrendingUp, Users, Rocket, Construction, AlertTriangle, MapPin, Compass, Target, Eye, ShieldCheck, TriangleAlert, Layers, Camera, CheckCircle2, BarChart3, Gem, Zap, Wrench } from "lucide-react";
import { useScanHistory, compressToThumbnail, serializeResult } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { isValidGps, isValidImageDataUrl } from "@/lib/imageUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBuildingScan } from "@/hooks/useBuildingScan";
import { cn } from "@/lib/utils";
import { DataBadge, type DataTier } from "@/components/DataBadge";
import type {
  IdentifyResult, PricingData,
  TimeViewData, OpportunityData,
  InfrastrutureData, SchoolContext,
  RischioZonaData, TrendDemograficoData, SviluppoAreaData,
  ConvergenzaTerritorialeData, MarketContextData, ComparablesSummary,
  ScanResult, SourceMetadata, PoiEnrichmentData,
  InfrastructureProject, InfrastructureSignal, InfrastructureDriverRisk,
} from "@/types";
import { isRenderableTrendDemografico, getAvailableDemographicMetricCount } from "@/lib/demographic";
import { calculateNeighborhoodIndex, type NeighborhoodIndex, type SubDimension } from "@/lib/neighborhoodIndex";
import {
  ProfiloRapidoCard, ImmobileFacciataCard, ContestoVicinatoCard,
  PosizionamentoCommercialeCard, ProfiloAreaCard,
  ScenarioTemporaleCard, SintesiFinaleCard, TrasparenzaFontiCard,
  PrioritaCriticitaCard,
} from "@/components/report/ReportSections";
import type { TrasparenzaFontiData, FonteEntry, PrioritaCriticitaData } from "@/types/report";
import AddressOverrideForm from "@/components/AddressOverrideForm";
import type { ManualAddressInput } from "@/components/AddressOverrideForm";
import { GeoLevelHeroBanner, ReportAccordionItem, resolveReportGeoStatus } from "@/components/report/ReportAccordion";
import { buildZoneValue, valueNarrativeMode, valueReliabilityLabel } from "@/lib/zoneValueEngine";
import { resolveGeoContext } from "@/lib/reportMapper";
import { buildRenovationEstimate, renovationNarrativeMode } from "@/lib/renovationCostEngine";
import { buildWowSnapshot } from "@/lib/sottraWowSnapshot";
import type { WowSnapshot } from "@/lib/sottraWowSnapshot";
import { WowPanel } from "@/components/report/WowPanel";
import {
  buildHouseDifferentiation,
  differentiationStatusLabel,
  specificityStrengthLabel,
  specificityStrengthColor,
  separationLabel,
  type HouseDifferentiationResult,
} from "@/lib/houseDifferentiationEngine";
import { evaluateStrongCase, type StrongCaseResult } from "@/lib/strongCaseEvaluator";

/* ── Section-level ErrorBoundary ──────────────────────── */

class SectionSafe extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn("[SectionSafe] caught:", error, info);
  }
  render() {
    if (this.state.hasError) return null; // silently hide broken section
    return this.props.children;
  }
}

/* ── helpers ─────────────────────────────────────────── */

import { safeText } from "@/lib/safeRender";

function toText(v: unknown): string {
  return safeText(v, "");
}

/** Renders structured SchoolContext — only if available */
function SchoolContextBlock({ schoolContext }: { schoolContext?: SchoolContext | string | null }) {
  if (!schoolContext || typeof schoolContext === "string") return null;
  if (!schoolContext.available || schoolContext.totalSchools === 0) return null;

  const precisionLabel = schoolContext.precision === "comune" ? "Dato comunale" : schoolContext.precision === "strada" ? "Dato stradale" : schoolContext.precision === "civico" ? "Dato puntuale" : null;

  return (
    <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contesto scuole</p>
      <div className="flex items-baseline gap-2 text-xs text-foreground">
        <span>Scuole nel comune: <span className="font-semibold">{schoolContext.totalSchools}</span></span>
        {precisionLabel && <span className="text-[10px] text-muted-foreground/50">· {precisionLabel}</span>}
      </div>
      {schoolContext.gradiPresenti.length > 0 && (
        <p className="text-xs text-muted-foreground">Ordini presenti: {schoolContext.gradiPresenti.join(", ")}</p>
      )}
      {schoolContext.nearestSchools.length > 0 && (
        <div className="space-y-1 mt-1">
          {schoolContext.nearestSchools.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
              <span>{s.denominazione ?? "Scuola"}{s.grado ? ` (${s.grado})` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
      "rounded-2xl border border-border/60 bg-card p-5 transition-opacity duration-500 min-w-0 overflow-hidden",
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

/** Qualitative badge to replace ScoreArc in elaborated indices */
function QualitativeBadge({ band, bandLabels, subtitle }: { band: string | null; bandLabels: Record<string, string>; subtitle?: string }) {
  const label = band ? bandLabels[band] ?? band : "Non determinato";
  const badgeColors: Record<string, string> = {
    molto_forte: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    forte: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    elevata: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    significativa: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    interessante: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    moderata: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    contenuta: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    debole: "bg-stone-500/10 text-muted-foreground border-stone-500/20",
    limitata: "bg-stone-500/10 text-muted-foreground border-stone-500/20",
  };
  const colorClass = band ? badgeColors[band] ?? "bg-muted text-muted-foreground border-border" : "bg-muted text-muted-foreground border-border";
  return (
    <div className="mb-4">
      <span className={cn("inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold", colorClass)}>
        {label}
      </span>
      {subtitle && <p className="text-[10px] text-muted-foreground/60 mt-1.5">{subtitle}</p>}
    </div>
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

/* WowSnapshotPanel removed — replaced by WowPanel component */

/* ── House Differentiation Card ──────────────────────── */

function HouseDifferentiationCard({ diff, loading }: { diff: HouseDifferentiationResult | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!diff || diff.summary.narrative_mode === "hidden") return null;

  const isPartial = diff.summary.narrative_mode === "partial";
  const strengthColor = specificityStrengthColor(diff.specificity.specificity_strength);

  return (
    <Section>
      <SectionHeader icon={Eye} title="Specificità dell'immobile" badge={isPartial ? "Parziale" : null} />

      {/* Main status */}
      <div className="flex items-center justify-between rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
        <span className="text-xs text-muted-foreground">Differenziazione</span>
        <span className={cn("text-xs font-bold", strengthColor)}>
          {specificityStrengthLabel(diff.specificity.specificity_strength)}
        </span>
      </div>

      <p className="text-xs text-foreground mb-3">{differentiationStatusLabel(diff.specificity.specificity_status)}</p>

      {/* Sub-blocks: Facade, Address, Adjacent risk, Result */}
      <div className="space-y-2 mb-3">
        {/* Facciata e fronte */}
        <div className="rounded-lg bg-background/30 border border-border/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Facciata e fronte edificio</p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Facciata</span>
            <span className="font-medium text-foreground">{diff.visual_signals.facade_detected ? "Rilevata" : "Non rilevata"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Fronte chiaro</span>
            <span className="font-medium text-foreground">{diff.visual_signals.frontage_detected ? "Sì" : "No"}</span>
          </div>
          {diff.visual_signals.structure.single_facade_likelihood !== "not_determinable" && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Facciata singola</span>
              <span className={cn("font-medium",
                diff.visual_signals.structure.single_facade_likelihood === "strong" ? "text-emerald-400" :
                diff.visual_signals.structure.single_facade_likelihood === "medium" ? "text-primary" : "text-amber-400"
              )}>{diff.visual_signals.structure.single_facade_likelihood === "strong" ? "Probabile" : diff.visual_signals.structure.single_facade_likelihood === "medium" ? "Possibile" : "Poco probabile"}</span>
            </div>
          )}
        </div>

        {/* Coerenza via/civico */}
        <div className="rounded-lg bg-background/30 border border-border/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coerenza con via/civico</p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Via</span>
            <span className="font-medium text-foreground">{diff.address_alignment.street_support_status === "official" ? "Ufficiale" : diff.address_alignment.street_support_status === "none" ? "Non disponibile" : "Parziale"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Civico</span>
            <span className="font-medium text-foreground">{diff.address_alignment.civic_support_status === "official" ? "Ufficiale" : diff.address_alignment.civic_support_status === "none" ? "Non disponibile" : "Parziale"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Allineamento</span>
            <span className={cn("font-medium",
              diff.address_alignment.diagnostics.overall_alignment_status === "high_alignment" ? "text-emerald-400" :
              diff.address_alignment.diagnostics.overall_alignment_status === "medium_alignment" ? "text-primary" :
              diff.address_alignment.diagnostics.overall_alignment_status === "conflicting_alignment" ? "text-destructive" : "text-amber-400"
            )}>{diff.address_alignment.diagnostics.overall_alignment_status === "high_alignment" ? "Alto" :
                diff.address_alignment.diagnostics.overall_alignment_status === "medium_alignment" ? "Medio" :
                diff.address_alignment.diagnostics.overall_alignment_status === "conflicting_alignment" ? "Conflitto" : "Basso"}</span>
          </div>
        </div>

        {/* Rischio confusione adiacenti */}
        <div className="rounded-lg bg-background/30 border border-border/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Rischio confusione con adiacenti</p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Separazione</span>
            <span className="font-medium text-foreground text-right">{separationLabel(diff.specificity.house_vs_adjacent_separation)}</span>
          </div>
          {diff.visual_signals.context_separation.likely_adjacent_building_confusion !== "not_determinable" && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Confusione probabile</span>
              <span className={cn("font-medium",
                diff.visual_signals.context_separation.likely_adjacent_building_confusion === "strong" ? "text-amber-400" : "text-primary"
              )}>{diff.visual_signals.context_separation.likely_adjacent_building_confusion === "strong" ? "Alta" : "Moderata"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Limitations */}
      {diff.summary.limitations.slice(0, 2).map((l, i) => (
        <div key={i} className="flex items-start gap-2 text-[10px] text-muted-foreground/70 mb-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{l}</span>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground/60 mt-2">La differenziazione non equivale a una identificazione catastale</p>
    </Section>
  );
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
            <h2 className="text-lg font-bold text-foreground leading-snug break-anywhere">{identify.address}</h2>
          )}
          {lowConfidence && identify.address && (
            <h2 className="text-lg font-bold text-foreground/60 leading-snug break-anywhere">{identify.address}</h2>
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

  // Determine if pricing data is municipal-level (false specificity guard)
  const effectiveGeoLevel = data.omiGeoLevel ?? (data.polygonMatch ? "microzona_omi" : "comune");
  const isComuneLevel = effectiveGeoLevel === "comune" || (!data.polygonMatch && !data.omiGeoLevel);
  const isFineZone = effectiveGeoLevel === "microzona_omi" || effectiveGeoLevel === "zona_specifica" || effectiveGeoLevel === "quartiere";

  return (
    <Section>
      <SectionHeader icon={TrendingUp} title={isComuneLevel ? "Prezzi di Mercato (comunale)" : "Prezzi di Mercato"} />
      {/* Geo-level context — prevents false specificity */}
      {isFineZone && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />Dato di zona
          </span>
        </div>
      )}
      {isComuneLevel && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[10px] text-amber-400">
            Dato riferito al livello comunale — la zona specifica potrebbe presentare valori diversi
          </p>
        </div>
      )}
      <div className="flex items-baseline gap-1.5 mb-3 min-w-0 flex-wrap">
        <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight break-words">{fmtEur(data.prezzoMq)}</span>
        <span className="text-sm text-muted-foreground font-medium">/m²</span>
      </div>
      <div className={cn("grid gap-3 text-sm mb-3", hasMediaZona ? "grid-cols-2" : "grid-cols-1")}>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Fascia</span>
          <p className="font-semibold text-foreground text-sm mt-0.5">{fmtEur(data.prezzoMqMin)} – {fmtEur(data.prezzoMqMax)}</p>
        </div>
        {hasMediaZona && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{isComuneLevel ? "Media comunale" : "Media zona"}</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">{fmtEur(data.mediaZona)}</p>
          </div>
        )}
      </div>
      {hasTrend && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Trend 5 anni{isComuneLevel ? " (comunale)" : ""}</span>
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

  const _tier = sourceTypeToTier(data.sourceType);
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
      <QualitativeBadge band={data.band} bandLabels={bandLabels} subtitle="Valutazione sintetica Sottra" />
      <div className="space-y-1 mb-4">
        {data.convergenceLevel && (
          <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Convergenza</span><span className="font-semibold text-foreground">{convergenceLabels[data.convergenceLevel] ?? data.convergenceLevel}</span></div>
        )}
        {data.coverageLevel && (
          <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Copertura dati</span><span className="font-semibold text-foreground">{coverageLabels[data.coverageLevel] ?? data.coverageLevel}</span></div>
        )}
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
      <p className="text-[11px] text-muted-foreground/60 mt-1">Indice di convergenza elaborato — non costituisce consulenza</p>
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
      <div className="flex items-start gap-4 min-w-0">
        <ScoreArc value={data.scoreRischio} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm flex-1 min-w-0">
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

  // Microzona / quartiere — positive confirmed level
  if (geoLevel === "microzona" || geoLevel === "quartiere") {
    return (
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <MapPin className="h-3 w-3" />{geoLevel === "microzona" ? "Microzona" : "Quartiere"}
        </span>
        {geoLabel && <span className="text-[10px] text-muted-foreground/60">{geoLabel}</span>}
      </div>
    );
  }

  // Zona stimata
  if (geoLevel === "zona" || geoLevel === "stimato") {
    return (
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          <Compass className="h-3 w-3" />Zona stimata
        </span>
        {geoLabel && <span className="text-[10px] text-muted-foreground/60">{geoLabel}</span>}
      </div>
    );
  }

  // Comunale
  if (geoLevel === "comune") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 mb-3">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
        <p className="text-[10px] text-amber-400">
          Dato riferito al livello comunale{geoLabel ? ` · ${geoLabel}` : ""} — la zona specifica potrebbe variare
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <p className="text-[10px] text-muted-foreground/60 mb-3 flex items-center gap-1">
      <MapPin className="h-3 w-3" />Dato territoriale{geoLabel ? ` · ${geoLabel}` : ""}
    </p>
  );
}


function TrendDemograficoCard({ data, loading }: { data: TrendDemograficoData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!isRenderableTrendDemografico(data)) return null;
  // data is guaranteed non-null by the check above
  const d = data!;

  const isMunicipal = d.geoLevel === "comune" || (!d.geoLevel && !d.geoLabel);
  const geoSuffix = isMunicipal ? " del comune" : "";

  // Build only non-null metric tiles — label reflects geo level
  const metrics: { label: string; value: string }[] = [];
  if (d.etaMedia != null) metrics.push({ label: `Età media${geoSuffix}`, value: fmt(d.etaMedia) });
  if (d.densitaAbitanti != null) metrics.push({ label: `Densità${geoSuffix}`, value: `${fmt(d.densitaAbitanti)} ab/km²` });
  if (d.flussoResidenti12Mesi != null) metrics.push({ label: `Flusso residenti 12m${geoSuffix}`, value: `${d.flussoResidenti12Mesi > 0 ? "+" : ""}${fmt(d.flussoResidenti12Mesi)}%` });
  if (d.percentualeGiovani != null) metrics.push({ label: `Under 35${geoSuffix}`, value: `${fmt(d.percentualeGiovani)}%` });

  const hasBars = d.percentualeFamiglie != null || d.percentualeStranieri != null;
  const totalVisibleItems = getAvailableDemographicMetricCount(d);

  // Title and subtitle reflect geo level
  const sectionTitle = isMunicipal
    ? `Contesto Demografico Comunale${d.geoLabel ? ` — ${d.geoLabel}` : ""}`
    : "Trend Demografico";

  return (
    <Section>
      <SectionHeader icon={Users} title={sectionTitle} />
      <GeoLevelTag geoLevel={d.geoLevel} geoLabel={d.geoLabel} />
      {isMunicipal && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 mb-4">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-[11px] font-medium text-amber-400">
              Dato riferito all'intero comune{d.geoLabel ? ` di ${d.geoLabel}` : ""}, non alla singola zona analizzata.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">I valori della zona specifica dell'immobile potrebbero differire significativamente.</p>
          </div>
        </div>
      )}
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
          {d.percentualeFamiglie != null && <MiniBar label={`Famiglie${geoSuffix}`} value={d.percentualeFamiglie} />}
          {d.percentualeStranieri != null && <MiniBar label={`Stranieri${geoSuffix}`} value={d.percentualeStranieri} />}
        </div>
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
      <QualitativeBadge band={effectiveBand} bandLabels={bandLabels} subtitle="Indice elaborato Sottra" />
      {observation && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed italic">"{observation}"</p>
        </div>
      )}

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
      <p className="text-[11px] text-muted-foreground/60 mt-1">Indice elaborato — non costituisce consulenza finanziaria</p>
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

      {data.scenarioBand && (
        <QualitativeBadge
          band={data.scenarioBand}
          bandLabels={bandLabels}
          subtitle="Proiezione indicativa — scenario orientativo, non previsione"
        />
      )}

      {data.previsione5Anni != null && (
        <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2.5 mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Stima indicativa di variazione</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {[
              { label: "5a", value: data.previsione5Anni },
              { label: "10a", value: data.previsione10Anni },
              { label: "20a", value: data.previsione20Anni },
            ].filter(item => item.value != null).map((item, i) => (
              <div key={i} className="flex items-baseline gap-1">
                <span>{item.label}:</span>
                <span className="font-medium text-foreground/70 text-xs">~{fmt(item.value)}%</span>
              </div>
            ))}
          </div>
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
      <p className="text-[11px] text-muted-foreground/60 mt-1">Le proiezioni sono indicative e non costituiscono consulenza finanziaria</p>
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

      <QualitativeBadge band={data.infrastructureBand} bandLabels={bandLabels} subtitle="Valutazione sintetica Sottra" />

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

      {/* Connectivity context — structured */}
      {data.connectivityContext?.connectivityAvailable && data.connectivityContext.connectivityLabel && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3 space-y-1.5">
          <div className="flex items-start gap-2 text-xs text-foreground">
            <Construction className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
            <div>
              <span>{data.connectivityContext.connectivityLabel}</span>
              {data.connectivityContext.connectivityPrecision && (
                <span className="text-[10px] text-muted-foreground/50 ml-1">
                  · {data.connectivityContext.connectivityPrecision === "civico" ? "Dato puntuale" : data.connectivityContext.connectivityPrecision === "strada" ? "Dato stradale" : "Dato comunale"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Energy context — string */}
      {data.energyContext && typeof data.energyContext === "string" && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3">
          <div className="flex items-start gap-2 text-xs text-foreground">
            <Rocket className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
            <span>{data.energyContext}</span>
          </div>
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

      <QualitativeBadge band={data.areaDevelopmentBand} bandLabels={bandLabels} subtitle="Indice elaborato Sottra" />

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

      {/* School context — structured */}
      <SchoolContextBlock schoolContext={data.schoolContext} />

      {/* Energy context — string */}
      {data.energyContext && typeof data.energyContext === "string" && (
        <div className="rounded-lg bg-background/40 border border-border/30 p-3 mb-3">
          <div className="flex items-start gap-2 text-xs text-foreground">
            <Rocket className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
            <span>{data.energyContext}</span>
          </div>
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
  const isPartial = data.sourceType === "commercial_partial" || data.marketCoverageLevel === "parziale" || data.marketCoverageLevel === "scarsa";

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
      {isPartial && (
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          {data.marketCoverageLevel === "scarsa"
            ? "Dati di mercato limitati per questa zona — valori puramente indicativi"
            : "Analisi basata su copertura parziale — dati indicativi"}
        </p>
      )}
    </Section>
  );
}

function ComparablesBlock({ comp, isPartial: _isPartial }: { comp: ComparablesSummary; isPartial: boolean }) {
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

/* ── OMI Card ─────────────────────────────────────────── */

function OmiCard({ data, loading }: { data: import("@/types").OmiZoneData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable") return null;

  const hasQuotazioni = data.quotazioneMinResidenziale != null || data.quotazioneMaxResidenziale != null;
  const hasZone = data.zonaOmi != null;
  if (!hasQuotazioni && !hasZone) return null;

  const effectiveGeoLevel = data.omiGeoLevel ?? (data.polygonMatch ? "microzona_omi" : (data.sourceCoverageLevel === "zone_omi" ? "microzona_omi" : undefined));
  const isExactZone = effectiveGeoLevel === "microzona_omi" || effectiveGeoLevel === "zona_specifica" || effectiveGeoLevel === "quartiere";
  const isComuneLevel = effectiveGeoLevel === "comune" || (!isExactZone && data.sourceCoverageLevel === "comune");
  const isFallback = data.matchMethod === "ai_estimate" || data.matchMethod === "catastale_fallback";

  return (
    <Section gradient="from-green-500/10 to-emerald-500/5 border-green-500/15">
      <SectionHeader icon={TrendingUp} title="Quotazioni OMI" badge={data.semestre ?? null} />

      {/* Zone label */}
      {data.zonaOmiLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{isExactZone ? "Zona OMI" : "Riferimento"}:{" "}
            <span className="font-semibold text-foreground">{data.zonaOmiLabel}</span>
          </span>
          {data.comuneLabel && <span className="text-muted-foreground/50">· {data.comuneLabel}</span>}
        </div>
      )}

      {/* Geo-level badge — microzona reale */}
      {isExactZone && !isFallback && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />Microzona identificata
          </span>
          {data.matchConfidence != null && data.matchConfidence < 0.8 && (
            <span className="text-[9px] text-muted-foreground/50">Confidenza: {Math.round(data.matchConfidence * 100)}%</span>
          )}
        </div>
      )}

      {/* Geo-level badge — zona stimata */}
      {isExactZone && isFallback && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            <Compass className="h-3 w-3" />Zona stimata
          </span>
          <span className="text-[9px] text-muted-foreground/50">Da verificare con indirizzo esatto</span>
        </div>
      )}

      {/* Geo-level banner — comunale */}
      {isComuneLevel && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[10px] text-amber-400">
            Riferimento comunale — la zona specifica potrebbe presentare valori diversi
          </p>
        </div>
      )}

      {/* Quotazioni */}
      {hasQuotazioni ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {data.quotazioneMinResidenziale != null && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Min €/m²</span>
              <p className="font-bold text-foreground text-sm mt-0.5">{fmtEur(data.quotazioneMinResidenziale)}</p>
            </div>
          )}
          {data.quotazioneMaxResidenziale != null && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Max €/m²</span>
              <p className="font-bold text-foreground text-sm mt-0.5">{fmtEur(data.quotazioneMaxResidenziale)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2 mb-3">
          <p className="text-xs text-muted-foreground">Zona identificata — quotazioni non ancora disponibili per questo periodo</p>
        </div>
      )}

      {data.tipologia && <p className="text-[10px] text-muted-foreground/60">Tipologia: {data.tipologia}</p>}
      <SourceTag meta={data} />
    </Section>
  );
}

/* ── ISTAT Card ───────────────────────────────────────── */

function IstatCard({ data, loading }: { data: import("@/types").IstatDemographicData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.popolazione == null) return null;

  const isMunicipal = !data.geoLevel || data.geoLevel === "comune" || data.geoLevel === "area_vasta" || data.geoLevel === "stimato";
  const isSubMunicipal = data.geoLevel === "microzona" || data.geoLevel === "quartiere" || data.geoLevel === "zona";

  const geoSuffix = isMunicipal ? " del comune" : "";
  const titleLabel = isSubMunicipal
    ? `Dati Demografici${data.geoLabel ? ` — ${data.geoLabel}` : ""}`
    : `Dati ISTAT Ufficiali${data.geoLabel ? ` — ${data.geoLabel}` : " (Comune)"}`;

  const geoLevelLabels: Record<string, string> = {
    microzona: "Microzona", quartiere: "Quartiere", zona: "Zona",
    comune: "Comune", area_vasta: "Area vasta", stimato: "Stima",
  };
  const geoLevelBadge = data.geoLevel ? geoLevelLabels[data.geoLevel] ?? null : null;

  const matchMethodLabels: Record<string, string> = {
    zona_omi: "Match zona OMI", point_in_polygon: "Match spaziale",
    municipal_fallback: "Fallback comunale",
  };

  return (
    <Section gradient={isSubMunicipal ? "from-emerald-500/10 to-teal-500/5 border-emerald-500/15" : "from-blue-500/10 to-indigo-500/5 border-blue-500/15"}>
      <SectionHeader icon={Users} title={titleLabel} badge={geoLevelBadge ?? data.annoRilevazione ?? null} />
      {data.comuneLabel && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {isSubMunicipal ? "Zona: " : "Comune: "}
          <span className="font-semibold text-foreground">{data.geoLabel ?? data.comuneLabel}</span>
        </p>
      )}
      {isMunicipal && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[11px] text-amber-400">
            Dato riferito all'intero comune{data.comuneLabel ? ` di ${data.comuneLabel}` : ""}, non alla singola zona analizzata.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Popolazione{geoSuffix}</span>
          <p className="font-bold text-foreground text-sm mt-0.5">{fmt(data.popolazione)}</p>
        </div>
        {data.densita != null && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Densità{geoSuffix}</span>
            <p className="font-bold text-foreground text-sm mt-0.5">{fmt(data.densita)} ab/km²</p>
          </div>
        )}
        {data.indiceVecchiaia != null && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Indice vecchiaia{geoSuffix}</span>
            <p className="font-bold text-foreground text-sm mt-0.5">{fmt(data.indiceVecchiaia)}</p>
          </div>
        )}
        {data.percentualeStranieri != null && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Stranieri{geoSuffix}</span>
            <p className="font-bold text-foreground text-sm mt-0.5">{fmt(data.percentualeStranieri)}%</p>
          </div>
        )}
      </div>
      {/* Transparency metadata — matchMethod, confidence, selectionReason */}
      {(data.matchMethod || data.annoRilevazione || data.selectionReason) && (
        <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2 mb-3 space-y-0.5">
          {data.matchMethod && (
            <p className="text-[10px] text-muted-foreground">
              Metodo: <span className="font-medium text-foreground/80">{matchMethodLabels[data.matchMethod] ?? data.matchMethod}</span>
              {data.matchConfidence != null && <span className="ml-2">· Confidenza: {Math.round(data.matchConfidence * 100)}%</span>}
            </p>
          )}
          {data.annoRilevazione && (
            <p className="text-[10px] text-muted-foreground">
              Anno rilevazione: <span className="font-medium text-foreground/80">{data.annoRilevazione}</span>
            </p>
          )}
          {data.selectionReason && (
            <p className="text-[10px] text-muted-foreground">
              Selezione: <span className="font-medium text-foreground/80">{data.selectionReason.replace(/_/g, " ")}</span>
            </p>
          )}
        </div>
      )}
      <SourceTag meta={data} />
    </Section>
  );
}

/* ── Neighborhood Index Card ──────────────────────────── */

function DimensionStatusIcon({ status }: { status: SubDimension["status"] }) {
  if (status === "disponibile") return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
  if (status === "parziale") return <AlertTriangle className="h-3 w-3 text-amber-400" />;
  return <AlertTriangle className="h-3 w-3 text-muted-foreground/40" />;
}

function NeighborhoodIndexCard({ index, loading }: { index: NeighborhoodIndex | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!index || !index.isRenderable || index.score == null) return null;

  const bandColors: Record<string, string> = {
    ottimo: "from-emerald-500/15 to-green-500/5 border-emerald-500/20",
    buono: "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    discreto: "from-violet-500/10 to-indigo-500/5 border-violet-500/20",
    sufficiente: "from-amber-500/10 to-yellow-500/5 border-amber-500/20",
    insufficiente: "from-stone-500/10 to-stone-400/5 border-stone-500/20",
  };
  const bandLabels: Record<string, string> = {
    ottimo: "Ottimo", buono: "Buono", discreto: "Discreto", sufficiente: "Sufficiente", insufficiente: "Insufficiente",
  };

  const geoLevelLabels: Record<string, string> = {
    microzona: "Microzona", quartiere: "Quartiere", zona: "Zona locale",
    comune: "Comunale", area_vasta: "Area vasta", stimato: "Stimato",
  };

  return (
    <Section gradient={index.band ? bandColors[index.band] ?? "" : ""}>
      <SectionHeader icon={Layers} title="Profilo di Zona" badge={index.band ? bandLabels[index.band] : null} />

      {/* Geo level indicator */}
      {index.geoLevel && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
            index.geoLevel === "microzona" || index.geoLevel === "quartiere"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : index.geoLevel === "comune"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-muted/50 border-border/50 text-muted-foreground",
          )}>
            <MapPin className="h-3 w-3" />{geoLevelLabels[index.geoLevel] ?? index.geoLevel}
          </span>
          {index.geoLabel && <span className="text-[10px] text-muted-foreground/60">{index.geoLabel}</span>}
        </div>
      )}

      {/* Score arc + coverage */}
      <div className="flex items-center gap-4 mb-4">
        <ScoreArc value={index.score} />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Copertura dati</span>
            <span className="font-semibold text-foreground">{index.coveragePct}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Dimensioni</span>
            <span className="font-semibold text-foreground">{index.dimensionsAvailable}/{index.dimensionsTotal}</span>
          </div>
        </div>
      </div>

      {/* Sub-dimensions */}
      <div className="space-y-2 mb-3">
        {index.dimensions.map((dim) => (
          <div key={dim.id} className="rounded-lg bg-background/40 border border-border/30 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <DimensionStatusIcon status={dim.status} />
                <span className="text-xs font-medium text-foreground">{dim.label}</span>
              </div>
              {dim.score != null && (
                <span className="text-xs font-bold text-foreground">{dim.score}/100</span>
              )}
            </div>
            {dim.note && (
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{dim.note}</p>
            )}
            {dim.sources.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {dim.sources.map((s, i) => (
                  <span key={i} className="text-[9px] text-muted-foreground/40">{s}</span>
                ))}
                {dim.geoLevel && dim.geoLevel !== index.geoLevel && (
                  <span className="text-[9px] text-muted-foreground/40">· {geoLevelLabels[dim.geoLevel] ?? dim.geoLevel}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/60">{index.disclaimer}</p>
    </Section>
  );
}



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
                <p className="text-[10px] text-muted-foreground">{cat.count}{cat.nearest?.distance != null ? ` · ${cat.nearest.distance}m` : ""}</p>
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

/* ── Trasparenza Fonti builder ────────────────────────── */

function buildTrasparenzaFonti(result: ScanResult): TrasparenzaFontiData | null {
  const fonti: FonteEntry[] = [];

  if (result.identify.status === "success" && result.identify.data) {
    fonti.push({ categoria: "immagine", categoriaLabel: "Analisi immagine", provider: "Intelligenza artificiale", dettaglio: "Identificazione edificio da foto e coordinate GPS" });
  }
  if (result.omiZone.status === "success" && result.omiZone.data) {
    const omi = result.omiZone.data as import("@/types").OmiZoneData;
    fonti.push({ categoria: "dato_ufficiale", categoriaLabel: "Quotazioni OMI", provider: "Agenzia delle Entrate", periodo: omi.semestre ?? undefined, copertura: omi.polygonMatch ? "Zona identificata da coordinate" : "Media comunale" });
  }
  if (result.istatDemographic.status === "success" && result.istatDemographic.data) {
    const istat = result.istatDemographic.data as import("@/types").IstatDemographicData;
    const istatGeoLabel = istat.geoLevel === "microzona" || istat.geoLevel === "quartiere" || istat.geoLevel === "zona"
      ? `Livello ${istat.geoLevel}${istat.geoLabel ? ` — ${istat.geoLabel}` : ""}`
      : "Livello comunale";
    fonti.push({ categoria: "dato_ufficiale", categoriaLabel: "Dati demografici ISTAT", provider: "ISTAT", copertura: istatGeoLabel });
  }
  if (result.pricing.status === "success" && result.pricing.data) {
    fonti.push({ categoria: "dato_mercato", categoriaLabel: "Prezzi di mercato", provider: "Fonti di mercato verificate", dettaglio: "Elaborazione da comparabili e dati di mercato" });
  }
  if (result.marketContext.status === "success" && result.marketContext.data) {
    fonti.push({ categoria: "dato_mercato", categoriaLabel: "Contesto di mercato", provider: "Fonti commerciali", dettaglio: "Analisi comparabili e segnali di mercato" });
  }
  if (result.poiEnrichment.status === "success" && result.poiEnrichment.data) {
    fonti.push({ categoria: "dato_territoriale", categoriaLabel: "Servizi e POI", provider: "Fonti geospaziali verificate", dettaglio: "Punti di interesse nelle vicinanze" });
  }
  if (result.rischioZona.status === "success" && result.rischioZona.data) {
    fonti.push({ categoria: "dato_territoriale", categoriaLabel: "Rischio zona", provider: "Fonti istituzionali", dettaglio: "Rischio idrogeologico, sismico e ambientale" });
  }
  if (result.timeView.status === "success" && result.timeView.data) {
    fonti.push({ categoria: "scenario", categoriaLabel: "Scenario evolutivo", provider: "Elaborazione Sottra", dettaglio: "Proiezione indicativa basata su trend e segnali" });
  }
  if (result.convergenzaTerritoriale.status === "success" && result.convergenzaTerritoriale.data) {
    fonti.push({ categoria: "elaborazione", categoriaLabel: "Convergenza territoriale", provider: "Indice elaborato Sottra", dettaglio: "Sintesi da fonti multiple" });
  }

  return fonti.length > 0 ? { fonti } : null;
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

interface ResultState { photo: string; lat: number | null; lng: number | null; manualAddress?: string; savedResult?: Partial<ScanResult>; }

const LOW_CONFIDENCE_THRESHOLD = 0.4;

const isDev = import.meta.env.DEV;
function devLog(...args: unknown[]) { if (isDev) console.log("[RESULT]", ...args); }

function OffmarketSection({ data, loading }: { data: import("@/types").OffmarketData | null; loading: boolean }) {
  const segnali = data?.segnali ?? [];
  const opportunita = data?.opportunita ?? [];
  const totale = data?.totale ?? 0;
  const isEmpty = !loading && totale <= 0;

  const badgeClass = (tipo: string): string => {
    const t = tipo.toLowerCase();
    if (t.includes("asta")) return "bg-red-500/15 text-red-400 border-red-500/30";
    if (t.includes("variante")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (t.includes("eredit")) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    if (t.includes("patrimonio") || t.includes("pubblic")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const badgeLabel = (tipo: string): string => {
    const t = tipo.toLowerCase();
    if (t.includes("asta")) return "Asta";
    if (t.includes("variante")) return "Variante urbanistica";
    if (t.includes("eredit")) return "Eredità";
    if (t.includes("patrimonio") || t.includes("pubblic")) return "Patrimonio pubblico";
    return tipo;
  };

  return (
    <ReportAccordionItem id="offmarket" title="Segnali Off-Market" icon={Gem} defaultOpen={false}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {loading && (
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">In aggiornamento</Badge>
          )}
          {!loading && totale > 0 && (
            <Badge variant="outline" className="text-[10px]">{totale} {totale === 1 ? "segnale" : "segnali"}</Badge>
          )}
        </div>

        {isEmpty && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nessun segnale off-market rilevato per questa zona al momento.
          </p>
        )}

        {segnali.length > 0 && (
          <div className="space-y-2">
            {segnali.map((s, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium", badgeClass(s.tipo))}>
                    {badgeLabel(s.tipo)}
                  </span>
                  {typeof s.distanza_m === "number" && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(s.distanza_m)} m</span>
                  )}
                </div>
                {s.titolo && <p className="text-sm font-medium text-foreground leading-tight">{toText(s.titolo)}</p>}
                {s.descrizione && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{toText(s.descrizione)}</p>}
                {(s.fonte || s.data) && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                    {s.fonte ? toText(s.fonte) : ""}{s.fonte && s.data ? " · " : ""}{s.data ? toText(s.data) : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {opportunita.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1.5">Opportunità</p>
            <ul className="space-y-1">
              {opportunita.map((o, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">• {toText(o)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ReportAccordionItem>
  );
}

function ZoneIntelligenceSection({ data, loading }: { data: import("@/types").ZoneIntelligenceData | null; loading: boolean }) {
  const risultati = data?.risultati ?? [];

  const inferCategoria = (r: import("@/types").ZoneIntelligenceResult): string => {
    if (r.categoria) return r.categoria;
    const q = (r.query ?? "").toLowerCase();
    if (q.includes("notizie") || q.includes("notizia")) return "Notizie Recenti";
    if (q.includes("aste") || q.includes("asta")) return "Aste e Procedure";
    if (q.includes("variante") || q.includes("urbanistic")) return "Urbanistica";
    return "Approfondimento";
  };

  const truncate = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <ReportAccordionItem id="zone-intelligence" title="Intelligenza di Zona" icon={Zap} defaultOpen={false}>
      <div className="space-y-3 min-w-0">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!loading && risultati.length === 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nessuna notizia recente disponibile per questa zona
          </p>
        )}

        {!loading && risultati.length > 0 && (
          <div className="space-y-3">
            {risultati.map((r, i) => {
              const fonti = (r.fonti ?? []).slice(0, 3);
              return (
                <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-3 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 mb-1.5">
                    {inferCategoria(r)}
                  </p>
                  {r.risposta && (
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {toText(r.risposta)}
                    </p>
                  )}
                  {fonti.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {fonti.map((f, j) => (
                        <li key={j} className="text-[11px] min-w-0">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            • {truncate(toText(f.title || f.url || ""), 40)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">
            Powered by Perplexity
          </Badge>
        </div>
      </div>
    </ReportAccordionItem>
  );
}

function ListingsSection({ data, loading }: { data: import("@/types").ListingsData | null; loading: boolean }) {
  const annunci = data?.annunci ?? [];
  const totale = data?.totale ?? annunci.length;
  return (
    <ReportAccordionItem id="listings" title="Annunci attivi nella zona" icon={Gem} defaultOpen={false}>
      <div className="space-y-3 min-w-0">
        {loading && <Skeleton className="h-16 w-full" />}
        {!loading && totale === 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">Nessun annuncio attivo rilevato per questa zona.</p>
        )}
        {!loading && totale > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{totale} {totale === 1 ? "annuncio" : "annunci"}</Badge>
              {typeof data?.prezzo_medio_mq === "number" && (
                <Badge variant="outline" className="text-[10px]">Media: {Math.round(data.prezzo_medio_mq)} €/m²</Badge>
              )}
              {typeof data?.prezzo_min_mq === "number" && typeof data?.prezzo_max_mq === "number" && (
                <Badge variant="outline" className="text-[10px]">Range: {Math.round(data.prezzo_min_mq)}–{Math.round(data.prezzo_max_mq)} €/m²</Badge>
              )}
            </div>
            <div className="space-y-2">
              {annunci.slice(0, 8).map((a, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-3 min-w-0">
                  {a.titolo && <p className="text-sm font-medium text-foreground leading-tight break-words">{toText(a.titolo)}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                    {typeof a.prezzo === "number" && <span>{a.prezzo.toLocaleString("it-IT")} €</span>}
                    {typeof a.superficie_mq === "number" && <span>{a.superficie_mq} m²</span>}
                    {typeof a.prezzo_mq === "number" && <span>{Math.round(a.prezzo_mq)} €/m²</span>}
                    {a.locali && <span>{toText(String(a.locali))} locali</span>}
                  </div>
                  {a.indirizzo && <p className="text-[11px] text-muted-foreground/80 mt-1 break-words">{toText(a.indirizzo)}</p>}
                  {(a.fonte || a.url) && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                          {toText(a.fonte || a.url)}
                        </a>
                      ) : toText(a.fonte || "")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ReportAccordionItem>
  );
}

function CondominioSection({ data, loading }: { data: import("@/types").CondominioData | null; loading: boolean }) {
  const hasData = !!data && (data.amministratore || data.numero_unita || data.anno_costruzione || data.classe_energetica || (data.segnali && data.segnali.length > 0));
  return (
    <ReportAccordionItem id="condominio" title="Condominio" icon={Gem} defaultOpen={false}>
      <div className="space-y-3 min-w-0">
        {loading && <Skeleton className="h-16 w-full" />}
        {!loading && !hasData && (
          <p className="text-xs text-muted-foreground leading-relaxed">Nessun dato condominiale disponibile.</p>
        )}
        {!loading && hasData && data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {data.amministratore && <div><span className="text-muted-foreground">Amministratore: </span><span className="text-foreground break-words">{toText(data.amministratore)}</span></div>}
            {data.contatti && <div><span className="text-muted-foreground">Contatti: </span><span className="text-foreground break-words">{toText(data.contatti)}</span></div>}
            {typeof data.numero_unita === "number" && <div><span className="text-muted-foreground">Unità: </span><span className="text-foreground">{data.numero_unita}</span></div>}
            {typeof data.anno_costruzione === "number" && <div><span className="text-muted-foreground">Anno costruzione: </span><span className="text-foreground">{data.anno_costruzione}</span></div>}
            {data.classe_energetica && <div><span className="text-muted-foreground">Classe energetica: </span><span className="text-foreground">{toText(data.classe_energetica)}</span></div>}
            {typeof data.spese_annue === "number" && <div><span className="text-muted-foreground">Spese annue: </span><span className="text-foreground">{data.spese_annue.toLocaleString("it-IT")} €</span></div>}
            {data.note && <div className="sm:col-span-2 text-muted-foreground leading-relaxed break-words">{toText(data.note)}</div>}
          </div>
        )}
        {!loading && data?.segnali && data.segnali.length > 0 && (
          <ul className="space-y-1">
            {data.segnali.map((s, i) => (
              <li key={i} className="text-xs text-foreground">• {toText(s.label)}{s.valore ? `: ${toText(s.valore)}` : ""}</li>
            ))}
          </ul>
        )}
      </div>
    </ReportAccordionItem>
  );
}

function StoricoTransazioniSection({ data, loading }: { data: import("@/types").StoricoTransazioniData | null; loading: boolean }) {
  const transazioni = data?.transazioni ?? [];
  const totale = data?.totale ?? transazioni.length;
  return (
    <ReportAccordionItem id="storico-transazioni" title="Storico transazioni" icon={Gem} defaultOpen={false}>
      <div className="space-y-3 min-w-0">
        {loading && <Skeleton className="h-16 w-full" />}
        {!loading && totale === 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">Nessuna transazione storica disponibile.</p>
        )}
        {!loading && totale > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">{totale} {totale === 1 ? "transazione" : "transazioni"}</Badge>
              {typeof data?.prezzo_medio_mq === "number" && (
                <Badge variant="outline" className="text-[10px]">Media: {Math.round(data.prezzo_medio_mq)} €/m²</Badge>
              )}
              {typeof data?.variazione_percentuale === "number" && (
                <Badge variant="outline" className="text-[10px]">Variazione: {data.variazione_percentuale > 0 ? "+" : ""}{data.variazione_percentuale.toFixed(1)}%</Badge>
              )}
              {data?.periodo && <Badge variant="outline" className="text-[10px]">{toText(data.periodo)}</Badge>}
            </div>
            <div className="space-y-2">
              {transazioni.slice(0, 10).map((t, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-3 min-w-0">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-foreground">
                    {t.data && <span className="text-muted-foreground">{toText(t.data)}</span>}
                    {typeof t.prezzo === "number" && <span className="font-medium">{t.prezzo.toLocaleString("it-IT")} €</span>}
                    {typeof t.superficie_mq === "number" && <span>{t.superficie_mq} m²</span>}
                    {typeof t.prezzo_mq === "number" && <span>{Math.round(t.prezzo_mq)} €/m²</span>}
                    {t.tipologia && <span className="text-muted-foreground">{toText(t.tipologia)}</span>}
                  </div>
                  {t.fonte && <p className="text-[10px] text-muted-foreground/70 mt-1">{toText(t.fonte)}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ReportAccordionItem>
  );
}

function MoodScoreSection({ data, loading }: { data: import("@/types").MoodScoreData | null; loading: boolean }) {
  const hasData = !!data && (typeof data.score === "number" || data.observation || (data.drivers && data.drivers.length > 0));
  const bandClass = (band?: string | null): string => {
    const b = (band ?? "").toLowerCase();
    if (b.includes("molto_pos")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (b.includes("pos")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    if (b.includes("neutr")) return "bg-muted text-muted-foreground border-border";
    if (b.includes("molto_neg")) return "bg-red-500/15 text-red-400 border-red-500/30";
    if (b.includes("neg")) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    return "bg-muted text-muted-foreground border-border";
  };
  return (
    <ReportAccordionItem id="mood-score" title="Percezione di zona" icon={Zap} defaultOpen={false}>
      <div className="space-y-3 min-w-0">
        {loading && <Skeleton className="h-16 w-full" />}
        {!loading && !hasData && (
          <p className="text-xs text-muted-foreground leading-relaxed">Percezione di zona non disponibile.</p>
        )}
        {!loading && hasData && data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {typeof data.score === "number" && (
                <span className="text-2xl font-semibold text-foreground">{Math.round(data.score)}</span>
              )}
              {data.band && (
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium", bandClass(data.band))}>
                  {toText(data.sentimentLabel || data.band)}
                </span>
              )}
            </div>
            {data.observation && (
              <p className="text-xs text-foreground leading-relaxed break-words">{toText(data.observation)}</p>
            )}
            {data.drivers && data.drivers.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Punti di forza</p>
                <ul className="space-y-0.5">
                  {data.drivers.map((d, i) => <li key={i} className="text-xs text-foreground">• {toText(d)}</li>)}
                </ul>
              </div>
            )}
            {data.risks && data.risks.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wide mb-1">Punti di attenzione</p>
                <ul className="space-y-0.5">
                  {data.risks.map((r, i) => <li key={i} className="text-xs text-foreground">• {toText(r)}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </ReportAccordionItem>
  );
}

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultState | null;
  const { result, scanning, refining, manualAddress, scan, refineAddress, restoreResult } = useBuildingScan();
  const { saveScan } = useScanHistory();
  const { toast } = useToast();
  const started = useRef(false);

  const hasValidPhoto = isValidImageDataUrl(state?.photo);
  const hasManualAddress = !!(state?.manualAddress && state.manualAddress.trim().length >= 3);
  const hasValidCoords = isValidGps(state?.lat, state?.lng) || hasManualAddress;
  const hasSavedResult = state?.savedResult != null && Object.keys(state.savedResult).length > 0;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // If navigating from history with a saved result, restore it instead of re-scanning
    if (hasSavedResult) {
      devLog("restoring saved result from history");
      restoreResult(state!.savedResult!);
      return;
    }

    if (!hasValidPhoto || !hasValidCoords) return;
    devLog("identify start", { lat: state!.lat, lng: state!.lng });
    scan(state!.photo, state!.lat!, state!.lng!, state?.manualAddress);
  }, [state, scan, restoreResult, hasValidPhoto, hasValidCoords, hasSavedResult]);

  if (!hasValidPhoto) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  if (!hasValidCoords) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
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
  const moduleKeys: (keyof ScanResult)[] = ["pricing", "marketContext", "convergenzaTerritoriale", "rischioZona", "trendDemografico", "opportunity", "timeView", "infrastrutture", "sviluppoArea", "poiEnrichment"];
  const completedModules = moduleKeys.filter(k => result[k].status !== "loading" && result[k].status !== "idle");
  const publishedCount = completedModules.filter(k => isSectionPublishable(result[k].status, result[k].data)).length;
  const excludedCount = completedModules.length - publishedCount;

  // ── WOW Snapshot computation ──
  const pricingData = result.pricing.data as PricingData | null;
  const streetEvidence = identifyData?.streetEvidence;
  const wowAndDiff: { snapshot: WowSnapshot; houseDiff: HouseDifferentiationResult; caseResult: StrongCaseResult } | null = (() => {
    if (!identifyDone || lowConfidence || identifyFailed) return null;
    try {
      // Stub minimal zone correspondence for snapshot
      const omiLevel = pricingData?.omiGeoLevel;
      const isMicrozona = omiLevel === "microzona_omi";
      const isZonaSpecifica = omiLevel === "zona_specifica" || omiLevel === "quartiere";
      const isFineZone = isMicrozona || isZonaSpecifica;
      const isComuneLevel = !isFineZone && (omiLevel === "comune" || !omiLevel);
      const zoneTypeLabel = isMicrozona ? "Microzona OMI" : isZonaSpecifica ? (omiLevel === "zona_specifica" ? "Zona OMI specifica" : "Zona OMI quartiere") : isComuneLevel ? "Livello comunale" : "Zona OMI";
      const geoLevelReale = isFineZone ? "zona_omi" as const : "comune" as const;
      const anchorStr = isMicrozona ? "strong" as const : isZonaSpecifica ? "medium" as const : "weak" as const;
      const precisionStr = isMicrozona ? "strong" as const : isZonaSpecifica ? "medium" as const : "weak" as const;
      const marketSupport = isFineZone ? "direct" as const : "fallback" as const;
      const maxClaim = isFineZone ? "zona_omi" as const : "comune" as const;
      const fbWeight = (pricingData?.polygonMatch ? "none" : isComuneLevel ? "high" : isFineZone ? "low" : "medium") as "none" | "low" | "medium" | "high";
      const fsRisk = (isComuneLevel ? "medium" : "none") as "none" | "low" | "medium" | "high";
      const stubCorr = {
        zone_identity: { geo_level_reale: geoLevelReale, geo_code: pricingData?.omiGeoLevel ?? "unknown", geo_label: identifyData?.address?.split(",").pop()?.trim() ?? "Zona", normalized_path: "", zone_type_label: zoneTypeLabel, zone_corresponds_to: "", zone_anchor_strength: anchorStr },
        zone_correspondence: { corresponds_to_microzona_omi: isMicrozona, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: isComuneLevel, primary_zone_basis: isMicrozona ? "Microzona OMI" : isZonaSpecifica ? "Zona OMI" : "Livello comunale", secondary_zone_basis: isComuneLevel ? [] as string[] : ["Contesto comunale"], fallback_used: !pricingData?.polygonMatch, fallback_weight: fbWeight, false_specificity_risk: fsRisk },
        zone_precision: { precision_status: precisionStr, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: marketSupport, territorial_support_status: "partial" as const, max_safe_claim_level: maxClaim },
        zone_limitations: { missing_sub_comunale: true, market_only_comunale: isComuneLevel, weak_zone_anchor: isComuneLevel, fallback_dominant: false, blocking_gaps: [] as string[], transparency_notes: isComuneLevel ? ["Lettura a livello comunale — la zona specifica potrebbe variare"] : [] as string[] },
      };
      const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] as string[] });
      const stubTd = {
        territorial_identity: { geo_level: "zona_omi" as const, geo_code: "live", geo_label: identifyData?.address?.split(",").pop()?.trim() ?? "", normalized_path: "", resolution_method: "direct" },
        territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block(pricingData ? "full" : "unavailable", "zona_omi"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
      };
      const value = buildZoneValue({ data: stubTd as any, corr: stubCorr as any, omiMin: pricingData?.prezzoMqMin, omiMax: pricingData?.prezzoMqMax, omiGeoLevel: pricingData?.omiGeoLevel, omiPolygonMatch: pricingData?.polygonMatch });
      const reno = buildRenovationEstimate({ zone_geo_code: "live", zone_geo_level: "zona_omi", hasPhoto: true, visibleFloors: streetEvidence?.photoAnalysis?.visibleFloors, buildingType: streetEvidence?.photoAnalysis?.buildingType, facadeConsistencyLevel: streetEvidence?.facadeConsistencyLevel, photoReadability: streetEvidence?.photoAnalysis?.photoReadability, value_per_sqm_mid: value.value_result.value_per_sqm_mid });
      const hDiff = buildHouseDifferentiation({
        photo_present: true,
        geo_present: hasValidCoords,
        lat: state?.lat ?? null,
        lng: state?.lng ?? null,
        address_raw: identifyData?.address ?? null,
        address_resolution: null,
        building_profile: null,
        identify_hints: identifyData ? {
          confidence: identifyData.confidence ?? 0.5,
        } : null,
      });
      const snap = buildWowSnapshot({ value, renovation: reno, growth: null, corr: stubCorr as any, specificity_strength: hDiff.specificity.specificity_strength, specificity_status: hDiff.specificity.specificity_status });
      const caseRes = evaluateStrongCase({
        snapshot: snap,
        house_specificity_strength: hDiff.specificity.specificity_strength,
        alignment_status: hDiff.address_alignment.diagnostics.overall_alignment_status,
        outlook_status: null,
        boundary_available: false,
      });
      return { snapshot: snap, houseDiff: hDiff, caseResult: caseRes };
    } catch { return null; }
  })();

  const wowSnapshot = wowAndDiff?.snapshot ?? null;
  const houseDiff = wowAndDiff?.houseDiff ?? null;
  const caseResult = wowAndDiff?.caseResult ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/scan")} aria-label="Indietro">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {scanning && <span className="text-[11px] text-primary font-medium animate-pulse">Elaborazione…</span>}
        </>
      } />

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

          {/* ═══ HERO GEO-LEVEL BANNER — verità del dato immediata ═══ */}
          {identifyDone && !lowConfidence && !identifyFailed && (() => {
            const _pd = result.pricing.data as PricingData | null;
            const _istat = result.istatDemographic.data as import("@/types").IstatDemographicData | null;
            const geoStatus = resolveReportGeoStatus(
              _pd?.omiGeoLevel,
              _pd?.polygonMatch,
              _istat?.geoLevel,
            );
            const _omi = result.omiZone.data as import("@/types").OmiZoneData | null;
            return (
              <GeoLevelHeroBanner
                status={geoStatus}
                zoneLabel={_omi?.zonaOmiLabel ?? _istat?.geoLabel ?? null}
                comuneLabel={_omi?.comuneLabel ?? _istat?.comuneLabel ?? identifyData?.address?.split(",").pop()?.trim() ?? null}
              />
            );
          })()}

          {/* ═══ WOW PANEL — Tiers 1+2 (colpo d'occhio + decisione) ═══ */}
          <SectionSafe>
            <WowPanel
              snapshot={wowSnapshot}
              loading={result.pricing.status === "loading"}
              outlookLabel={null}
              outlookVariant="muted"
              alignmentLabel={houseDiff ? (
                houseDiff.address_alignment.photo_address_alignment === "high_alignment" ? "Coerente" :
                houseDiff.address_alignment.photo_address_alignment === "medium_alignment" ? "Parziale" :
                houseDiff.address_alignment.photo_address_alignment === "low_alignment" ? "Da verificare" : null
              ) : null}
              alignmentVariant={houseDiff ? (
                houseDiff.address_alignment.photo_address_alignment === "high_alignment" ? "positive" :
                houseDiff.address_alignment.photo_address_alignment === "medium_alignment" ? "neutral" : "warning"
              ) : "muted"}
              caseResult={caseResult}
            />
          </SectionSafe>

          {/* Manual address override — shown after identify success, not during initial scan */}
          {identifyDone && !lowConfidence && !identifyFailed && (
            <AddressOverrideForm
              loading={refining}
              onSubmit={(addr: ManualAddressInput) => {
                refineAddress(addr, state!.lat!, state!.lng!, state!.photo);
              }}
            />
          )}

          {/* Post-override confirmation banner */}
          {manualAddress && !refining && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground leading-tight">Localizzazione aggiornata</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  I dati territoriali sono stati ricalcolati in base all'indirizzo dell'immobile inserito. Nessun credito aggiuntivo consumato.
                </p>
              </div>
            </div>
          )}

          {lowConfidence && <LowConfidenceCard onRetry={() => navigate("/scan")} />}

          {!lowConfidence && !identifyFailed && (
            <>
              {/* ═══ ALWAYS OPEN — Profilo Rapido + Specificità ═══ */}
              <SectionSafe><ProfiloRapidoCard data={result.profiloRapido.data as import("@/types/report").ProfiloRapidoData | null} loading={result.profiloRapido.status === "loading"} /></SectionSafe>
              <SectionSafe><HouseDifferentiationCard diff={houseDiff} loading={scanning} /></SectionSafe>

              {/* ═══ ACCORDION SECTIONS — Mobile-first collapsible ═══ */}

              {/* Zona OMI — always open */}
              <SectionSafe>
                <ReportAccordionItem id="omi" title="Quotazioni OMI" icon={TrendingUp} defaultOpen>
                  <OmiCard data={result.omiZone.data as import("@/types").OmiZoneData | null} loading={result.omiZone.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Prezzi di Mercato — always open */}
              <SectionSafe>
                <ReportAccordionItem id="pricing" title="Prezzi di Mercato" icon={TrendingUp} defaultOpen
                  isWeak={(() => { const _p = result.pricing.data as PricingData | null; return !_p?.polygonMatch && (!_p?.omiGeoLevel || _p?.omiGeoLevel === "comune"); })()}>
                  <PricingCard data={result.pricing.data as PricingData | null} loading={result.pricing.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Mercato Locale */}
              <SectionSafe>
                <ReportAccordionItem id="market" title="Mercato Locale" icon={BarChart3} defaultOpen={false}>
                  <MarketContextCard data={result.marketContext.data as MarketContextData | null} loading={result.marketContext.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Immobile e Facciata */}
              <SectionSafe>
                <ReportAccordionItem id="facciata" title="Immobile e Facciata" icon={Eye} defaultOpen={false}>
                  <ImmobileFacciataCard data={result.immobileFacciata.data as import("@/types/report").ImmobileFacciataData | null} loading={result.immobileFacciata.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Contesto e Vicinato */}
              <SectionSafe>
                <ReportAccordionItem id="contesto" title="Contesto e Vicinato" icon={Compass} defaultOpen={false}>
                  <ContestoVicinatoCard data={result.contestoVicinato.data as import("@/types/report").ContestoVicinatoData | null} loading={result.contestoVicinato.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Servizi e POI */}
              <SectionSafe>
                <ReportAccordionItem id="poi" title="Servizi e POI" icon={MapPin} defaultOpen={false}>
                  <PoiEnrichmentCard data={result.poiEnrichment.data as PoiEnrichmentData | null} loading={result.poiEnrichment.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Posizionamento Commerciale */}
              <SectionSafe>
                <ReportAccordionItem id="commerciale" title="Posizionamento Commerciale" icon={Target} defaultOpen={false}>
                  <PosizionamentoCommercialeCard data={result.posizionamentoCommerciale.data as import("@/types/report").PosizionamentoCommercialeData | null} loading={result.posizionamentoCommerciale.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Profilo Area */}
              <SectionSafe>
                <ReportAccordionItem id="area" title="Profilo Area" icon={Layers} defaultOpen={false}>
                  <ProfiloAreaCard data={result.profiloArea.data as import("@/types/report").ProfiloAreaData | null} loading={result.profiloArea.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Rischio Zona */}
              <SectionSafe>
                <ReportAccordionItem id="rischio" title="Rischio Zona" icon={AlertTriangle} defaultOpen={false}>
                  <RischioZonaCard data={result.rischioZona.data as RischioZonaData | null} loading={result.rischioZona.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Dati Demografici */}
              <SectionSafe>
                <ReportAccordionItem id="istat" title="Dati Demografici" icon={Users} defaultOpen={false}
                  isWeak={(() => { const _i = result.istatDemographic.data as import("@/types").IstatDemographicData | null; return !_i?.geoLevel || _i?.geoLevel === "comune" || _i?.geoLevel === "area_vasta"; })()}>
                  <IstatCard data={result.istatDemographic.data as import("@/types").IstatDemographicData | null} loading={result.istatDemographic.status === "loading"} />
                  <TrendDemograficoCard data={result.trendDemografico.data as TrendDemograficoData | null} loading={result.trendDemografico.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Profilo di Zona */}
              <SectionSafe>
                <ReportAccordionItem id="vicinato" title="Profilo di Zona" icon={Layers} defaultOpen={false}>
                  <NeighborhoodIndexCard
                    index={calculateNeighborhoodIndex(
                      result.poiEnrichment.data as PoiEnrichmentData | null,
                      result.istatDemographic.data as import("@/types").IstatDemographicData | null,
                      result.rischioZona.data as RischioZonaData | null,
                      result.omiZone.data as import("@/types").OmiZoneData | null,
                    )}
                    loading={scanning}
                  />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Convergenza + Opportunità */}
              <SectionSafe>
                <ReportAccordionItem id="convergenza" title="Convergenza e Opportunità" icon={Zap} defaultOpen={false}>
                  <ConvergenzaTerritorialeCard data={result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null} loading={result.convergenzaTerritoriale.status === "loading"} />
                  <div className="mt-3" />
                  <OpportunityCard data={result.opportunity.data as OpportunityData | null} loading={result.opportunity.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Scenario e Proiezioni */}
              <SectionSafe>
                <ReportAccordionItem id="scenario" title="Scenario e Proiezioni" icon={Rocket} defaultOpen={false}>
                  <ScenarioTemporaleCard data={result.scenarioTemporale.data as import("@/types/report").ScenarioTemporaleData | null} loading={result.scenarioTemporale.status === "loading"} />
                  <div className="mt-3" />
                  <TimeViewCard data={result.timeView.data as TimeViewData | null} loading={result.timeView.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Infrastrutture e Sviluppo */}
              <SectionSafe>
                <ReportAccordionItem id="infra" title="Infrastrutture e Sviluppo" icon={Construction} defaultOpen={false}>
                  <InfrastrutureCard data={result.infrastrutture.data as InfrastrutureData | null} loading={result.infrastrutture.status === "loading"} />
                  <div className="mt-3" />
                  <SviluppoAreaCard data={result.sviluppoArea.data as SviluppoAreaData | null} loading={result.sviluppoArea.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Segnali Off-Market */}
              <SectionSafe>
                <OffmarketSection data={result.offmarket?.data as import("@/types").OffmarketData | null} loading={result.offmarket?.status === "loading"} />
              </SectionSafe>

              {/* Intelligenza di Zona */}
              <SectionSafe>
                <ZoneIntelligenceSection data={result.zoneIntelligence?.data as import("@/types").ZoneIntelligenceData | null} loading={result.zoneIntelligence?.status === "loading"} />
              </SectionSafe>

              {/* Sintesi Finale — always open */}
              <SectionSafe><SintesiFinaleCard data={result.sintesiFinale.data as import("@/types/report").SintesiFinaleData | null} loading={result.sintesiFinale.status === "loading"} /></SectionSafe>

              {/* Priorità / Criticità */}
              <SectionSafe>
                <ReportAccordionItem id="priorita" title="Priorità e Criticità" icon={AlertTriangle} defaultOpen={false}>
                  <PrioritaCriticitaCard data={result.prioritaCriticita.data as PrioritaCriticitaData | null} loading={result.prioritaCriticita.status === "loading"} />
                </ReportAccordionItem>
              </SectionSafe>

              {/* Trasparenza Fonti */}
              {!scanning && (
                <SectionSafe>
                  <ReportAccordionItem id="fonti" title="Fonti e Metodologia" icon={ShieldCheck} defaultOpen={false}>
                    <TrasparenzaFontiCard data={buildTrasparenzaFonti(result)} />
                  </ReportAccordionItem>
                </SectionSafe>
              )}

              {/* Discrete quality footer */}
              {!scanning && <ReportFooter excludedCount={excludedCount} totalPublished={publishedCount} />}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border/50 px-4 sm:px-5 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-3 flex gap-3 z-40" style={{ paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)', paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)' }}>
        <Button className="flex-1 min-h-[48px] active:scale-[0.97] transition-transform" size="lg" onClick={() => navigate("/scan")}>Nuova scansione</Button>
        <Button variant="outline" size="lg" className="shrink-0 min-h-[48px]" disabled={!identifyData || lowConfidence || identifyFailed || scanning} onClick={async () => {
          if (!state) return;
          if (!identifyData) {
            toast({ title: "Report non salvabile", description: "L'identificazione dell'edificio non è ancora completa.", variant: "destructive" });
            return;
          }
          const convergenza = result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null;
          const thumbnail = await compressToThumbnail(state.photo);
          const snapshot = serializeResult(result);
          // Use resolveGeoContext for consistency with report display
          const geo = resolveGeoContext(result);
          const primaryGeo = geo.geoLevel !== "non_determinato" ? geo.geoLevel : null;
          saveScan({
            locality: identifyData.address
              ? identifyData.address.split(",").slice(-2, -1)[0]?.trim() || "Posizione sconosciuta"
              : "Posizione sconosciuta",
            moodScore: null,
            convergenzaTerritoriale: convergenza ? {
              score: convergenza.score,
              band: convergenza.band,
            } : null,
            lat: state.lat,
            lng: state.lng,
            photoThumbnail: thumbnail,
            resultSnapshot: snapshot,
            primaryGeoLevel: primaryGeo,
            restorable: !!(thumbnail && snapshot),
          });
          toast({ title: "Report salvato", description: "Trovi questo report nella cronologia." });
        }}><Bookmark className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default Result;
