/**
 * WowPanel — Photo-first reveal experience
 *
 * Receives the PhotoWowResponse from the Central Core orchestrator and the
 * captured photo (DataURL), and progressively reveals the full territorial
 * intelligence with a high-impact, mobile-first UX.
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MapPin, Zap, FileText, Brain, Target,
  CheckCircle2, AlertTriangle, ExternalLink, TrendingUp,
} from "lucide-react";
import type { PhotoWowResponse, PhotoWowLiveSignal } from "@/types/photoWow";
import type { OmiZoneData, SectionStatus } from "@/types";

/* ── helpers ─────────────────────────────────────────── */

function scoreColor(v: number): { text: string; border: string; ring: string } {
  if (v >= 70) return { text: "text-emerald-400", border: "border-emerald-500/40", ring: "ring-emerald-500/40" };
  if (v >= 40) return { text: "text-amber-400", border: "border-amber-500/40", ring: "ring-amber-500/40" };
  return { text: "text-rose-400", border: "border-rose-500/40", ring: "ring-rose-500/40" };
}

function sentimentColor(level: string | null | undefined): string {
  const k = (level ?? "").toLowerCase();
  if (k.includes("alt")) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (k.includes("med")) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (k.includes("bas")) return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  return "bg-white/10 text-white/70 border-white/20";
}

const SIGNAL_STYLE: Record<string, { bg: string; label: string }> = {
  asta: { bg: "bg-rose-500/90 text-white", label: "ASTA" },
  alienazione: { bg: "bg-orange-500/90 text-white", label: "ALIENAZIONE" },
  bando: { bg: "bg-blue-500/90 text-white", label: "BANDO" },
  lavori_pubblici: { bg: "bg-violet-500/90 text-white", label: "LAVORI" },
  delibera: { bg: "bg-slate-500/90 text-white", label: "DELIBERA" },
  rigenerazione: { bg: "bg-emerald-500/90 text-white", label: "RIGENERAZIONE" },
};

function signalStyle(tipo: string): { bg: string; label: string } {
  const k = (tipo ?? "").toLowerCase().replace(/\s+/g, "_");
  return SIGNAL_STYLE[k] ?? { bg: "bg-white/15 text-white", label: tipo?.toUpperCase() ?? "SEGNALE" };
}

/* ── animated counter ────────────────────────────────── */

function useCountUp(target: number, durationMs: number, start: boolean): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start]);
  return v;
}

/* ── score card ──────────────────────────────────────── */

function ScoreCard({ label, value, delay, start }: { label: string; value: number | null | undefined; delay: number; start: boolean }) {
  const available = typeof value === "number" && Number.isFinite(value);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!start) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [start, delay]);
  const c = available ? scoreColor(value) : { text: "text-white/45", border: "border-white/15", ring: "ring-white/10" };
  const animated = useCountUp(available ? value : 0, 1200, shown && available);
  return (
    <div className={cn(
      "min-w-[180px] flex-1 rounded-2xl border bg-gradient-to-br from-black/60 to-black/30 p-4 backdrop-blur-md transition-all duration-500",
      c.border,
      shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
    )}>
      <p className="text-[11px] uppercase tracking-widest text-white/60">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        {available ? (
          <>
            <span className={cn("text-4xl font-black tabular-nums", c.text)}>{animated}</span>
            <span className="text-sm text-white/40">/100</span>
          </>
        ) : (
          <span className="text-2xl font-semibold text-white/40">—</span>
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-[width] duration-[1200ms] ease-out", c.text.replace("text-", "bg-"))}
          style={{ width: shown && available ? `${value}%` : "0%" }}
        />
      </div>
      {!available && (
        <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">Non disponibile</p>
      )}
    </div>
  );
}

/* ── phase reveal hook ───────────────────────────────── */

function useReveal(delayMs: number, enabled: boolean): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!enabled) { setV(false); return; }
    const t = setTimeout(() => setV(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, enabled]);
  return v;
}

/* ── section wrapper ─────────────────────────────────── */

function Reveal({ show, slide = "up", className, children }: {
  show: boolean;
  slide?: "up" | "right" | "none";
  className?: string;
  children: React.ReactNode;
}) {
  const hiddenT = slide === "up" ? "translate-y-10" : slide === "right" ? "translate-x-8" : "";
  return (
    <div className={cn(
      "transition-all duration-700 ease-out",
      show ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${hiddenT}`,
      className,
    )}>
      {children}
    </div>
  );
}

/* ── main component ──────────────────────────────────── */

export interface OfficialOmiOverlay {
  status?: SectionStatus;
  data?: OmiZoneData | null;
}

export interface WowPanelProps {
  data: PhotoWowResponse | null | undefined;
  photo: string;
  /** Pipeline status from useBuildingScan (defaults to "loading" if omitted). */
  status?: "idle" | "loading" | "success" | "error";
  /** Official Sottra OMI lookup — replaces Civiko zone numbers when present. */
  officialOmi?: OfficialOmiOverlay;
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function WowPanel({ data, photo, status = "loading", officialOmi }: WowPanelProps) {
  const omi = officialOmi?.data ?? null;
  const omiStatus = officialOmi?.status ?? "idle";
  const hasOfficialOmi = !!(
    omi &&
    omi.sourceType !== "unavailable" &&
    (omi.quotazioneMinResidenziale != null || omi.quotazioneMaxResidenziale != null || omi.zonaOmiLabel)
  );

  // Safety timeout: exit loading after 20s even if no data arrived
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (status !== "loading" || data) return;
    const t = setTimeout(() => setTimedOut(true), 20_000);
    return () => clearTimeout(t);
  }, [status, data]);

  // Show panel as soon as data exists OR pipeline is no longer in-flight OR timeout fired
  const ready = !!data || status !== "loading" || timedOut;
  const partial = ready && !data;

  // Phase reveal timings (relative to data arrival)
  const p2 = useReveal(50, ready);
  const p3 = useReveal(50 + 800, ready);
  const p4 = useReveal(50 + 800 + 600, ready);
  const p5 = useReveal(50 + 800 + 600 + 500, ready);
  const p6 = useReveal(50 + 800 + 600 + 500 + 400, ready);
  const p7 = useReveal(50 + 800 + 600 + 500 + 400 + 400, ready);
  const p8 = useReveal(50 + 800 + 600 + 500 + 400 + 400 + 400, ready);
  const p9 = useReveal(50 + 800 + 600 + 500 + 400 + 400 + 400 + 300, ready);

  const venScore = typeof data?.scores?.vendibilita === "number" ? data.scores.vendibilita : null;
  const venCol = useMemo(() => scoreColor(venScore ?? 0), [venScore]);
  const zoneTitle = data?.zona?.nomeComune
    ?? omi?.comuneLabel
    ?? data?.zona?.nomeZonaOmi
    ?? omi?.zonaOmiLabel
    ?? "—";
  const zoneOmiLine = [data?.zona?.nomeZonaOmi ?? omi?.zonaOmiLabel, data?.zona?.classificazioneZona]
    .filter((x, i, arr) => !!x && arr.indexOf(x) === i && x !== zoneTitle)
    .join(" · ");

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
      {/* PHASE 0 — Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${photo})`,
          filter: "blur(24px) brightness(0.35)",
          transform: "scale(1.08)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" aria-hidden />

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 py-6 space-y-6 text-white">

        {/* PHASE 1 — Loading (only while pipeline is actually fetching) */}
        {!ready && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <p className="text-lg font-medium tracking-wide">
              Analisi zona in corso<span className="inline-block w-6 text-left animate-pulse">...</span>
            </p>
            <div className="relative w-56 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 w-1/3 rounded-full bg-white/70 animate-[wow-indeterminate_1.4s_ease-in-out_infinite]" />
            </div>
            <style>{`@keyframes wow-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}`}</style>
          </div>
        )}

        {/* Partial / fallback banner — shown when ready but data missing */}
        {partial && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Anteprima visiva non disponibile. Il report ufficiale (OMI / ISTAT) si compila sotto se la zona è coperta.</span>
          </div>
        )}

        {/* Official OMI strip — shown as soon as Sottra pro-sources resolve */}
        {(omiStatus === "loading" || hasOfficialOmi || omiStatus === "error") && (
          <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-5 py-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-sky-200/80 font-semibold">
              Dato ufficiale OMI
            </p>
            {omiStatus === "loading" && !hasOfficialOmi && (
              <p className="text-sm text-white/80">Lettura quotazioni ufficiali…</p>
            )}
            {hasOfficialOmi && (
              <>
                <p className="text-2xl font-black tracking-tight">
                  {fmtEur(omi?.quotazioneMinResidenziale)} – {fmtEur(omi?.quotazioneMaxResidenziale)}
                  <span className="ml-1 text-sm font-semibold text-white/60">/m²</span>
                </p>
                <p className="text-sm text-white/75">
                  {[omi?.zonaOmiLabel, omi?.comuneLabel, omi?.semestre].filter(Boolean).join(" · ")}
                </p>
                {!omi?.polygonMatch && (
                  <p className="text-[11px] text-amber-200/90">
                    Riferimento di zona o comunale — non è il valore del singolo immobile.
                  </p>
                )}
              </>
            )}
            {omiStatus === "error" && !hasOfficialOmi && (
              <p className="text-sm text-white/75">Quotazione OMI ufficiale non disponibile per questa zona.</p>
            )}
          </div>
        )}


        {ready && data && (
          <>
            {/* Quality banner */}
            {data.qualita === "minima" && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Dati parziali — geolocalizzazione o foto non ottimale.</span>
              </div>
            )}

            {/* PHASE 2 — Zona identified */}
            <Reveal show={p2}>
              <div className="rounded-2xl border border-white/30 bg-black/80 backdrop-blur-md px-5 py-5 space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50">
                  <MapPin className="h-3.5 w-3.5" />Zona (da foto e posizione)
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  {zoneTitle}{data.zona?.provincia ? ` · ${data.zona.provincia}` : ""}
                </h2>
                {zoneOmiLine && (
                  <p className="text-sm text-white/70">{zoneOmiLine}</p>
                )}
                {data.zona?.livelloSentiment && (
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold mt-1",
                    sentimentColor(data.zona.livelloSentiment),
                  )}>
                    Sentiment: {data.zona.livelloSentiment}
                  </span>
                )}
              </div>
            </Reveal>

            {/* PHASE 3 — Map */}
            {data.mappaCaloreUrl && (
              <Reveal show={p3}>
                <div className="relative overflow-hidden rounded-xl border border-white/15">
                  <img src={data.mappaCaloreUrl} alt="Mappa di calore zona" className="w-full h-auto object-cover" loading="lazy" />
                  <div className={cn(
                    "absolute top-3 right-3 flex flex-col items-center justify-center h-16 w-16 rounded-full bg-black/80 border-2",
                    venCol.border,
                  )}>
                    <span className={cn("text-2xl font-black leading-none tabular-nums", venCol.text)}>{venScore ?? "—"}</span>
                    <span className="text-[8px] uppercase tracking-wider text-white/60 mt-0.5">vendib.</span>
                  </div>
                </div>
              </Reveal>
            )}

            {/* PHASE 4 — Scores (elaborated, never official) */}
            <Reveal show={p4}>
              <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">
                Stime elaborate — non sono quotazioni OMI
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                <div className="snap-start flex-1 min-w-[180px]">
                  <ScoreCard label="Vendibilità" value={data.scores?.vendibilita} delay={0} start={p4} />
                </div>
                <div className="snap-start flex-1 min-w-[180px]">
                  <ScoreCard label="Opportunità" value={data.scores?.opportunitaInvestimento} delay={120} start={p4} />
                </div>
                <div className="snap-start flex-1 min-w-[180px]">
                  <ScoreCard label="Pressione ereditaria" value={data.scores?.pressioneEreditaria} delay={240} start={p4} />
                </div>
              </div>
            </Reveal>

            {/* PHASE 5 — Live signals */}
            {data.liveSignals && data.liveSignals.length > 0 && (
              <Reveal show={p5}>
                <div className="space-y-2.5">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide">
                    <Zap className="h-4 w-4 text-amber-300" />Segnali attivi nella zona
                  </h3>
                  <div className="space-y-2">
                    {data.liveSignals.map((s: PhotoWowLiveSignal, i) => {
                      const st = signalStyle(s.tipo);
                      return (
                        <div
                          key={`${s.url}-${i}`}
                          className="rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2.5 transition-all duration-500"
                          style={{
                            transitionDelay: `${i * 100}ms`,
                            opacity: p5 ? 1 : 0,
                            transform: p5 ? "translateX(0)" : "translateX(24px)",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider", st.bg)}>
                              {st.label}
                            </span>
                            <span className="text-[10px] text-white/50 truncate">{s.fonte} · {s.dataRilevazione}</span>
                          </div>
                          <p className="text-[13px] font-semibold leading-snug line-clamp-2">{s.titolo}</p>
                          {s.estratto && <p className="text-[11px] text-white/60 mt-1 line-clamp-2">{s.estratto}</p>}
                          {s.url && (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-sky-300 hover:underline"
                            >
                              Vedi fonte <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            )}

            {/* PHASE 6 — Territorial documents */}
            {data.territorialDocuments && data.territorialDocuments.length > 0 && (
              <Reveal show={p6}>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide">
                    <FileText className="h-4 w-4 text-sky-300" />Documenti territoriali
                  </h3>
                  <ul className="space-y-1.5">
                    {data.territorialDocuments.map((d, i) => (
                      <li key={`${d.url}-${i}`} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-white/50" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium truncate">{d.titolo}</p>
                          <p className="text-[10px] text-white/50">{d.fonte}</p>
                        </div>
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-300 hover:underline shrink-0">
                            Apri
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )}

            {/* PHASE 7 — Zone intelligence */}
            {data.zonaIntelligence && (
              <Reveal show={p7}>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide">
                    <Brain className="h-4 w-4 text-violet-300" />Intelligence zona
                  </h3>
                  {data.zonaIntelligence.tendenzaMercato && (
                    <p className="text-base italic text-white/90 leading-snug">"{data.zonaIntelligence.tendenzaMercato}"</p>
                  )}
                  {data.zonaIntelligence.puntiDiForzaNascosti?.length > 0 && (
                    <ul className="space-y-1">
                      {data.zonaIntelligence.puntiDiForzaNascosti.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-white/80">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.zonaIntelligence.criticitaEmergenti?.length > 0 && (
                    <ul className="space-y-1">
                      {data.zonaIntelligence.criticitaEmergenti.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-white/80">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-rose-400 shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.zonaIntelligence.notizieRecenti?.length > 0 && (
                    <div className="pt-1 space-y-1.5 border-t border-white/10">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />Notizie recenti
                      </p>
                      {data.zonaIntelligence.notizieRecenti.slice(0, 3).map((n, i) => (
                        <a
                          key={i}
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[12px] text-sky-300 hover:underline"
                        >
                          {n.titolo} <span className="text-white/40 text-[10px]">· {n.data}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            )}

            {/* PHASE 8 — Esclusiva plan */}
            {data.pianoEsclusiva && (
              <Reveal show={p8}>
                <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-black/60 to-black/40 backdrop-blur-sm p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
                    <Target className="h-4 w-4" />Il tuo piano esclusiva
                  </h3>
                  {data.pianoEsclusiva.argomento && (
                    <p className="text-lg font-bold leading-tight">{data.pianoEsclusiva.argomento}</p>
                  )}
                  {data.pianoEsclusiva.puntiChiave?.length > 0 && (
                    <ol className="list-decimal list-inside space-y-1 text-[13px] text-white/85">
                      {data.pianoEsclusiva.puntiChiave.map((p, i) => <li key={i}>{p}</li>)}
                    </ol>
                  )}
                  {data.pianoEsclusiva.stimaRapida && (
                    <div className="rounded-lg border border-amber-400/30 bg-black/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-amber-200/70">Stima rapida (elaborata)</p>
                      <p className="text-base font-bold text-amber-100">{data.pianoEsclusiva.stimaRapida}</p>
                    </div>
                  )}
                </div>
              </Reveal>
            )}

            {data.fontiUsate?.length > 0 && (
              <Reveal show={p9}>
                <p className="text-[10px] text-white/40 text-center leading-relaxed">
                  Anteprima: {data.fontiUsate.join(" · ")}. Le quotazioni ufficiali OMI/ISTAT sono nel report sotto.
                </p>
              </Reveal>
            )}
          </>
        )}
      </div>
    </div>
  );
}
