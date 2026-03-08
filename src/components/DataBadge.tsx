import { cn } from "@/lib/utils";

export type DataTier = "ufficiale" | "elaborato" | "stima" | "demo";

const config: Record<DataTier, { label: string; className: string; desc: string }> = {
  ufficiale: {
    label: "Dato ufficiale",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    desc: "Fonte istituzionale verificata",
  },
  elaborato: {
    label: "Dato elaborato",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    desc: "Elaborazione da fonti pubbliche",
  },
  stima: {
    label: "Stima indicativa",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    desc: "Valore indicativo, non certificato",
  },
  demo: {
    label: "Contenuto dimostrativo",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    desc: "Esempio a scopo illustrativo",
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
