import { cn } from "@/lib/utils";
import type { ImportDraftStatus } from "@/types/keydraft";

const statusConfig: Record<ImportDraftStatus, { label: string; className: string }> = {
  importata: {
    label: "Importata da KeyDraft",
    className: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  in_lavorazione: {
    label: "In lavorazione",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  completata: {
    label: "Completata",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  archiviata: {
    label: "Archiviata",
    className: "bg-stone-500/15 text-stone-400 border-stone-500/30",
  },
};

export function ImportStatusBadge({
  status,
  className,
}: {
  status: ImportDraftStatus;
  className?: string;
}) {
  const c = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-tight",
        c.className,
        className,
      )}
    >
      {c.label}
    </span>
  );
}
