import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

function jsonResponse(body: Record<string, unknown>, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Resolve core API secret with per-app priority and legacy fallback */
function resolveCoreSecret(): string | undefined {
  return Deno.env.get("AI_CORE_SECRET_SOTTRA")
    || Deno.env.get("AI_CORE_SECRET")
    || Deno.env.get("CORE_API_KEY");
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // ── 1. Authenticate caller ──────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: { message: "Accesso non autorizzato" } }, 401, req);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("Auth verification failed:", userError?.message);
      return jsonResponse({ error: { message: "Sessione non valida o scaduta" } }, 401, req);
    }

    // ── 2. Parse request body ─────────────────────────────
    const { endpoint, method = "POST", payload, timeout = 10000 } = await req.json();

    if (!endpoint || typeof endpoint !== "string") {
      return jsonResponse({ error: { message: "Parametri della richiesta non validi" } }, 400, req);
    }

    // ── 3. Check backend configuration ────────────────────
    const CORE_API_URL = (Deno.env.get("CORE_API_URL") || "").replace(/\/+$/, "");
    const CORE_API_KEY = resolveCoreSecret();

    if (!CORE_API_URL || !CORE_API_KEY) {
      console.error("Core backend not configured: missing CORE_API_URL or secret");
      return jsonResponse(
        { error: { message: "Servizio non ancora disponibile. Configurazione in corso." } },
        503,
        req,
      );
    }

    // ── 4. Forward to Core API ────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const coreUrl = `${CORE_API_URL}${endpoint}`;

      const response = await fetch(coreUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": CORE_API_KEY,
          "Authorization": `Bearer ${CORE_API_KEY}`,
          "x-source-app": "sottra",
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      return jsonResponse(data, response.ok ? 200 : response.status, req);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(`Core timeout on ${endpoint} after ${timeout}ms`);
        return jsonResponse(
          { error: { message: "Il servizio non ha risposto in tempo. Riprova tra qualche istante." } },
          504,
          req,
        );
      }

      console.error("Core upstream error:", fetchError);
      return jsonResponse(
        { error: { message: "Errore di comunicazione con il servizio. Riprova più tardi." } },
        502,
        req,
      );
    }
  } catch (error) {
    console.error("Core proxy unhandled error:", error);
    return jsonResponse(
      { error: { message: "Errore temporaneo del servizio" } },
      500,
      req,
    );
  }
});
