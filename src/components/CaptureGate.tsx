import { useEffect, useState } from "react";
import { MapPin, Crosshair, Hash, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GEO_GATE_PROMPT_OPTIONS,
  GeoRequestError,
  STANDALONE_LOCATION_ASK_HINT,
  isStandaloneDisplay,
  isValidGeoPosition,
  requestGeolocation,
  type GeoPosition,
  type GeoRequestErrorCode,
} from "@/lib/requestGeolocation";

type GeoStatus = "idle" | "granted" | "failed" | "unavailable";

export type CaptureGateContinue = {
  position: GeoPosition | null;
  errorCode?: GeoRequestErrorCode | null;
};

interface CaptureGateProps {
  onContinue: (result: CaptureGateContinue) => void;
}

export default function CaptureGate({ onContinue }: CaptureGateProps) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [locating, setLocating] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [grantedPos, setGrantedPos] = useState<GeoPosition | null>(null);
  const [errorCode, setErrorCode] = useState<GeoRequestErrorCode | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }

    // Permissions API is advisory only. On iOS Safari / Home Screen PWA it often
    // reports "denied" before the user was asked — never lock Continua on it.
    if (!navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((perm) => {
        if (perm.state === "granted") setGeoStatus("granted");

        perm.addEventListener("change", () => {
          if (perm.state === "granted") setGeoStatus("granted");
        });
      })
      .catch(() => {
        // permissions.query is unsupported or throws for geolocation — ignore.
      });
  }, []);

  const applySuccess = (pos: GeoPosition) => {
    setGrantedPos(pos);
    setGeoStatus("granted");
    setErrorCode(null);
    return pos;
  };

  const applyFailure = (err: unknown) => {
    const code = err instanceof GeoRequestError ? err.code : navigator.geolocation ? "position_unavailable" : "unavailable";
    setErrorCode(code);
    setGeoStatus((prev) => (prev === "granted" ? prev : navigator.geolocation ? "failed" : "unavailable"));
    return code;
  };

  const handleUseMyLocation = () => {
    if (locating || continuing) return;
    setLocating(true);
    void requestGeolocation(GEO_GATE_PROMPT_OPTIONS)
      .then(applySuccess)
      .catch(applyFailure)
      .finally(() => {
        setLocating(false);
      });
  };

  const handleContinue = async () => {
    if (locating || continuing) return;
    setContinuing(true);
    try {
      // Stay on the gate until getCurrentPosition settles so iOS can show the prompt
      // before getUserMedia hides it. Then pass granted coords into Scan.
      const pos = await requestGeolocation(GEO_GATE_PROMPT_OPTIONS);
      applySuccess(pos);
      onContinue({ position: pos, errorCode: null });
    } catch (err) {
      const code = applyFailure(err);
      onContinue({
        position: isValidGeoPosition(grantedPos) ? grantedPos : null,
        errorCode: code,
      });
    }
  };

  const geoFailed = geoStatus === "failed" || geoStatus === "unavailable";
  const showStandaloneHint = standalone && (geoFailed || errorCode === "standalone_watchdog");
  const busy = locating || continuing;

  const checks: { icon: React.ReactNode; label: string; sublabel: string; status: "ok" | "warn" | "neutral" }[] = [
    {
      icon: <MapPin className="h-5 w-5" />,
      label: "Geolocalizzazione attiva",
      sublabel: geoStatus === "granted"
        ? "Posizione disponibile"
        : geoFailed
          ? "Puoi continuare e inserire l'indirizzo"
          : "Tocca Continua o Usa la mia posizione. Puoi anche inserire l'indirizzo.",
      status: geoStatus === "granted" ? "ok" : geoFailed ? "warn" : "neutral",
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

        {/* CTA — never locked by Permissions API denied/prompt */}
        <Button
          onClick={() => { void handleContinue(); }}
          size="lg"
          disabled={busy}
          className="w-full min-h-[52px] text-base font-semibold"
        >
          {continuing ? "Richiesta posizione…" : "Continua allo scatto"}
          {!continuing && <ChevronRight className="h-5 w-5 ml-1" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={handleUseMyLocation}
          disabled={busy}
          className="w-full mt-2 min-h-[44px] text-sm font-medium"
        >
          {locating ? "Richiesta posizione…" : "Usa la mia posizione"}
        </Button>

        {geoFailed && (
          <p className="text-xs text-muted-foreground/70 text-center mt-3 leading-relaxed">
            Posizione non disponibile. Puoi continuare e inserire l'indirizzo.
          </p>
        )}
        {showStandaloneHint && (
          <p className="text-xs text-muted-foreground/80 text-center mt-2 leading-relaxed">
            {STANDALONE_LOCATION_ASK_HINT}
          </p>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1 min-h-[40px]" />
    </div>
  );
}
