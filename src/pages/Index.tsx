import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/icons/icon-512.png" alt="Sottra" className="h-20 w-20 sm:h-28 sm:w-28" />
          <h1 className="text-6xl font-black tracking-tight text-foreground sm:text-8xl">
            Sottra
          </h1>
        </div>
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
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        © 2026 Sottra
      </footer>
    </div>
  );
};

export default Index;
