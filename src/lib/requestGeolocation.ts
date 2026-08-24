export type GeoPosition = {
  lat: number;
  lng: number;
};

export type GeoRequestErrorCode =
  | "unavailable"
  | "denied"
  | "timeout"
  | "position_unavailable"
  | "zero_coords"
  | "standalone_watchdog";

export class GeoRequestError extends Error {
  readonly code: GeoRequestErrorCode;

  constructor(code: GeoRequestErrorCode, message?: string) {
    super(message ?? code);
    this.name = "GeoRequestError";
    this.code = code;
  }
}

/** First lock: high accuracy, longer than the old 8s iOS-first-fix timeout. */
export const GEO_HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
};

/** Second attempt after timeout/unavailable: network/cell OK, still no invented coords. */
export const GEO_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 25_000,
  maximumAge: 30_000,
};

/** Gate prompt only — must run from a user gesture so iOS can show the system dialog. */
export const GEO_GATE_PROMPT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

/**
 * iOS standalone PWA + Safari Location=Ask: getCurrentPosition never shows a
 * prompt and never fires timeout. JS watchdog settles so she can type the address.
 */
export const GEO_STANDALONE_WATCHDOG_MS = 10_000;

/** Extra JS wait after the native timeout so a real TIMEOUT can win first. */
export const GEO_WATCHDOG_GRACE_MS = 1_500;

export const STANDALONE_LOCATION_ASK_HINT =
  "Impostazioni → Privacy e sicurezza → Localizzazione → Safari/Sottra → Durante l'uso (non «Chiedi»).";

/** Clear Italian ask before / while using the camera. iOS cannot open Settings. */
export const LOCATION_USE_PROMPT =
  "Per la quotazione ufficiale OMI, consenti la posizione Durante l'uso di Sottra.";

export const LOCATION_USE_DETAIL =
  "Tocca Continua: il telefono chiederà l'accesso alla posizione per questa analisi. Se Safari è su «Chiedi» e non compare nulla, inserisci l'indirizzo.";

export const LOCATION_CAMERA_ASK =
  "Consenti la posizione Durante l'uso per questo scatto. Se non compare la richiesta, inserisci l'indirizzo.";

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const nav = navigator as StandaloneNavigator;
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia === "function") {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function isValidGeoPosition(pos: GeoPosition | null | undefined): pos is GeoPosition {
  if (!pos) return false;
  if (typeof pos.lat !== "number" || typeof pos.lng !== "number") return false;
  if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return false;
  if (pos.lat === 0 && pos.lng === 0) return false;
  if (pos.lat < -90 || pos.lat > 90 || pos.lng < -180 || pos.lng > 180) return false;
  return true;
}

function mapPositionError(err: GeolocationPositionError): GeoRequestError {
  if (err.code === err.PERMISSION_DENIED) {
    return new GeoRequestError("denied", err.message);
  }
  if (err.code === err.TIMEOUT) {
    return new GeoRequestError("timeout", err.message);
  }
  return new GeoRequestError("position_unavailable", err.message);
}

export function shouldRetryGeoFix(err: unknown): boolean {
  if (err instanceof GeoRequestError) {
    return err.code === "timeout" || err.code === "position_unavailable" || err.code === "zero_coords";
  }
  return false;
}

export function watchdogMsForRequest(options: PositionOptions = GEO_HIGH_ACCURACY_OPTIONS): number {
  const nativeTimeout = options.timeout ?? GEO_HIGH_ACCURACY_OPTIONS.timeout ?? 20_000;
  if (isStandaloneDisplay()) {
    return Math.min(GEO_STANDALONE_WATCHDOG_MS, nativeTimeout);
  }
  return nativeTimeout + GEO_WATCHDOG_GRACE_MS;
}

export function requestGeolocation(
  options: PositionOptions = GEO_HIGH_ACCURACY_OPTIONS,
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
      reject(new GeoRequestError("unavailable"));
      return;
    }

    let settled = false;
    const standalone = isStandaloneDisplay();
    const watchdogDelay = watchdogMsForRequest(options);

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      fn();
    };

    const watchdog = setTimeout(() => {
      settle(() => {
        reject(
          new GeoRequestError(
            standalone ? "standalone_watchdog" : "timeout",
            standalone ? STANDALONE_LOCATION_ASK_HINT : "timeout",
          ),
        );
      });
    }, watchdogDelay);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (lat === 0 && lng === 0) {
          settle(() => reject(new GeoRequestError("zero_coords")));
          return;
        }
        settle(() => resolve({ lat, lng }));
      },
      (err) => {
        settle(() => reject(mapPositionError(err)));
      },
      options,
    );
  });
}

export async function requestGeolocationWithFallback(): Promise<GeoPosition> {
  try {
    return await requestGeolocation(GEO_HIGH_ACCURACY_OPTIONS);
  } catch (err) {
    if (!shouldRetryGeoFix(err)) {
      throw err;
    }
    return requestGeolocation(GEO_FALLBACK_OPTIONS);
  }
}

/**
 * Kick off shutter GPS in the same user-gesture tick (before setTimeout / await).
 * Typed address skips GPS. Valid gate coords are reused. Never invents coords.
 */
export function startShootGeolocation(args: {
  skipForAddress: boolean;
  gatePosition?: GeoPosition | null;
}): Promise<GeoPosition> | null {
  if (args.skipForAddress) return null;
  if (isValidGeoPosition(args.gatePosition)) {
    return Promise.resolve(args.gatePosition);
  }
  const pending = requestGeolocationWithFallback();
  // Fast iOS deny can reject before processAndNavigate awaits (setTimeout 150ms).
  void pending.catch(() => {});
  return pending;
}
