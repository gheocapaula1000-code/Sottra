import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerById } from "../_shared/ownerUtils.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isBillingActive } from "../_shared/billing.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token vuoto" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;

    // Owner/admin bypass — don't consume scans
    if (isOwnerEmail(user.email)) {
      return new Response(JSON.stringify({ recorded: false, bypassed: true, scans_used: 0, max_scans: 999 }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check admin role
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      return new Response(JSON.stringify({ recorded: false, bypassed: true, scans_used: 0, max_scans: 999 }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Payload non valido" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const scan_id = body.scan_id;
    if (!scan_id || typeof scan_id !== "string") {
      return new Response(JSON.stringify({ error: "scan_id richiesto" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ── Check trial/subscription limits before recording ──
    let { data: trial } = await serviceClient
      .from("user_trials")
      .select("scans_used, max_scans, trial_end")
      .eq("user_id", user.id)
      .single();

    // Auto-create trial row if missing
    if (!trial) {
      const { data: newTrial } = await serviceClient
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

    // ── DB-first subscription check (source of truth) ──
    let hasSubscription = false;
    const { data: subData } = await serviceClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    if (subData) {
      hasSubscription = true;
    }

    // ── Stripe fallback (only if DB has no useful record and billing is active) ──
    if (!hasSubscription && isBillingActive()) {
      try {
        // Look up by stripe_customer_id already in DB
        const { data: existingSub } = await serviceClient
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let stripeCustomerId = existingSub?.stripe_customer_id;

        // If no customer_id in DB, try email lookup as last resort
        if (!stripeCustomerId && user.email) {
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
          const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
          }
        }

        if (stripeCustomerId) {
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
          const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          for (const checkStatus of ["active", "trialing"] as const) {
            const subs = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              status: checkStatus,
              limit: 1,
            });
            if (subs.data.length > 0) {
              hasSubscription = true;
              break;
            }
          }
        }
      } catch {
        // Stripe not available — non-blocking
      }
    }

    if (!trialActive && !hasSubscription) {
      return new Response(JSON.stringify({
        error: "Limite scansioni raggiunto",
        limit_reached: true,
        scans_used: trial?.scans_used ?? 0,
        max_scans: trial?.max_scans ?? 5,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Call the idempotent DB function
    const { data, error } = await serviceClient.rpc("record_scan", {
      _user_id: user.id,
      _scan_id: scan_id,
    });

    if (error) {
      console.error("record_scan error:", error);
      return new Response(JSON.stringify({ error: "Errore nella registrazione della scansione" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("record-scan unhandled:", error);
    return new Response(JSON.stringify({ error: "Errore temporaneo" }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
