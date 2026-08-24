/**
 * iOS Home Screen PWA / Safari: getUserMedia + canvas toDataURL strips EXIF.
 * Prefer the system camera (input capture) so the File keeps GPS tags.
 * Android keeps the live getUserMedia path.
 */
export function prefersSystemCameraCapture(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ can report as MacIntel with touch
  const platform = navigator.platform || "";
  if (platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1) return true;
  return false;
}
