import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultState {
  photo: string;
  lat: number | null;
  lng: number | null;
  gpsError?: boolean;
}

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultState | null;

  if (!state?.photo) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>
          Vai alla scansione
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button onClick={() => navigate("/scan")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <span className="text-base font-bold text-foreground">Risultato</span>
      </header>

      {/* Preview image */}
      <div className="mx-5 mt-3 overflow-hidden rounded-xl border border-border">
        <img src={state.photo} alt="Edificio scansionato" className="h-48 w-full object-cover sm:h-64" />
      </div>

      {/* Analysis loading */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground">Analisi in corso…</p>
          <p className="text-sm text-muted-foreground">Stiamo esaminando ciò che sta sotto.</p>
        </div>
      </div>

      {/* GPS info */}
      <div className="px-5 pb-3">
        {state.gpsError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Posizione GPS non disponibile
          </div>
        )}

        {state.lat != null && state.lng != null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {state.lat.toFixed(5)}, {state.lng.toFixed(5)}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="px-5 pb-[max(env(safe-area-inset-bottom,20px),20px)]">
        <Button className="w-full" size="lg" onClick={() => navigate("/scan")}>
          Scansiona un altro
        </Button>
      </div>
    </div>
  );
};

export default Result;
