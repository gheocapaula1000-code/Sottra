/**
 * Admin Zone Correspondence Diagnostics — Sottra
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence, type ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import { buildZoneGrowthSignals, growthStatusLabel, narrativeModeLabel, type ZoneGrowthSignalsResult } from "@/lib/zoneGrowthSignals";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Bool({ label, value }: { label: string; value: boolean }) {
  return <Row label={label} value={value ? "✓" : "✗"} />;
}

function strengthBadge(s: string) {
  const v = s === "strong" ? "default" : s === "medium" ? "secondary" : "outline";
  return <Badge variant={v as "default" | "secondary" | "outline"} className="text-[10px]">{s}</Badge>;
}

function directionColor(d: string) {
  if (d === "positive") return "text-emerald-400";
  if (d === "negative") return "text-red-400";
  if (d === "mixed") return "text-amber-400";
  return "text-muted-foreground";
}

export default function AdminZoneCorrespondence() {
  const [code, setCode] = useState("015146");
  const [corr, setCorr] = useState<ZoneCorrespondenceResult | null>(null);
  const [growth, setGrowth] = useState<ZoneGrowthSignalsResult | null>(null);

  const run = () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
    const c = buildZoneCorrespondence(data);
    const g = buildZoneGrowthSignals(data, c);
    setCorr(c);
    setGrowth(g);
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <h1 className="text-lg font-bold text-foreground">Admin — Zone Correspondence + Growth Signals</h1>

        <Card>
          <CardContent className="p-4 flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Codice ISTAT" className="flex-1" />
            <Button onClick={run} size="sm">Analizza</Button>
          </CardContent>
        </Card>

        {corr && growth && (
          <div className="space-y-4">
            {/* Zone Identity */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Zone Identity</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Row label="Livello reale" value={corr.zone_identity.geo_level_reale} />
                <Row label="Codice" value={corr.zone_identity.geo_code} />
                <Row label="Label" value={corr.zone_identity.geo_label} />
                <Row label="Tipo zona" value={corr.zone_identity.zone_type_label} />
                <Row label="Corrisponde a" value={corr.zone_identity.zone_corresponds_to} />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Solidità ancoraggio</span>
                  {strengthBadge(corr.zone_identity.zone_anchor_strength)}
                </div>
              </CardContent>
            </Card>

            {/* Correspondence */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Correspondence</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Bool label="Microzona OMI" value={corr.zone_correspondence.corresponds_to_microzona_omi} />
                <Bool label="ASC" value={corr.zone_correspondence.corresponds_to_asc} />
                <Bool label="Sezione/Aggregato" value={corr.zone_correspondence.corresponds_to_section_or_aggregate} />
                <Bool label="Solo comunale" value={corr.zone_correspondence.corresponds_to_comune_only} />
                <Row label="Base primaria" value={corr.zone_correspondence.primary_zone_basis} />
                <Row label="Fallback weight" value={corr.zone_correspondence.fallback_weight} />
                <Row label="Rischio falsa specificità" value={corr.zone_correspondence.false_specificity_risk} />
              </CardContent>
            </Card>

            {/* Precision */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Precision</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {strengthBadge(corr.zone_precision.precision_status)}
                </div>
                <Row label="Sub-comunale" value={corr.zone_precision.sub_comunale_support_status} />
                <Row label="Market zone" value={corr.zone_precision.market_zone_support_status} />
                <Row label="Territoriale" value={corr.zone_precision.territorial_support_status} />
                <Row label="Max claim level" value={corr.zone_precision.max_safe_claim_level} />
              </CardContent>
            </Card>

            {/* Limitations */}
            {(corr.zone_limitations.blocking_gaps.length > 0 || corr.zone_limitations.transparency_notes.length > 0) && (
              <Card>
                <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Limitations</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 text-xs space-y-1">
                  <Bool label="Missing sub-comunale" value={corr.zone_limitations.missing_sub_comunale} />
                  <Bool label="Market solo comunale" value={corr.zone_limitations.market_only_comunale} />
                  <Bool label="Ancoraggio debole" value={corr.zone_limitations.weak_zone_anchor} />
                  <Bool label="Fallback dominante" value={corr.zone_limitations.fallback_dominant} />
                  {corr.zone_limitations.transparency_notes.map((n, i) => (
                    <p key={i} className="text-muted-foreground/60 pl-2">{n}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Growth Signals */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Growth Signals — {growth.growth_signals.length} segnali</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-2">
                {growth.growth_signals.map(s => (
                  <div key={s.signal_key} className="pb-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.signal_label}</span>
                      <span className={`font-medium ${directionColor(s.signal_direction)}`}>{s.signal_direction}</span>
                    </div>
                    <p className="text-muted-foreground/80">{s.signal_value}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-muted-foreground/60">{s.signal_family}</span>
                      {strengthBadge(s.evidence_level)}
                      <span className="text-muted-foreground/60">{s.geo_validity_level}</span>
                    </div>
                    {s.notes && <p className="text-muted-foreground/50 mt-0.5">{s.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Growth Summary */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Growth Summary</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Row label="Positivi" value={`${growth.growth_summary.positive_signal_count}`} />
                <Row label="Negativi" value={`${growth.growth_summary.negative_signal_count}`} />
                <Row label="Misti" value={`${growth.growth_summary.mixed_signal_count}`} />
                <Row label="Deboli" value={`${growth.growth_summary.weak_signal_count}`} />
                <Row label="Status complessivo" value={growthStatusLabel(growth.growth_summary.overall_growth_signal_status)} />
                <Row label="Modalità narrativa" value={narrativeModeLabel(growth.growth_summary.narrative_mode)} />
                {growth.growth_limitations.transparency_notes.map((n, i) => (
                  <p key={i} className="text-amber-400/80 pl-2">{n}</p>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
