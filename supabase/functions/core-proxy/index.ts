import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkEntitlement } from "../_shared/entitlement.ts";

/** Endpoint prefixes the client is allowed to reach on the upstream Core. */
const ALLOWED_ENDPOINT_PREFIXES = [
  "/civiko-",
  "/sottra",
  "/scan",
  "/pro-sources",
  "/health",
];

const ALLOWED_METHODS = ["GET", "POST"];

export function isAllowedEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string") return false;
  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (ep.includes("..") || ep.includes("//") || ep.includes("\\")) return false;
  if (/^\/*[a-z][a-z0-9+.-]*:/i.test(ep)) return false;
  if (/[\r\n\s]/.test(ep)) return false;
  if (ep.length > 200) return false;
  return ALLOWED_ENDPOINT_PREFIXES.some((p) => ep === p || ep.startsWith(p));
}


function jsonResponse(body: Record<string, unknown>, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Resolve core API secret with per-app priority and legacy fallback */

/** Build upstream Sottra URL. Accepts CORE_API_URL as project root, /functions/v1, or /functions/v1/sottra. */
function buildSottraCoreUrl(base: string, endpoint: string): string {
  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const b = base.replace(/\/+$/, "");
  if (/\/sottra$/i.test(b)) return `${b}${ep}`;
  if (/\/functions\/v1$/i.test(b)) return `${b}/sottra${ep}`;
  // project root (https://xxx.supabase.co)
  return `${b}/functions/v1/sottra${ep}`;
}

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

    // ── 2. Server-side entitlement gate (trial / subscription) ──
    const entitlement = await checkEntitlement(userData.user.id);
    if (!entitlement.allowed) {
      return jsonResponse(
        { error: { message: "Abbonamento non attivo o periodo di prova esaurito" }, limit_reached: true },
        403,
        req,
      );
    }

    // ── 3. Parse and validate request body ────────────────
    const { endpoint, method = "POST", payload, timeout = 10000 } = await req.json();

    if (!endpoint || typeof endpoint !== "string" || !isAllowedEndpoint(endpoint)) {
      return jsonResponse({ error: { message: "Parametri della richiesta non validi" } }, 400, req);
    }

    const upstreamMethod = typeof method === "string" ? method.toUpperCase() : "";
    if (!ALLOWED_METHODS.includes(upstreamMethod)) {
      return jsonResponse({ error: { message: "Metodo non consentito" } }, 405, req);
    }

    const safeTimeout = typeof timeout === "number" && timeout > 0 && timeout <= 60000 ? timeout : 10000;

    console.log(`[core-proxy] IN endpoint=${endpoint} method=${upstreamMethod} user=${userData.user.id}`);


    // ── 3. Check backend configuration ────────────────────
    const CORE_API_URL = (Deno.env.get("CORE_API_URL") || "").replace(/\/+$/, "");
    const CORE_API_KEY = resolveCoreSecret();

    if (!CORE_API_URL || !CORE_API_KEY) {
      console.error("[core-proxy] missing CORE_API_URL or secret");
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
      const coreUrl = buildSottraCoreUrl(CORE_API_URL, endpoint);
      console.log(`[core-proxy] FORWARD → ${coreUrl}`);

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

      console.log(`[core-proxy] RESPONSE ${endpoint} status=${response.status}`);

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
