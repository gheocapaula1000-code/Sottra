import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerById } from "../_shared/ownerUtils.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isBillingActive } from "../_shared/billing.ts";
import { resolveReturnOrigin } from "../_shared/originResolver.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req);

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Empty token");

    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Owner check via server-side table
    const isOwner = await isOwnerById(user.id);
    if (isOwner) {
      return new Response(JSON.stringify({ owner: true, message: "Account owner — nessun abbonamento da gestire." }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!isBillingActive()) {
      return new Response(JSON.stringify({
        error: "Il portale abbonamenti non è ancora attivo."
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 503,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Priority 1: resolve stripe_customer_id from DB
    let customerId: string | undefined;

    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    }

    // Priority 2: email fallback on Stripe
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({
        error: "Nessun abbonamento attivo. Puoi continuare a usare il trial gratuito."
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const returnOrigin = resolveReturnOrigin(req);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${returnOrigin}/app`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
