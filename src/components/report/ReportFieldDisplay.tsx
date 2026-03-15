/**
 * Atomic UI primitives for rendering ReportField values.
 * Used across all report section components.
 */

import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { ReportField, ReportSourceType, AvailabilityStatus } from "@/types/report";

/* ── Source type micro-badge ─────────────────────────────── */

const sourceStyles: Record<ReportSourceType, string> = {
  image_detected: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  visual_estimate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  territorial_verified: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  official_data: "bg-green-500/15 text-green-400 border-green-500/30",
  market_data: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  forecast_scenario: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  unavailable: "bg-stone-500/15 text-stone-400 border-stone-500/30",
};

const sourceLabels: Record<ReportSourceType, string> = {
  image_detected: "Da immagine",
  visual_estimate: "Stima visiva",
  territorial_verified: "Verificato",
  official_data: "Ufficiale",
  market_data: "Mercato",
  forecast_scenario: "Scenario",
  unavailable: "N/D",
};

export function SourceMicroBadge({ sourceType, className }: { sourceType: ReportSourceType; className?: string }) {
  if (sourceType === "unavailable") return null;
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1 py-px text-[9px] font-medium leading-tight",
      sourceStyles[sourceType],
      className,
    )}>
      {sourceLabels[sourceType]}
    </span>
  );
}

/* ── Single field tile ───────────────────────────────────── */

interface FieldTileProps {
  field: ReportField | null | undefined;
  className?: string;
  /** Override the display value */
  formatValue?: (value: unknown) => string;
  /** Show source micro-badge */
  showSource?: boolean;
}

function defaultFormat(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (typeof value === "number") return value.toLocaleString("it-IT");
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function FieldTile({ field, className, formatValue, showSource = false }: FieldTileProps) {
  if (!field || field.availabilityStatus === "unavailable") return null;

  const isFallback = field.availabilityStatus === "fallback";
  const isPartial = field.availabilityStatus === "partial";
  const isNotDeterminable = field.availabilityStatus === "not_determinable";
  const displayValue = (formatValue ?? defaultFormat)(field.value);

  if (isNotDeterminable) return null;

  return (
    <div className={cn("rounded-lg bg-muted/40 px-3 py-2", className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</span>
      <p className={cn(
        "font-semibold text-sm mt-0.5 break-anywhere",
        isFallback ? "text-foreground/70" : "text-foreground",
      )}>
        {displayValue}
      </p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {showSource && <SourceMicroBadge sourceType={field.sourceType} />}
        {isFallback && (
          <span className="text-[9px] text-amber-400/70 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" />Approssimazione
          </span>
        )}
        {isPartial && (
          <span className="text-[9px] text-sky-400/70 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" />Dato parziale
          </span>
        )}
        {field.note && (
          <span className="text-[9px] text-muted-foreground/50">{field.note}</span>
        )}
      </div>
    </div>
  );
}

/* ── Field grid — auto-hides empty fields ────────────────── */

interface FieldGridProps {
  fields: (ReportField | null | undefined)[];
  className?: string;
  showSource?: boolean;
  cols?: 1 | 2 | 3;
}

export function FieldGrid({ fields, className, showSource = false, cols = 2 }: FieldGridProps) {
  const renderable = fields.filter(
    (f) => f != null && f.availabilityStatus !== "unavailable" && f.availabilityStatus !== "not_determinable"
  );
  if (renderable.length === 0) return null;

  const gridCols = cols === 3 ? "grid-cols-2 sm:grid-cols-3" : cols === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={cn("grid gap-2", gridCols, className)}>
      {renderable.map((field, i) => (
        <FieldTile key={i} field={field} showSource={showSource} />
      ))}
    </div>
  );
}

/* ── Availability status label ───────────────────────────── */

const statusColors: Record<AvailabilityStatus, string> = {
  available: "text-emerald-400",
  partial: "text-sky-400",
  unavailable: "text-stone-400",
  not_determinable: "text-stone-400",
  fallback: "text-amber-400",
};

const statusLabels: Record<AvailabilityStatus, string> = {
  available: "Disponibile",
  partial: "Parziale",
  unavailable: "Non disponibile",
  not_determinable: "Non determinabile",
  fallback: "Approssimazione",
};

export function AvailabilityLabel({ status, className }: { status: AvailabilityStatus; className?: string }) {
  return (
    <span className={cn("text-[10px] font-medium", statusColors[status], className)}>
      {statusLabels[status]}
    </span>
  );
}
