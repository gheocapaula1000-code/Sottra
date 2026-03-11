import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  ScanLine,
  ChevronRight,
  History,
  BarChart3,
  Activity,
  Shield,
  Mail,
  LogOut,
  Camera,
  Clock,
  CreditCard,
  HelpCircle,
} from "lucide-react";

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

  const recentScans = scans.slice(0, 5);
  const totalScans = scans.length;
  const lastScanDate = scans[0]?.date
    ? new Date(scans[0].date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
    : null;

  const scansUsed = trial?.scans_used ?? totalScans;
  const scansMax = trial?.max_scans ?? null;

  const accountLabel = isAdmin
    ? "Admin"
    : subscribed
      ? "Abbonamento attivo"
      : trial?.active
        ? "Trial attivo"
        : "Account";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <SottraMark size="sm" />

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/admin")}>
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            {subscribed && !isAdmin && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={handleManageSubscription}>
                <CreditCard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abbonamento</span>
              </Button>
            )}
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">

        {/* ── Title row + CTA ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Panoramica del tuo account e accesso rapido alle funzionalità.</p>
          </div>
          <Button size="lg" className="min-h-[48px] sm:min-h-0 sm:h-10 gap-2 shrink-0" onClick={() => navigate("/scan")}>
            <ScanLine className="h-4 w-4" />
            Nuova scansione
          </Button>
        </div>

        {/* ── Overview cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <OverviewCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Scansioni effettuate"
            value={String(scansUsed)}
          />
          <OverviewCard
            icon={<Activity className="h-4 w-4" />}
            label="Disponibili"
            value={scansMax !== null ? String(Math.max(0, scansMax - scansUsed)) : "∞"}
          />
          <OverviewCard
            icon={<Clock className="h-4 w-4" />}
            label="Ultima attività"
            value={lastScanDate ?? "–"}
          />
          <OverviewCard
            icon={<Shield className="h-4 w-4" />}
            label="Account"
            value={accountLabel}
          />
        </div>

        {/* ── Two-column content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column — 2/3 */}
          <div className="lg:col-span-2 space-y-4">

            {/* CTA card */}
            <Card className="border-primary/20 bg-primary/[0.04]">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Avvia una nuova scansione</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Inquadra un edificio e ottieni il quadro informativo della zona.</p>
                </div>
                <Button className="min-h-[44px] sm:min-h-0 sm:h-9 w-full sm:w-auto shrink-0 gap-1.5" onClick={() => navigate("/scan")}>
                  <ScanLine className="h-4 w-4" />
                  Scansiona
                </Button>
              </CardContent>
            </Card>

            {/* Recent scans */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">Scansioni recenti</CardTitle>
                {totalScans > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => navigate("/history")}>
                    Vedi tutte <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {recentScans.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <History className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Nessuna scansione ancora</p>
                      <p className="text-xs text-muted-foreground mt-0.5">La tua prima analisi comparirà qui.</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => navigate("/scan")}>
                      <ScanLine className="h-3.5 w-3.5" />
                      Scansiona un edificio
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentScans.map((scan) => (
                      <button
                        key={scan.id}
                        onClick={() => navigate("/history")}
                        className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-secondary/30 -mx-1 px-1 rounded transition-colors"
                      >
                        {scan.photo ? (
                          <img
                            src={scan.photo}
                            alt=""
                            className="h-9 w-9 rounded object-cover shrink-0 bg-muted"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                            <Camera className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {scan.address || "Indirizzo non disponibile"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(scan.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — 1/3 */}
          <div className="space-y-4">

            {/* Account status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Stato account</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tipo</span>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {isAdmin ? "Admin" : subscribed ? "Pro" : "Trial"}
                  </Badge>
                </div>
                {!isAdmin && trial?.active && !subscribed && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Scansioni</span>
                    <span className="text-xs font-medium text-foreground">{trial.scans_used}/{trial.max_scans}</span>
                  </div>
                )}
                {subscribed && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Piano</span>
                    <span className="text-xs font-medium text-foreground">Attivo</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-xs text-foreground truncate max-w-[140px]">{user?.email}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Azioni rapide</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <QuickAction icon={<ScanLine className="h-4 w-4" />} label="Nuova scansione" onClick={() => navigate("/scan")} />
                <QuickAction icon={<History className="h-4 w-4" />} label="Cronologia scansioni" onClick={() => navigate("/history")} />
                {subscribed && !isAdmin && (
                  <QuickAction icon={<CreditCard className="h-4 w-4" />} label="Gestisci abbonamento" onClick={handleManageSubscription} />
                )}
                {isAdmin && (
                  <QuickAction icon={<Shield className="h-4 w-4" />} label="Pannello admin" onClick={() => navigate("/admin")} />
                )}
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Assistenza</p>
                  <a
                    href={`mailto:${APP_BRAND.supportEmail}`}
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {APP_BRAND.supportEmail}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

/* ── Sub-components ── */

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
    </button>
  );
}

export default Dashboard;
