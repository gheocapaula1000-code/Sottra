import { formatOmiRentRange, formatOmiSaleRange } from "@/lib/omiQuotes";
import type { OmiQuote } from "@/types";

export function formatOmiSaleDisplay(q: OmiQuote): string {
  const range = formatOmiSaleRange(q);
  return range ? `${range} €/m²` : "";
}

export function formatOmiRentDisplay(q: OmiQuote): string {
  const range = formatOmiRentRange(q);
  return range ? `${range} €/m²/mese` : "";
}

export function OmiQuotesTable({ quotes }: { quotes: OmiQuote[] }) {
  if (quotes.length === 0) return null;

  return (
    <div className="space-y-2 mb-3" data-testid="omi-quotes-table">
      {quotes.map((q, i) => {
        const sale = formatOmiSaleDisplay(q);
        const rent = formatOmiRentDisplay(q);
        return (
          <div
            key={`${q.tipologia}|${q.stato ?? ""}|${i}`}
            data-testid="omi-quote-row"
            className="rounded-lg bg-muted/50 px-3 py-2 space-y-1"
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground">{q.tipologia}</p>
              {q.stato && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{q.stato}</span>
              )}
            </div>
            {sale && (
              <p className="text-sm font-bold text-foreground">
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
