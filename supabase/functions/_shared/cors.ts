/**
 * Shared CORS helper for Sottra Edge Functions.
 *
 * Uses an allowlist when ALLOWED_ORIGINS env var is set (comma-separated).
 * When ALLOWED_ORIGINS is NOT set, **denies by default** — no wildcard "*".
 * This ensures production never accidentally opens to all origins.
 */

const STANDARD_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-internal-secret, x-source-app, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

let _allowedOrigins: string[] | null = null;
let _resolved = false;

function getAllowedOrigins(): string[] {
  if (_resolved) return _allowedOrigins ?? [];
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const parsed = raw
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  _allowedOrigins = parsed.length > 0 ? parsed : null;
  _resolved = true;
  return _allowedOrigins ?? [];
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origins = getAllowedOrigins();

  // Deny-by-default: if no allowlist is configured, block cross-origin.
  if (origins.length === 0) {
    return {
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Headers": STANDARD_HEADERS,
      "Vary": "Origin",
    };
  }

  // Allowlist mode: reflect origin if it matches, else use primary domain.
  const reqOrigin = req
    ? (req.headers.get("Origin") ?? "").toLowerCase()
    : "";

  const origin = origins.includes(reqOrigin) ? reqOrigin : origins[0];

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": STANDARD_HEADERS,
    "Vary": "Origin",
  };
}

/** Standard OPTIONS preflight response */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }
  return null;
}
