/**
 * ReportAccordion — Mobile-first collapsible report sections.
 *
 * Wraps report content in accordion items with clear section headers.
 * Weak/fallback sections start closed; strong sections start open.
 *
 * Empty modules must be gated on data BEFORE this component mounts
 * (see PublishableAccordionItem / shouldRenderAccordion). Do not probe the DOM.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { shouldRenderAccordion } from "@/lib/reportSectionPublishable";

/** When true, publishable tendine expand for a full-report capture. Empty ones stay unmounted. */
export const ReportCaptureOpenContext = React.createContext(false);

interface ReportAccordionItemProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  /** Badge text shown beside the title */
  badge?: string | null;
  /** Whether this section should start expanded */
  defaultOpen?: boolean;
  /** If true, section has weak/fallback data — muted styling */
  isWeak?: boolean;
  children: React.ReactNode;
}

/** True when children are statically empty (null, false, whitespace, empty fragment). */
export function isEmptyAccordionChildren(children: React.ReactNode): boolean {
  const nodes = React.Children.toArray(children);
  if (nodes.length === 0) return true;
  return nodes.every((node) => {
    if (typeof node === "string") return node.trim().length === 0;
    if (React.isValidElement(node) && node.type === React.Fragment) {
      return isEmptyAccordionChildren((node.props as { children?: React.ReactNode }).children);
    }
    return false;
  });
}

/**
 * Tendina gated on this scan's data: publishable → title; empty → nothing.
 * Not a permanent hide-list — the same section can appear on the next scan.
 * Loading may keep the title visible; an empty finished module unmounts it.
 */
export function PublishableAccordionItem({
  loading = false,
  publishable,
  children,
  ...props
}: ReportAccordionItemProps & { loading?: boolean; publishable: boolean }) {
  if (!shouldRenderAccordion(loading, publishable)) return null;
  return <ReportAccordionItem {...props}>{children}</ReportAccordionItem>;
}

export function ReportAccordionItem({
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  isWeak = false,
  children,
}: ReportAccordionItemProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const captureOpen = React.useContext(ReportCaptureOpenContext);
  const shown = captureOpen || open;

  if (isEmptyAccordionChildren(children)) return null;

  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-card overflow-hidden transition-all",
      isWeak && "opacity-80",
    )}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={shown}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
          <span className="font-semibold text-foreground text-sm tracking-tight truncate">{title}</span>
          {badge && (
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
              {badge}
            </span>
          )}
          {isWeak && (
            <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 shrink-0">
              Comunale
            </span>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          shown && "rotate-180",
        )} />
      </button>
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          shown ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="px-5 pb-5 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Hero Geo-Level Banner ────────────────────────────── */

export type ReportGeoStatus = "zona_reale" | "microzona_omi" | "sub_comunale" | "fallback_comunale" | "elaborato" | "unavailable";

interface GeoLevelHeroBannerProps {
  status: ReportGeoStatus;
  zoneLabel?: string | null;
  comuneLabel?: string | null;
}

const geoStatusConfig: Record<ReportGeoStatus, {
  label: string;
  sublabel: string;
  containerClass: string;
  dotClass: string;
}> = {
  zona_reale: {
    label: "Dato di zona",
    sublabel: "Il report è basato sulla zona reale identificata",
    containerClass: "bg-emerald-500/10 border-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  microzona_omi: {
    label: "Microzona OMI",
    sublabel: "Il report è basato sulla microzona OMI identificata da coordinate",
    containerClass: "bg-emerald-500/10 border-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  sub_comunale: {
    label: "Dato sub-comunale",
    sublabel: "Il report è basato su dati sub-comunali verificati",
    containerClass: "bg-sky-500/10 border-sky-500/25",
    dotClass: "bg-sky-500",
  },
  fallback_comunale: {
    label: "Fallback comunale",
    sublabel: "I dati principali si riferiscono al comune — la zona specifica potrebbe variare",
    containerClass: "bg-amber-500/10 border-amber-500/25",
    dotClass: "bg-amber-500",
  },
  elaborato: {
    label: "Dato elaborato",
    sublabel: "Il report si basa su elaborazioni — precisione ridotta",
    containerClass: "bg-stone-500/10 border-stone-500/25",
    dotClass: "bg-stone-400",
  },
  unavailable: {
    label: "Dato non disponibile",
    sublabel: "Dati territoriali insufficienti per questa posizione",
    containerClass: "bg-stone-500/10 border-stone-500/25",
    dotClass: "bg-stone-400",
  },
};

export function GeoLevelHeroBanner({ status, zoneLabel, comuneLabel }: GeoLevelHeroBannerProps) {
  const cfg = geoStatusConfig[status];

  return (
    <div className={cn(
      "rounded-2xl border px-4 py-3 flex items-start gap-3",
      cfg.containerClass,
    )}>
      <div className={cn("mt-1.5 h-3 w-3 rounded-full shrink-0 animate-pulse", cfg.dotClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground tracking-tight">{cfg.label}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
          {cfg.sublabel}
          {zoneLabel && status !== "fallback_comunale" && status !== "unavailable" && (
            <span className="font-medium text-foreground"> · {zoneLabel}</span>
          )}
          {comuneLabel && status === "fallback_comunale" && (
            <span className="font-medium text-foreground"> · {comuneLabel}</span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Resolve the overall report geo status from scan result data */
export function resolveReportGeoStatus(
  omiGeoLevel?: string | null,
  polygonMatch?: boolean | null,
  istatGeoLevel?: string | null,
): ReportGeoStatus {
  // OMI microzona with polygon match = strongest
  if (omiGeoLevel === "microzona_omi" || (polygonMatch && omiGeoLevel !== "comune")) {
    return "microzona_omi";
  }
  // Zona specifica / quartiere
  if (omiGeoLevel === "zona_specifica" || omiGeoLevel === "quartiere") {
    return "zona_reale";
  }
  // Sub-comunale from ISTAT
  if (istatGeoLevel === "microzona" || istatGeoLevel === "quartiere" || istatGeoLevel === "zona") {
    return "sub_comunale";
  }
  // Comune level = fallback
  if (omiGeoLevel === "comune" || !omiGeoLevel) {
    return "fallback_comunale";
  }
  return "elaborato";
}
