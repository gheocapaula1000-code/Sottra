import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, ShieldAlert, Eye, Layers, AlertTriangle } from "lucide-react";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import {
  buildFullBuildingReport,
  supportLevelLabel,
  type BuildingProfile,
  type BuildingReportViewModel,
} from "@/lib/buildingProfileEngine";
import { qualityStatusLabel } from "@/lib/territorialDataBackbone";

export default function AdminBuildingProfile() {
  const [istatCode, setIstatCode] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [address, setAddress] = useState("");
  const [profile, setProfile] = useState<BuildingProfile | null>(null);
  const [vm, setVm] = useState<BuildingReportViewModel | null>(null);

  const run = () => {
    const td = resolveTerritorialData({
      geo_input: { comune_istat_code: istatCode || undefined },
    });
    const latN = lat ? parseFloat(lat) : null;
    const lngN = lng ? parseFloat(lng) : null;
    const result = buildFullBuildingReport({
      territorial_data: td,
      lat: latN,
      lng: lngN,
      has_photo: false,
      identification_confidence: latN ? 0.6 : 0,
      identification_mode: latN ? "coordinate" : "territorial_only",
    });
    setProfile(result.profile);
    setVm(result.viewModel);
  };

  const badgeColor = (v: string) => {
    if (v === "official") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (v === "elaborated") return "bg-sky-500/10 text-sky-700 border-sky-500/20";
    if (v === "partial") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Building Profile Engine — Diagnostica
        </h1>

        {/* Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Test Building Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Codice ISTAT (es. 015146)" value={istatCode} onChange={e => setIstatCode(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Lat (opz.)" value={lat} onChange={e => setLat(e.target.value)} />
              <Input placeholder="Lng (opz.)" value={lng} onChange={e => setLng(e.target.value)} />
            </div>
            <Button onClick={run} className="w-full">Genera profilo edificio</Button>
          </CardContent>
        </Card>

        {profile && vm && (
          <>
            {/* Identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Identità edificio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Modalità</span><span className="font-medium">{profile.building_identity.building_scope_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Precisione</span><span className="font-medium">{profile.building_identity.identification_precision}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Puntuale</span><span className="font-medium">{profile.building_identity.is_point_specific ? "Sì" : "No"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Livello edificio</span><span className="font-medium">{profile.building_identity.is_building_level_supported ? "Supportato" : "No"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Via/civico</span><span className="font-medium">Non introdotto</span></div>
              </CardContent>
            </Card>

            {/* Localization */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Localizzazione
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Livello risolto</span><span className="font-medium">{profile.building_localization.effective_building_scope}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Coordinate</span><span className="font-medium">{profile.building_localization.coordinate_status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Indirizzo</span><span className="font-medium">{profile.building_localization.address_status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Civico</span><span className="font-medium">{profile.building_localization.civic_status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Confidenza</span><span className="font-medium">{Math.round(profile.building_localization.localization_confidence * 100)}%</span></div>
              </CardContent>
            </Card>

            {/* Supported Facts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Fatti supportati
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {[
                  { title: "Identificazione", facts: profile.building_supported_facts.identification_facts },
                  { title: "Localizzazione", facts: profile.building_supported_facts.localization_facts },
                  { title: "Contesto territoriale", facts: profile.building_supported_facts.territorial_context_facts },
                  { title: "Mercato", facts: profile.building_supported_facts.market_linkage_facts },
                ].map(group => group.facts.length > 0 && (
                  <div key={group.title}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{group.title}</p>
                    {group.facts.map(f => (
                      <div key={f.key} className="flex items-center justify-between py-0.5">
                        <span className="text-muted-foreground">{f.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{f.value}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                            f.is_direct ? "border-emerald-500/30 text-emerald-600" :
                            f.is_contextual ? "border-sky-500/30 text-sky-600" :
                            "border-amber-500/30 text-amber-600"
                          }`}>
                            {supportLevelLabel(f.support_level)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Renderability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Renderability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {Object.entries(profile.building_report_renderability.sections).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{key}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                      val.render_mode === "full" ? "border-emerald-500/30 text-emerald-600" :
                      val.render_mode === "partial" ? "border-amber-500/30 text-amber-600" :
                      "border-red-500/30 text-red-600"
                    }`}>
                      {val.render_mode}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Unsupported Claims */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Affermazioni non supportate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {profile.building_inferred_bounds.what_cannot_be_said.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                    <span>{c}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Rischio sovraprecisione</span><span className="font-medium">{profile.building_inferred_bounds.overprecision_risk}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rischio falsa specificità</span><span className="font-medium">{profile.building_inferred_bounds.false_specificity_risk}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Quality */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Qualità</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Stato</span><span className="font-medium">{qualityStatusLabel(profile.building_data_quality.overall_quality_status)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Identificazione</span><span className="font-medium">{profile.building_data_quality.identification_strength}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Localizzazione</span><span className="font-medium">{profile.building_data_quality.localization_strength}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Supporto contestuale</span><span className="font-medium">{profile.building_data_quality.contextual_support_strength}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trasparenza</span><span className="font-medium">{Math.round(profile.building_data_quality.transparency_score * 100)}%</span></div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-4 space-y-2 text-xs">
                <p className="font-semibold text-foreground">{profile.building_summary.executive_summary}</p>
                <p className="text-muted-foreground">{profile.building_summary.safe_user_summary}</p>
                <p className="text-[10px] text-muted-foreground/60 italic">{profile.building_summary.next_best_step}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
