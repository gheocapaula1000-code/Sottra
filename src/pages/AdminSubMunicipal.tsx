import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Database, MapPin, Layers, AlertTriangle } from "lucide-react";
import { fetchSubMunicipalStats } from "@/lib/subMunicipalImporter";

type Stats = NonNullable<Awaited<ReturnType<typeof fetchSubMunicipalStats>>>;

const AdminSubMunicipal = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubMunicipalStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <AppHeader onLogout={signOut} />
      <main className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Aree Sub-Comunali 2021 — Admin</h1>
        </div>

        {/* Status banner */}
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Modulo preparatorio — nessun dato ancora caricato</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Questa vista diventerà operativa dopo l'import dei dataset ISTAT ASC_21 e R03_21.
                  Il motore pubblico di Sottra non utilizza ancora questa tabella.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : !stats || stats.totalRecords === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Nessun dato caricato</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                La tabella <code>sub_municipal_areas_2021</code> è vuota.
                Per popolarla servono i dataset reali ISTAT (ASC_21, R03_21).
              </p>
              <div className="mt-6 text-left max-w-lg mx-auto space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Dataset attesi:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>ASC_21</strong> — Aree Sub Comunali nazionali (3 livelli: Liv1, Liv2, Liv3)</li>
                  <li><strong>R03_21</strong> — Sezioni censuarie Lombardia (shapefile + tabelle CSV)</li>
                </ul>
                <p className="font-medium text-foreground mt-4">Campi attesi nei dataset:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>PRO_COM_T, COD_REG, COD_PRO, DEN_PROV, DEN_REG, DEN_COM</li>
                  <li>COD_ASC / SEZ2011 (codice area), DEN_ASC (denominazione)</li>
                  <li>POP_RES, geometry (poligoni)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" /> Record Totali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString("it-IT")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.comuniDistinti} comuni distinti
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Copertura Geometrica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.withGeometry.toLocaleString("it-IT")}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({Math.round((stats.withGeometry / stats.totalRecords) * 100)}%)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.withCentroid} con centroide, {stats.withPopolazione} con popolazione
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Distribuzione per Dataset / Livello
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Per dataset:</p>
                    {Object.entries(stats.byDataset).map(([k, v]) => (
                      <p key={k} className="text-muted-foreground">{k}: {v.toLocaleString("it-IT")}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Per livello ASC:</p>
                    {Object.entries(stats.byLevel).map(([k, v]) => (
                      <p key={k} className="text-muted-foreground">Livello {k}: {v.toLocaleString("it-IT")}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {Object.keys(stats.byRegione).length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Distribuzione per Regione</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                    {Object.entries(stats.byRegione)
                      .sort(([, a], [, b]) => b - a)
                      .map(([regione, count]) => (
                        <p key={regione} className="text-muted-foreground">
                          {regione}: <span className="font-medium text-foreground">{count.toLocaleString("it-IT")}</span>
                        </p>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminSubMunicipal;
