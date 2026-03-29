/**
 * Admin Zone Boundaries Diagnostics — Sottra
 * Sober, mobile-first admin page for auditing zone boundary support.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Square } from "lucide-react";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";
import {
  buildZoneBoundaries,
  boundaryNarrativeMode,
  boundaryPrecisionLabel,
  boundaryDisplayModeLabel,
  boundaryConfidenceLabel,
  boundarySourceLabel,
  type ZoneBoundaryResult,
} from "@/lib/zoneBoundariesEngine";
import AppHeader from "@/components/AppHeader";

function Row({ label, value, variant }: { label: string; value: string; variant?: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      {variant ? <Badge variant={variant} className="text-[10px]">{value}</Badge> : <span className="font-medium text-foreground">{value}</span>}
    </div>
  );
}

export default function AdminZoneBoundaries() {
  const [istatCode, setIstatCode] = useState("015146");
  const [result, setResult] = useState<ZoneBoundaryResult | null>(null);
  const [narrative, setNarrative] = useState<string>("");

  const analyze = () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: istatCode }, include_placeholders: true });
    const corr = buildZoneCorrespondence(data);
    const r = buildZoneBoundaries(data, corr);
    setResult(r);
    setNarrative(boundaryNarrativeMode(r));
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground">Confini Zona — Diagnostica</h1>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input value={istatCode} onChange={e => setIstatCode(e.target.value)} placeholder="Codice ISTAT" className="flex-1" />
              <Button onClick={analyze} size="sm">Analizza</Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Identity */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Identità Confine</CardTitle>
                  <Badge variant={narrative === "full" ? "default" : narrative === "partial" ? "secondary" : "destructive"} className="text-[10px] ml-auto">
                    {narrative}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-0.5">
                <Row label="Zona" value={result.zone_boundary_identity.zone_label} />
                <Row label="Livello geo" value={result.zone_boundary_identity.zone_geo_level} />
                <Row label="Confine disponibile" value={result.zone_boundary_identity.boundary_available ? "Sì" : "No"} variant={result.zone_boundary_identity.boundary_available ? "default" : "destructive"} />
                <Row label="Fonte confine" value={boundarySourceLabel(result.zone_boundary_identity.boundary_source_type)} />
                <Row label="Livello confine" value={result.zone_boundary_identity.boundary_geo_level} />
                <Row label="Precisione" value={boundaryPrecisionLabel(result.zone_boundary_identity.boundary_precision_status)} variant={result.zone_boundary_identity.boundary_precision_status === "strong" ? "default" : "secondary"} />
              </CardContent>
            </Card>

            {/* Support */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Supporto Confini</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-0.5">
                <Row label="OMI microzona" value={result.zone_boundary_support.supports_microzona_omi_boundary ? "✓" : "✗"} />
                <Row label="ASC" value={result.zone_boundary_support.supports_asc_boundary ? "✓" : "✗"} />
                <Row label="Sezione/aggregato" value={result.zone_boundary_support.supports_section_or_aggregate_boundary ? "✓" : "✗"} />
                <Row label="Comune" value={result.zone_boundary_support.supports_comune_boundary ? "✓" : "✗"} />
                <Row label="Base primaria" value={result.zone_boundary_support.primary_boundary_basis} />
                <Row label="Peso fallback" value={result.zone_boundary_support.fallback_weight} variant={result.zone_boundary_support.fallback_weight === "none" ? "default" : "secondary"} />
                <Row label="Rischio falsa specificità" value={result.zone_boundary_support.false_specificity_risk} />
              </CardContent>
            </Card>

            {/* Geometry */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Geometria</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-0.5">
                <Row label="Geometria disponibile" value={result.zone_boundary_geometry.geometry_available ? "Sì" : "No"} />
                <Row label="Tipo" value={result.zone_boundary_geometry.geometry_type} />
                <Row label="Scope" value={result.zone_boundary_geometry.geometry_scope_label} />
                <Row label="Render mode" value={result.zone_boundary_geometry.render_mode} />
                <Row label="Display mode" value={boundaryDisplayModeLabel(result.zone_boundary_geometry.boundary_display_mode)} />
                <Row label="Confidence" value={boundaryConfidenceLabel(result.zone_boundary_geometry.boundary_confidence)} variant={result.zone_boundary_geometry.boundary_confidence === "high" ? "default" : "secondary"} />
              </CardContent>
            </Card>

            {/* Limitations */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Limiti</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <Row label="Nessun confine reale" value={result.zone_boundary_limitations.no_real_boundary_available ? "Sì" : "No"} variant={result.zone_boundary_limitations.no_real_boundary_available ? "destructive" : "default"} />
                <Row label="Solo comunale" value={result.zone_boundary_limitations.comune_only_boundary ? "Sì" : "No"} />
                <Row label="Ancoraggio debole" value={result.zone_boundary_limitations.weak_boundary_anchor ? "Sì" : "No"} />
                <Row label="Fallback dominante" value={result.zone_boundary_limitations.fallback_dominant ? "Sì" : "No"} />
                {result.zone_boundary_limitations.blocking_gaps.map((g, i) => (
                  <p key={i} className="text-xs text-destructive">{g}</p>
                ))}
                {result.zone_boundary_limitations.transparency_notes.map((n, i) => (
                  <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
