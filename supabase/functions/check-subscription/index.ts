import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerById } from "../_shared/ownerUtils.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isBillingActive } from "../_shared/billing.ts";
import { ensureBootstrap, isCommercialBypass } from "../_shared/adminBootstrap.ts";

const log = (step: string, detail?: string) =>
  console.log(`[check-subscription] ${step}${detail ? ` — ${detail}` : ""}`);

/** Stable response shape — ALWAYS returned with HTTP 200 */
const BASE_RESPONSE = {
  ok: false,
  subscribed: false,
  product_id: null as string | null,
  price_id: null as string | null,
  subscription_end: null as string | null,
  cancel_at_period_end: false,
  subscription_status: null as string | null,
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
    try {
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        log("auth invalid via getClaims", claimsError?.message ?? "no claims");
        return json({ error: `Auth error: ${claimsError?.message ?? "invalid token"}`, code: "auth_invalid" }, req);
      }
      userId = claimsData.claims.sub as string;
    } catch (e) {
      log("auth exception", String(e));
      return json({ error: "Auth verification failed", code: "auth_exception" }, req);
    }

    log("authenticated", userId);

    // ── 1b. Bootstrap: auto-provision owner+admin if in allowlist ──
    let userEmail: string | undefined;
    try {
      const { data: userData } = await serviceClient.auth.admin.getUserById(userId);
      userEmail = userData?.user?.email;
    } catch { /* non-blocking */ }

    try {
      const bootstrap = await ensureBootstrap(userId, userEmail);
      if (bootstrap.bootstrapped) {
        log("bootstrap applied", userEmail ?? userId);
        return json({
          ok: true,
          subscribed: true,
          is_admin: true,
          is_owner: true,
          owner: true,
          code: "bootstrap",
        }, req);
      }
    } catch (e) {
      log("bootstrap check failed (non-fatal)", String(e));
    }

    // ── 1c. Commercial bypass: full user access, no admin ──
    if (isCommercialBypass(userEmail)) {
      log("commercial bypass", userEmail ?? userId);
      return json({
        ok: true,
        subscribed: true,
        is_admin: false,
        is_owner: false,
        owner: false,
        code: "commercial_bypass",
      }, req);
    }

    // ── 2. Owner check (server-side table) ──────────────────
    let isOwner = false;
    try {
      isOwner = await isOwnerById(userId);
    } catch (e) {
      log("owner check exception", String(e));
    }

    if (isOwner) {
      log("owner bypass (table-based)");
      return json({ ok: true, subscribed: true, is_admin: false, is_owner: true, owner: true, code: "owner" }, req);
    }

    // ── 3. Admin check (RBAC table) ─────────────────────────
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

    // ── 5. DB subscription check (source of truth) ──────────
    let subscribed = false;
    let productId: string | null = null;
    let priceId: string | null = null;
    let subscriptionEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let subscriptionStatus: string | null = null;

    try {
      const { data: subData, error: subErr } = await serviceClient
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr) {
        log("subscription DB lookup failed", subErr.message);
      } else if (subData) {
        subscribed = subData.status === "active" || subData.status === "trialing";
        priceId = subData.price_id ?? null;
        subscriptionEnd = subData.current_period_end ?? null;
        cancelAtPeriodEnd = subData.cancel_at_period_end ?? false;
        subscriptionStatus = subData.status ?? null;

        // Resolve product_id from price_id if needed (for plan mapping)
        // We'll pass price_id and let the client resolve
      }
    } catch (e) {
      log("subscription DB exception", String(e));
    }

    // ── 5b. Fallback: Stripe direct check (if billing active and no DB sub) ──
    if (!subscribed && isBillingActive() && userEmail) {
      try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
        const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
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
            subscriptionStatus = sub.status;
            cancelAtPeriodEnd = sub.cancel_at_period_end === true;

            if (typeof sub.current_period_end === "number" && sub.current_period_end > 0) {
              subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
            }

            const firstItem = sub.items?.data?.[0];
            const price = firstItem?.price;
            if (price?.id) priceId = price.id;
            const product = price?.product;
            if (typeof product === "string") {
              productId = product;
            } else if (product && typeof product === "object" && "id" in product) {
              productId = (product as { id: string }).id;
            }

            // Backfill DB
            try {
              await serviceClient.from("subscriptions").upsert({
                user_id: userId,
                stripe_customer_id: customer.id,
                stripe_subscription_id: sub.id,
                price_id: priceId,
                status: sub.status,
                current_period_end: subscriptionEnd,
                cancel_at_period_end: cancelAtPeriodEnd,
              }, { onConflict: "stripe_subscription_id" });
              log("backfilled DB from Stripe", sub.id);
            } catch (e) {
              log("backfill failed (non-fatal)", String(e));
            }
          }
        }
      } catch (stripeErr) {
        log("stripe fallback failed", String(stripeErr));
      }
    }

    // ── 6. Stable response ──────────────────────────────────
    return json({
      ok: true,
      subscribed,
      product_id: productId,
      price_id: priceId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      subscription_status: subscriptionStatus,
      is_admin: false,
      trial: trialPayload,
      code: "resolved",
    }, req);
  } catch (topLevelErr) {
    log("FATAL top-level catch", String(topLevelErr));
    return json({ error: "Internal error", code: "fatal" }, req);
  }
});
