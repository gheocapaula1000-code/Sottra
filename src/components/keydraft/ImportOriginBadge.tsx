import { cn } from "@/lib/utils";
import type { KeyDraftDataOrigin } from "@/types/keydraft";

const originConfig: Record<KeyDraftDataOrigin, { label: string; className: string; desc: string }> = {
  photo_derived: {
    label: "Rilevato da foto",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    desc: "Dato rilevato automaticamente dall'analisi fotografica",
  },
  agent_supplied: {
    label: "Inserito dall'agente",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    desc: "Dato inserito manualmente dall'agente in KeyDraft",
  },
  generated_text: {
    label: "Testo generato",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    desc: "Contenuto testuale generato automaticamente",
  },
  completed_in_sottra: {
    label: "Completato in Sottra",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    desc: "Dato aggiunto o confermato in Sottra dall'agenzia",
  },
  bridge_metadata: {
    label: "Metadato sistema",
    className: "bg-stone-500/15 text-stone-400 border-stone-500/30",
    desc: "Informazione tecnica di sistema",
  },
};

export function ImportOriginBadge({
  origin,
  className,
}: {
  origin: KeyDraftDataOrigin;
  className?: string;
}) {
  const c = originConfig[origin];
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
