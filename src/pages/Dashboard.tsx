import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { APP_BRAND } from "@/lib/legalEntity";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import SottraMark from "@/components/SottraMark";
import { ScanLine, Clock, ChevronRight } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading, canScan, subscribed, trial, isAdmin, refresh } = useSubscription();
  const { toast } = useToast();
  const { scans } = useScanHistory();

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    }
  };

  useEffect(() => { refresh(); }, [refresh]);

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

  const recentScans = scans.slice(0, 3);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-border">
        <SottraMark size="sm" />
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="text-xs text-primary font-medium hover:underline transition-colors"
            >
              Admin
            </button>
          )}
          {subscribed && !isAdmin && (
            <button
              onClick={handleManageSubscription}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Abbonamento
            </button>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[160px]">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* Quick action block */}
        <section className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Avvia una nuova scansione</h1>
          <p className="text-sm text-muted-foreground">
            Inquadra un edificio e ottieni il quadro informativo della zona in pochi secondi.
          </p>
          <Button size="lg" className="w-full sm:w-auto min-h-[48px]" onClick={() => navigate("/scan")}>
            <ScanLine className="mr-2 h-5 w-5" />
            Scansiona un edificio
          </Button>
        </section>

        {/* Trial/subscription status */}
        {!isAdmin && trial?.active && !subscribed && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Clock className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Trial attivo — <span className="text-foreground font-medium">{trial.scans_used}/{trial.max_scans}</span> scansioni utilizzate
            </p>
          </div>
        )}

        {/* Recent scans */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Scansioni recenti</h2>
            <button
              onClick={() => navigate("/history")}
              className="text-xs text-primary hover:underline transition-colors flex items-center gap-0.5"
            >
              Vedi tutte <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {recentScans.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Nessuna scansione ancora. Inizia la tua prima analisi.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => navigate("/history")}
                  className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  {scan.photo && (
                    <img
                      src={scan.photo}
                      alt=""
                      className="h-10 w-10 rounded object-cover flex-shrink-0 bg-muted"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {scan.address || "Indirizzo non disponibile"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(scan.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        <p>
          Assistenza: <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary hover:underline">{APP_BRAND.supportEmail}</a>
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
