import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function CtaFinal() {
  const navigate = useNavigate();

  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-7 text-center sm:p-12">
        <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl" style={{ textWrap: "balance" as any }}>
          Il contesto conta quanto il prezzo
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base" style={{ textWrap: "balance" as any }}>
          Prova Sottra gratis per 3 giorni. 5 scansioni incluse, nessuna carta
          di credito, nessun dato bancario.
        </p>
        <Button
          size="lg"
          className="mt-8 gap-2 text-base"
          onClick={() => navigate("/signup")}
        >
          Inizia senza carta <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Se non ti abboni, non succede nulla. Nessuna disdetta.</span>
        </div>
      </div>
    </section>
  );
}
