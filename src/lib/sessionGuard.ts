/**
 * Pure session / entitlement helpers for client failsafe.
 * Server `checkEntitlement` remains the source of truth for paid data.
 */

export const AUTH_ERROR_CODES = new Set([
  "auth_missing",
  "auth_empty",
  "auth_invalid",
  "auth_exception",
]);

export function isAuthErrorCode(code: string | null | undefined): boolean {
  return !!code && AUTH_ERROR_CODES.has(code);
}

/** True when a present session cannot be used (expired clock or empty token). */
export function sessionNeedsReauth(
  session: { expires_at?: number | null; access_token?: string | null } | null,
  nowMs = Date.now(),
): boolean {
  if (!session) return false;
  if (!session.access_token) return true;
  const expiresAt = session.expires_at;
  if (expiresAt != null && Number.isFinite(expiresAt) && expiresAt * 1000 < nowMs) {
    return true;
  }
  return false;
}

/**
 * Client canScan / canManageBilling — mirrors SubscriptionContext.
 * past_due never grants scan; it only keeps billing portal access.
 */
export function deriveEntitlementFlags(opts: {
  isOwner: boolean;
  isAdmin: boolean;
  subscribed: boolean;
  trialActive: boolean;
  subscriptionStatus: string | null;
}): { canScan: boolean; canManageBilling: boolean } {
  const canScan = opts.isOwner || opts.isAdmin || opts.subscribed || opts.trialActive;
  const canManageBilling =
    opts.isOwner || opts.isAdmin || opts.subscribed || opts.subscriptionStatus === "past_due";
  return { canScan, canManageBilling };
}
