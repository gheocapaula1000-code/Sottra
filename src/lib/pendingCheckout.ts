import { type PlanKey } from "@/lib/plans";

const STORAGE_KEY = "sottra.pending_checkout_plan";
const PLAN_KEYS = new Set<PlanKey>(["agente", "agenzia", "rete"]);

export function parsePlanKey(value: string | null | undefined): PlanKey | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return PLAN_KEYS.has(key as PlanKey) ? (key as PlanKey) : null;
}

export function rememberPendingPlan(plan: PlanKey): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, plan);
  } catch {
    // Private mode / blocked storage — URL ?plan= remains the fallback.
  }
}

export function peekPendingPlan(): PlanKey | null {
  try {
    return parsePlanKey(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function consumePendingPlan(): PlanKey | null {
  const plan = peekPendingPlan();
  clearPendingPlan();
  return plan;
}

export function clearPendingPlan(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Resolve a plan from the current URL, then from sessionStorage. */
export function resolvePendingPlan(search: string): PlanKey | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return parsePlanKey(params.get("plan")) ?? peekPendingPlan();
}

export function withPlanParam(path: string, plan: PlanKey | null): string {
  if (!plan) return path;
  const [pathname, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set("plan", plan);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Prevents login + runner from opening two Checkout sessions. */
let checkoutLaunchLock = false;

export function takeCheckoutLaunchLock(): boolean {
  if (checkoutLaunchLock) return false;
  checkoutLaunchLock = true;
  return true;
}

export function releaseCheckoutLaunchLock(): void {
  checkoutLaunchLock = false;
}

/** Only same-origin app paths — blocks open redirects. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  if (trimmed.startsWith("/login") || trimmed.startsWith("/signup")) return null;
  return trimmed;
}
