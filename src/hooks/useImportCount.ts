/**
 * Lightweight hook to check if the user has any KeyDraft imports.
 * Designed to be resilient: returns 0 on any error, never blocks the app.
 * This is used for optional UI hints (e.g. dashboard quick action).
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useImportCount(): { count: number; loading: boolean } {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { count: total, error } = await supabase
          .from("keydraft_imports" as never)
          .select("id", { count: "exact", head: true });

        if (!cancelled && !error) {
          setCount(total ?? 0);
        }
      } catch {
        // Silently fail — imports are optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { count, loading };
}
