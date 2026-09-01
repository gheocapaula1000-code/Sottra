import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { isBillingActive } from "../_shared/billing.ts";
import { isAllowedPriceId } from "../_shared/allowedPrices.ts";
import { resolveReturnOrigin } from "../_shared/originResolver.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cors = corsHeaders(req);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    // Server-side validation: only allow known price IDs
    if (!isAllowedPriceId(priceId)) {
      return new Response(JSON.stringify({ error: "Piano non valido." }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!isBillingActive()) {
      return new Response(JSON.stringify({
        error: "Il sistema di pagamento non è ancora attivo. Il trial gratuito resta disponibile."
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 503,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── Block duplicate subscriptions ──
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id, status, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      const periodEnd = existingSub.current_period_end
        ? new Date(existingSub.current_period_end)
        : null;
      const stillValid = !periodEnd || periodEnd > new Date();

      if (stillValid) {
        const errorCode = existingSub.status === "past_due"
          ? "use_customer_portal"
          : "already_subscribed";
        const errorMsg = existingSub.status === "past_due"
          ? "Hai un pagamento in sospeso. Usa il portale di gestione per aggiornare il metodo di pagamento."
          : "Hai già un abbonamento attivo.";

        return new Response(JSON.stringify({
          error: errorMsg,
          error_code: errorCode,
        }), {
          headers: { ...cors, "Content-Type": "application/json" },
          status: 409,
        });
      }
    }

    // ── Reuse existing Stripe customer if available ──
    let customerId: string | undefined;

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      // Check DB for any previous subscription record
      const { data: prevSub } = await serviceClient
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevSub?.stripe_customer_id) {
        customerId = prevSub.stripe_customer_id;
      } else {
        // Fallback: search Stripe by email
        const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    // Resolve return origin from ALLOWED_ORIGINS
    const returnOrigin = resolveReturnOrigin(req);

    const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      // Pi.Gi Service è in regime forfettario: IVA non applicabile, mai «+ IVA».
      automatic_tax: { enabled: false },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${returnOrigin}/app?checkout=success`,
      cancel_url: `${returnOrigin}/app?checkout=cancel`,
    });


    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
