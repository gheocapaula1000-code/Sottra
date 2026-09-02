/**
 * Shared server-side entitlement gate.
 *
 * Verifies that a user may consume paid data endpoints (pro-sources, core-proxy).
 * Access is granted when the user is an owner, has the admin role, has an active
 * trial, has an active/trialing subscription, or inherits an agency seat
 * (Agenzia / Rete: telefoni illimitati sotto un solo abbonamento).
 *
 * Never trust client-side gating: every paid data function must call this.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerById } from "./ownerUtils.ts";
import { inheritsAgencySeat } from "./agencySeats.ts";

export interface EntitlementResult {
  allowed: boolean;
  reason: "owner" | "admin" | "trial" | "subscription" | "agency_seat" | "expired" | "error";
}

export async function checkEntitlement(userId: string): Promise<EntitlementResult> {
  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // Owner bypass (server-side table check)
    try {
      if (await isOwnerById(userId)) return { allowed: true, reason: "owner" };
    } catch {
      /* non-blocking */
    }

    // Admin role bypass (RBAC table)
    const { data: roleData } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleData) return { allowed: true, reason: "admin" };

    // Active subscription on this very account (source of truth)
    const { data: subData } = await service
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();
    if (subData) return { allowed: true, reason: "subscription" };

    // Agency seat: Agenzia / Rete sono venduti con telefoni illimitati sotto UN
    // abbonamento. L'agente loggato della stessa agenzia eredita l'accesso.
    // Piano Agente (posto singolo) non viene mai ereditato. Fail-closed.
    try {
      const { data: shared } = await service.rpc("agency_shared_subscription", {
        _user_id: userId,
      });
      const row = Array.isArray(shared) ? shared[0] : shared;
      if (inheritsAgencySeat(row)) return { allowed: true, reason: "agency_seat" };
    } catch {
      /* fail-closed: nessuna eredità se il lookup fallisce */
    }


    // Active trial
    const { data: trial } = await service
      .from("user_trials")
      .select("scans_used, max_scans, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (trial) {
      const active =
        new Date() < new Date(trial.trial_end) && trial.scans_used < trial.max_scans;
      if (active) return { allowed: true, reason: "trial" };
    }

    return { allowed: false, reason: "expired" };
  } catch (e) {
    console.error("[entitlement] check failed:", e instanceof Error ? e.message : e);
    return { allowed: false, reason: "error" };
  }
}
