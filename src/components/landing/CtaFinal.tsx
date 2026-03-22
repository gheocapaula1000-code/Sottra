import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function CtaFinal() {
  const navigate = useNavigate();

  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-7 text-center sm:p-12">
        <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl" style={{ textWrap: "balance" as React.CSSProperties }}>
          Valuta il prodotto con calma
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base" style={{ textWrap: "balance" as React.CSSProperties }}>
          3 giorni di prova, 5 scansioni incluse. Nessuna carta di credito
          e nessun dato bancario. Se non fa per te, non succede nulla.
        </p>
        <Button
          size="lg"
          className="mt-8 gap-2 text-base min-h-[48px]"
          onClick={() => navigate("/signup")}
        >
          Inizia senza carta <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Se non ti abboni, non succede nulla. Nessuna disdetta.</span>
          </div>
          <span className="font-medium text-primary/80">Paghi solo se scegli di continuare</span>
        </div>
      </div>
    </section>
  );
}
