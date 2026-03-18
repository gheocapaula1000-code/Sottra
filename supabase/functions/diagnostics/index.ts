import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid URL)";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Verify caller is admin/owner
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user)
    return new Response(JSON.stringify({ error: "Auth failed" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const userId = userData.user.id;
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  const OWNER_EMAILS = ["gheocapaula@gmail.com", "gheocapaula1000@gmail.com"];
  const isOwner = OWNER_EMAILS.includes(userData.user.email?.toLowerCase() ?? "");

  if (!isAdmin && !isOwner)
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Gather config info
  const CORE_API_URL = (Deno.env.get("CORE_API_URL") || "").replace(/\/+$/, "");
  const hasApiKey = !!(Deno.env.get("AI_CORE_SECRET") || Deno.env.get("CORE_API_KEY"));
  const keySource = Deno.env.get("AI_CORE_SECRET")
    ? "AI_CORE_SECRET"
    : Deno.env.get("CORE_API_KEY")
      ? "CORE_API_KEY"
      : "none";

  const sanitized = CORE_API_URL ? sanitizeUrl(CORE_API_URL) : "(not configured)";

  // Official core detection
  const OFFICIAL_HOST = "jpunnzgixcghuydstdlt.supabase.co";
  let isOfficial = false;
  try {
    isOfficial = new URL(CORE_API_URL).host === OFFICIAL_HOST;
  } catch {}

  // Health check
  let healthStatus = "SKIP";
  let healthLatency = 0;
  if (CORE_API_URL && hasApiKey) {
    const apiKey = Deno.env.get("AI_CORE_SECRET") || Deno.env.get("CORE_API_KEY") || "";
    try {
      const t0 = Date.now();
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${CORE_API_URL}/health`, {
        headers: {
          "x-internal-secret": apiKey,
          "Authorization": `Bearer ${apiKey}`,
          "x-source-app": "sottra",
        },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      healthLatency = Date.now() - t0;
      healthStatus = res.ok ? "PASS" : `FAIL (${res.status})`;
    } catch (e) {
      healthStatus = `FAIL (${e instanceof Error ? e.message : "unknown"})`;
    }
  }

  const payload = {
    proxy_local: sanitizeUrl(Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/core-proxy",
    upstream_sanitized: sanitized,
    upstream_origin: "env",
    key_configured: hasApiKey,
    key_source: keySource,
    is_official: isOfficial,
    official_host: OFFICIAL_HOST,
    health: healthStatus,
    health_latency_ms: healthLatency,
    routing: "frontend → core-proxy → Central Core",
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
