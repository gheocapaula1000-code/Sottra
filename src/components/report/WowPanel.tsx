/**
 * WOW Panel — Commercial Report Top Section
 *
 * Three visual tiers:
 *  Tier 1 (3s)  — zona, valore mq, attenzione, specificità, limite
 *  Tier 2 (15s) — affidabilità, costi ristr., segnali, outlook micro-riga
 *  Tier 3       — detail sections below (handled by parent)
 *
 * No engine changes. Presentation only.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Zap, Wrench, TrendingUp,
  MapPin, Eye, ShieldCheck, ArrowUpRight,
} from "lucide-react";
import type { WowSnapshot, AttentionSignal, SpecificityLabel } from "@/lib/sottraWowSnapshot";
import { attentionSignalLabel, attentionSignalColor } from "@/lib/sottraWowSnapshot";

/* ── Attention badge ─────────────────────────────────── */

const attentionBg: Record<AttentionSignal, string> = {
  high: "bg-emerald-500/15 border-emerald-500/30",
  medium: "bg-primary/15 border-primary/30",
  low: "bg-amber-500/15 border-amber-500/30",
  insufficient: "bg-muted border-border",
};

function AttentionBadge({ signal }: { signal: AttentionSignal }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold leading-tight",
      attentionBg[signal],
      attentionSignalColor(signal),
    )}>
      {signal === "high" && <ArrowUpRight className="h-3 w-3" />}
      {attentionSignalLabel(signal)}
    </span>
  );
}

/* ── Specificity badge ───────────────────────────────── */

const specBg: Record<SpecificityLabel, string> = {
  Alta: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  Media: "bg-primary/15 border-primary/30 text-primary",
  Bassa: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  "Non sufficiente": "bg-muted border-border text-muted-foreground",
};

function SpecificityBadge({ label }: { label: SpecificityLabel }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold leading-tight",
      specBg[label],
    )}>
      <Eye className="h-3 w-3" />{label}
    </span>
  );
}

/* ── Micro status chip ───────────────────────────────── */

function StatusChip({ label, value, variant }: { label: string; value: string; variant: "positive" | "neutral" | "warning" | "muted" }) {
  const cls = variant === "positive" ? "text-emerald-400"
    : variant === "warning" ? "text-amber-400"
    : variant === "neutral" ? "text-primary"
    : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between text-[11px] gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={cn("font-semibold whitespace-nowrap", cls)}>{value}</span>
    </div>
  );
}

/* ── Fallback weight helpers ─────────────────────────── */

function fallbackLabel(snapshot: WowSnapshot): { text: string; variant: "positive" | "neutral" | "warning" | "muted" } {
  const aff = snapshot.affidabilita_valore;
  if (aff === "Alta") return { text: "Basso", variant: "positive" };
  if (aff === "Media") return { text: "Medio", variant: "neutral" };
  if (aff === "Bassa") return { text: "Alto", variant: "warning" };
  return { text: "Non det.", variant: "muted" };
}

/* ── Exported panel ──────────────────────────────────── */

export interface WowPanelProps {
  snapshot: WowSnapshot | null;
  loading: boolean;
  /** Optional outlook micro-summary */
  outlookLabel?: string | null;
  outlookVariant?: "positive" | "neutral" | "warning" | "muted";
  /** Optional alignment label (photo+geo+address) */
  alignmentLabel?: string | null;
  alignmentVariant?: "positive" | "neutral" | "warning" | "muted";
  /** Optional boundary label */
  boundaryLabel?: string | null;
  boundaryVariant?: "positive" | "neutral" | "warning" | "muted";
}

export function WowPanel({
  snapshot, loading,
  outlookLabel, outlookVariant = "muted",
  alignmentLabel, alignmentVariant = "muted",
  boundaryLabel, boundaryVariant = "muted",
}: WowPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 animate-pulse">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
      </div>
    );
  }
  if (!snapshot || snapshot.narrative_mode === "hidden") return null;

  const isPartial = snapshot.narrative_mode === "partial";
  const fb = fallbackLabel(snapshot);

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">

      {/* ═══ TIER 1 — Colpo d'occhio (3 seconds) ═══ */}
      <div className="px-5 pt-5 pb-4">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">Snapshot Immediato</span>
          {isPartial && <Badge variant="secondary" className="text-[9px] py-0">Parziale</Badge>}
        </div>

        {/* Zona reale */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
          <span className="text-xs text-muted-foreground">Zona:</span>
          <span className="text-sm font-bold text-foreground truncate">{snapshot.zona_reale}</span>
        </div>

        {/* Valore + badges row */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          {snapshot.valore_al_mq ? (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Valore al m²</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground leading-none">{snapshot.valore_al_mq}</span>
              {snapshot.valore_range && (
                <span className="text-[10px] text-muted-foreground block mt-0.5">{snapshot.valore_range}</span>
              )}
            </div>
          ) : (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Valore al m²</span>
              <span className="text-sm text-muted-foreground">Non disponibile</span>
            </div>
          )}
          <div className="flex flex-col items-end gap-1.5">
            <AttentionBadge signal={snapshot.attenzione_area} />
            {snapshot.specificita_immobile && <SpecificityBadge label={snapshot.specificita_immobile} />}
          </div>
        </div>

        {/* Limite principale — ALWAYS visible */}
        <div className="flex items-start gap-1.5 mt-3 rounded-lg bg-background/40 border border-border/30 px-3 py-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/70" />
          <span className="text-[10px] text-muted-foreground leading-relaxed">{snapshot.limite_principale}</span>
        </div>
      </div>

      {/* ═══ TIER 2 — Decisione iniziale (15 seconds) ═══ */}
      <div className="border-t border-border/30 bg-background/20 px-5 py-4 space-y-3">

        {/* Costi ristrutturazione + Affidabilità row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background/60 border border-border/40 p-3">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Affidabilità</span>
            <p className="text-sm font-bold text-foreground mt-0.5">{snapshot.affidabilita_valore}</p>
          </div>
          {snapshot.costo_ristrutturazione ? (
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Wrench className="h-3 w-3" />Ristr.</span>
              <p className="text-sm font-bold text-foreground mt-0.5">{snapshot.costo_ristrutturazione}</p>
              {snapshot.costo_range && <p className="text-[10px] text-muted-foreground mt-0.5">{snapshot.costo_range}</p>}
            </div>
          ) : (
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Wrench className="h-3 w-3" />Ristr.</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Non stimabile</p>
            </div>
          )}
        </div>

        {/* Segnali zona */}
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary/50 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Segnali zona:</span>
          <span className="text-[11px] font-semibold text-foreground">{snapshot.segnali_zona}</span>
        </div>

        {/* ── Micro-riga contestuale ── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-background/40 border border-border/30 px-3 py-2">
          <StatusChip label="Fallback" value={fb.text} variant={fb.variant} />
          {outlookLabel && <StatusChip label="Outlook" value={outlookLabel} variant={outlookVariant} />}
          {boundaryLabel && <StatusChip label="Confini" value={boundaryLabel} variant={boundaryVariant} />}
          {alignmentLabel && <StatusChip label="Allineamento" value={alignmentLabel} variant={alignmentVariant} />}
        </div>

        <p className="text-[9px] text-muted-foreground/30">Snapshot orientativo — non sostituisce una valutazione professionale</p>
      </div>
    </div>
  );
}
