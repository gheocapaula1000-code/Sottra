/**
 * Territorial Report Page — Sottra
 * Mobile-first, professional zone profile report with correspondence and growth signals.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, Layers, BarChart3, AlertTriangle, Info, ChevronDown, ChevronUp, TrendingUp, Anchor, Construction, Magnet, Square } from "lucide-react";
import { resolveTerritorialData, type TerritorialDataResult } from "@/lib/territorialDataBackbone";
import { buildTerritorialReport, type TerritorialReportViewModel, type ReportSectionVM, type ReportBadge, type SectionRenderMode } from "@/lib/zoneProfileEngine";
import { badgeVariantClasses } from "@/lib/badgeUtils";
import { buildZoneCorrespondence, type ZoneCorrespondenceResult } from "@/lib/zoneCorrespondenceEngine";
import { buildZoneGrowthSignals, growthStatusLabel, type ZoneGrowthSignalsResult, type GrowthSignal } from "@/lib/zoneGrowthSignals";
import { buildUrbanTransformations, transformationStatusLabel, stageLabel, proximityLabel, relevanceLabel, type UrbanTransformationResult, type UrbanTransformationInput } from "@/lib/zoneUrbanTransformations";
import { buildAttractorsPressure, pressureStatusLabel, attractorFamilyLabel, attractorProximityLabel, attractorRelevanceLabel, attractorIntensityLabel, type AttractorPressureResult, type AttractorInput } from "@/lib/zoneAttractorsPressure";
import { buildZoneBoundaries, boundaryNarrativeMode, boundaryPrecisionLabel, boundaryDisplayModeLabel, boundaryConfidenceLabel, boundarySourceLabel, type ZoneBoundaryResult } from "@/lib/zoneBoundariesEngine";
import AppHeader from "@/components/AppHeader";

// Synthetic demo signals — in production these come from a real source
const DEMO_URBAN_SIGNALS: UrbanTransformationInput[] = [
  { signal_key: "metro_m4", signal_label: "Prolungamento metropolitana M4", signal_family: "opere_pubbliche", signal_type: "infrastruttura", signal_status: "in_progress", signal_stage: "in_progress", signal_direction: "supportive", geo_scope: "sub_comunale", evidence_level: "strong", source_basis: "delibera_comunale", is_official: true },
  { signal_key: "regen_area", signal_label: "Rigenerazione area ex-scalo", signal_family: "rigenerazione_urbana", signal_type: "recupero_area", signal_status: "approved", signal_stage: "approved", signal_direction: "supportive", geo_scope: "sub_comunale", evidence_level: "medium", source_basis: "variante_urbanistica", is_official: true },
];

// Synthetic demo attractors — in production these come from a real source
const DEMO_ATTRACTORS: AttractorInput[] = [
  { signal_key: "uni_statale", signal_label: "Università Statale", signal_family: "poli_formativi", signal_type: "università", attractor_category: "istruzione_superiore", signal_status: "active", signal_direction: "supportive", geo_scope: "sub_comunale", proximity_hint: "immediate", intensity_hint: "strong", evidence_level: "strong", source_basis: "anagrafe_istruzione", is_official: true },
  { signal_key: "stazione_centrale", signal_label: "Stazione Centrale", signal_family: "nodi_di_flusso", signal_type: "stazione_ferroviaria", attractor_category: "trasporto", signal_status: "active", signal_direction: "supportive", geo_scope: "sub_comunale", proximity_hint: "near", intensity_hint: "strong", evidence_level: "strong", source_basis: "rfi_rete", is_official: true },
];

const SECTION_ICONS: Record<string, React.ReactNode> = {
  territorial_identity: <MapPin className="h-4 w-4" />,
  precision_level: <Layers className="h-4 w-4" />,
  territorial_structure: <Layers className="h-4 w-4" />,
  sub_municipal_coverage: <BarChart3 className="h-4 w-4" />,
  market_context: <BarChart3 className="h-4 w-4" />,
  data_quality: <Shield className="h-4 w-4" />,
  limitations: <AlertTriangle className="h-4 w-4" />,
};

function badgeClasses(variant: ReportBadge["variant"]): string {
  return badgeVariantClasses(variant);
}

function renderModeIndicator(mode: SectionRenderMode) {
  if (mode === "partial") {
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium"><Info className="h-3 w-3" /> Parziale</span>;
  }
  return null;
}

function ReportBadgeChip({ badge }: { badge: ReportBadge }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${badgeClasses(badge.variant)}`}
      title={badge.tooltip}
    >
      {badge.label}
    </span>
  );
}

function ReportSection({ section }: { section: ReportSectionVM }) {
  const [expanded, setExpanded] = useState(true);

  if (section.render_mode === "hidden") return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="p-4 pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{SECTION_ICONS[section.key]}</span>
            <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            {renderModeIndicator(section.render_mode)}
          </div>
          <div className="flex items-center gap-2">
            {section.badges.map((b, i) => <ReportBadgeChip key={i} badge={b} />)}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-0 space-y-2">
          {section.facts.length > 0 && (
            <div className="grid gap-1.5">
              {section.facts.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{f.value}</span>
                    {f.badge && <ReportBadgeChip badge={f.badge} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {section.notes.length > 0 && (
            <div className="mt-2 space-y-1">
              {section.notes.map((n, i) => (
                <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SignalDirectionIcon({ direction }: { direction: GrowthSignal["signal_direction"] }) {
  const cls = direction === "positive" ? "text-emerald-500" : direction === "negative" ? "text-destructive" : "text-muted-foreground";
  return <span className={`text-xs font-bold ${cls}`}>{direction === "positive" ? "↑" : direction === "negative" ? "↓" : "—"}</span>;
}

function GrowthSignalsPanel({ growth, corr }: { growth: ZoneGrowthSignalsResult; corr: ZoneCorrespondenceResult }) {
  if (growth.growth_summary.narrative_mode === "hidden") return null;

  return (
    <>
      {/* Zone Correspondence */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <Anchor className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">A cosa corrisponde la zona</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Corrisponde a</span>
            <span className="font-medium text-foreground">{corr.zone_identity.zone_corresponds_to}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Livello reale</span>
            <span className="font-medium text-foreground">{corr.zone_identity.zone_type_label}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Solidità ancoraggio</span>
            <Badge variant={corr.zone_identity.zone_anchor_strength === "strong" ? "default" : "secondary"} className="text-[10px]">
              {corr.zone_identity.zone_anchor_strength}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Peso fallback</span>
            <span className="font-medium text-foreground">{corr.zone_correspondence.fallback_weight === "none" ? "Assente" : corr.zone_correspondence.fallback_weight}</span>
          </div>
          {corr.zone_limitations.transparency_notes.map((n, i) => (
            <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
          ))}
        </CardContent>
      </Card>

      {/* Growth Signals */}
      <Card className="border-border/50">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Segnali della zona</CardTitle>
            </div>
            <Badge variant={growth.growth_summary.overall_growth_signal_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
              {growthStatusLabel(growth.growth_summary.overall_growth_signal_status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {growth.growth_signals.map(s => (
            <div key={s.signal_key} className="flex items-start gap-2 text-sm">
              <SignalDirectionIcon direction={s.signal_direction} />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{s.signal_label}</span>
                <p className="text-xs text-muted-foreground/80">{s.signal_value}</p>
              </div>
            </div>
          ))}
          {growth.growth_limitations.transparency_notes.map((n, i) => (
            <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export default function TerritorialReport() {
  const [istatCode, setIstatCode] = useState("015146");
  const [vm, setVm] = useState<TerritorialReportViewModel | null>(null);
  const [corr, setCorr] = useState<ZoneCorrespondenceResult | null>(null);
  const [growth, setGrowth] = useState<ZoneGrowthSignalsResult | null>(null);
  const [urban, setUrban] = useState<UrbanTransformationResult | null>(null);
  const [attractors, setAttractors] = useState<AttractorPressureResult | null>(null);

  const generate = () => {
    const data = resolveTerritorialData({
      geo_input: { comune_istat_code: istatCode },
      include_placeholders: true,
    });
    const { viewModel } = buildTerritorialReport(data);
    const c = buildZoneCorrespondence(data);
    const g = buildZoneGrowthSignals(data, c);
    const u = buildUrbanTransformations(data, c, DEMO_URBAN_SIGNALS);
    const a = buildAttractorsPressure(data, c, DEMO_ATTRACTORS);
    setVm(viewModel);
    setCorr(c);
    setGrowth(g);
    setUrban(u);
    setAttractors(a);
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground">Profilo Zona</h1>

        {/* Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                value={istatCode}
                onChange={e => setIstatCode(e.target.value)}
                placeholder="Codice ISTAT comune"
                className="flex-1"
              />
              <Button onClick={generate} size="sm">Genera</Button>
            </div>
          </CardContent>
        </Card>

        {vm && (
          <>
            {/* Header */}
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-foreground truncate">{vm.header.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{vm.header.subtitle}</p>
                  </div>
                  <ReportBadgeChip badge={vm.header.precision_badge} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {vm.badges.map((b, i) => <ReportBadgeChip key={i} badge={b} />)}
                </div>
              </CardContent>
            </Card>

            {/* Key facts */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {vm.key_facts.map((f, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Zone Correspondence + Growth Signals */}
            {corr && growth && <GrowthSignalsPanel growth={growth} corr={corr} />}

            {/* Urban Transformations */}
            {urban && urban.urban_transformation_summary.narrative_mode !== "hidden" && (
              <Card className="border-border/50">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Construction className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Trasformazioni e opere rilevate</CardTitle>
                    </div>
                    <Badge variant={urban.urban_transformation_summary.overall_transformation_signal_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
                      {transformationStatusLabel(urban.urban_transformation_summary.overall_transformation_signal_status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  {urban.urban_transformation_signals
                    .filter(s => s.territorial_relevance !== "not_determinable")
                    .map(s => (
                    <div key={s.signal_key} className="flex items-start gap-2 text-sm">
                      <span className={`text-xs font-bold mt-0.5 ${s.signal_direction === "supportive" ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {s.signal_direction === "supportive" ? "↑" : "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">{s.signal_label}</span>
                          <Badge variant="outline" className="text-[9px] py-0">{stageLabel(s.signal_stage)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {proximityLabel(s.proximity_relevance)} · Rilevanza {relevanceLabel(s.territorial_relevance).toLowerCase()} · Evidenza {s.evidence_level}
                        </p>
                      </div>
                    </div>
                  ))}
                  {urban.urban_transformation_limitations.transparency_notes.map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Attractors & Pressure */}
            {attractors && attractors.pressure_summary.narrative_mode !== "hidden" && (
              <Card className="border-border/50">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Magnet className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Attrattori e pressione della zona</CardTitle>
                    </div>
                    <Badge variant={attractors.pressure_summary.overall_pressure_signal_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
                      {pressureStatusLabel(attractors.pressure_summary.overall_pressure_signal_status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  {attractors.attractor_signals
                    .filter(s => s.territorial_relevance !== "not_determinable")
                    .map(s => (
                    <div key={s.signal_key} className="flex items-start gap-2 text-sm">
                      <span className={`text-xs font-bold mt-0.5 ${s.signal_direction === "supportive" ? "text-primary" : "text-muted-foreground"}`}>
                        {s.signal_direction === "supportive" ? "●" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">{s.signal_label}</span>
                          <Badge variant="outline" className="text-[9px] py-0">{attractorFamilyLabel(s.signal_family)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {attractorProximityLabel(s.proximity_relevance)} · Rilevanza {attractorRelevanceLabel(s.territorial_relevance).toLowerCase()} · Intensità {attractorIntensityLabel(s.intensity_hint).toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {attractors.pressure_limitations.transparency_notes.map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed">{n}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {vm.sections.map(s => <ReportSection key={s.key} section={s} />)}
            </div>

            {/* Transparency panel */}
            {vm.transparency_panel.sources.length > 0 && (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Trasparenza fonti
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-1.5">
                    {vm.transparency_panel.sources.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{s.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-foreground">{s.quality}</span>
                          <span className="text-muted-foreground/60">{s.level}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Footer */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{vm.data_quality_footer.status_label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{vm.data_quality_footer.confidence_note}</p>
                {vm.data_quality_footer.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {vm.data_quality_footer.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80">{w}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unsupported sections */}
            {vm.unsupported_sections.length > 0 && (
              <p className="text-xs text-muted-foreground/60 text-center">
                Sezioni non mostrate per dati insufficienti: {vm.unsupported_sections.join(", ")}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
