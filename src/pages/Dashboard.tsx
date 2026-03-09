import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { APP_BRAND } from "@/lib/legalEntity";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SottraMark from "@/components/SottraMark";
import logoS from "@/assets/logo-s-icon.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading, canScan, subscribed, trial, planKey, isAdmin } = useSubscription();
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!canScan) {
    return <TrialExpiredScreen scansUsed={trial?.scans_used ?? 0} />;
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <SottraMark size="sm" />
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="text-xs text-primary font-medium hover:underline transition-colors"
            >
              Admin →
            </button>
          )}
          {!isAdmin && trial?.active && !subscribed && (
            <span className="text-xs text-primary font-medium">
              Trial: {trial.scans_used}/{trial.max_scans} scansioni
            </span>
          )}
          {subscribed && (
            <button
              onClick={handleManageSubscription}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Gestisci abbonamento
            </button>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </div>
      </header>

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
          Inquadra qualsiasi edificio. Ottieni un quadro informativo in pochi secondi.
        </p>
        <Button className="mt-10" size="lg" onClick={() => navigate("/scan")}>
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
        <p>Per trasferire il tuo account a un nuovo dispositivo, scrivi a <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary hover:underline">{APP_BRAND.supportEmail}</a></p>
      </footer>
    </div>
  );
};

export default Dashboard;
