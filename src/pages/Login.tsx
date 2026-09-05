import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SottraMark from "@/components/SottraMark";
import { PLANS } from "@/lib/plans";
import { createCheckoutSession, redirectToCheckout } from "@/lib/checkout";
import {
  consumePendingPlan,
  releaseCheckoutLaunchLock,
  resolvePendingPlan,
  safeInternalPath,
  takeCheckoutLaunchLock,
  withPlanParam,
} from "@/lib/pendingCheckout";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const plan = resolvePendingPlan(searchParams.toString());
  const nextPath = safeInternalPath(searchParams.get("next"));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast({ title: "Errore di accesso", description: error.message, variant: "destructive" });
      return;
    }

    if (plan) {
      consumePendingPlan();
      if (takeCheckoutLaunchLock()) {
        const result = await createCheckoutSession(PLANS[plan].price_id);
        if (result.ok) {
          redirectToCheckout(result.url);
          return;
        }
        releaseCheckoutLaunchLock();
        setLoading(false);
        toast({
          title: "Checkout non avviato",
          description: result.error,
          variant: result.error_code === "unknown" ? "destructive" : "default",
        });
        navigate("/abbonamento");
        return;
      }
      setLoading(false);
      navigate("/abbonamento");
      return;
    }

    setLoading(false);
    navigate(nextPath ?? "/app");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-safe">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <SottraMark size="lg" textOnly />
          <p className="text-sm text-muted-foreground">Accedi al tuo account</p>
          {plan && (
            <p className="text-xs text-primary font-medium text-center">
              Dopo l'accesso apriamo il checkout Stripe per il piano {PLANS[plan].name}. La prova senza carta resta disponibile.
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@esempio.it" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Minimo 6 caratteri" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Accesso in corso…" : plan ? `Accedi e abbonati a ${PLANS[plan].name}` : "Accedi"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <Link to="/forgot-password" className="block text-primary hover:underline">
            Password dimenticata?
          </Link>
          <p>
            Non hai un account?{" "}
            <Link to={withPlanParam("/signup", plan)} className="text-primary hover:underline">Registrati gratis</Link>
          </p>
          <p className="text-[10px] pt-1">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
            {" · "}
            <Link to="/termini-condizioni" className="hover:text-foreground transition-colors">Termini</Link>
          </p>
          <Link to="/" className="block text-xs hover:text-foreground transition-colors pt-1">
            ← Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
