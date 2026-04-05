/**
 * Admin Zone Profile Diagnostics — Sottra Phase 3
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildTerritorialReport, type ZoneProfile, type TerritorialReportViewModel } from "@/lib/zoneProfileEngine";
import { geoLevelLabel } from "@/lib/geoBackbone";

export default function AdminZoneProfile() {
  const [code, setCode] = useState("015146");
  const [profile, setProfile] = useState<ZoneProfile | null>(null);
  const [vm, setVm] = useState<TerritorialReportViewModel | null>(null);

  const run = () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: code }, include_placeholders: true });
    const result = buildTerritorialReport(data);
    setProfile(result.profile);
    setVm(result.viewModel);
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <h1 className="text-lg font-bold text-foreground">Admin — Zone Profile Engine</h1>

        <Card>
          <CardContent className="p-4 flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="ISTAT code" className="flex-1" />
            <Button onClick={run} size="sm">Analizza</Button>
          </CardContent>
        </Card>

        {profile && vm && (
          <div className="space-y-4">
            {/* Identity */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Zone Identity</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Row label="Geo Level" value={geoLevelLabel(profile.zone_identity.geo_level)} />
                <Row label="Code" value={profile.zone_identity.geo_code} />
                <Row label="Label" value={profile.zone_identity.geo_label} />
                <Row label="Path" value={profile.zone_identity.normalized_path} />
                <Row label="Precision" value={profile.zone_identity.precision_label} />
                <Row label="Scope" value={profile.zone_identity.effective_scope_label} />
              </CardContent>
            </Card>

            {/* Positioning */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Zone Positioning</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Row label="Urban" value={profile.zone_positioning.urban_classification} />
                <Row label="Granularity" value={geoLevelLabel(profile.zone_positioning.territorial_granularity)} />
                <Row label="Microzone" value={profile.zone_positioning.microzone_presence ? "✓" : "✗"} />
                <Row label="ASC" value={profile.zone_positioning.asc_presence ? "✓" : "✗"} />
                <Row label="Sections" value={profile.zone_positioning.section_presence ? "✓" : "✗"} />
                <Row label="OMI" value={profile.zone_positioning.omi_linkage_status} />
              </CardContent>
            </Card>

            {/* Renderability */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Report Renderability</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1">
                  {Object.entries(profile.report_renderability.sections).map(([key, s]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.render_mode === "full" ? "default" : s.render_mode === "partial" ? "secondary" : "outline"} className="text-[10px]">
                          {s.render_mode}
                        </Badge>
                        <span className="text-muted-foreground/60 max-w-[200px] truncate">{s.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quality */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Data Quality</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                <Row label="Overall" value={profile.zone_data_quality.overall_quality_status} />
                <Row label="Coverage" value={profile.zone_data_quality.coverage_strength} />
                <Row label="Explainability" value={profile.zone_data_quality.explainability_strength} />
                <Row label="Fallbacks" value={`${profile.zone_data_quality.fallback_count}`} />
                {profile.zone_data_quality.key_warnings.map((w, i) => (
                  <p key={i} className="text-amber-400/80 pl-2">{w}</p>
                ))}
              </CardContent>
            </Card>

            {/* Limitations */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Limitations</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-1">
                {profile.zone_limitations.missing_layers.length > 0 && (
                  <Row label="Missing" value={profile.zone_limitations.missing_layers.join(", ")} />
                )}
                {profile.zone_limitations.blocking_gaps.length > 0 && (
                  <Row label="Blocking" value={profile.zone_limitations.blocking_gaps.join(", ")} />
                )}
                {profile.zone_limitations.transparency_notes.map((n, i) => (
                  <p key={i} className="text-muted-foreground/60 pl-2">{n}</p>
                ))}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-2">
                <p className="font-medium">{profile.zone_summary.executive_summary}</p>
                <p className="text-muted-foreground">{profile.zone_summary.user_facing_summary}</p>
                <p className="text-muted-foreground/60">{profile.zone_summary.next_best_step}</p>
              </CardContent>
            </Card>

            {/* VM Sections */}
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Report ViewModel — {vm.sections.length} sezioni</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-xs">
                {vm.unsupported_sections.length > 0 && (
                  <p className="text-amber-400/80 mb-2">Nascoste: {vm.unsupported_sections.join(", ")}</p>
                )}
                {vm.sections.map(s => (
                  <div key={s.key} className="mb-2 pb-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant={s.render_mode === "full" ? "default" : "secondary"} className="text-[10px]">{s.render_mode}</Badge>
                    </div>
                    <p className="text-muted-foreground/60">{s.facts.length} fatti, {s.notes.length} note</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
