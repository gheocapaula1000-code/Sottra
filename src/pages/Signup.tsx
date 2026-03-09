import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SottraMark from "@/components/SottraMark";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      toast({ title: "Errore di registrazione", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Registrazione completata", description: "Controlla la tua email per confermare l'account." });
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center">
            <img src={logoS} alt="Sottra" className="h-12 w-auto" style={{ mixBlendMode: "lighten" }} />
            <span className="ml-[-0.6rem] text-3xl font-black text-foreground tracking-tight">ottra</span>
          </div>
          <p className="text-sm text-muted-foreground">Crea il tuo account</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@esempio.it" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Minimo 6 caratteri" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Registrazione…" : "Registrati"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Hai già un account?{" "}
            <Link to="/login" className="text-primary hover:underline">Accedi</Link>
          </p>
          <Link to="/" className="block text-xs hover:text-foreground transition-colors">
            ← Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
