/**
 * This-building WOW — photo + civico + photoAnalysis.
 * Distinguishes THIS facade from the one next door.
 * Zone data (OMI / ISTAT / POI) is identical for adjacent civici;
 * these fields are not. Never labeled DATO UFFICIALE.
 * If a photo exists, it is always shown — never a blank skeleton slot.
 */

import type { ReactNode } from "react";
import { Building2, CheckCircle2, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidImageDataUrl } from "@/lib/imageUtils";
import type { IdentifyResult, PhotoAnalysis, StreetEvidence } from "@/types";

export function hasDisplayablePhoto(photo: unknown): photo is string {
  if (typeof photo !== "string") return false;
  const t = photo.trim();
  if (t.length === 0) return false;
  if (isValidImageDataUrl(t)) return true;
  // Imported assets / http(s) URLs used by the public demo
  if (t.startsWith("data:")) return false;
  return t.startsWith("/") || t.startsWith("http://") || t.startsWith("https://") || t.startsWith("blob:");
}

export function facadeConsistencyLabel(level: StreetEvidence["facadeConsistencyLevel"] | undefined): string | null {
  switch (level) {
    case "strong": return "Facciata coerente";
    case "good": return "Buona coerenza di facciata";
    case "partial": return "Coerenza parziale";
    case "weak": return "Coerenza debole";
    case "none": return "Coerenza non valutabile";
    default: return null;
  }
}

export function photoReadabilityLabel(level: PhotoAnalysis["photoReadability"] | undefined): string | null {
  switch (level) {
    case "clear": return "Foto chiara";
    case "partial": return "Foto parzialmente leggibile";
    case "poor": return "Foto poco leggibile";
    default: return null;
  }
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
      className ?? "bg-muted/60 border-border/50 text-foreground",
    )}>
      {children}
    </span>
  );
}

export interface BuildingIdentityCardProps {
  photo: string;
  identify: IdentifyResult | null;
  loading?: boolean;
  lat?: number | null;
  lng?: number | null;
  lowConfidence?: boolean;
  /** Public homepage esempio chrome */
  esempio?: boolean;
  /** Extra photo reads (intonaco, persiane). Never invented market data. */
  visualNotes?: string[] | null;
  className?: string;
}

export function BuildingIdentityCard({
  photo,
  identify,
  loading = false,
  lat = null,
  lng = null,
  lowConfidence = false,
  esempio = false,
  visualNotes = null,
  className,
}: BuildingIdentityCardProps) {
  const showPhoto = hasDisplayablePhoto(photo);
  const street = identify?.streetEvidence;
  const analysis = street?.photoAnalysis;
  const facade = facadeConsistencyLabel(street?.facadeConsistencyLevel);
  const readability = photoReadabilityLabel(analysis?.photoReadability);
  const floors = typeof analysis?.visibleFloors === "number" && Number.isFinite(analysis.visibleFloors)
    ? analysis.visibleFloors
    : null;
  const buildingType = analysis?.buildingType?.trim() || null;
  const address = identify?.address?.trim() || null;
  const notes = (visualNotes ?? []).map((s) => s.trim()).filter(Boolean);

  return (
    <div
      data-testid="building-identity"
      className={cn(
        "rounded-2xl border border-border/60 bg-card overflow-hidden min-w-0",
        className,
      )}
    >
      <div className="relative">
        {showPhoto ? (
          <img
            src={photo}
            alt="Edificio acquisito"
            className="w-full aspect-[16/10] object-cover"
          />
        ) : (
          <div
            data-testid="building-identity-empty-photo"
            className="w-full aspect-[16/10] bg-muted flex items-center justify-center text-xs text-muted-foreground"
          >
            Nessuna foto
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent pointer-events-none" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {esempio ? (
            <Chip className="bg-amber-500/90 border-amber-300/40 text-black font-semibold uppercase tracking-wider">
              Esempio
            </Chip>
          ) : (
            <Chip className="bg-black/70 border-white/15 text-white">Questo edificio</Chip>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 -mt-8 relative z-10 space-y-3">
        {esempio ? (
          <h2 className="text-lg font-bold leading-snug text-foreground">
            {buildingType ?? "Questa facciata"}
          </h2>
        ) : address ? (
          <h2 className={cn(
            "text-lg font-bold leading-snug break-anywhere",
            lowConfidence ? "text-foreground/60" : "text-foreground",
          )}>
            {address}
          </h2>
        ) : loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Riconoscimento civico…</p>
        ) : (
          <p className="text-sm text-muted-foreground">Indirizzo in elaborazione</p>
        )}

        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {esempio
            ? "Letto dalla foto — non un dato catastale"
            : "Identità di questo civico — da foto e posizione, non un dato catastale"}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {!esempio && !lowConfidence && address && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />Civico distinto dal vicino
            </span>
          )}
          {lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <MapPin className="h-3 w-3" />{lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
          )}
        </div>

        {notes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {notes.map((n) => (
              <span
                key={n}
                className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground"
              >
                {n}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm font-medium text-foreground leading-snug">
          In venti secondi, su questo palazzo: c'è un appartamento in vendita,
          stanno vendendo lo stabile, è una successione.
        </p>

        {!esempio && (buildingType || floors != null || facade || readability) && (
          <div className="grid grid-cols-2 gap-2">
            {buildingType && (
              <div className="rounded-lg bg-muted/40 border border-border/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />Tipo (da foto)
                </p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{buildingType}</p>
              </div>
            )}
            {floors != null && (
              <div className="rounded-lg bg-muted/40 border border-border/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3 w-3" />Piani visibili
                </p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{floors}</p>
              </div>
            )}
            {facade && (
              <div className="rounded-lg bg-muted/40 border border-border/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coerenza facciata</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{facade}</p>
              </div>
            )}
            {readability && (
              <div className="rounded-lg bg-muted/40 border border-border/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leggibilità foto</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{readability}</p>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          {esempio
            ? "OMI sotto è di microzona, non di questo interno."
            : "OMI, ISTAT e POI a 800 m sono di zona: identici per il civico accanto. Qui distinguiamo questo edificio."}
        </p>
      </div>
    </div>
  );
}
