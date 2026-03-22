/**
 * Shared owner resolution for Edge Functions.
 * Uses the `owner_access` table via the `is_owner()` SQL function.
 * No longer relies on OWNER_EMAILS env var.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * Check if a user_id is a registered owner via server-side table lookup.
 * Uses SECURITY DEFINER function `public.is_owner(_user_id)`.
 */
export async function isOwnerById(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data, error } = await client.rpc("is_owner", { _user_id: userId });
    if (error) {
      console.warn("[ownerUtils] is_owner RPC failed:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn("[ownerUtils] is_owner exception:", e);
    return false;
  }
}

/**
 * @deprecated — kept temporarily for migration. Will be removed.
 * Always returns false now; owner check must use isOwnerById(userId).
 */
export function isOwnerEmail(_email: string | undefined | null): boolean {
  return false;
}
