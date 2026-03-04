import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SottraLogoSvg from "@/components/SottraLogoSvg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="flex items-center text-6xl font-black tracking-tight text-foreground sm:text-8xl">
          <SottraLogoSvg className="inline-block h-[2.6em] w-auto -my-[0.6em] -mr-[1.1em] -ml-[0.5em]" />
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

      <footer className="py-6 text-center text-xs text-muted-foreground">
        © 2026 Sottra
      </footer>
    </div>
  );
};

export default Index;
