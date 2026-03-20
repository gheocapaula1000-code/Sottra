import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SottraMark from "@/components/SottraMark";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <SottraMark size="lg" textOnly className="justify-center" />
        <div className="space-y-2">
          <p className="text-6xl font-black text-foreground tracking-tight">404</p>
          <p className="text-sm text-muted-foreground">
            La pagina che stai cercando non esiste o è stata spostata.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="min-h-[48px] gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Torna alla home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
