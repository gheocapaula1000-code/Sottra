/**
 * Lightweight hook to check if the user has any KeyDraft imports.
 * Designed to be resilient: returns 0 on any error, never blocks the app.
 * This is used for optional UI hints (e.g. dashboard quick action).
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useImportCount(): { count: number; loading: boolean; refetch: () => Promise<void> } {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const { count: total, error } = await supabase
        .from("keydraft_imports" as never)
        .select("id", { count: "exact", head: true });

      if (!error) {
        setCount(total ?? 0);
      }
    } catch {
      // Silently fail — imports are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { count, loading, refetch };
}
