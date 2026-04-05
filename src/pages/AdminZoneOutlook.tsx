/**
 * Admin Zone Outlook Diagnostics — Sottra
 * Shows 2/5/10y outlook composition, signals, penalties, attention reasoning.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";
import { buildZoneGrowthSignals } from "@/lib/zoneGrowthSignals";
import { buildUrbanTransformations, type UrbanTransformationInput } from "@/lib/zoneUrbanTransformations";
import { buildAttractorsPressure, type AttractorInput } from "@/lib/zoneAttractorsPressure";
import {
  buildZoneOutlook, outlookStatusLabel, outlookDirectionLabel,
  outlookAttentionLabel, outlookNarrativeMode,
  type ZoneOutlookResult, type HorizonView,
} from "@/lib/zoneOutlookEngine";

const DEMO_URBAN: UrbanTransformationInput[] = [
  { signal_key: "metro_m4", signal_label: "Prolungamento M4", signal_family: "opere_pubbliche", signal_type: "infrastruttura", signal_status: "in_progress", signal_stage: "in_progress", signal_direction: "supportive", geo_scope: "sub_comunale", evidence_level: "strong", source_basis: "delibera", is_official: true },
];

const DEMO_ATTR: AttractorInput[] = [
  { signal_key: "uni", signal_label: "Università Statale", signal_family: "poli_formativi", signal_type: "università", attractor_category: "edu", signal_status: "active", signal_direction: "supportive", geo_scope: "sub_comunale", proximity_hint: "immediate", intensity_hint: "strong", evidence_level: "strong", source_basis: "anagrafe", is_official: true },
];

function HorizonCard({ h, label }: { h: HorizonView; label: string }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          {label}
          <Badge variant={h.outlook_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
            {outlookStatusLabel(h.outlook_status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Direzione</span><span>{outlookDirectionLabel(h.outlook_direction)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Supporto</span><span>{h.support_strength}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Evidenza</span><span>{h.evidence_level}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Trasformazioni</span><span>{h.transformation_signal_strength}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Attrattori</span><span>{h.attractor_signal_strength}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Mercato</span><span>{h.market_support_strength}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Penalità fb</span><span>{h.fallback_penalty.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Narrativa</span><span>{h.narrative_mode}</span></div>
        <p className="text-muted-foreground/80 pt-1">{h.summary}</p>
        {h.limitations.map((l, i) => <p key={i} className="text-amber-500/80">{l}</p>)}
      </CardContent>
    </Card>
  );
}

export default function AdminZoneOutlook() {
  const [code, setCode] = useState("015146");
  const [result, setResult] = useState<ZoneOutlookResult | null>(null);

  const run = () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
    const corr = buildZoneCorrespondence(data);
    const growth = buildZoneGrowthSignals(data, corr);
    const urban = buildUrbanTransformations(data, corr, DEMO_URBAN);
    const attr = buildAttractorsPressure(data, corr, DEMO_ATTR);
    setResult(buildZoneOutlook(corr, growth, urban, attr));
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold">Admin · Vista Prospettica Zona</h1>
        <Card><CardContent className="p-4 flex gap-2">
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="ISTAT" className="flex-1" />
          <Button onClick={run} size="sm">Analizza</Button>
        </CardContent></Card>

        {result && (
          <>
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Zona</span><span className="font-medium">{result.outlook_identity.zone_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Livello</span><span>{result.outlook_identity.zone_geo_level}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Base segnali</span><span>{result.outlook_identity.signal_base_strength}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Narrativa</span><span>{outlookNarrativeMode(result)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attenzione</span>
                  <Badge variant={result.outlook_attention === "high" ? "default" : "secondary"} className="text-[10px]">
                    {outlookAttentionLabel(result.outlook_attention)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <HorizonCard h={result.horizon_2y} label="Orizzonte 2 anni" />
            <HorizonCard h={result.horizon_5y} label="Orizzonte 5 anni" />
            <HorizonCard h={result.horizon_10y} label="Orizzonte 10 anni" />

            <Card className="border-border/50">
              <CardHeader className="p-3 pb-1"><CardTitle className="text-sm font-semibold">Pressione sui valori</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Breve termine</span><span>{outlookDirectionLabel(result.outlook_value_pressure.near_term_value_pressure)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Medio termine</span><span>{outlookDirectionLabel(result.outlook_value_pressure.mid_term_value_pressure)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lungo termine</span><span>{outlookDirectionLabel(result.outlook_value_pressure.long_term_value_pressure)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Confidenza</span><span>{result.outlook_value_pressure.pressure_confidence}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span>{result.outlook_value_pressure.pressure_basis}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rischio falsa specificità</span><span>{result.outlook_value_pressure.false_specificity_risk ? "Sì" : "No"}</span></div>
              </CardContent>
            </Card>

            {result.outlook_limitations.transparency_notes.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-1">
                  {result.outlook_limitations.transparency_notes.map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground/80">{n}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
