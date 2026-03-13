import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OWNER_EMAILS = ["gheocapaula@gmail.com"];
const isOwnerEmail = (email: string) => OWNER_EMAILS.includes(email.toLowerCase());

const log = (step: string, detail?: string) =>
  console.log(`[check-subscription] ${step}${detail ? ` — ${detail}` : ""}`);

/** Stable fallback shape — always safe to return */
const BASE_RESPONSE = {
  subscribed: false,
  product_id: null,
  subscription_end: null,
  is_admin: false,
  trial: null,
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 1. Auth ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log("auth missing");
    return json({ ...BASE_RESPONSE, error: "Missing authorization" }, 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    log("auth empty token");
    return json({ ...BASE_RESPONSE, error: "Empty token" }, 401);
  }

  let supabaseClient: ReturnType<typeof createClient>;
  try {
    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
  } catch (e) {
    log("supabase client init failed", String(e));
    return json({ ...BASE_RESPONSE, error: "Internal configuration error" }, 500);
  }

  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) {
      log("auth invalid", error?.message ?? "no user");
      return json({ ...BASE_RESPONSE, error: `Auth error: ${error?.message ?? "session missing"}` }, 401);
    }
    user = data.user;
  } catch (e) {
    log("auth exception", String(e));
    return json({ ...BASE_RESPONSE, error: "Auth error: Auth session missing!" }, 401);
  }

  if (!user?.email) {
    log("auth no email");
    return json({ ...BASE_RESPONSE, error: "Auth error: no email" }, 401);
  }

  const userId = user.id;
  const email = user.email;
  log("authenticated", userId);

  // ── 2. Owner bypass ──────────────────────────────────────
  if (isOwnerEmail(email)) {
    log("owner bypass");
    return json({ ...BASE_RESPONSE, subscribed: true, is_admin: true });
  }

  // ── 3. Admin check (non-blocking) ───────────────────────
  let isAdmin = false;
  try {
    const { data: roleData, error: roleErr } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) {
      log("role lookup failed", roleErr.message);
    } else {
      isAdmin = !!roleData;
    }
  } catch (e) {
    log("role lookup exception", String(e));
  }

  if (isAdmin) {
    log("admin bypass");
    return json({ ...BASE_RESPONSE, subscribed: true, is_admin: true });
  }

  // ── 4. Trial (non-blocking) ─────────────────────────────
  let trialPayload: Record<string, unknown> | null = null;
  try {
    let { data: trial, error: trialErr } = await supabaseClient
      .from("user_trials")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (trialErr) {
      log("trial lookup failed", trialErr.message);
    }

    // Auto-create if missing
    if (!trial) {
      try {
        const { data: newTrial, error: insertErr } = await supabaseClient
          .from("user_trials")
          .insert({ user_id: userId })
          .select()
          .single();
        if (insertErr) {
          log("trial auto-create failed", insertErr.message);
        } else {
          trial = newTrial;
        }
      } catch (e) {
        log("trial auto-create exception", String(e));
      }
    }

    if (trial) {
      const now = new Date();
      const trialEnd = trial.trial_end ? new Date(trial.trial_end) : null;
      const scansUsed = typeof trial.scans_used === "number" ? trial.scans_used : 0;
      const maxScans = typeof trial.max_scans === "number" ? trial.max_scans : 5;
      const trialActive = trialEnd ? now < trialEnd && scansUsed < maxScans : false;

      trialPayload = {
        active: trialActive,
        scans_used: scansUsed,
        max_scans: maxScans,
        trial_end: trial.trial_end ?? null,
      };
    }
  } catch (e) {
    log("trial exception", String(e));
  }

  // ── 5. Stripe (completely non-blocking) ─────────────────
  let subscribed = false;
  let productId: string | null = null;
  let subscriptionEnd: string | null = null;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey && email) {
    try {
      const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const customers = await stripe.customers.list({ email, limit: 1 });
      const customer = customers?.data?.[0];

      if (customer?.id) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 1,
        });

        const sub = subscriptions?.data?.[0];
        if (sub) {
          subscribed = true;

          // Defensive access for current_period_end
          if (typeof sub.current_period_end === "number" && sub.current_period_end > 0) {
            subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
          }

          // Defensive access for product id
          const firstItem = sub.items?.data?.[0];
          const price = firstItem?.price;
          const product = price?.product;
          if (typeof product === "string") {
            productId = product;
          } else if (product && typeof product === "object" && "id" in product) {
            productId = (product as { id: string }).id;
          }
        }
      }
    } catch (stripeErr) {
      log("stripe lookup failed", String(stripeErr));
      // Non-blocking — trial still works
    }
  }

  // ── 6. Stable response ──────────────────────────────────
  return json({
    subscribed,
    product_id: productId,
    subscription_end: subscriptionEnd,
    is_admin: false,
    trial: trialPayload,
  });
});
