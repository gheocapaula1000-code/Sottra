import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

function json(body: Record<string, unknown>, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/**
 * Validates the canonical bridge payload.
 * Returns null if valid, or an error string.
 */
function validatePayload(p: unknown): string | null {
  if (!p || typeof p !== "object") return "Payload mancante o non valido";
  const obj = p as Record<string, unknown>;

  if (!obj.source || typeof obj.source !== "object") return "Campo 'source' mancante";
  if (!obj.listing || typeof obj.listing !== "object") return "Campo 'listing' mancante";

  const source = obj.source as Record<string, unknown>;
  const listing = obj.listing as Record<string, unknown>;

  if (typeof source.app !== "string" || !source.app) return "source.app obbligatorio";
  if (typeof listing.listing_id !== "string" || !listing.listing_id) return "listing.listing_id obbligatorio";

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Metodo non supportato" }, 405);
  }

  // ── Auth: accept either user JWT or internal secret ────
  const authHeader = req.headers.get("Authorization") ?? "";
  const internalSecret = req.headers.get("x-internal-secret") ?? "";
  const CORE_API_KEY = Deno.env.get("CORE_API_KEY") ?? "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let userId: string | null = null;

  // Internal bridge call from Central Core
  if (internalSecret && CORE_API_KEY && internalSecret === CORE_API_KEY) {
    // Bridge call — userId will come from the payload or be null
    userId = null;
  } else if (authHeader.startsWith("Bearer ")) {
    // User-initiated call
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Autenticazione non valida" }, 401);
    }
    userId = userData.user.id;
  } else {
    return json({ ok: false, error: "Autenticazione richiesta" }, 401);
  }

  try {
    const body = await req.json();
    const payload = body.payload ?? body;

    // ── Validate ────────────────────────────────────────
    const validationError = validatePayload(payload);
    if (validationError) {
      console.error("[keydraft-import] Validation failed:", validationError);
      return json({ ok: false, error: validationError }, 400);
    }

    const listing = payload.listing as { listing_id: string; run_id?: string };
    const source = payload.source as { app: string };

    // Use service role for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Idempotency: check existing import ──────────────
    const { data: existing } = await adminClient
      .from("keydraft_imports")
      .select("id, status")
      .eq("listing_id", listing.listing_id)
      .maybeSingle();

    if (existing) {
      // Update the existing record with fresh payload data
      const { error: updateError } = await adminClient
        .from("keydraft_imports")
        .update({
          bridge_payload: payload,
          origin_map: payload.origin_map ?? {},
          run_id: listing.run_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[keydraft-import] Update failed:", updateError);
        return json({ ok: false, error: "Errore durante l'aggiornamento" }, 500);
      }

      console.log(`[keydraft-import] Updated existing import ${existing.id} for listing ${listing.listing_id}`);
      return json({
        ok: true,
        import_id: existing.id,
        action: "updated",
        listing_id: listing.listing_id,
      });
    }

    // ── Insert new import ───────────────────────────────
    const { data: inserted, error: insertError } = await adminClient
      .from("keydraft_imports")
      .insert({
        listing_id: listing.listing_id,
        run_id: listing.run_id ?? null,
        user_id: userId,
        source_app: source.app,
        status: "importata",
        bridge_payload: payload,
        sottra_completions: {},
        origin_map: payload.origin_map ?? {},
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[keydraft-import] Insert failed:", insertError);
      return json({ ok: false, error: "Errore durante il salvataggio" }, 500);
    }

    console.log(`[keydraft-import] Created import ${inserted.id} for listing ${listing.listing_id}`);
    return json({
      ok: true,
      import_id: inserted.id,
      action: "created",
      listing_id: listing.listing_id,
    });
  } catch (err) {
    console.error("[keydraft-import] Unhandled error:", err);
    return json({ ok: false, error: "Errore interno del servizio" }, 500);
  }
});
