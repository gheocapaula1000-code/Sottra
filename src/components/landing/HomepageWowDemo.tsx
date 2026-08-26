import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuildingIdentityCard } from "@/components/report/BuildingIdentityCard";
import { WowPanel } from "@/components/report/WowPanel";
import {
  DEMO_IDENTIFY,
  DEMO_OMI,
  emptyDemoWow,
} from "@/lib/homepageWowDemo";
import demoPadovaEst from "@/assets/demo-padova-est.jpg";

/**
 * Public WOW vetrina. Photo: real Padova street facade (Via San Francesco /
 * Santa Sofia, Falk2, CC BY-SA 4.0). No faces, no plates, not a private civico.
 * OMI numbers remain official D8 Est 1400–1850, labeled Esempio.
 * The photo is not that microzona and is not this-civico.
 */
export default function HomepageWowDemo() {
  const navigate = useNavigate();
  const wow = emptyDemoWow();

  return (
    <section
      id="wow-esempio"
      data-testid="homepage-wow-demo"
      className="px-5 py-10 sm:px-10 lg:px-20"
    >
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Esempio · senza registrazione
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            Cosa vedi dopo una foto
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Report di esempio su Padova, microzona OMI D8 Est. Le quotazioni sono
          quelle ufficiali del 1° semestre 2025. Non è il catastale, non è una
          media comunale. La foto è una palazzina padovana di esempio, non questo civico.
        </p>

        <BuildingIdentityCard
          photo={demoPadovaEst}
          identify={DEMO_IDENTIFY}
          esempio
        />

        <WowPanel
          data={wow}
          photo={demoPadovaEst}
          status="success"
          officialOmi={{ status: "success", data: DEMO_OMI }}
        />

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          Foto di esempio: palazzina a Padova (Falk2, CC BY-SA 4.0). Non è il civico scansionato.
        </p>

        <Button
          size="lg"
          className="w-full gap-2 min-h-[48px]"
          onClick={() => navigate("/signup")}
        >
          Prova gratis 3 giorni
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
