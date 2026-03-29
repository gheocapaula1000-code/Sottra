/**
 * Territorial Report Page — Sottra Phase 3
 * Mobile-first, professional zone profile report.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, Layers, BarChart3, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildTerritorialReport, type TerritorialReportViewModel, type ReportSectionVM, type ReportBadge, type SectionRenderMode } from "@/lib/zoneProfileEngine";
import AppHeader from "@/components/AppHeader";

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
  switch (variant) {
    case "official": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "elaborated": return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "partial": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "unavailable": return "bg-muted text-muted-foreground border-border";
    case "info": return "bg-primary/15 text-primary border-primary/30";
  }
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

export default function TerritorialReport() {
  const [istatCode, setIstatCode] = useState("015146");
  const [vm, setVm] = useState<TerritorialReportViewModel | null>(null);

  const generate = () => {
    const data = resolveTerritorialData({
      geo_input: { comune_istat_code: istatCode },
      include_placeholders: true,
    });
    const { viewModel } = buildTerritorialReport(data);
    setVm(viewModel);
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

            {/* Sections */}
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
