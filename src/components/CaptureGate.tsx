import { useEffect, useState } from "react";
import { MapPin, Crosshair, Hash, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GeoStatus = "checking" | "granted" | "denied" | "unavailable";

interface CaptureGateProps {
  onContinue: () => void;
}

export default function CaptureGate({ onContinue }: CaptureGateProps) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("checking");

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }

    // Check permissions API if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((perm) => {
        if (perm.state === "granted") setGeoStatus("granted");
        else if (perm.state === "denied") setGeoStatus("denied");
        else setGeoStatus("checking"); // prompt — we'll show as neutral

        perm.addEventListener("change", () => {
          if (perm.state === "granted") setGeoStatus("granted");
          else if (perm.state === "denied") setGeoStatus("denied");
          else setGeoStatus("checking");
        });
      }).catch(() => {
        // permissions API not supported for geolocation on this browser
        setGeoStatus("checking");
      });
    } else {
      setGeoStatus("checking");
    }
  }, []);

  const _geoOk = geoStatus === "granted" || geoStatus === "checking";
  const geoDenied = geoStatus === "denied" || geoStatus === "unavailable";

  const checks: { icon: React.ReactNode; label: string; sublabel: string; status: "ok" | "warn" | "neutral" }[] = [
    {
      icon: <MapPin className="h-5 w-5" />,
      label: "Geolocalizzazione attiva",
      sublabel: geoDenied
        ? "Attivala nelle impostazioni del browser"
        : geoStatus === "granted"
          ? "Posizione disponibile"
          : "Verrà richiesta al momento dello scatto",
      status: geoStatus === "granted" ? "ok" : geoDenied ? "warn" : "neutral",
    },
    {
      icon: <Crosshair className="h-5 w-5" />,
      label: "Massima precisione disponibile",
      sublabel: "Attiva il GPS ad alta precisione sul dispositivo",
      status: "neutral",
    },
    {
      icon: <Hash className="h-5 w-5" />,
      label: "Civico visibile, se possibile",
      sublabel: "Aiuta l'inquadramento. Non è una verifica catastale.",
      status: "neutral",
    },
  ];

  return (
    <div className="fixed-safe flex flex-col bg-background overflow-y-auto">
      {/* Top spacer */}
      <div className="flex-1 min-h-[60px]" />

      {/* Content */}
      <div className="flex flex-col items-center px-6 max-w-sm mx-auto w-full">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
          <MapPin className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2 text-center">
          Prima di iniziare
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
          Per un'analisi accurata, verifica questi elementi
        </p>

        {/* Checklist */}
        <div className="w-full space-y-3 mb-10">
          {checks.map((c, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3.5 rounded-xl border p-4 transition-colors",
                c.status === "ok" && "border-emerald-500/30 bg-emerald-500/5",
                c.status === "warn" && "border-destructive/30 bg-destructive/5",
                c.status === "neutral" && "border-border bg-card",
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                c.status === "ok" && "bg-emerald-500/15 text-emerald-400",
                c.status === "warn" && "bg-destructive/15 text-destructive",
                c.status === "neutral" && "bg-muted text-muted-foreground",
              )}>
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.sublabel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          onClick={onContinue}
          disabled={geoDenied}
          size="lg"
          className="w-full min-h-[52px] text-base font-semibold"
        >
          {geoDenied ? (
            <>Attiva la geolocalizzazione per continuare</>
          ) : (
            <>
              Continua allo scatto
              <ChevronRight className="h-5 w-5 ml-1" />
            </>
          )}
        </Button>

        {geoDenied && (
          <p className="text-xs text-muted-foreground/70 text-center mt-3 leading-relaxed">
            Vai nelle impostazioni del browser, consenti la posizione per questo sito e ricarica la pagina.
          </p>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1 min-h-[40px]" />
    </div>
  );
}
