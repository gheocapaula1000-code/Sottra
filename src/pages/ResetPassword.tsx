import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SottraMark from "@/components/SottraMark";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the hash fragment
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if we already have a session (user clicked the link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Errore", description: "Le password non coincidono.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Errore", description: "La password deve avere almeno 6 caratteri.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password aggiornata", description: "Ora puoi accedere con la nuova password." });
      navigate("/app");
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <SottraMark size="lg" />
          <p className="text-sm text-muted-foreground">Verifica del link in corso…</p>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <SottraMark size="lg" />
          <p className="text-sm text-muted-foreground">Imposta la nuova password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nuova password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Minimo 6 caratteri"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Conferma password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              placeholder="Ripeti la password"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Salvataggio…" : "Salva nuova password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
