import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark } from "lucide-react";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBuildingScan } from "@/hooks/useBuildingScan";
import HeaderCard from "@/components/result/HeaderCard";
import CadastralCard from "@/components/result/CadastralCard";
import PricingCard from "@/components/result/PricingCard";
import ListingsCard from "@/components/result/ListingsCard";
import EnergyCard from "@/components/result/EnergyCard";
import MoodScoreCard from "@/components/result/MoodScoreCard";
import TimeViewCard from "@/components/result/TimeViewCard";
import OpportunityCard from "@/components/result/OpportunityCard";
import type {
  IdentifyResult, CadastralData, PricingData, ListingsData,
  EnergyData, MoodScoreData, TimeViewData, OpportunityData, ScanResult,
} from "@/types";

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
  const { result, scanning, scan } = useBuildingScan();
  const { saveScan } = useScanHistory();
  const { toast } = useToast();
  const started = useRef(false);

  useEffect(() => {
    if (!state?.photo || started.current) return;
    started.current = true;
    scan(state.photo, state.lat ?? 0, state.lng ?? 0);
  }, [state, scan]);

  if (!state?.photo) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted-foreground">Nessuna immagine disponibile.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/scan")}>Vai alla scansione</Button>
      </div>
    );
  }

  const s = (k: keyof ScanResult) => result[k].status;
  const d = <T,>(k: keyof ScanResult) => result[k].data as T | null;

  const identify = d<IdentifyResult>("identify");
  const mood = d<MoodScoreData>("moodScore");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button onClick={() => navigate("/scan")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <span className="text-base font-bold text-foreground flex-1">Risultato</span>
        {scanning && <span className="text-xs text-muted-foreground animate-pulse">Analisi…</span>}
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-3 px-5 pb-32 pt-2">
          <HeaderCard photo={state.photo} identify={identify} loading={s("identify") === "loading"} lat={state.lat} lng={state.lng} />
          <CadastralCard data={d<CadastralData>("cadastral")} loading={s("cadastral") === "loading"} />
          <PricingCard data={d<PricingData>("pricing")} loading={s("pricing") === "loading"} />
          <ListingsCard data={d<ListingsData>("listings")} loading={s("listings") === "loading"} />
          <EnergyCard data={d<EnergyData>("energy")} loading={s("energy") === "loading"} />
          <MoodScoreCard data={d<MoodScoreData>("moodScore")} loading={s("moodScore") === "loading"} />
          <TimeViewCard data={d<TimeViewData>("timeView")} loading={s("timeView") === "loading"} />
          <OpportunityCard data={d<OpportunityData>("opportunity")} loading={s("opportunity") === "loading"} />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-lg border-t border-border px-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] pt-3 flex gap-3">
        <Button className="flex-1" size="lg" onClick={() => navigate("/scan")}>Scansiona un altro</Button>
        <Button variant="outline" size="lg" className="shrink-0" onClick={() => {
          if (!state) return;
          saveScan({
            photo: state.photo,
            address: identify?.address ?? "Indirizzo sconosciuto",
            lat: state.lat ?? null,
            lng: state.lng ?? null,
            moodScore: mood?.score ?? null,
            scanResult: result,
          });
          toast({ title: "Scansione salvata", description: "Trovi questa scansione nella cronologia." });
        }}>
          <Bookmark className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Result;
