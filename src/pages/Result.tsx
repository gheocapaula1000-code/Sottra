import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Zap, TrendingUp, MapPin, Bookmark, ChevronRight, Rocket } from "lucide-react";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBuildingScan } from "@/hooks/useBuildingScan";

interface ResultState {
  photo: string;
  lat: number | null;
  lng: number | null;
  gpsError?: boolean;
}

/* ---------- helpers ---------- */
const fmt = (n: number) => n.toLocaleString("it-IT");
const fmtEur = (n: number) => `€ ${fmt(n)}`;

const energyColor: Record<string, string> = {
  A: "text-green-400 border-green-400/40",
  B: "text-green-300 border-green-300/40",
  C: "text-lime-300 border-lime-300/40",
  D: "text-yellow-300 border-yellow-300/40",
  E: "text-orange-300 border-orange-300/40",
  F: "text-orange-400 border-orange-400/40",
  G: "text-red-400 border-red-400/40",
};

const quadranteColor: Record<string, string> = {
  "Stella Nascente": "from-green-500/20 to-green-500/5 border-green-500/30",
  "Diamante Grezzo": "from-primary/20 to-primary/5 border-primary/30",
  "Picco Raggiunto": "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  "Allerta Rossa": "from-red-500/20 to-red-500/5 border-red-500/30",
};

function scoreColor(s: number) {
  if (s < 40) return "stroke-red-400";
  if (s <= 70) return "stroke-yellow-400";
  return "stroke-green-400";
}

/* ---------- section wrapper ---------- */
function Section({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  if (!visible) return null;
  return <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">{children}</div>;
}

function SectionSkeleton() {
  return (
    <div className="rounded-xl bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/* ---------- score arc ---------- */
function ScoreArc({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx="55" cy="55" r={r} fill="none" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className={`${scoreColor(score)} transition-all duration-1000`}
        />
      </svg>
      <span className="absolute text-2xl font-bold text-foreground">{score}</span>
    </div>
  );
}

/* ---------- mini bar ---------- */
function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label}</span>
        <span className="text-foreground font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/* ========== MAIN ========== */
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

  const s = (k: keyof typeof result) => result[k].status;
  const d = <T,>(k: keyof typeof result) => result[k].data as T | null;

  const identify = d<{ address: string; buildingId: string; confidence: number }>("identify");
  const cadastral = d<{ foglio: number; particella: number; subalterno: number; anno: number; piani: number; unitaImmobiliari: number; renditaCatastale: number }>("cadastral");
  const pricing = d<{ prezzoMq: number; prezzoMqMin: number; prezzoMqMax: number; mediaZona: number; trend5Anni: number }>("pricing");
  const listings = d<{ annunci: { tipo: string; prezzo: number; mq: number; locali: number; piano: number; link: string }[] }>("listings");
  const energy = d<{ classeEnergetica: string; epgl: number; mediaZona: string }>("energy");
  const mood = d<{ score: number; trend: string; categorie: Record<string, number> }>("moodScore");
  const timeView = d<{ previsione5Anni: number; previsione10Anni: number; previsione20Anni: number; progettiInArrivo: string[] }>("timeView");
  const opportunity = d<{ indice: number; quadrante: string; raccomandazione: string }>("opportunity");

  const isLoading = (k: keyof typeof result) => s(k) === "loading";
  const isOk = (k: keyof typeof result) => s(k) === "success" && result[k].data;

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

          {/* ── HEADER CARD ── */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <img src={state.photo} alt="Edificio" className="h-40 w-full object-cover" />
            <div className="p-4 space-y-2">
              {isLoading("identify") && <Skeleton className="h-5 w-3/4" />}
              {isOk("identify") && identify && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-foreground leading-tight">{identify.address}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">ID: {identify.buildingId}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {Math.round(identify.confidence * 100)}%
                    </Badge>
                  </div>
                  {state.lat != null && state.lng != null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {state.lat.toFixed(5)}, {state.lng.toFixed(5)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── CATASTALE ── */}
          {isLoading("cadastral") && <SectionSkeleton />}
          <Section visible={!!isOk("cadastral") && !!cadastral}>
            {cadastral && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Building2 className="h-4 w-4 text-primary" /> Dati Catastali
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Anno", cadastral.anno],
                    ["Piani", cadastral.piani],
                    ["Unità", cadastral.unitaImmobiliari],
                    ["Rendita", fmtEur(cadastral.renditaCatastale)],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">{l as string}</p>
                      <p className="text-sm font-bold text-foreground">{v as string | number}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Foglio {cadastral.foglio} · Particella {cadastral.particella} · Sub {cadastral.subalterno}
                </p>
              </div>
            )}
          </Section>

          {/* ── VALORE ── */}
          {isLoading("pricing") && <SectionSkeleton />}
          <Section visible={!!isOk("pricing") && !!pricing}>
            {pricing && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" /> Valore di Mercato
                </div>
                <div className="text-center space-y-1">
                  <p className="text-3xl font-extrabold text-foreground">{fmtEur(pricing.prezzoMq)}<span className="text-sm font-normal text-muted-foreground">/m²</span></p>
                  <p className="text-xs text-muted-foreground">Range {fmtEur(pricing.prezzoMqMin)} – {fmtEur(pricing.prezzoMqMax)}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Media zona</p>
                    <p className="text-sm font-bold text-foreground">{fmtEur(pricing.mediaZona)}/m²</p>
                  </div>
                  <Badge variant={pricing.prezzoMq >= pricing.mediaZona ? "default" : "destructive"} className="text-xs">
                    {pricing.prezzoMq >= pricing.mediaZona ? "Sopra media" : "Sotto media"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Trend 5 anni</span>
                  <span className={`text-sm font-bold ${pricing.trend5Anni >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pricing.trend5Anni >= 0 ? "+" : ""}{pricing.trend5Anni}%
                  </span>
                </div>
              </div>
            )}
          </Section>

          {/* ── ANNUNCI ── */}
          {isLoading("listings") && <SectionSkeleton />}
          <Section visible={!!isOk("listings") && !!listings}>
            {listings && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ChevronRight className="h-4 w-4 text-primary" /> Annunci Attivi
                </div>
                <div className="space-y-2">
                  {listings.annunci.map((a, i) => (
                    <a key={i} href={a.link} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 active:bg-secondary transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={a.tipo === "vendita" ? "default" : "secondary"} className="text-[10px] uppercase">
                            {a.tipo}
                          </Badge>
                          <span className="text-sm font-bold text-foreground">{fmtEur(a.prezzo)}{a.tipo === "affitto" && "/mese"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.mq} m² · {a.locali} locali · Piano {a.piano}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── ENERGIA ── */}
          {isLoading("energy") && <SectionSkeleton />}
          <Section visible={!!isOk("energy") && !!energy}>
            {energy && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-primary" /> Classe Energetica
                </div>
                <div className="flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 text-3xl font-black ${energyColor[energy.classeEnergetica] ?? "text-muted-foreground border-border"}`}>
                    {energy.classeEnergetica}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">EPgl: <span className="font-bold">{energy.epgl} kWh/m²</span></p>
                    <p className="text-xs text-muted-foreground">Media zona: classe {energy.mediaZona}</p>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* ── MOOD SCORE ── */}
          {isLoading("moodScore") && <SectionSkeleton />}
          <Section visible={!!isOk("moodScore") && !!mood}>
            {mood && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="text-primary text-base">☀</span> MoodScore
                </div>
                <div className="flex items-center gap-6">
                  <ScoreArc score={mood.score} />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <p className="text-sm font-semibold text-foreground capitalize">{mood.trend}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(mood.categorie).map(([k, v]) => (
                    <MiniBar key={k} label={k.replace(/([A-Z])/g, " $1")} value={v} />
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── PREVISIONE FUTURA ── */}
          {isLoading("timeView") && <SectionSkeleton />}
          <Section visible={!!isOk("timeView") && !!timeView}>
            {timeView && (
              <div className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" /> Previsione Futura
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["5 anni", timeView.previsione5Anni],
                    ["10 anni", timeView.previsione10Anni],
                    ["20 anni", timeView.previsione20Anni],
                  ].map(([label, val]) => (
                    <div key={label as string} className="rounded-lg bg-secondary/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label as string}</p>
                      <p className={`text-lg font-bold ${(val as number) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        +{val as number}%
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {timeView.progettiInArrivo.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Rocket className="h-3.5 w-3.5 text-primary shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── OPPORTUNITÀ ── */}
          {isLoading("opportunity") && <SectionSkeleton />}
          <Section visible={!!isOk("opportunity") && !!opportunity}>
            {opportunity && (
              <div className={`rounded-xl border p-4 space-y-2 bg-gradient-to-br ${quadranteColor[opportunity.quadrante] ?? "from-card to-card border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Indice Opportunità</p>
                  <span className="text-3xl font-black text-foreground">{opportunity.indice}</span>
                </div>
                <p className="text-base font-bold text-foreground">{opportunity.quadrante}</p>
                <p className="text-sm text-muted-foreground">{opportunity.raccomandazione}</p>
              </div>
            )}
          </Section>
        </div>
      </ScrollArea>

      {/* ── FOOTER ── */}
      <div className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-lg border-t border-border px-5 pb-[max(env(safe-area-inset-bottom,20px),20px)] pt-3 flex gap-3">
        <Button className="flex-1" size="lg" onClick={() => navigate("/scan")}>Scansiona un altro</Button>
        <Button variant="outline" size="lg" className="shrink-0" onClick={() => {}}>
          <Bookmark className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Result;
