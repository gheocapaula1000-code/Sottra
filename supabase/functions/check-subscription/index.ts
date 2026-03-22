import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerEmail } from "../_shared/ownerUtils.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isBillingActive } from "../_shared/billing.ts";

const log = (step: string, detail?: string) =>
  console.log(`[check-subscription] ${step}${detail ? ` — ${detail}` : ""}`);

/** Stable response shape — ALWAYS returned with HTTP 200 */
const BASE_RESPONSE = {
  ok: false,
  subscribed: false,
  product_id: null as string | null,
  subscription_end: null as string | null,
  is_admin: false,
  is_owner: false,
  owner: false,
  trial: null as Record<string, unknown> | null,
  error: null as string | null,
  code: "unknown" as string,
};

type ResponseShape = typeof BASE_RESPONSE;

const json = (body: Partial<ResponseShape>, req: Request) =>
  new Response(JSON.stringify({ ...BASE_RESPONSE, ...body }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    status: 200,
  });

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // ── 1. Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      log("auth missing");
      return json({ error: "Missing authorization", code: "auth_missing" }, req);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      log("auth empty token");
      return json({ error: "Empty token", code: "auth_empty" }, req);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let anonClient: ReturnType<typeof createClient>;
    let serviceClient: ReturnType<typeof createClient>;
    try {
      anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
    } catch (e) {
      log("supabase client init failed", String(e));
      return json({ error: "Internal configuration error", code: "init_error" }, req);
    }

    let userId: string;
    let email: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        log("auth invalid via getClaims", claimsError?.message ?? "no claims");
        return json({ error: `Auth error: ${claimsError?.message ?? "invalid token"}`, code: "auth_invalid" }, req);
      }
      userId = claimsData.claims.sub as string;
      email = claimsData.claims.email as string | undefined;
    } catch (e) {
      log("auth exception", String(e));
      return json({ error: "Auth verification failed", code: "auth_exception" }, req);
    }

    if (!email) {
      log("auth no email");
      return json({ error: "Auth error: no email", code: "auth_no_email" }, req);
    }

    log("authenticated", userId);

    // ── 2. Owner bypass ──────────────────────────────────────
    if (isOwnerEmail(email)) {
      log("owner bypass");
      return json({ ok: true, subscribed: true, is_admin: false, is_owner: true, owner: true, code: "owner" }, req);
    }

    // ── 3. Admin check (non-blocking) ───────────────────────
    let isAdmin = false;
    try {
      const { data: roleData, error: roleErr } = await serviceClient
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
      return json({ ok: true, subscribed: true, is_admin: true, code: "admin" }, req);
    }

    // ── 4. Trial (non-blocking) ─────────────────────────────
    let trialPayload: Record<string, unknown> | null = null;
    try {
      let { data: trial, error: trialErr } = await serviceClient
        .from("user_trials")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (trialErr) {
        log("trial lookup failed", trialErr.message);
      }

      if (!trial) {
        try {
          const { data: newTrial, error: insertErr } = await serviceClient
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

    // ── 5. Stripe (completely non-blocking, only if billing is active) ──
    let subscribed = false;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (isBillingActive() && email) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
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

            if (typeof sub.current_period_end === "number" && sub.current_period_end > 0) {
              subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
            }

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
      }
    }

    // ── 6. Stable response ──────────────────────────────────
    return json({
      ok: true,
      subscribed,
      product_id: productId,
      subscription_end: subscriptionEnd,
      is_admin: false,
      trial: trialPayload,
      code: "resolved",
    }, req);
  } catch (topLevelErr) {
    log("FATAL top-level catch", String(topLevelErr));
    return json({ error: "Internal error", code: "fatal" }, req);
  }
});
