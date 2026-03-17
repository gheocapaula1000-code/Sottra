/**
 * Normalizes connectivityContext and schoolContext shapes
 * from Central Core responses to canonical frontend types.
 */

import type { ConnectivityContext, SchoolContext, InfrastrutureData, SviluppoAreaData } from "@/types";

/**
 * Normalize infrastrutture data: resolve connectivityContext
 * from either nested object or legacy flat fields.
 */
export function normalizeInfrastrutture(raw: unknown): InfrastrutureData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = { ...(raw as Record<string, unknown>) } as InfrastrutureData;

  // If connectivityContext is already present as object, use it
  if (data.connectivityContext && typeof data.connectivityContext === "object") {
    // Already in canonical shape — nothing to do
  } else if (data.connectivityLabel || data.connectivityPrecision) {
    // Build connectivityContext from legacy flat aliases
    data.connectivityContext = {
      connectivityAvailable: !!data.connectivityLabel,
      connectivityLabel: (data.connectivityLabel as string) ?? null,
      connectivityPrecision: (data.connectivityPrecision as ConnectivityContext["connectivityPrecision"]) ?? null,
      connectivitySource: null,
      limitations: null,
    };
  }

  // Normalize schoolContext on InfrastrutureData if present
  data.schoolContext = normalizeSchoolContext(data.schoolContext);

  return data;
}

/**
 * Normalize sviluppo area data: resolve schoolContext from
 * either structured object or legacy string.
 */
export function normalizeSviluppoArea(raw: unknown): SviluppoAreaData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = { ...(raw as Record<string, unknown>) } as SviluppoAreaData;

  data.schoolContext = normalizeSchoolContext(data.schoolContext);

  return data;
}

/**
 * Normalize schoolContext: accepts object, string, or null.
 * - If object with `available` field → canonical shape
 * - If string → legacy summary (marked available but minimal)
 * - Otherwise → null
 */
function normalizeSchoolContext(val: unknown): SchoolContext | null {
  if (val == null) return null;

  // Already structured
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    // Validate it has the expected shape
    if (typeof obj.available === "boolean") {
      return val as SchoolContext;
    }
    // Object but missing `available` — try to infer
    if (typeof obj.totalSchools === "number") {
      return { available: obj.totalSchools > 0, ...(val as SchoolContext) };
    }
    return null;
  }

  // Legacy string — do NOT invent data, just wrap minimally
  if (typeof val === "string" && val.length > 0) {
    return {
      available: true,
      totalSchools: 0,
      byGrado: {},
      gradiPresenti: [],
      nearestSchools: [],
      precision: "comune",
      source: "legacy",
      limitations: [val],
    };
  }

  return null;
}
