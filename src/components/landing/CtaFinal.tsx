import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function CtaFinal() {
  const navigate = useNavigate();

  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-7 text-center sm:p-12">
        <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Il contesto conta quanto il prezzo
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
          Prova Sottra gratis per 3 giorni. 5 scansioni incluse, nessuna carta
          di credito, accesso completo.
        </p>
        <Button
          size="lg"
          className="mt-8 gap-2 text-base"
          onClick={() => navigate("/signup")}
        >
          Inizia ora <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
