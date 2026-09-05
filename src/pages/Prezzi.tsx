import { useEffect } from "react";
import { Link } from "react-router-dom";
import PricingSection from "@/components/landing/PricingSection";
import Footer from "@/components/landing/Footer";
import SottraMark from "@/components/SottraMark";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PRICING_FAQ, faqJsonLd } from "@/lib/pricingFaq";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_TITLE = "Piani e prezzi — Sottra";
const PAGE_DESCRIPTION =
  "Listino flat Sottra: Agente 79 €, Agenzia 249 €, Rete 690 € al mese. IVA non applicabile (regime forfettario). Prova 3 giorni, 5 scansioni, zero carta.";

export default function Prezzi() {
  const { session } = useAuth();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;

    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? null;
    desc?.setAttribute("content", PAGE_DESCRIPTION);

    const canonical = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    canonical?.setAttribute("href", "https://sottra.app/prezzi");

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-faq-jsonld", "true");
    script.textContent = JSON.stringify(faqJsonLd());
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) desc?.setAttribute("content", prevDesc);
      if (prevCanonical !== null) canonical?.setAttribute("href", prevCanonical);
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background overflow-x-hidden">
      <header className="px-5 pt-[env(safe-area-inset-top,0px)] sm:px-10 lg:px-20">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between py-5">
          <Link to="/" aria-label="Sottra — home">
            <SottraMark size="md" textOnly />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {session ? (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/app">Pannello</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/abbonamento">Abbonati</Link>
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/login">Accedi</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Prova gratis 3 giorni</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <div className="px-5 pt-8 text-center sm:px-10 lg:px-20">
          <h1 className="mx-auto max-w-3xl text-3xl font-black text-foreground sm:text-4xl lg:text-5xl">
            Piani e prezzi Sottra
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Listino flat, tetto scansioni incluso, nessun extra a consumo.
          </p>
        </div>

        <PricingSection />

        <section className="px-5 pb-20 sm:px-10 lg:px-20" aria-labelledby="faq-title">
          <div className="mx-auto max-w-3xl">
            <h2
              id="faq-title"
              className="text-2xl font-black text-foreground sm:text-3xl"
            >
              Domande frequenti
            </h2>
            <Accordion type="single" collapsible className="mt-6">
              {PRICING_FAQ.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="text-left text-sm font-semibold sm:text-base">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
