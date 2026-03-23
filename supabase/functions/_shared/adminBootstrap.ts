/**
 * Admin/Owner Bootstrap — server-side only.
 *
 * Reads ADMIN_BOOTSTRAP_EMAILS env var (comma-separated).
 * For each matching authenticated user, ensures:
 *   1. A row in owner_access (owner entitlements)
 *   2. A row in user_roles with role='admin' (RBAC admin)
 *
 * All operations are idempotent (ON CONFLICT DO NOTHING).
 * No client-side exposure — runs only inside Edge Functions.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const log = (msg: string) => console.log(`[adminBootstrap] ${msg}`);

/** Parse the allowlist from env. Returns lowercase email set. */
function getBootstrapEmails(): Set<string> {
  const raw = Deno.env.get("ADMIN_BOOTSTRAP_EMAILS") ?? "";
  if (!raw.trim()) return new Set();
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * If the given email is in the bootstrap allowlist,
 * upsert owner_access + user_roles for the user_id.
 * Returns { bootstrapped: boolean, isOwner: boolean, isAdmin: boolean }.
 */
export async function ensureBootstrap(
  userId: string,
  email: string | undefined | null,
): Promise<{ bootstrapped: boolean; isOwner: boolean; isAdmin: boolean }> {
  if (!email || !userId) return { bootstrapped: false, isOwner: false, isAdmin: false };

  const allowlist = getBootstrapEmails();
  if (!allowlist.has(email.toLowerCase())) {
    return { bootstrapped: false, isOwner: false, isAdmin: false };
  }

  log(`bootstrap match for ${email}`);

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Upsert owner_access
  try {
    await client.from("owner_access").upsert(
      { user_id: userId, label: `bootstrap:${email}` },
      { onConflict: "user_id" },
    );
  } catch (e) {
    log(`owner_access upsert failed: ${e}`);
  }

  // Upsert user_roles (admin)
  try {
    await client.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" },
    );
  } catch (e) {
    log(`user_roles upsert failed: ${e}`);
  }

  log(`bootstrap complete for ${userId}`);
  return { bootstrapped: true, isOwner: true, isAdmin: true };
}
