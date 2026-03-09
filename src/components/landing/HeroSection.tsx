import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import logoS from "@/assets/logo-s-icon.png";

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-svh flex flex-col overflow-hidden px-5 pt-[env(safe-area-inset-top,0px)] sm:px-10 lg:px-20">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[660px] rounded-full bg-primary/8 blur-[140px]" />

      {/* Nav */}
      <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between py-5">
        <div className="flex items-center gap-0">
          <img
            src={logoS}
            alt="Sottra"
            className="h-8 w-auto sm:h-9"
            style={{ mixBlendMode: "lighten" }}
            fetchPriority="high"
          />
          <span className="ml-[-0.35rem] text-[1.35rem] sm:text-2xl font-black text-foreground tracking-tight leading-none">
            ottra
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate("/login")}>
            Accedi
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() =>
              document
                .getElementById("pricing")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Piani e prezzi
          </Button>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative mx-auto flex flex-1 max-w-3xl flex-col items-center justify-center text-center pb-20">
        <span className="mb-5 inline-block rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Piattaforma per professionisti immobiliari
        </span>

        <h1 className="text-[2.5rem] leading-[1.05] font-black tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Una foto.
          <br />
          <span className="text-primary">Molto di più.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:mt-6 sm:max-w-lg sm:text-lg">
          Prezzo, rischio, demografia, dinamica territoriale, scenario e
          infrastrutture.{" "}
          <strong className="text-foreground">
            Da un solo scatto, il quadro completo.
          </strong>
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
          <Button
            size="lg"
            className="w-full gap-2 text-base sm:w-auto"
            onClick={() => navigate("/signup")}
          >
            Prova gratis 3 giorni
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              document
                .getElementById("value")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Scopri cosa ottieni
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Nessuna carta di credito · 5 scansioni incluse
        </p>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </section>
  );
}
