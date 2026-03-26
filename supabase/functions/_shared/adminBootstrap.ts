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

/** Parse commercial bypass emails — full user-facing access, no admin. */
function getCommercialBypassEmails(): Set<string> {
  const raw = Deno.env.get("COMMERCIAL_BYPASS_EMAILS") ?? "";
  if (!raw.trim()) return new Set();
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

export type BootstrapResult = {
  /** Bootstrap was fully applied (owner + admin rows created/confirmed) */
  bootstrapped: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  /** 'matched' = email in allowlist & upserts OK, 'missing' = email not in allowlist,
   *  'failed' = email in allowlist but upsert failed, 'not_applicable' = no email provided */
  state: "matched" | "missing" | "failed" | "not_applicable";
};

/**
 * If the given email is in the bootstrap allowlist,
 * upsert owner_access + user_roles for the user_id.
 * Never throws — returns state describing what happened.
 */
export async function ensureBootstrap(
  userId: string,
  email: string | undefined | null,
): Promise<BootstrapResult> {
  if (!email || !userId) return { bootstrapped: false, isOwner: false, isAdmin: false, state: "not_applicable" };

  const allowlist = getBootstrapEmails();
  if (!allowlist.has(email.trim().toLowerCase())) {
    return { bootstrapped: false, isOwner: false, isAdmin: false, state: "missing" };
  }

  log(`bootstrap match for ${email}`);

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let ownerOk = false;
  let adminOk = false;

  // Upsert owner_access
  try {
    const { error } = await client.from("owner_access").upsert(
      { user_id: userId, label: `bootstrap:${email}` },
      { onConflict: "user_id" },
    );
    ownerOk = !error;
    if (error) log(`owner_access upsert failed: ${error.message}`);
  } catch (e) {
    log(`owner_access upsert exception: ${e}`);
  }

  // Upsert user_roles (admin)
  try {
    const { error } = await client.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" },
    );
    adminOk = !error;
    if (error) log(`user_roles upsert failed: ${error.message}`);
  } catch (e) {
    log(`user_roles upsert exception: ${e}`);
  }

  if (ownerOk && adminOk) {
    log(`bootstrap complete for ${userId}`);
    return { bootstrapped: true, isOwner: true, isAdmin: true, state: "matched" };
  }

  log(`bootstrap PARTIAL for ${userId} — owner=${ownerOk} admin=${adminOk}`);
  return { bootstrapped: false, isOwner: ownerOk, isAdmin: adminOk, state: "failed" };
}

/**
 * Check if email is in the commercial bypass list.
 * These users get full user-facing access (subscribed=true, trial bypass)
 * but NO admin/owner privileges.
 */
export function isCommercialBypass(email: string | undefined | null): boolean {
  if (!email) return false;
  return getCommercialBypassEmails().has(email.trim().toLowerCase());
}

/**
 * Check if email is in the admin bootstrap allowlist (without performing upserts).
 */
export function isInBootstrapAllowlist(email: string | undefined | null): boolean {
  if (!email) return false;
  return getBootstrapEmails().has(email.trim().toLowerCase());
}
