import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import AppHeader from "@/components/AppHeader";

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
  const { scans, clearAll } = useScanHistory();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <span className="text-base font-bold text-foreground flex-1">Le tue scansioni</span>
        {scans.length > 0 && (
          <button
            onClick={clearAll}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="px-5 pb-10 pt-2 space-y-3">
          {scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nessuna scansione ancora</p>
              <Button onClick={() => navigate("/scan")}>Scansiona un edificio</Button>
            </div>
          ) : (
            scans.map((scan) => (
              <button
                key={scan.id}
                onClick={() =>
                  navigate("/result", {
                    state: {
                      photo: scan.photo,
                      lat: scan.lat,
                      lng: scan.lng,
                      savedResult: scan.scanResult,
                    },
                  })
                }
                className="flex w-full items-center gap-3 rounded-xl bg-card border border-border p-3 text-left active:bg-secondary transition-colors"
              >
                <img
                  src={scan.photo}
                  alt={scan.address}
                  className="h-16 w-16 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground truncate">{scan.address}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(scan.date)}</p>
                </div>
                {scan.moodScore != null && (
                  <Badge variant={scoreVariant(scan.moodScore)} className="shrink-0 text-xs">
                    {scan.moodScore}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default History;
