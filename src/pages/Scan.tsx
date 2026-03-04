import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Scan = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate("/")}
          className="text-lg font-bold text-foreground"
        >
          Sottra
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary">
          <Camera className="h-10 w-10 text-primary" />
        </div>
        <p className="mt-6 text-base text-muted-foreground">
          Inquadra un edificio per iniziare
        </p>
        <Button className="mt-8" size="lg">
          Scatta foto
        </Button>
      </main>
    </div>
  );
};

export default Scan;
