import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isOwnerById } from "../_shared/ownerUtils.ts";
import { isBillingActive } from "../_shared/billing.ts";

function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid URL)";
  }
}

/** Mask email for safe display: first 2 chars + ***@domain */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Check if email is in a comma-separated env var (normalized). */
function emailInEnvList(email: string, envVar: string): boolean {
  const raw = Deno.env.get(envVar) ?? "";
  if (!raw.trim()) return false;
  const list = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** Check if ALLOWED_ORIGINS includes the request origin. */
function isOriginAllowed(req: Request): boolean {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  if (!raw.trim()) return false;
  const origins = raw.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean);
  const reqOrigin = (req.headers.get("Origin") ?? "").toLowerCase();
  return origins.includes(reqOrigin);
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req);
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  // ── Determine action ──
  let action = "";
  try {
    const cloned = req.clone();
    const body = await cloned.json();
    if (body?.action) action = String(body.action);
  } catch {
    // No body or not JSON — default to admin diagnostics
  }

  // ══════════════════════════════════════════════════════════
  // Self-test: accessible to ANY authenticated user (no admin required)
  // Returns safe diagnostic info without exposing secrets
  // ══════════════════════════════════════════════════════════
  if (action === "self-test") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({
        session_present: false,
        user_email: "—",
        check_reachable: true,
        check_code: "auth_missing",
        billing_configured: isBillingActive(),
        owner_match: false,
        admin_match: false,
        origin_allowed: isOriginAllowed(req),
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let userId: string | null = null;

    try {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });

      // Try getClaims first, fall back to getUser
      let claimsOk = false;
      try {
        const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
        if (!claimsError && claimsData?.claims) {
          userId = claimsData.claims.sub as string;
          claimsOk = true;
        }
      } catch { /* fallback below */ }

      if (!claimsOk) {
        const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
        if (userErr || !userData?.user) {
          return json({
            session_present: true,
            user_email: "—",
            check_reachable: true,
            check_code: "auth_invalid",
            billing_configured: isBillingActive(),
            owner_match: false,
            admin_match: false,
            origin_allowed: isOriginAllowed(req),
          });
        }
        userId = userData.user.id;
      }
    } catch {
      return json({
        session_present: true,
        user_email: "—",
        check_reachable: true,
        check_code: "auth_exception",
        billing_configured: isBillingActive(),
        owner_match: false,
        admin_match: false,
        origin_allowed: isOriginAllowed(req),
      });
    }

    // Resolve email & check bootstrap
    let userEmail = "—";
    let ownerMatch = false;
    let adminMatch = false;
    let bypassMatch = false;

    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
      const { data: userData } = await serviceClient.auth.admin.getUserById(userId!);
      if (userData?.user?.email) {
        userEmail = maskEmail(userData.user.email);
        ownerMatch = emailInEnvList(userData.user.email, "ADMIN_BOOTSTRAP_EMAILS");
        bypassMatch = emailInEnvList(userData.user.email, "COMMERCIAL_BYPASS_EMAILS");

        try {
          const { data: roleData } = await serviceClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userId!)
            .eq("role", "admin")
            .maybeSingle();
          adminMatch = !!roleData;
        } catch { /* non-blocking */ }
      }
    } catch { /* non-blocking */ }

    return json({
      session_present: true,
      user_email: userEmail,
      check_reachable: true,
      check_code: "resolved",
      billing_configured: isBillingActive(),
      owner_match: ownerMatch,
      admin_match: adminMatch || ownerMatch,
      bypass_match: bypassMatch,
      origin_allowed: isOriginAllowed(req),
    });
  }

  // ══════════════════════════════════════════════════════════
  // Admin diagnostics (original): requires admin/owner role
  // ══════════════════════════════════════════════════════════
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "").trim();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user)
    return json({ error: "Auth failed" }, 401);

  const userId = userData.user.id;

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  let isOwner = false;
  try {
    isOwner = await isOwnerById(userId);
  } catch { /* non-blocking */ }

  if (!isAdmin && !isOwner)
    return json({ error: "Forbidden" }, 403);

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

  return json(payload);
});
