/**
 * Photo-first WOW on THIS facade.
 * Show only what the photo (and GPS address) actually gave.
 * Hide empty sale / inheritance / piano rows — never invent them.
 */

import { cn } from "@/lib/utils";

export interface CivicoSignalsCardProps {
  esempio?: boolean;
  viaCivico?: string | null;
  buildingType?: string | null;
  visibleFloors?: number | null;
  pianoStimato?: string | null;
  materiale?: string | null;
  strengths?: string[] | null;
  className?: string;
}

function fact(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function CivicoSignalsCard({
  esempio = false,
  viaCivico = null,
  buildingType = null,
  visibleFloors = null,
  pianoStimato = null,
  materiale = null,
  strengths = null,
  className,
}: CivicoSignalsCardProps) {
  const type = fact(buildingType);
  const material = fact(materiale);
  const piano = fact(pianoStimato);
  const address = !esempio ? fact(viaCivico) : null;
  const extra = (strengths ?? []).map((s) => fact(s)).filter((s): s is string => !!s);
  const floors =
    typeof visibleFloors === "number" && Number.isFinite(visibleFloors) && visibleFloors > 0
      ? `${visibleFloors} piani visibili`
      : null;

  const chips = [
    material,
    floors,
    ...extra.filter((s) => s !== type && s !== material),
  ].filter((s): s is string => !!s);

  const hasVisual = !!(type || chips.length > 0 || piano);
  if (!esempio && !hasVisual && !address) return null;

  return (
    <div
      data-testid="civico-signals"
      className={cn("rounded-2xl border border-border/60 bg-card overflow-hidden min-w-0", className)}
    >
      <div className="px-5 pt-4 pb-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          {esempio ? "Esempio · dalla foto" : "Dalla foto"}
        </p>
        <h3 className="text-2xl font-black tracking-tight text-foreground leading-none">
          {type ?? (esempio ? "Palazzina" : "Questa facciata")}
        </h3>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {piano && (
          <p className="text-sm font-semibold text-foreground">
            Piano letto dalla foto: {piano}
          </p>
        )}
        {address && (
          <p className="text-sm font-semibold text-foreground">{address}</p>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {esempio
            ? "Letto da questa facciata. Via e civico escono dalla scansione vera, non li inventiamo."
            : "Solo ciò che la foto e la posizione hanno dato su questo civico. Gli annunci di zona non sono questo palazzo."}
        </p>

      </div>
    </div>
  );
}
