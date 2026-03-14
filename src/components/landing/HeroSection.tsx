import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, ShieldCheck, CreditCard, CalendarOff, ScanLine, Clock } from "lucide-react";
import SottraMark from "@/components/SottraMark";
import logoS from "@/assets/logo-s-icon.png";

const trustItems = [
  { icon: Clock, text: "3 giorni gratis" },
  { icon: ScanLine, text: "5 scansioni incluse" },
  { icon: CreditCard, text: "Zero carta, zero dati bancari" },
  { icon: CalendarOff, text: "Nessuna disdetta" },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-svh flex flex-col overflow-hidden px-5 pt-[env(safe-area-inset-top,0px)] sm:px-10 lg:px-20">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[660px] rounded-full bg-primary/8 blur-[140px]" />

      {/* Nav */}
      <nav className="relative mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center py-5">
        <SottraMark size="md" textOnly className="justify-self-start" />
        <LandingCenterLogo />
        <div className="flex items-center justify-end gap-2 sm:gap-3">
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
      <div className="relative mx-auto flex flex-1 max-w-3xl flex-col items-center justify-center text-center pb-24">
        <span className="mb-5 inline-block rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Piattaforma per professionisti immobiliari
        </span>

        <h1 className="text-[2.5rem] leading-[1.05] font-black tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Una foto.
          <br />
          <span className="text-primary">Molto di più.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-[18rem] text-base leading-relaxed text-muted-foreground sm:mt-6 sm:max-w-md sm:text-lg" style={{ textWrap: "balance" as any }}>
          Da un solo scatto,{" "}
          <strong className="text-foreground">il contesto che conta.</strong>
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
          <Button
            size="lg"
            className="w-full gap-2 text-base sm:w-auto min-h-[48px]"
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

        {/* Trust strip */}
        <div className="mt-8 w-full max-w-lg">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
            {trustItems.map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 sm:flex-col sm:gap-1 sm:px-2 sm:py-3 sm:text-center"
              >
                <item.icon className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground sm:text-xs font-medium">
            Nessuna carta di credito né dato bancario richiesti per iniziare · Paghi solo se scegli di continuare
          </p>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </section>
  );
}

function LandingCenterLogo() {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={logoS}
      alt="Sottra logo"
      className="h-12 w-12 sm:h-14 sm:w-14 object-contain justify-self-center"
      fetchPriority="high"
      onError={() => setOk(false)}
    />
  );
}