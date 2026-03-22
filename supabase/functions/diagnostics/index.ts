import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid URL)";
  }
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "").trim();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user)
    return new Response(JSON.stringify({ error: "Auth failed" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  // Access: admin RBAC only — no email-based bypass
  const userId = userData.user.id;
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!isAdmin)
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const CORE_API_URL = (Deno.env.get("CORE_API_URL") || "").replace(/\/+$/, "");
  const coreSecret = Deno.env.get("AI_CORE_SECRET_SOTTRA")
    || Deno.env.get("AI_CORE_SECRET")
    || Deno.env.get("CORE_API_KEY");
  const hasApiKey = !!coreSecret;
  const keySource = Deno.env.get("AI_CORE_SECRET_SOTTRA")
    ? "AI_CORE_SECRET_SOTTRA"
    : Deno.env.get("AI_CORE_SECRET")
      ? "AI_CORE_SECRET"
      : Deno.env.get("CORE_API_KEY")
        ? "CORE_API_KEY"
        : "none";

  const sanitized = CORE_API_URL ? sanitizeUrl(CORE_API_URL) : "(not configured)";

  let healthStatus = "SKIP";
  let healthLatency = 0;
  if (CORE_API_URL && hasApiKey) {
    try {
      const t0 = Date.now();
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${CORE_API_URL}/health`, {
        headers: {
          "x-internal-secret": coreSecret!,
          "Authorization": `Bearer ${coreSecret!}`,
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

  // Redacted output — no raw secrets, no internal hostnames beyond sanitized
  const payload = {
    proxy_local: sanitizeUrl(Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/core-proxy",
    upstream_sanitized: sanitized,
    upstream_origin: "env",
    key_configured: hasApiKey,
    key_source: keySource,
    health: healthStatus,
    health_latency_ms: healthLatency,
    routing: "frontend → core-proxy → Central Core",
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
