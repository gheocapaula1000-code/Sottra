/**
 * Shared CORS helper for Sottra Edge Functions.
 *
 * Uses an allowlist when ALLOWED_ORIGINS env var is set (comma-separated).
 * Falls back to wildcard "*" for Lovable preview compatibility.
 */

const STANDARD_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-internal-secret, x-source-app, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

let _allowedOrigins: string[] | null = null;

function getAllowedOrigins(): string[] | null {
  if (_allowedOrigins !== null) return _allowedOrigins.length > 0 ? _allowedOrigins : null;
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  _allowedOrigins = raw
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  return _allowedOrigins.length > 0 ? _allowedOrigins : null;
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origins = getAllowedOrigins();

  let origin = "*";
  if (origins && req) {
    const reqOrigin = (req.headers.get("Origin") ?? "").toLowerCase();
    if (origins.includes(reqOrigin)) {
      origin = reqOrigin;
    } else {
      origin = origins[0]; // default to primary domain
    }
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": STANDARD_HEADERS,
  };

  if (origins) {
    headers["Vary"] = "Origin";
  }

  return headers;
}

/** Standard OPTIONS preflight response */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }
  return null;
}
