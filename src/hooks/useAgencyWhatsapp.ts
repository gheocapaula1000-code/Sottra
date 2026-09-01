import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  cacheAgencyWhatsapp,
  normalizeItalianMobile,
  readCachedAgencyWhatsapp,
} from "@/lib/agencyWhatsapp";

/**
 * Numero WhatsApp dell'agenzia dell'agente loggato.
 * Persistenza sul profilo dell'utente (user_metadata dell'auth esistente),
 * con cache localStorage sul telefono.
 */
export function useAgencyWhatsapp() {
  const { user } = useAuth();
  const [phone, setPhone] = useState<string | null>(() => readCachedAgencyWhatsapp());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const remote = normalizeItalianMobile(
      typeof meta?.agency_whatsapp === "string" ? (meta.agency_whatsapp as string) : null,
    );
    if (remote) {
      setPhone(remote);
      cacheAgencyWhatsapp(remote);
    }
  }, [user]);

  const save = useCallback(async (input: string): Promise<string | null> => {
    const norm = normalizeItalianMobile(input);
    if (!norm) return null; // fail-closed
    setSaving(true);
    try {
      setPhone(norm);
      cacheAgencyWhatsapp(norm);
      try {
        await supabase.auth.updateUser({ data: { agency_whatsapp: norm } });
      } catch {
        /* offline: resta la cache locale */
      }
      return norm;
    } finally {
      setSaving(false);
    }
  }, []);

  return { phone, save, saving, hasPhone: phone !== null };
}
