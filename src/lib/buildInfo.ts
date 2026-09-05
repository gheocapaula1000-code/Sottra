/** Build version — bumped on each deploy (YYYY.MM.DD.N) */
export const BUILD_VERSION = "2026.09.05.3";

/**
 * Sottra — Release Readiness State
 *
 * After this, only real device validation (Android + iPhone) remains.
 */
export const READINESS_STATE = {
  ready_for_device_validation: true,
  last_readiness_check: "2026-09-05",
  engines_modified: false,
  safety_invariants_verified: true,
  seo_hardened: true,
  mobile_code_ready: true,
  device_tested: false,
  edge_functions_hardened: true,
  auth_model_uniform: true,
} as const;
