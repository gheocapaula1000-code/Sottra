import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import {
  PLANS,
  PLAN_DESCRIPTIONS,
  PLAN_FEATURES,
  PLAN_POPULAR,
  planScansLabel,
  planUsersLabel,
  type PlanKey,
} from "@/lib/plans";

const PLAN_ORDER: PlanKey[] = ["agente", "agenzia", "rete"];

interface PlanCheckoutGridProps {
  onCheckout: (key: PlanKey) => void;
  loadingPlan: PlanKey | null;
  currentPlan?: PlanKey | null;
  ctaLabel?: (key: PlanKey) => string;
}

export default function PlanCheckoutGrid({
  onCheckout,
  loadingPlan,
  currentPlan = null,
  ctaLabel,
}: PlanCheckoutGridProps) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      {PLAN_ORDER.map((key) => {
        const plan = PLANS[key];
        const popular = key === PLAN_POPULAR;
        const isCurrent = currentPlan === key;
        const label = isCurrent
          ? "Piano attuale"
          : ctaLabel
            ? ctaLabel(key)
            : `Scegli ${plan.name}`;

        return (
          <Card
            key={key}
            className={`relative flex flex-col rounded-2xl border p-6 text-left ${
              popular
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card"
            }`}
          >
            {popular && (
              <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs">
                Più popolare
              </Badge>
            )}
            <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{PLAN_DESCRIPTIONS[key]}</p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-foreground">€{plan.price}</span>
              <span className="text-muted-foreground">/mese</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">{planScansLabel(plan.scans)}</Badge>
              <Badge variant="secondary" className="text-xs">{planUsersLabel(plan.users)}</Badge>
            </div>

            <Separator className="my-5" />

            <ul className="flex-1 space-y-2">
              {PLAN_FEATURES[key].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              className="mt-6 w-full gap-2"
              variant={popular ? "default" : "outline"}
              size="lg"
              disabled={isCurrent || loadingPlan !== null}
              onClick={() => onCheckout(key)}
            >
              {loadingPlan === key ? "Caricamento…" : label}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
