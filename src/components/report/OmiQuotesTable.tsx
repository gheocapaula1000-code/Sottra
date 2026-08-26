import { formatOmiRentRange, formatOmiSaleRange, isCivileTipologia, isNormaleStato, withoutMashedCivileEnvelope } from "@/lib/omiQuotes";
import { cn } from "@/lib/utils";
import type { OmiQuote } from "@/types";

export function formatOmiSaleDisplay(q: OmiQuote): string {
  const range = formatOmiSaleRange(q);
  return range ? `${range} €/m²` : "";
}

export function formatOmiRentDisplay(q: OmiQuote): string {
  const range = formatOmiRentRange(q);
  return range ? `${range} €/m²/mese` : "";
}

function isReferenceQuote(q: OmiQuote): boolean {
  return isCivileTipologia(q.tipologia) && isNormaleStato(q.stato);
}

export function OmiQuotesTable({ quotes }: { quotes: OmiQuote[] }) {
  const rows = withoutMashedCivileEnvelope(quotes);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 mb-3" data-testid="omi-quotes-table">
      {rows.map((q, i) => {
        const sale = formatOmiSaleDisplay(q);
        const rent = formatOmiRentDisplay(q);
        const reference = isReferenceQuote(q);
        return (
          <div
            key={`${q.tipologia}|${q.stato ?? ""}|${i}`}
            data-testid="omi-quote-row"
            data-omi-reference={reference ? "true" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 space-y-1",
              reference ? "bg-emerald-500/10 border border-emerald-500/25" : "bg-muted/50",
            )}
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground">{q.tipologia}</p>
              <span className="flex items-center gap-1.5">
                {reference && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Riferimento
                  </span>
                )}
                {q.stato && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{q.stato}</span>
                )}
              </span>
            </div>
            {sale && (
              <p className={cn("font-bold text-foreground", reference ? "text-base" : "text-sm")}>
                Vendita {sale}
              </p>
            )}
            {rent ? (
              <p className="text-[11px] text-muted-foreground">Affitto {rent}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground" data-testid="omi-quote-rent-blank" />
            )}
          </div>
        );
      })}
    </div>
  );
}
