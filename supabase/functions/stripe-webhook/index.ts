import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const log = (step: string, detail?: string) =>
  console.log(`[stripe-webhook] ${step}${detail ? ` — ${detail}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    log("FATAL", "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("rejected", "Missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Record<string, unknown>;
  try {
    const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as unknown as Record<string, unknown>;
  } catch (err) {
    log("signature verification failed", String(err));
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = event.type as string;
  log("event received", eventType);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    switch (eventType) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event, serviceClient, stripeKey);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event, serviceClient, stripeKey);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event, serviceClient);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event, serviceClient);
        break;
      default:
        log("unhandled event type", eventType);
    }
  } catch (err) {
    log("handler error", String(err));
    // Return 200 anyway to prevent Stripe retries on logic errors
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/* ── User Resolution ── */

/**
 * Resolve Supabase user_id from Stripe data with priority:
 * 1. metadata.supabase_user_id
 * 2. client_reference_id (checkout sessions)
 * 3. stripe_customer_id already saved in DB
 * 4. Customer email as final fallback
 */
async function resolveUserId(
  opts: {
    metadata?: Record<string, unknown> | null;
    clientReferenceId?: string | null;
    stripeCustomerId?: string | null;
    stripeKey?: string;
  },
  serviceClient: ReturnType<typeof createClient>,
): Promise<string | null> {
  // Priority 1: metadata
  if (opts.metadata && typeof opts.metadata.supabase_user_id === "string") {
    log("resolveUserId", `via metadata: ${opts.metadata.supabase_user_id}`);
    return opts.metadata.supabase_user_id;
  }

  // Priority 2: client_reference_id
  if (opts.clientReferenceId) {
    log("resolveUserId", `via client_reference_id: ${opts.clientReferenceId}`);
    return opts.clientReferenceId;
  }

  // Priority 3: existing DB record by stripe_customer_id
  if (opts.stripeCustomerId) {
    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", opts.stripeCustomerId)
      .limit(1)
      .maybeSingle();

    if (existingSub?.user_id) {
      log("resolveUserId", `via DB stripe_customer_id: ${existingSub.user_id}`);
      return existingSub.user_id;
    }
  }

  // Priority 4: email fallback via Stripe customer lookup
  if (opts.stripeCustomerId && opts.stripeKey) {
    try {
      const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
      const stripe = new Stripe(opts.stripeKey, { apiVersion: "2025-08-27.basil" });
      const customer = await stripe.customers.retrieve(opts.stripeCustomerId);
      if (customer && !customer.deleted && customer.email) {
        const { data: users } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const match = users?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === customer.email.toLowerCase(),
        );
        if (match?.id) {
          log("resolveUserId", `via email fallback: ${match.id}`);
          return match.id;
        }
      }
    } catch (e) {
      log("resolveUserId email fallback failed", String(e));
    }
  }

  return null;
}

/* ── Event Handlers ── */

async function handleCheckoutCompleted(
  event: Record<string, unknown>,
  client: ReturnType<typeof createClient>,
  stripeKey: string,
) {
  const session = event.data as { object: Record<string, unknown> };
  const obj = session.object;

  if (obj.mode !== "subscription") {
    log("checkout.session.completed", "not subscription mode, skipping");
    return;
  }

  const customerId = obj.customer as string;
  const subscriptionId = obj.subscription as string;
  const metadata = obj.metadata as Record<string, unknown> | null;
  const clientReferenceId = obj.client_reference_id as string | null;

  if (!customerId || !subscriptionId) {
    log("checkout.session.completed", "missing customer or subscription ID");
    return;
  }

  const userId = await resolveUserId(
    { metadata, clientReferenceId, stripeCustomerId: customerId, stripeKey },
    client,
  );

  if (!userId) {
    log("checkout.session.completed", `no user resolved for customer=${customerId}`);
    return;
  }

  // Eagerly upsert subscription from checkout to avoid race with subscription.created
  try {
    const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
    const priceId = items?.data?.[0]?.price?.id ?? null;

    const currentPeriodEnd = typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    const { error } = await client.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        price_id: priceId,
        status: sub.status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: sub.cancel_at_period_end === true,
        trial_end: typeof sub.trial_end === "number"
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
      },
      { onConflict: "stripe_subscription_id" },
    );

    if (error) {
      log("checkout upsert failed", error.message);
    } else {
      log("checkout.session.completed", `upserted sub=${subscriptionId} user=${userId}`);
    }
  } catch (e) {
    log("checkout sub retrieve failed", String(e));
  }
}

async function handleSubscriptionChange(
  event: Record<string, unknown>,
  client: ReturnType<typeof createClient>,
  stripeKey: string,
) {
  const data = event.data as { object: Record<string, unknown> };
  const sub = data.object;

  const stripeSubscriptionId = sub.id as string;
  const stripeCustomerId = sub.customer as string;
  const status = sub.status as string;
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
  const metadata = sub.metadata as Record<string, unknown> | null;

  const currentPeriodEnd = typeof sub.current_period_end === "number"
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const trialEnd = typeof sub.trial_end === "number"
    ? new Date(sub.trial_end * 1000).toISOString()
    : null;

  const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id ?? null;

  // Resolve user_id with priority chain
  // First check existing DB record
  const { data: existingSub } = await client
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  let userId = existingSub?.user_id;

  if (!userId) {
    userId = await resolveUserId(
      { metadata, stripeCustomerId, stripeKey },
      client,
    ) ?? undefined;
  }

  if (!userId) {
    log("subscription change", `no user_id for sub=${stripeSubscriptionId}`);
    return;
  }

  // Idempotent upsert
  const { error } = await client.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      price_id: priceId,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      trial_end: trialEnd,
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    log("upsert failed", error.message);
  } else {
    log("subscription upserted", `sub=${stripeSubscriptionId} status=${status}`);
  }
}

async function handleInvoicePaid(
  event: Record<string, unknown>,
  client: ReturnType<typeof createClient>,
) {
  const data = event.data as { object: Record<string, unknown> };
  const invoice = data.object;
  const subscriptionId = invoice.subscription as string | null;

  if (!subscriptionId) return;

  const { error } = await client
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("status", "past_due");

  if (error) {
    log("invoice.paid update failed", error.message);
  } else {
    log("invoice.paid", `sub=${subscriptionId} → active`);
  }
}

async function handleInvoicePaymentFailed(
  event: Record<string, unknown>,
  client: ReturnType<typeof createClient>,
) {
  const data = event.data as { object: Record<string, unknown> };
  const invoice = data.object;
  const subscriptionId = invoice.subscription as string | null;

  if (!subscriptionId) return;

  const { error } = await client
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    log("invoice.payment_failed update failed", error.message);
  } else {
    log("invoice.payment_failed", `sub=${subscriptionId} → past_due`);
  }
}
