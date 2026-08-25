import { cn } from "@/lib/utils";
import type { IstatSubMunicipalArea } from "@/types";
import {
  applyOmiNameOnlySuggestion,
  hasRenderableIstatAreas,
  ISTAT_SUB_MUNICIPAL_SOURCE_LABEL,
  OMI_NAME_ONLY_SUGGESTION_NOTE,
} from "@/lib/istatSubMunicipalAreas";

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { maximumFractionDigits: 0 });
}

export function IstatSubMunicipalAreasTable({
  areas,
  omiZoneLabel,
}: {
  areas: IstatSubMunicipalArea[] | null | undefined;
  omiZoneLabel?: string | null;
}) {
  const annotated = applyOmiNameOnlySuggestion(areas ?? [], omiZoneLabel);
  if (!hasRenderableIstatAreas(annotated)) return null;

  const showDensity = annotated.some((a) => a.densita != null);
  const showAge = annotated.some((a) => a.etaMedia != null);
  const suggested = annotated.find((a) => a.suggestedNameOnly);

  return (
    <div className="mt-3" data-testid="istat-submunicipal-areas">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        Aree sub-comunali
      </p>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2.5 py-1.5 font-medium">Area</th>
              <th className="px-2.5 py-1.5 font-medium text-right">Popolazione</th>
              <th className="px-2.5 py-1.5 font-medium text-right">Famiglie</th>
              {showDensity && <th className="px-2.5 py-1.5 font-medium text-right">Densità</th>}
              {showAge && <th className="px-2.5 py-1.5 font-medium text-right">Età media</th>}
            </tr>
          </thead>
          <tbody>
            {annotated.map((area) => (
              <tr
                key={area.code ?? area.name}
                data-area={area.name}
                data-suggested={area.suggestedNameOnly ? "true" : "false"}
                className={cn(
                  "border-t border-border/30",
                  area.suggestedNameOnly && "bg-emerald-500/10",
                )}
              >
                <td className="px-2.5 py-1.5 font-medium text-foreground">
                  {area.name}
                  {area.suggestedNameOnly && (
                    <span className="ml-1.5 text-[9px] font-normal text-emerald-400">
                      suggerimento nominale
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                  {fmtInt(area.popolazione)}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                  {fmtInt(area.nucleiFamiliari)}
                </td>
                {showDensity && (
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                    {fmtInt(area.densita)}
                  </td>
                )}
                {showAge && (
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                    {area.etaMedia == null ? "—" : area.etaMedia.toLocaleString("it-IT", { maximumFractionDigits: 1 })}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
        {annotated[0]?.sourceLabel ?? ISTAT_SUB_MUNICIPAL_SOURCE_LABEL}
      </p>
      {suggested && (
        <p className="mt-1.5 text-[10px] text-emerald-400/90 leading-relaxed">
          {OMI_NAME_ONLY_SUGGESTION_NOTE}
        </p>
      )}
    </div>
  );
}
