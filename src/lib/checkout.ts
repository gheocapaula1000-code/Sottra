import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_PRICE_IDS } from "@/lib/plans";

export type CheckoutFailureCode =
  | "already_subscribed"
  | "use_customer_portal"
  | "billing_inactive"
  | "invalid_plan"
  | "unknown";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; error_code: CheckoutFailureCode };

const MESSAGES: Record<CheckoutFailureCode, string> = {
  already_subscribed: "Hai già un abbonamento attivo.",
  use_customer_portal: "Aggiorna il metodo di pagamento dal portale di gestione.",
  billing_inactive: "Il sistema di pagamento non è ancora attivo. Il trial gratuito resta disponibile.",
  invalid_plan: "Piano non valido.",
  unknown: "Impossibile aprire il checkout. Riprova.",
};

export function checkoutErrorMessage(code: CheckoutFailureCode): string {
  return MESSAGES[code];
}

export function classifyCheckoutError(message: string, errorCode?: unknown): CheckoutFailureCode {
  const code = typeof errorCode === "string" ? errorCode : "";
  const parsed = `${code} ${message}`.toLowerCase();
  if (parsed.includes("already_subscribed") || parsed.includes("409")) return "already_subscribed";
  if (parsed.includes("use_customer_portal")) return "use_customer_portal";
  if (
    parsed.includes("503") ||
    parsed.includes("non è ancora attivo") ||
    parsed.includes("pagamento non è ancora")
  ) {
    return "billing_inactive";
  }
  if (parsed.includes("piano non valido") || parsed.includes("invalid_plan")) return "invalid_plan";
  return "unknown";
}

function isSafeCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createCheckoutSession(priceId: string): Promise<CheckoutResult> {
  if (!ALLOWED_PRICE_IDS.includes(priceId)) {
    return { ok: false, error: MESSAGES.invalid_plan, error_code: "invalid_plan" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });

    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const payloadError = typeof payload?.error === "string" ? payload.error : "";
    const payloadCode = payload?.error_code;

    if (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: string }).message)
          : String(error);
      const error_code = classifyCheckoutError(`${payloadCode ?? ""} ${payloadError} ${message}`, payloadCode);
      return { ok: false, error: payloadError || MESSAGES[error_code], error_code };
    }

    if (payloadError || payloadCode) {
      const error_code = classifyCheckoutError(payloadError, payloadCode);
      return { ok: false, error: payloadError || MESSAGES[error_code], error_code };
    }

    const url = typeof payload?.url === "string" ? payload.url : "";
    if (url && isSafeCheckoutUrl(url)) {
      return { ok: true, url };
    }

    return { ok: false, error: MESSAGES.unknown, error_code: "unknown" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore sconosciuto";
    const error_code = classifyCheckoutError(message);
    return { ok: false, error: message || MESSAGES[error_code], error_code };
  }
}

export function redirectToCheckout(url: string): void {
  if (!isSafeCheckoutUrl(url)) return;
  window.location.assign(url);
}
