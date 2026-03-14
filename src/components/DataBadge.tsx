import { cn } from "@/lib/utils";

export type DataTier =
  | "ufficiale" | "geo_verificato" | "premium"
  | "mercato_verificato" | "mercato_parziale"
  | "elaborato" | "stima" | "non_disponibile";

const config: Record<DataTier, { label: string; className: string; desc: string }> = {
  ufficiale: {
    label: "Dato ufficiale",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    desc: "Fonte istituzionale verificata",
  },
  geo_verificato: {
    label: "Dato geo verificato",
    className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    desc: "Fonte geospaziale professionale verificata",
  },
  premium: {
    label: "Dato premium",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    desc: "Fonte premium esterna",
  },
  mercato_verificato: {
    label: "Mercato verificato",
    className: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    desc: "Fonte di mercato verificata",
  },
  mercato_parziale: {
    label: "Mercato parziale",
    className: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    desc: "Copertura di mercato parziale",
  },
  elaborato: {
    label: "Dato elaborato",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    desc: "Elaborazione da fonti verificate",
  },
  stima: {
    label: "Stima indicativa",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    desc: "Valore indicativo, non certificato",
  },
  non_disponibile: {
    label: "Non disponibile",
    className: "bg-stone-500/15 text-stone-400 border-stone-500/30",
    desc: "Dato non disponibile per questa zona",
  },
};

export function DataBadge({ tier, className }: { tier: DataTier; className?: string }) {
  const c = config[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
        c.className,
        className,
      )}
      title={c.desc}
    >
      {c.label}
    </span>
  );
}
