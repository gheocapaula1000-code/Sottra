import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Camera, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportStatusBadge } from "./ImportStatusBadge";
import type { KeyDraftImportRecord } from "@/types/keydraft";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ImportDraftCard({ record }: { record: KeyDraftImportRecord }) {
  const navigate = useNavigate();
  const payload = record.bridge_payload;
  const property = payload.property;
  const agent = payload.agent_supplied;

  const address = agent?.address ?? "Indirizzo da completare";
  const propertyType = property?.property_type ?? null;
  const rooms = property?.rooms_estimated ?? null;
  const photoCount = property?.photo_count ?? 0;
  const hasTexts = !!(payload.generated_text?.primary_listing_text);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {record.listing_id} · {formatDate(record.created_at)}
            </p>
          </div>
        </div>
        <ImportStatusBadge status={record.status} />
      </div>

      {/* Quick info */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {propertyType && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5">
            {propertyType}
          </span>
        )}
        {rooms != null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5">
            {rooms} {rooms === 1 ? "locale" : "locali"}
          </span>
        )}
        {photoCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5">
            <Camera className="h-3 w-3" /> {photoCount} foto
          </span>
        )}
        {agent?.agent_notes_freeform && (
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 text-violet-400 px-2 py-0.5">
            <User className="h-3 w-3" /> Note agente
          </span>
        )}
        {hasTexts && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-400 px-2 py-0.5">
            <FileText className="h-3 w-3" /> Testi pronti
          </span>
        )}
      </div>

      {/* Action */}
      <Button
        variant="outline"
        size="sm"
        className="w-full min-h-[44px] gap-2"
        onClick={() => navigate(`/app/imports/${record.id}`)}
      >
        Apri bozza
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
