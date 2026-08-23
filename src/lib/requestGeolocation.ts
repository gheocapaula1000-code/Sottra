export type GeoPosition = {
  lat: number;
  lng: number;
};

export type GeoRequestErrorCode =
  | "unavailable"
  | "denied"
  | "timeout"
  | "position_unavailable"
  | "zero_coords";

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

export function requestGeolocation(
  options: PositionOptions = GEO_HIGH_ACCURACY_OPTIONS,
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
      reject(new GeoRequestError("unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (lat === 0 && lng === 0) {
          reject(new GeoRequestError("zero_coords"));
          return;
        }
        resolve({ lat, lng });
      },
      (err) => {
        reject(mapPositionError(err));
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
