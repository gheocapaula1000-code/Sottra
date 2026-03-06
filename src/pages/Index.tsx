import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoS from "@/assets/logo-s-icon.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="flex items-center text-6xl font-black tracking-tight text-foreground sm:text-8xl">
          <img
            src={logoS}
            alt="S"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            className="inline-block h-[2.6em] w-auto object-contain -my-[0.6em]"
            style={{ marginRight: '-1.1em', marginLeft: '-0.5em', mixBlendMode: 'lighten' }}
          />
          <span>ottra</span>
        </h1>
        <p className="mt-4 text-lg font-medium text-foreground/80 sm:text-xl">
          Ciò che sta sotto, lo sai solo tu.
        </p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          Inquadra qualsiasi edificio. Scopri tutto in 3 secondi.
        </p>
        <Button
          className="mt-10"
          size="lg"
          onClick={() => navigate("/scan")}
        >
          Inizia a scoprire
        </Button>
        <button
          onClick={() => navigate("/history")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Le tue scansioni →
        </button>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground space-y-2">
        <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>|</span>
          <a href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</a>
          <span>|</span>
          <a href="/termini-condizioni" className="hover:text-foreground transition-colors">Termini e Condizioni</a>
          <span>|</span>
          <a href="/note-legali" className="hover:text-foreground transition-colors">Note Legali</a>
        </nav>
        <p>© 2026 Sottra By Pi.Gi Service — Tutti i diritti riservati</p>
      </footer>
    </div>
  );
};

export default Index;
