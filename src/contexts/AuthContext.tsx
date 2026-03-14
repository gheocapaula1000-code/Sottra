import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Track whether getSession has resolved — prevents onAuthStateChange
    // from prematurely setting loading=false with a null session before
    // the persisted session is hydrated.
    let initialised = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
        if (initialised) setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      initialised = true;
      setSession(sess);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
