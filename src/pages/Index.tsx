import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LEGAL_ENTITY } from "@/lib/legalEntity";
import logoS from "@/assets/logo-s-icon.png";
import {
  Camera, Zap, ShieldCheck, TrendingUp, Users, Building2,
  CheckCircle2, ArrowRight, Database, Brain, Globe, Clock,
  BarChart3, MapPin, Star, Layers,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const plans = [
  {
    name: "Agente",
    price: 129,
    period: "/mese",
    description: "Per l'agente immobiliare indipendente o il professionista singolo.",
    scans: "80 scansioni/mese",
    users: "1 account",
    features: [
      "Motore Scan completo — dati reali certificati",
      "Motore Forecast — analisi predittiva zona",
      "Prezzi OMI, visura catastale, classe energetica",
      "MoodScore, trend demografico, rischio zona",
      "Storico scansioni 6 mesi",
      "Solo visualizzazione in-app (no export PDF)",
      "Dispositivo vincolato per durata abbonamento",
    ],
    cta: "Inizia il trial gratuito",
    popular: false,
  },
  {
    name: "Agenzia",
    price: 349,
    period: "/mese",
    description: "Per l'agenzia strutturata. 3 agenti inclusi.",
    scans: "250 scansioni/mese",
    users: "3 account inclusi",
    features: [
      "Tutto del piano Agente",
      "Dashboard agenzia multi-agente",
      "Export PDF con logo agenzia + watermark Sottra",
      "Annunci attivi nella zona",
      "Storico scansioni illimitato",
      "Supporto prioritario via email",
      "Dispositivo vincolato per durata abbonamento",
    ],
    extra: "Agente aggiuntivo: €49/mese (+80 scansioni)",
    cta: "Inizia il trial gratuito",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 749,
    period: "/mese",
    description: "Per agenzie strutturate e grandi team.",
    scans: "800 scansioni/mese",
    users: "10 account inclusi",
    features: [
      "Tutto del piano Agenzia",
      "Dashboard agenzia multi-agente",
      "Export PDF con logo agenzia + watermark Sottra",
      "Storico scansioni illimitato",
      "Supporto prioritario",
    ],
    extra: "Agente aggiuntivo: €39/mese (sconto rispetto ai €49 standard)",
    cta: "Inizia il trial gratuito",
    popular: false,
  },
];

const dataSources = [
  { name: "OMI — Agenzia delle Entrate", desc: "Prezzi immobiliari certificati per zona", icon: BarChart3, free: true },
  { name: "Sister / Catasto", desc: "Visure catastali: foglio, particella, rendita", icon: Database, free: true },
  { name: "ISTAT", desc: "Dati demografici, popolazione, età, famiglie", icon: Users, free: true },
  { name: "ISPRA IdroGEO", desc: "Rischio idrogeologico e alluvionale", icon: ShieldCheck, free: true },
  { name: "INGV / Protezione Civile", desc: "Classificazione sismica ufficiale", icon: Layers, free: true },
  { name: "Open Data Comunali", desc: "Cantieri, infrastrutture, progetti urbani", icon: MapPin, free: true },
  { name: "Google Maps + Places", desc: "Identificazione edificio e POI zona", icon: Globe, free: false },
  { name: "GPT-5.4 Vision", desc: "Analisi visiva foto edificio", icon: Brain, free: false },
];

const moatItems = [
  { icon: Database, title: "Dati precaricati", desc: "Settimane di lavoro per scaricare, pulire e importare OMI, ISTAT, ISPRA in un database PostGIS." },
  { icon: ShieldCheck, title: "Brevetto depositato", desc: "Il metodo foto → profilo multi-sorgente con due motori paralleli è coperto da domanda di brevetto UIBM." },
  { icon: Brain, title: "Integrazione Vision", desc: "Nessun concorrente italiano combina analisi visiva con dati catastali reali." },
  { icon: Layers, title: "Incrocio 7+ fonti", desc: "Il valore è nell'incrocio automatico di fonti in 5 secondi. Replicare l'integrazione richiede competenze specifiche." },
  { icon: TrendingUp, title: "Effetto rete", desc: "Ogni scansione migliora il database. Più utenti = più dati = prodotto migliore." },
];

/* ------------------------------------------------------------------ */
/*  COMPONENTS                                                         */
/* ------------------------------------------------------------------ */

function HeroSection() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden px-6 pt-[env(safe-area-inset-top,40px)] pb-20 sm:px-10 lg:px-20">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-[120px]" />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between py-6">
        <div className="flex items-center">
          <img src={logoS} alt="Sottra" className="h-10 w-auto" style={{ mixBlendMode: "lighten" }} />
          <span className="ml-[-0.5rem] text-2xl font-black text-foreground tracking-tight">ottra</span>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate("/login")}>
            Accedi
          </Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
            Piani e prezzi
          </Button>
        </div>
      </nav>

      <div className="relative mx-auto mt-16 max-w-3xl text-center sm:mt-24">
        <Badge variant="secondary" className="mb-6 text-xs font-medium tracking-wide uppercase">
          Piattaforma B2B per professionisti immobiliari
        </Badge>
        <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Scatta. Scopri.<br />
          <span className="text-primary">Decidi.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
          Una foto di un edificio → profilo completo con <strong className="text-foreground">dati reali certificati</strong> in 5 secondi. 
          Quello che oggi richiede 2 ore su 6 portali diversi.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" className="gap-2 text-base" onClick={() => navigate("/signup")}>
            Prova gratis 3 giorni <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">Nessuna carta di credito richiesta</p>
        </div>
      </div>

      <div className="relative mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: Camera, label: "Foto → Dati" },
          { icon: Zap, label: "5 secondi" },
          { icon: ShieldCheck, label: "Fonti certificate" },
          { icon: TrendingUp, label: "Analisi predittiva" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: "01", title: "Scatta una foto", desc: "Inquadra qualsiasi edificio con il tuo smartphone." },
    { num: "02", title: "Due motori in parallelo", desc: "Motore Scan (dati reali) + Motore Forecast (analisi predittiva) lavorano simultaneamente." },
    { num: "03", title: "Report completo", desc: "Prezzi OMI, catasto, classe energetica, MoodScore, rischio zona e molto altro." },
  ];
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-black text-foreground sm:text-4xl">Come funziona</h2>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.num} className="space-y-3">
              <span className="text-4xl font-black text-primary/30">{s.num}</span>
              <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const navigate = useNavigate();
  return (
    <section id="pricing" className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-black text-foreground sm:text-4xl">Piani di abbonamento</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Trial gratuito 3 giorni, 5 scansioni, senza carta di credito.
            <br />Dopo il trial, scegli il tuo piano. Rinnovo mensile, disdici quando vuoi.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 ${
                plan.popular
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs">
                  Più popolare
                </Badge>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">€{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">{plan.scans}</Badge>
                <Badge variant="secondary" className="text-xs">{plan.users}</Badge>
              </div>

              <Separator className="my-6" />

              <ul className="flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.extra && (
                <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                  {plan.extra}
                </p>
              )}

              <Button
                className="mt-6 w-full"
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                onClick={() => navigate("/signup")}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function DataSourcesSection() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-black text-foreground sm:text-4xl">
          Fonti dati certificate
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Ogni dato nel report Sottra è tracciabile alla fonte ufficiale. 7 fonti su 10 sono gratuite.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {dataSources.map((ds) => (
            <div key={ds.name} className="flex items-start gap-4 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ds.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground truncate">{ds.name}</h4>
                  <Badge variant={ds.free ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                    {ds.free ? "Gratuita" : "A pagamento"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{ds.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Costo medio per scansione: <strong className="text-foreground">~€0.06</strong>
        </p>
      </div>
    </section>
  );
}

function MoatSection() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-black text-foreground sm:text-4xl">
          Perché nessuno può copiarlo
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {moatItems.map((m) => (
            <div key={m.title} className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
              <m.icon className="h-6 w-6 text-primary" />
              <h4 className="text-base font-bold text-foreground">{m.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const navigate = useNavigate();
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center sm:p-12">
        <Clock className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-3xl font-black text-foreground sm:text-4xl">
          Prova Sottra gratis per 3 giorni
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          5 scansioni incluse. Nessuna carta di credito. Accesso completo a tutti i dati certificati.
        </p>
        <Button size="lg" className="mt-8 gap-2 text-base" onClick={() => navigate("/signup")}>
          Inizia il trial gratuito <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
        <div className="flex items-center">
          <img src={logoS} alt="Sottra" className="h-8 w-auto" style={{ mixBlendMode: "lighten" }} />
          <span className="ml-[-0.4rem] text-lg font-black text-foreground">ottra</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</a>
          <a href="/termini-condizioni" className="hover:text-foreground transition-colors">Termini e Condizioni</a>
          <a href="/note-legali" className="hover:text-foreground transition-colors">Note Legali</a>
        </nav>
        <p className="text-xs text-muted-foreground">
          © 2026 Sottra By {LEGAL_ENTITY.companyName} — P.IVA {LEGAL_ENTITY.vatNumber} — Tutti i diritti riservati
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

const Index = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate("/app", { replace: true });
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <HeroSection />
      <HowItWorks />
      <PricingSection />
      <DataSourcesSection />
      <MoatSection />
      <CtaSection />
      <Footer />
    </div>
  );
};

export default Index;
