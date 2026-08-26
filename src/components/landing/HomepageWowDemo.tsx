import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuildingIdentityCard } from "@/components/report/BuildingIdentityCard";
import { WowPanel } from "@/components/report/WowPanel";
import {
  DEMO_IDENTIFY,
  DEMO_OMI,
  DEMO_PHOTO_FACTS,
  emptyDemoWow,
} from "@/lib/homepageWowDemo";
import demoPadovaEst from "@/assets/demo-padova-est.jpg";

/**
 * Public WOW vetrina. One photo card, then official OMI.
 * Visual facts are what THIS facade shows. Labeled Esempio.
 * No invented civico, listings, whole-building sale, or successione.
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
            Una foto. Questo palazzo.
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sottra legge la facciata. OMI sotto è la microzona D8 Est di Padova,
          1° semestre 2025 — non il valore di questo interno, non una media
          comunale, non un dato catastale.
        </p>

        <BuildingIdentityCard
          photo={demoPadovaEst}
          identify={DEMO_IDENTIFY}
          esempio
          visualNotes={[DEMO_PHOTO_FACTS.materiale, ...DEMO_PHOTO_FACTS.strengths]}
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
