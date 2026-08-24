/**
 * Result action-bar clearance: safe-area PLUS extra breathing room
 * so Condividi / Nuova scansione / bookmark sit above the Android nav.
 * Scroll content uses the same value so Fonti e Metodologia is never hidden.
 */
export const RESULT_SAFE_BOTTOM_EXTRA_PX = 16;

export const RESULT_SAFE_BOTTOM_PAD = `calc(env(safe-area-inset-bottom, 0px) + ${RESULT_SAFE_BOTTOM_EXTRA_PX}px)`;
