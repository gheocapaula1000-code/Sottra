import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildZoneValue, valueNarrativeMode, valuePrecisionLabel, valueReliabilityLabel, marketSupportLabel } from "@/lib/zoneValueEngine";
import { buildRenovationEstimate, renovationNarrativeMode, estimateStrengthLabel } from "@/lib/renovationCostEngine";
import { buildWowSnapshot, attentionSignalLabel } from "@/lib/sottraWowSnapshot";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { resolveFromInput } from "@/lib/geoBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";
import { buildZoneGrowthSignals } from "@/lib/zoneGrowthSignals";
import { AlertTriangle, TrendingUp, Wrench, Zap } from "lucide-react";

function fmtEur(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function AdminZoneValue() {
  const [code, setCode] = useState("015146");
  const [result, setResult] = useState<ReturnType<typeof buildWowSnapshot> | null>(null);
  const [valueResult, setValueResult] = useState<ReturnType<typeof buildZoneValue> | null>(null);
  const [renoResult, setRenoResult] = useState<ReturnType<typeof buildRenovationEstimate> | null>(null);

  const run = () => {
    const geo = resolveGeoBackbone(code);
    const td = buildTerritorialData(geo);
    const corr = buildZoneCorrespondence(td);
    const growth = buildZoneGrowthSignals(td, corr);
    const value = buildZoneValue({ data: td, corr, omiMin: 2800, omiMax: 3500, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: code, zone_geo_level: td.territorial_identity.geo_level, hasPhoto: true, facadeConsistencyLevel: "good", photoReadability: "clear", value_per_sqm_mid: value.value_result.value_per_sqm_mid });
    const snap = buildWowSnapshot({ value, renovation: reno, growth, corr });
    setResult(snap);
    setValueResult(value);
    setRenoResult(reno);
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <h1 className="text-xl font-bold text-foreground">Admin — Valore Zona & WOW Snapshot</h1>

        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice catastale" className="max-w-xs" />
          <Button onClick={run}>Analizza</Button>
        </div>

        {valueResult && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Valore al mq</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">Basis</span><p className="font-medium">{valueResult.value_identity.value_basis_type}</p></div>
                <div><span className="text-muted-foreground text-xs">Scope</span><p className="font-medium">{valueResult.value_identity.value_scope_label}</p></div>
                <div><span className="text-muted-foreground text-xs">Min</span><p className="font-medium">{fmtEur(valueResult.value_result.value_per_sqm_min)}</p></div>
                <div><span className="text-muted-foreground text-xs">Max</span><p className="font-medium">{fmtEur(valueResult.value_result.value_per_sqm_max)}</p></div>
                <div><span className="text-muted-foreground text-xs">Mid</span><p className="font-medium">{fmtEur(valueResult.value_result.value_per_sqm_mid)}</p></div>
                <div><span className="text-muted-foreground text-xs">Confidence</span><p className="font-medium">{(valueResult.value_result.value_confidence * 100).toFixed(0)}%</p></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{valuePrecisionLabel(valueResult.value_result.value_precision_status)}</Badge>
                <Badge variant="outline">{valueReliabilityLabel(valueResult.value_quality.reliability_status)}</Badge>
                <Badge variant="outline">{marketSupportLabel(valueResult.value_quality.market_support_status)}</Badge>
                <Badge variant={valueResult.value_result.fallback_used ? "destructive" : "secondary"}>Fallback: {valueResult.value_result.fallback_weight}</Badge>
              </div>
              {valueResult.value_quality.transparency_notes.map((n, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{n}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {renoResult && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Stima Ristrutturazione</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">Range</span><p className="font-medium">{fmtEur(renoResult.renovation_estimate.renovation_cost_min)} – {fmtEur(renoResult.renovation_estimate.renovation_cost_max)}</p></div>
                <div><span className="text-muted-foreground text-xs">Mid</span><p className="font-medium">{fmtEur(renoResult.renovation_estimate.renovation_cost_mid)}</p></div>
                <div><span className="text-muted-foreground text-xs">Mode</span><p className="font-medium">{renoResult.renovation_estimate.estimate_mode}</p></div>
                <div><span className="text-muted-foreground text-xs">Strength</span><p className="font-medium">{estimateStrengthLabel(renoResult.renovation_quality.estimate_strength)}</p></div>
              </div>
              <Badge variant="outline">Narrative: {renovationNarrativeMode(renoResult)}</Badge>
              {renoResult.renovation_quality.transparency_notes.map((n, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{n}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" />WOW Snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">Zona</span><p className="font-medium">{result.zona_reale}</p></div>
                <div><span className="text-muted-foreground text-xs">Livello</span><p className="font-medium">{result.livello_lettura}</p></div>
                <div><span className="text-muted-foreground text-xs">Valore mq</span><p className="font-medium">{result.valore_al_mq ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Affidabilità</span><p className="font-medium">{result.affidabilita_valore}</p></div>
                <div><span className="text-muted-foreground text-xs">Costo ristr.</span><p className="font-medium">{result.costo_ristrutturazione ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Segnali zona</span><p className="font-medium">{result.segnali_zona}</p></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Attenzione: {attentionSignalLabel(result.attenzione_area)}</Badge>
                <Badge variant="outline">Narrative: {result.narrative_mode}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{result.limite_principale}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
