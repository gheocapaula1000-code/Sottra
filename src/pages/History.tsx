import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2, Camera, MapPin, AlertTriangle, Cloud } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

interface CloudScan {
  id: string;
  address: string | null;
  comune: string | null;
  lat: number | null;
  lng: number | null;
  zona_omi: string | null;
  created_at: string;
  result_snapshot: unknown;
  photo_thumbnail: string | null;
}

function scoreVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 60) return "default";
  if (score >= 40) return "secondary";
  return "destructive";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

const History = () => {
  const navigate = useNavigate();
  const { scans, clearAll, removeScan } = useScanHistory();

  const handleOpenScan = (scan: typeof scans[number]) => {
    // If the scan is restorable and has a photo + coordinates, reopen the real report
    if (scan.restorable && scan.resultSnapshot && scan.photoThumbnail && scan.lat != null && scan.lng != null) {
      navigate("/result", {
        state: {
          photo: scan.photoThumbnail,
          lat: scan.lat,
          lng: scan.lng,
          savedResult: scan.resultSnapshot,
        },
      });
    }
    // Otherwise, show that the result is not restorable — don't fake a redirect
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Indietro">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {scans.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearAll} aria-label="Cancella tutto">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </>
      } />

      <ScrollArea className="flex-1">
        <div className="px-5 pb-10 pb-safe pt-4 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Cronologia</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scans.length === 0
                ? "Le tue scansioni appariranno qui."
                : `${scans.length} ${scans.length === 1 ? "scansione" : "scansioni"} effettuate`}
            </p>
          </div>
          {scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nessuna scansione effettuata</p>
                <p className="text-xs text-muted-foreground mt-1">Le tue analisi appariranno qui dopo la prima scansione.</p>
              </div>
              <Button onClick={() => navigate("/scan")} className="min-h-[48px]">Avvia la prima scansione</Button>
            </div>
          ) : (
            scans.map((scan) => (
              <div key={scan.id} className="relative">
                <button
                  onClick={() => handleOpenScan(scan)}
                  disabled={!scan.restorable}
                  className="flex w-full items-center gap-3 rounded-xl bg-card border border-border p-3 text-left active:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail or placeholder */}
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {scan.photoThumbnail ? (
                      <img src={scan.photoThumbnail} alt="" className="h-full w-full object-cover rounded-lg" />
                    ) : (
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground truncate">{scan.locality || "Posizione non disponibile"}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(scan.date)}</p>
                      {scan.primaryGeoLevel && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                          scan.primaryGeoLevel === "zona_omi" || scan.primaryGeoLevel === "microzona_omi"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : scan.primaryGeoLevel === "comune"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}>
                          {scan.primaryGeoLevel === "zona_omi" ? "Zona OMI" :
                           scan.primaryGeoLevel === "microzona_omi" ? "Microzona" :
                           scan.primaryGeoLevel === "comune" ? "Comunale" :
                           scan.primaryGeoLevel}
                        </span>
                      )}
                    </div>
                    {!scan.restorable && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        <span>Risultato non più ricostruibile</span>
                      </div>
                    )}
                  </div>
                  {scan.convergenzaTerritoriale?.score != null && (
                    <Badge variant={scoreVariant(scan.convergenzaTerritoriale.score)} className="shrink-0 text-xs">
                      {scan.convergenzaTerritoriale.score}
                    </Badge>
                  )}
                </button>
                {/* Remove single scan */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeScan(scan.id); }}
                  className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Rimuovi scansione"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default History;
