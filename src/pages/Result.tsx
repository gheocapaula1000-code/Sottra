import { useCallback, useEffect, useRef, useState, Component, type ReactNode, type ErrorInfo } from "react";
import AppHeader from "@/components/AppHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, TrendingUp, Users, Rocket, Construction, AlertTriangle, MapPin, Compass, Target, Eye, ShieldCheck, TriangleAlert, Layers, Camera, CheckCircle2, BarChart3, Gem, Zap, Wrench, Share2 } from "lucide-react";
import { useScanHistory, compressToThumbnail, serializeResult } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { isValidGps, isValidImageDataUrl } from "@/lib/imageUtils";
import { isSavedResultSnapshot, loadLastScanPhoto, mergeResultScanState, peekLastScanPhoto, saveLastScanPhoto, type LastScanRecord } from "@/lib/lastScanPhotoStore";
import { buildHistoryDraft, shouldRecordFinishedScan } from "@/lib/scanHistoryStore";
import {
  buildReportShareFile,
  buildShareTitle,
  captureReportElement,
  downloadBlobFile,
  waitForCaptureLayout,
} from "@/lib/shareReportImage";
import { buildAgencyShareCaption, buildAgencyWhatsappUrl } from "@/lib/agencyWhatsapp";
import { useAgencyWhatsapp } from "@/hooks/useAgencyWhatsapp";
import AgencyWhatsappDialog from "@/components/AgencyWhatsappDialog";
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
  IstatDemographicData, OmiZoneData,
} from "@/types";
import { isRenderableTrendDemografico, getAvailableDemographicMetricCount } from "@/lib/demographic";
import { IstatSubMunicipalAreasTable } from "@/components/report/IstatSubMunicipalAreasTable";
import {
  hasRenderableIstatAreas,
  isIstatDemographicsRenderable,
  sanitizeComunalePopolazione,
} from "@/lib/istatSubMunicipalAreas";
import { calculateNeighborhoodIndex, type NeighborhoodIndex, type SubDimension } from "@/lib/neighborhoodIndex";
import {
  ProfiloRapidoCard, ImmobileFacciataCard, ContestoVicinatoCard,
  ProfiloAreaCard,
  SintesiFinaleCard, TrasparenzaFontiCard,
  PrioritaCriticitaCard,
} from "@/components/report/ReportSections";
import type { TrasparenzaFontiData, FonteEntry, PrioritaCriticitaData, ScenarioTemporaleData } from "@/types/report";
import AddressOverrideForm, { formatManualAddress } from "@/components/AddressOverrideForm";
import type { ManualAddressInput } from "@/components/AddressOverrideForm";
import { GeoLevelHeroBanner, PublishableAccordionItem, ReportCaptureOpenContext, resolveReportGeoStatus } from "@/components/report/ReportAccordion";
import {
  isConvergenzaPublishable,
  isDemographicsPublishable,
  isFontiPublishable,
  isInfraPublishable,
  isMarketPublishable,
  isModuleLoading,
  isNeighborhoodPublishable,
  isOmiPublishable,
  isOpportunityPublishable,
  isPoiPublishable,
  isPricingPublishable,
  isPricingMicrozonaOmi,
  isPrioritaPublishable,
  isReportFieldsPublishable,
  isRischioPublishable,
  isScenarioTemporalePublishable,
  isSviluppoPublishable,
  isTimeViewPublishable,
  shouldShowEmptyScanAddressPrompt,
} from "@/lib/reportSectionPublishable";
import { buildZoneValue, valueNarrativeMode, valueReliabilityLabel } from "@/lib/zoneValueEngine";
import { resolveGeoContext } from "@/lib/reportMapper";
import { buildRenovationEstimate, renovationNarrativeMode } from "@/lib/renovationCostEngine";
import { buildWowSnapshot } from "@/lib/sottraWowSnapshot";
import type { WowSnapshot } from "@/lib/sottraWowSnapshot";
import { OmiQuotesTable } from "@/components/report/OmiQuotesTable";
import { WowPanel } from "@/components/report/WowPanel";
import { BuildingIdentityCard } from "@/components/report/BuildingIdentityCard";
import { resolveOfficialOmiOverlay } from "@/lib/officialOmiFromCore";
import { RESULT_SAFE_BOTTOM_PAD } from "@/lib/resultChrome";
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
    case "estimated": return "elaborato";
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

function PricingCard({ data, loading }: { data: PricingData | null; loading: boolean }) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable" || data.prezzoMq == null) return null;
  // Fail-closed: this card reads only as official OMI microzona data.
  // If the GPS point missed the AdE polygon, the card is hidden entirely.
  if (!isPricingMicrozonaOmi(data)) return null;

  const hasMediaZona = data.mediaZona != null;
  const hasTrend = data.trend5Anni != null;

  return (
    <Section>
      <SectionHeader icon={TrendingUp} title="Prezzi di Mercato (microzona OMI)" />
      {/* Geo-level context — official OMI microzona, never this interior */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />Dato ufficiale OMI — microzona
        </span>
      </div>
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
      <p className="text-[10px] text-muted-foreground/70 mt-3 leading-snug">
        Quotazione ufficiale OMI della microzona — non è il valore di questo interno né di questo appartamento.
      </p>
      {data.confidenceReason && <p className="text-[10px] text-muted-foreground/50 mt-2">{data.confidenceReason}</p>}
      <SourceTag meta={data} />
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

      {/* Official rows — every tipologia × stato for the matched link_zona */}
      {data.quotes && data.quotes.length > 0 ? (
        <OmiQuotesTable quotes={data.quotes} />
      ) : hasQuotazioni ? (
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

      {data.semestre && (
        <p className="text-[10px] text-muted-foreground/60">Semestre {data.semestre}</p>
      )}
      <SourceTag meta={data} />
    </Section>
  );
}

/* ── ISTAT Card ───────────────────────────────────────── */

function IstatCard({
  data,
  loading,
  omiZoneLabel,
}: {
  data: import("@/types").IstatDemographicData | null;
  loading: boolean;
  omiZoneLabel?: string | null;
}) {
  if (loading) return <SectionSkeleton />;
  if (!data || data.sourceType === "unavailable") return null;
  const popolazione = sanitizeComunalePopolazione(data.popolazione, data.comuneIstatCode, data.comuneLabel);
  const hasAreas = hasRenderableIstatAreas(data.areas);
  const hasAnyMetric = isIstatDemographicsRenderable(data)
    || data.nucleiFamiliari != null
    || data.densita != null
    || data.indiceVecchiaia != null
    || data.percentualeStranieri != null;
  if (!hasAnyMetric) return null;

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
        {popolazione != null && (
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Popolazione{geoSuffix}</span>
          <p className="font-bold text-foreground text-sm mt-0.5">{fmt(popolazione)}</p>
        </div>
        )}
        {data.nucleiFamiliari != null && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Nuclei familiari{geoSuffix}</span>
            <p className="font-bold text-foreground text-sm mt-0.5">{fmt(data.nucleiFamiliari)}</p>
          </div>
        )}
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
      {hasAreas && (
        <IstatSubMunicipalAreasTable areas={data.areas} omiZoneLabel={omiZoneLabel} />
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




function poiCategoryTitle(cat: { category?: string; categoryLabel?: string }): string {
  const k = (cat.category ?? "").toLowerCase();
  if (k === "leisure" || k === "parks") return cat.categoryLabel?.trim() || "Parchi / verde";
  if (k === "worship") return cat.categoryLabel?.trim() || "Luoghi di culto";
  return (cat.categoryLabel ?? cat.category ?? "").trim();
}

function PoiWowStrip({ data }: { data: PoiEnrichmentData }) {
  if (data.totalPois === 0 || !data.categories?.length) return null;
  return (
    <div
      data-testid="poi-wow-strip"
      className="rounded-2xl border border-border/60 bg-card overflow-hidden min-w-0 px-5 py-4 space-y-3"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
        Servizi a {data.searchRadius} m
      </p>
      <h3 className="text-base font-bold text-foreground leading-snug">
        {data.totalPois} nelle vicinanze
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {data.categories.slice(0, 8).map((cat, i) => (
          <div key={`${cat.category}-${i}`} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold text-foreground truncate">{poiCategoryTitle(cat)}</p>
            <p className="text-[10px] text-muted-foreground">
              {cat.count}{cat.nearest?.distance != null ? ` · ${cat.nearest.distance}m` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
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
                <p className="text-xs font-semibold text-foreground truncate">{poiCategoryTitle(cat)}</p>
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
  if (result.poiEnrichment.status === "success" && result.poiEnrichment.data) {
    fonti.push({ categoria: "dato_territoriale", categoriaLabel: "Servizi e POI", provider: "Fonti geospaziali verificate", dettaglio: "Punti di interesse nelle vicinanze" });
  }
  if (result.rischioZona.status === "success" && result.rischioZona.data) {
    fonti.push({ categoria: "dato_territoriale", categoriaLabel: "Rischio zona", provider: "Fonti istituzionali", dettaglio: "Rischio idrogeologico, sismico e ambientale" });
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

interface ResultState { photo: string; lat: number | null; lng: number | null; manualAddress?: string; savedResult?: Partial<ScanResult>; historyId?: string; }

const LOW_CONFIDENCE_THRESHOLD = 0.4;

const isDev = import.meta.env.DEV;
function devLog(...args: unknown[]) { if (isDev) console.log("[RESULT]", ...args); }

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as ResultState | null;
  const [persisted, setPersisted] = useState<LastScanRecord | null>(() => peekLastScanPhoto());
  const [hydrateDone, setHydrateDone] = useState(
    () => isValidImageDataUrl(routerState?.photo) || isValidImageDataUrl(peekLastScanPhoto()?.photo),
  );
  const { result, scanning, refining, manualAddress, scan, refresh, refineAddress, restoreResult, forceShowResult, setForceShowResult } = useBuildingScan();
  const { saveScan } = useScanHistory();
  const { toast } = useToast();
  const started = useRef(false);
  const historyIdRef = useRef<string | null>(null);
  const historySignatureRef = useRef<string | null>(null);
  const reportRootRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const { phone: agencyPhone, save: saveAgencyPhone, saving: savingAgencyPhone } = useAgencyWhatsapp();
  const [agencyDialogOpen, setAgencyDialogOpen] = useState(false);
  const officialOmi = resolveOfficialOmiOverlay({
    omiZone: result.omiZone,
    photoWow: result.photoWow,
    pricing: result.pricing,
  });

  useEffect(() => {
    if (isValidImageDataUrl(routerState?.photo)) {
      setHydrateDone(true);
      if (routerState.historyId) historyIdRef.current = routerState.historyId;
      // Live scan (not a history thumbnail) — keep the actual JPEG for reload.
      // Same JPEG: keep the finished snapshot. New JPEG: overwrite (no grafted tendine).
      if (!routerState?.savedResult) {
        const existing = peekLastScanPhoto();
        const samePhoto = existing?.photo === routerState.photo;
        void saveLastScanPhoto({
          photo: routerState.photo,
          lat: routerState.lat ?? null,
          lng: routerState.lng ?? null,
          manualAddress: routerState.manualAddress,
          historyId: routerState.historyId ?? existing?.historyId ?? historyIdRef.current ?? undefined,
          ...(samePhoto && isSavedResultSnapshot(existing?.savedResult)
            ? { savedResult: existing.savedResult }
            : {}),
        });
        if (samePhoto && existing) setPersisted(existing);
      }
      return;
    }
    let cancelled = false;
    loadLastScanPhoto().then((rec) => {
      if (cancelled) return;
      if (rec?.historyId) historyIdRef.current = rec.historyId;
      setPersisted(rec);
      setHydrateDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [routerState]);

  const state = mergeResultScanState(routerState, persisted) as ResultState | null;

  const hasValidPhoto = isValidImageDataUrl(state?.photo);
  const hasManualAddress = !!(state?.manualAddress && state.manualAddress.trim().length >= 3);
  const hasValidCoords = isValidGps(state?.lat, state?.lng) || hasManualAddress;
  const hasSavedResult = isSavedResultSnapshot(state?.savedResult);

  useEffect(() => {
    if (started.current) return;
    if (!hydrateDone) return;

    // If navigating from history with a saved result, restore it instead of re-scanning
    if (hasSavedResult) {
      started.current = true;
      devLog("restoring saved result from history");
      restoreResult(state!.savedResult!);
      return;
    }

    if (!hasValidPhoto || !hasValidCoords) return;
    started.current = true;
    devLog("identify start", { lat: state!.lat, lng: state!.lng });
    scan(state!.photo, state!.lat!, state!.lng!, state?.manualAddress);
  }, [hydrateDone, state, scan, restoreResult, hasValidPhoto, hasValidCoords, hasSavedResult]);

  useEffect(() => {
    if (!hydrateDone || scanning || hasSavedResult || !hasValidPhoto || !state) return;
    const identifyOk = result.identify.status === "success" && result.identify.data != null;
    if (!shouldRecordFinishedScan({
      scanning,
      hasPhoto: hasValidPhoto,
      officialOmi: officialOmi.data,
      identifyOk,
    })) return;

    const signature = [
      state.photo.slice(0, 64),
      state.lat,
      state.lng,
      state.manualAddress ?? "",
      officialOmi.data?.zonaOmi ?? "",
      officialOmi.data?.comuneLabel ?? "",
      result.identify.status,
    ].join("|");
    if (historySignatureRef.current === signature) return;

    let cancelled = false;
    void (async () => {
      const thumbnail = await compressToThumbnail(state.photo);
      if (cancelled) return;
      const snapshot = serializeResult(result);
      const geo = resolveGeoContext(result);
      const primaryGeo = geo.geoLevel !== "non_determinato" ? geo.geoLevel : null;
      const convergenza = result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null;
      if (!historyIdRef.current) historyIdRef.current = crypto.randomUUID();
      const draft = buildHistoryDraft({
        id: historyIdRef.current,
        photoThumbnail: thumbnail,
        resultSnapshot: snapshot,
        officialOmi: officialOmi.data,
        lat: state.lat,
        lng: state.lng,
        manualAddress: state.manualAddress,
        identifyAddress: (result.identify.data as IdentifyResult | null)?.address ?? null,
        primaryGeoLevel: primaryGeo,
        convergenzaTerritoriale: convergenza ? {
          score: convergenza.score,
          band: convergenza.band,
        } : null,
      });
      await saveScan(draft);
      if (cancelled) return;
      historySignatureRef.current = signature;
      void saveLastScanPhoto({
        photo: state.photo,
        lat: state.lat,
        lng: state.lng,
        manualAddress: state.manualAddress,
        historyId: historyIdRef.current,
        ...(snapshot && isSavedResultSnapshot(snapshot) ? { savedResult: snapshot } : {}),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrateDone, scanning, hasSavedResult, hasValidPhoto, state, officialOmi,
    result, saveScan,
  ]);

  const handlePullRefresh = useCallback(async () => {
    if (!state?.photo) return;
    const address = manualAddress ? formatManualAddress(manualAddress) : state.manualAddress;
    const lat = isValidGps(state.lat, state.lng) ? state.lat : 0;
    const lng = isValidGps(state.lat, state.lng) ? state.lng : 0;
    await refresh(state.photo, lat, lng, address);
  }, [state, manualAddress, refresh]);

  if (!hydrateDone) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!hasValidPhoto) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  const identifyFailedRaw = result.identify.status === "error";
  const identifyData = result.identify.data as IdentifyResult | null;
  const identifyDone = result.identify.status === "success";
  const lowConfidenceRaw = identifyDone && identifyData != null && identifyData.confidence < LOW_CONFIDENCE_THRESHOLD;
  // Quality gates DISABLED: il pipeline civiko-property-from-photo gestisce autonomamente
  // la qualità foto con fallback sicuro. Il frontend non blocca mai /result.
  void identifyFailedRaw; void lowConfidenceRaw; void forceShowResult; void setForceShowResult;
  const identifyFailed = false;
  const lowConfidence = false;

  // Count publishable vs excluded
  const moduleKeys: (keyof ScanResult)[] = ["pricing", "marketContext", "convergenzaTerritoriale", "rischioZona", "trendDemografico", "opportunity", "timeView", "infrastrutture", "sviluppoArea", "poiEnrichment"];
  const completedModules = moduleKeys.filter(k => result[k].status !== "loading" && result[k].status !== "idle");
  const publishedCount = completedModules.filter(k => isSectionPublishable(result[k].status, result[k].data)).length;
  const excludedCount = completedModules.length - publishedCount;

  /** Invia il report JPEG al WhatsApp dell'agenzia salvato dall'agente. */
  const sendToAgency = async (phoneE164: string) => {
    const root = reportRootRef.current;
    if (!root || capturing) return;
    const url = buildAgencyWhatsappUrl(
      phoneE164,
      buildAgencyShareCaption({
        street: identifyData?.geoResolution?.resolvedStreet ?? null,
        houseNumber: identifyData?.geoResolution?.resolvedHouseNumber ?? null,
        comuneLabel: officialOmi.data?.comuneLabel ?? identifyData?.comune ?? null,
        zonaOmi: officialOmi.data?.zonaOmi ?? null,
      }),
    );
    if (!url) {
      // fail-closed: numero non valido, non si invia nulla
      toast({ title: "Numero non valido", description: "Aggiorna il WhatsApp dell'agenzia.", variant: "destructive" });
      return;
    }
    const title = buildShareTitle({
      comuneLabel: officialOmi.data?.comuneLabel ?? null,
      zonaOmi: officialOmi.data?.zonaOmi ?? null,
    });
    setCapturing(true);
    document.documentElement.setAttribute("data-sottra-capture", "1");
    try {
      await waitForCaptureLayout();
      const file = await buildReportShareFile({
        root,
        title,
        capture: (reportRoot) => captureReportElement(reportRoot, { facadeSrc: state.photo }),
      });
      downloadBlobFile(file);
      window.open(url, "_blank", "noopener");
      toast({ title: "Report pronto per l'agenzia", description: `Allega ${file.name} nella chat aperta.` });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast({ title: "Invio non riuscito", description: "Riprova tra poco.", variant: "destructive" });
    } finally {
      document.documentElement.removeAttribute("data-sottra-capture");
      setCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!agencyPhone) {
      setAgencyDialogOpen(true);
      return;
    }
    await sendToAgency(agencyPhone);
  };



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
          building_type: streetEvidence?.photoAnalysis?.buildingType ?? null,
          facade_visible: streetEvidence?.facadeConsistencyLevel === "strong"
            || streetEvidence?.facadeConsistencyLevel === "good"
            || streetEvidence?.photoAnalysis?.photoReadability === "clear",
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

  const facciataData = result.immobileFacciata.data as import("@/types/report").ImmobileFacciataData | null;
  const contestoData = result.contestoVicinato.data as import("@/types/report").ContestoVicinatoData | null;
  const poiData = result.poiEnrichment.data as PoiEnrichmentData | null;
  const areaData = result.profiloArea.data as import("@/types/report").ProfiloAreaData | null;
  const rischioData = result.rischioZona.data as RischioZonaData | null;
  const istatData = result.istatDemographic.data as IstatDemographicData | null;
  const trendData = result.trendDemografico.data as TrendDemograficoData | null;
  const infraData = result.infrastrutture.data as InfrastrutureData | null;
  const prioritaData = result.prioritaCriticita.data as PrioritaCriticitaData | null;
  const fontiData = scanning ? null : buildTrasparenzaFonti(result);
  const hasPublishableTendine =
    isOmiPublishable(officialOmi.data)
    || isPricingPublishable(pricingData)
    || isReportFieldsPublishable(facciataData as unknown as Record<string, unknown>)
    || isReportFieldsPublishable(contestoData as unknown as Record<string, unknown>)
    || isPoiPublishable(poiData)
    || isReportFieldsPublishable(areaData as unknown as Record<string, unknown>)
    || isRischioPublishable(rischioData)
    || isDemographicsPublishable(istatData, trendData)
    || isInfraPublishable(infraData)
    || isPrioritaPublishable(prioritaData);

  const emptyScanNeedsAddress = shouldShowEmptyScanAddressPrompt(scanning, hasPublishableTendine)
    || !hasValidCoords;
  const showAddressForm = identifyDone || emptyScanNeedsAddress;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div data-capture-hide>
        <AppHeader rightContent={
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app")} aria-label="Indietro">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {scanning && <span className="text-[11px] text-primary font-medium animate-pulse">Elaborazione…</span>}
          </>
        } />
      </div>

      <PullToRefresh
        data-testid="result-scroll"
        onRefresh={handlePullRefresh}
        disabled={scanning || refining || capturing}
        className="overflow-y-auto"
      >
        <ReportCaptureOpenContext.Provider value={capturing}>
        <div
          ref={reportRootRef}
          data-testid="result-report-root"
          className="space-y-3 px-4 sm:px-5 pt-2"
          style={{ paddingBottom: RESULT_SAFE_BOTTOM_PAD }}
        >
          {/* Identify error gate rimosso: il pipeline civiko-property-from-photo
              gestisce autonomamente la qualità foto con fallback sicuro
              (WowPanel mostra qualita: "minima" quando necessario). */}

          <BuildingIdentityCard
            photo={state.photo}
            identify={identifyData}
            loading={result.identify.status === "loading"}
            lat={state.lat}
            lng={state.lng}
            lowConfidence={lowConfidence}
          />


          {!lowConfidence && !identifyFailed && (
            <SectionSafe><HouseDifferentiationCard diff={houseDiff} loading={scanning} /></SectionSafe>
          )}

          {/* ═══ HERO GEO-LEVEL BANNER — verità del dato immediata ═══ */}
          {identifyDone && !lowConfidence && !identifyFailed && (() => {
            const _pd = result.pricing.data as PricingData | null;
            const _istat = result.istatDemographic.data as import("@/types").IstatDemographicData | null;
            const geoStatus = resolveReportGeoStatus(
              _pd?.omiGeoLevel,
              _pd?.polygonMatch,
              _istat?.geoLevel,
            );
            const _omi = officialOmi.data ?? (result.omiZone.data as import("@/types").OmiZoneData | null);
            return (
              <GeoLevelHeroBanner
                status={geoStatus}
                zoneLabel={_omi?.zonaOmiLabel ?? _istat?.geoLabel ?? null}
                comuneLabel={_omi?.comuneLabel ?? _istat?.comuneLabel ?? identifyData?.address?.split(",").pop()?.trim() ?? null}
              />
            );
          })()}

          {/* ═══ WOW PANEL — Photo-first reveal experience ═══ */}
          <SectionSafe>
            <WowPanel
              data={result.photoWow?.data ?? null}
              status={result.photoWow?.status ?? "idle"}
              photo={state.photo}
              officialOmi={officialOmi}
            />
          </SectionSafe>

          {isPoiPublishable(poiData) && poiData && (
            <SectionSafe>
              <PoiWowStrip data={poiData} />
            </SectionSafe>
          )}

          {/* Address form: after identify, or when the finished scan has no tendine (iPhone GPS miss). */}
          {showAddressForm && !lowConfidence && !identifyFailed && (
            <AddressOverrideForm
              loading={refining}
              defaultOpen={emptyScanNeedsAddress}
              onSubmit={(addr: ManualAddressInput) => {
                const lat = isValidGps(state?.lat, state?.lng) ? state!.lat! : 0;
                const lng = isValidGps(state?.lat, state?.lng) ? state!.lng! : 0;
                refineAddress(addr, lat, lng, state?.photo);
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
              {/* ═══ ALWAYS OPEN — Profilo Rapido (specificità already leads, above zone WOW) ═══ */}
              <SectionSafe><ProfiloRapidoCard data={result.profiloRapido.data as import("@/types/report").ProfiloRapidoData | null} loading={result.profiloRapido.status === "loading"} /></SectionSafe>

              {/* Accordion tendine: title only when THIS scan has data for that section. */}

              {/* Zona OMI — open when zone prices exist */}
              <SectionSafe>
                <PublishableAccordionItem id="omi" title="Quotazioni OMI" icon={TrendingUp} defaultOpen
                  loading={isModuleLoading(officialOmi.status)} publishable={isOmiPublishable(officialOmi.data)}>
                  <OmiCard data={officialOmi.data} loading={isModuleLoading(officialOmi.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Prezzi di Mercato — open when prezzoMq exists */}
              <SectionSafe>
                <PublishableAccordionItem id="pricing" title="Prezzi di Mercato" icon={TrendingUp} defaultOpen
                  loading={isModuleLoading(result.pricing.status)} publishable={isPricingPublishable(pricingData)}
                  isWeak={!pricingData?.polygonMatch && (!pricingData?.omiGeoLevel || pricingData?.omiGeoLevel === "comune")}>
                  <PricingCard data={pricingData} loading={isModuleLoading(result.pricing.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Immobile e Facciata */}
              <SectionSafe>
                <PublishableAccordionItem id="facciata" title="Immobile e Facciata" icon={Eye} defaultOpen={false}
                  loading={isModuleLoading(result.immobileFacciata.status)} publishable={isReportFieldsPublishable(facciataData as unknown as Record<string, unknown>)}>
                  <ImmobileFacciataCard data={facciataData} loading={isModuleLoading(result.immobileFacciata.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Contesto e Vicinato */}
              <SectionSafe>
                <PublishableAccordionItem id="contesto" title="Contesto e Vicinato" icon={Compass} defaultOpen={false}
                  loading={isModuleLoading(result.contestoVicinato.status)}
                  publishable={isReportFieldsPublishable(contestoData as unknown as Record<string, unknown>)}>
                  <ContestoVicinatoCard data={contestoData} loading={isModuleLoading(result.contestoVicinato.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Servizi e POI */}
              <SectionSafe>
                <PublishableAccordionItem id="poi" title="Servizi e POI" icon={MapPin} defaultOpen={false}
                  loading={isModuleLoading(result.poiEnrichment.status)} publishable={isPoiPublishable(poiData)}>
                  <PoiEnrichmentCard data={poiData} loading={isModuleLoading(result.poiEnrichment.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Profilo Area */}
              <SectionSafe>
                <PublishableAccordionItem id="area" title="Profilo Area" icon={Layers} defaultOpen={false}
                  loading={isModuleLoading(result.profiloArea.status)} publishable={isReportFieldsPublishable(areaData as unknown as Record<string, unknown>)}>
                  <ProfiloAreaCard data={areaData} loading={isModuleLoading(result.profiloArea.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Rischio Zona */}
              <SectionSafe>
                <PublishableAccordionItem id="rischio" title="Rischio Zona" icon={AlertTriangle} defaultOpen={false}
                  loading={isModuleLoading(result.rischioZona.status)} publishable={isRischioPublishable(rischioData)}>
                  <RischioZonaCard data={rischioData} loading={isModuleLoading(result.rischioZona.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Dati Demografici */}
              <SectionSafe>
                <PublishableAccordionItem id="istat" title="Dati Demografici" icon={Users} defaultOpen={false}
                  loading={isModuleLoading(result.istatDemographic.status) || isModuleLoading(result.trendDemografico.status)}
                  publishable={isDemographicsPublishable(istatData, trendData)}>
                  <IstatCard
                    data={istatData}
                    omiZoneLabel={officialOmi.data?.zonaOmiLabel ?? officialOmi.data?.zonaOmi}
                    loading={isModuleLoading(result.istatDemographic.status)}
                  />
                  <TrendDemograficoCard data={trendData} loading={isModuleLoading(result.trendDemografico.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Infrastrutture e Sviluppo */}
              <SectionSafe>
                <PublishableAccordionItem id="infra" title="Infrastrutture" icon={Construction} defaultOpen={false}
                  loading={isModuleLoading(result.infrastrutture.status)}
                  publishable={isInfraPublishable(infraData)}>
                  <InfrastrutureCard data={infraData} loading={isModuleLoading(result.infrastrutture.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Sintesi Finale — always open */}
              <SectionSafe><SintesiFinaleCard data={result.sintesiFinale.data as import("@/types/report").SintesiFinaleData | null} loading={result.sintesiFinale.status === "loading"} /></SectionSafe>

              {/* Priorità / Criticità */}
              <SectionSafe>
                <PublishableAccordionItem id="priorita" title="Priorità e Criticità" icon={AlertTriangle} defaultOpen={false}
                  loading={isModuleLoading(result.prioritaCriticita.status)} publishable={isPrioritaPublishable(prioritaData)}>
                  <PrioritaCriticitaCard data={prioritaData} loading={isModuleLoading(result.prioritaCriticita.status)} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Trasparenza Fonti */}
              <SectionSafe>
                <PublishableAccordionItem id="fonti" title="Fonti e Metodologia" icon={ShieldCheck} defaultOpen={false}
                  loading={false} publishable={!scanning && isFontiPublishable(fontiData)}>
                  <TrasparenzaFontiCard data={fontiData} />
                </PublishableAccordionItem>
              </SectionSafe>

              {/* Discrete quality footer */}
              {!scanning && <ReportFooter excludedCount={excludedCount} totalPublished={publishedCount} />}
            </>
          )}
        </div>
        </ReportCaptureOpenContext.Provider>
      </PullToRefresh>

      <footer
        data-capture-hide
        data-testid="result-action-bar"
        className="shrink-0 border-t border-border/50 bg-background px-4 sm:px-5 pt-3 z-40"
        style={{
          paddingBottom: RESULT_SAFE_BOTTOM_PAD,
          paddingLeft: "max(env(safe-area-inset-left, 0px), 16px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 16px)",
        }}
      >
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 min-h-[48px] active:scale-[0.97] transition-transform"
            size="lg"
            onClick={() => void handleShare()}
            disabled={capturing || scanning}
          >
            <Share2 className="h-4 w-4" />
            {capturing ? "Preparazione…" : agencyPhone ? "Invia in agenzia" : "Condividi"}
          </Button>
          <Button
            variant="secondary"
            className="flex-1 min-h-[48px] active:scale-[0.97] transition-transform"
            size="lg"
            onClick={() => navigate("/scan")}
          >
            Nuova scansione
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0"
            aria-label="Salva in cronologia"
            disabled={!identifyData || lowConfidence || identifyFailed || scanning}
            onClick={async () => {
          if (!state) return;
          if (!identifyData) {
            toast({ title: "Report non salvabile", description: "L'identificazione dell'edificio non è ancora completa.", variant: "destructive" });
            return;
          }
          const convergenza = result.convergenzaTerritoriale.data as ConvergenzaTerritorialeData | null;
          const thumbnail = await compressToThumbnail(state.photo);
          const snapshot = serializeResult(result);
          const geo = resolveGeoContext(result);
          const primaryGeo = geo.geoLevel !== "non_determinato" ? geo.geoLevel : null;
          if (!historyIdRef.current) historyIdRef.current = crypto.randomUUID();
          saveScan(buildHistoryDraft({
            id: historyIdRef.current,
            photoThumbnail: thumbnail,
            resultSnapshot: snapshot,
            officialOmi: officialOmi.data,
            lat: state.lat,
            lng: state.lng,
            manualAddress: state.manualAddress,
            identifyAddress: identifyData.address ?? null,
            primaryGeoLevel: primaryGeo,
            convergenzaTerritoriale: convergenza ? {
              score: convergenza.score,
              band: convergenza.band,
            } : null,
          }));
          void saveLastScanPhoto({
            photo: state.photo,
            lat: state.lat,
            lng: state.lng,
            manualAddress: state.manualAddress,
            historyId: historyIdRef.current,
            ...(snapshot && isSavedResultSnapshot(snapshot) ? { savedResult: snapshot } : {}),
          });
          toast({ title: "Report salvato", description: "Trovi questo report nella cronologia." });
        }}><Bookmark className="h-4 w-4" /></Button>
        </div>
      </footer>

      <AgencyWhatsappDialog
        open={agencyDialogOpen}
        onOpenChange={setAgencyDialogOpen}
        saving={savingAgencyPhone}
        initialValue={agencyPhone}
        onSaved={async (e164) => {
          const saved = await saveAgencyPhone(e164);
          if (!saved) return;
          setAgencyDialogOpen(false);
          await sendToAgency(saved);
        }}
      />
    </div>
  );
};

export default Result;
