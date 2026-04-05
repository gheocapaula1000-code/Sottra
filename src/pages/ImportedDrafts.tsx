import { useState, useEffect } from "react";
import { Inbox } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportDraftCard } from "@/components/keydraft/ImportDraftCard";
import { fetchImports } from "@/services/keydraftImport";
import type { KeyDraftImportRecord } from "@/types/keydraft";

export default function ImportedDrafts() {
  const [records, setRecords] = useState<KeyDraftImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchImports()
      .then(setRecords)
      .catch((e) => setError(e.message ?? "Errore imprevisto"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-background pb-safe">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Bozze importate</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Schede ricevute dal bridge KeyDraft, pronte per la lavorazione in agenzia.
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <Inbox className="h-6 w-6 text-muted-foreground/50" />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground">Nessuna bozza importata</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Le schede inviate da KeyDraft tramite il bridge appariranno qui, pronte per essere completate e lavorate in agenzia.
            </p>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="space-y-3">
            {records.map((r) => (
              <ImportDraftCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
