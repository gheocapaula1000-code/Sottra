import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import { Users, ShieldCheck, ScanLine, Clock, ArrowLeft, Activity, Database, Map } from "lucide-react";

interface AdminStats {
  total_users: number;
  recent_users_7d: number;
  total_trials: number;
  active_trials: number;
  expired_trials: number;
  total_scans: number;
  admin_emails: string[];
  admin_count: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-stats");
        if (error) throw error;
        setStats(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes("Forbidden") ? "Accesso non autorizzato." : "Impossibile caricare i dati. Riprova più tardi.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader rightContent={
        <>
          <span className="text-xs font-semibold text-primary">Admin</span>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => navigate("/admin/diagnostics")}>
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Diagnostica</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app")} aria-label="Torna alla dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Esci</Button>
        </>
      } />

      {/* Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Pannello Amministrazione</h1>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {stats && !loading && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={Users} label="Utenti registrati" value={stats.total_users} />
              <StatCard icon={Users} label="Nuovi (7gg)" value={stats.recent_users_7d} />
              <StatCard icon={ScanLine} label="Scansioni totali" value={stats.total_scans} />
              <StatCard icon={ShieldCheck} label="Amministratori" value={stats.admin_count} />
            </div>

            {/* Trial Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Trial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total_trials}</p>
                    <p className="text-xs text-muted-foreground">Totali</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{stats.active_trials}</p>
                    <p className="text-xs text-muted-foreground">Attivi</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{stats.expired_trials}</p>
                    <p className="text-xs text-muted-foreground">Scaduti</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admins */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Utenti Admin
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.admin_emails.length > 0 ? (
                  <ul className="space-y-1">
                    {stats.admin_emails.map((email) => (
                      <li key={email} className="text-sm text-foreground font-mono bg-muted/50 rounded px-3 py-1.5">
                        {email}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun admin trovato</p>
                )}
              </CardContent>
            </Card>

            {/* OMI Ingest */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/omi-ingest")}>
              <CardContent className="py-8 text-center space-y-2">
                <Database className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm font-medium text-foreground">Import OMI</p>
                <p className="text-xs text-muted-foreground">
                  Carica CSV quotazioni e zone OMI dall'Agenzia delle Entrate
                </p>
              </CardContent>
            </Card>

            {/* OMI KML Ingest */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/omi-kml")}>
              <CardContent className="py-8 text-center space-y-2">
                <Map className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm font-medium text-foreground">Import Poligoni KML</p>
                <p className="text-xs text-muted-foreground">
                  Carica file KML dei perimetri OMI per il point-in-polygon reale
                </p>
              </CardContent>
            </Card>

            {/* Demographic zones import */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/demographic-import")}>
              <CardContent className="py-8 text-center space-y-2">
                <Users className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm font-medium text-foreground">Import Dati Demografici Sub-Comunali</p>
                <p className="text-xs text-muted-foreground">
                  Carica GeoJSON o CSV per popolare demographic_zones con dati reali di zona
                </p>
              </CardContent>
            </Card>

            {/* Future blocks placeholder */}
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Moderazione, monitoraggio e gestione utenti
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};


const StatCard = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) => (
  <Card>
    <CardContent className="pt-4 pb-4 px-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default AdminDashboard;
