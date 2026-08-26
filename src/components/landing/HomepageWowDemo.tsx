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
import heroProperty from "@/assets/hero-property.jpg";

/**
 * Public, no-auth WOW vetrina. A visitor sees a real-looking D8 Est report
 * without hitting /scan → /login. Numbers are the official civile NORMALE
 * 1400–1850 from Paula's Padova D8 scan, labeled Esempio.
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
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Esempio · senza registrazione
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Cosa vedi dopo una foto
            </h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Report di esempio su Padova, microzona OMI D8 Est. Le quotazioni sono
          quelle ufficiali del 1° semestre 2025. Non è il catastale, non è una
          media comunale.
        </p>

        <BuildingIdentityCard
          photo={heroProperty}
          identify={DEMO_IDENTIFY}
          esempio
        />

        <WowPanel
          data={wow}
          photo={heroProperty}
          status="success"
          officialOmi={{ status: "success", data: DEMO_OMI }}
        />

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
