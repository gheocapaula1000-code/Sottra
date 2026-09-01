/**
 * Shared origin resolution for Stripe return URLs.
 *
 * Uses ALLOWED_ORIGINS allowlist to derive a safe return origin.
 * Falls back to request Origin header only if it is in the allowlist.
 * Never uses raw, unvalidated request origins.
 */
const PROD_ORIGIN = "https://sottra.app";

export function resolveReturnOrigin(req: Request): string {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  const reqOrigin = (req.headers.get("Origin") ?? "").toLowerCase();

  if (allowedOrigins.includes(reqOrigin)) {
    return reqOrigin;
  }

  // Production domain first, if allowlisted
  if (allowedOrigins.includes(PROD_ORIGIN)) {
    return PROD_ORIGIN;
  }

  // Fallback: first allowed origin
  if (allowedOrigins.length > 0) {
    return allowedOrigins[0];
  }

  // Last resort: the only live URL (sottra.it does not exist)
  return PROD_ORIGIN;
}

