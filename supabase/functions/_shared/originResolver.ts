/**
 * Shared origin resolution for Stripe return URLs.
 *
 * Uses ALLOWED_ORIGINS allowlist to derive a safe return origin.
 * Falls back to request Origin header only if it is in the allowlist.
 * Never uses raw, unvalidated request origins.
 */
export function resolveReturnOrigin(req: Request): string {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  const reqOrigin = (req.headers.get("Origin") ?? "").toLowerCase();

  if (allowedOrigins.includes(reqOrigin)) {
    return reqOrigin;
  }

  // Fallback: first allowed origin (production domain)
  if (allowedOrigins.length > 0) {
    return allowedOrigins[0];
  }

  throw new Error("No allowed origin configured for return URL");
}
