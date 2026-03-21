import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerEmail } from "../_shared/ownerUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token vuoto" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;

    // Owner/admin bypass — don't consume scans
    if (isOwnerEmail(user.email)) {
      return new Response(JSON.stringify({ recorded: false, bypassed: true, scans_used: 0, max_scans: 999 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      return new Response(JSON.stringify({ recorded: false, bypassed: true, scans_used: 0, max_scans: 999 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Payload non valido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const scan_id = body.scan_id;
    if (!scan_id || typeof scan_id !== "string") {
      return new Response(JSON.stringify({ error: "scan_id richiesto" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ── Check trial/subscription limits before recording ──
    let { data: trial } = await supabaseClient
      .from("user_trials")
      .select("scans_used, max_scans, trial_end")
      .eq("user_id", user.id)
      .single();

    // Auto-create trial row if missing
    if (!trial) {
      const { data: newTrial } = await supabaseClient
        .from("user_trials")
        .insert({ user_id: user.id })
        .select("scans_used, max_scans, trial_end")
        .single();
      trial = newTrial;
    }

    const now = new Date();
    const trialActive = trial
      ? now < new Date(trial.trial_end) && trial.scans_used < trial.max_scans
      : false;

    // Check Stripe subscription (optional, non-blocking)
    let hasSubscription = false;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && user.email) {
      try {
        const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
          hasSubscription = subs.data.length > 0;
        }
      } catch {
        // Stripe not available — that's fine
      }
    }

    if (!trialActive && !hasSubscription) {
      return new Response(JSON.stringify({
        error: "Limite scansioni raggiunto",
        limit_reached: true,
        scans_used: trial?.scans_used ?? 0,
        max_scans: trial?.max_scans ?? 5,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Call the idempotent DB function
    const { data, error } = await supabaseClient.rpc("record_scan", {
      _user_id: user.id,
      _scan_id: scan_id,
    });

    if (error) {
      console.error("record_scan error:", error);
      return new Response(JSON.stringify({ error: "Errore nella registrazione della scansione" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("record-scan unhandled:", error);
    return new Response(JSON.stringify({ error: "Errore temporaneo" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
