import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GEO_FALLBACK_OPTIONS,
  GEO_HIGH_ACCURACY_OPTIONS,
  GEO_STANDALONE_WATCHDOG_MS,
  GeoRequestError,
  isValidGeoPosition,
  requestGeolocation,
  requestGeolocationWithFallback,
  shouldRetryGeoFix,
  startShootGeolocation,
} from "@/lib/requestGeolocation";

type GeoSuccess = (pos: GeolocationPosition) => void;
type GeoError = (err: GeolocationPositionError) => void;

function positionError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function mockGeolocation(impl: Geolocation["getCurrentPosition"] | null) {
  if (impl === null) {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    return;
  }
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: impl,
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  });
}

function setStandalone(standalone: boolean, displayMode = standalone) {
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value: standalone,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: displayMode && query.includes("display-mode: standalone"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setStandalone(false, false);
});

describe("requestGeolocation", () => {
  it("resolves real coordinates from getCurrentPosition", async () => {
    mockGeolocation((success: GeoSuccess) => {
      success({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 8 },
      } as GeolocationPosition);
    });

    await expect(requestGeolocation()).resolves.toEqual({ lat: 45.4064, lng: 11.8768 });
  });

  it("rejects 0,0 instead of inventing a position", async () => {
    mockGeolocation((success: GeoSuccess) => {
      success({
        coords: { latitude: 0, longitude: 0, accuracy: 1 },
      } as GeolocationPosition);
    });

    await expect(requestGeolocation()).rejects.toMatchObject({ code: "zero_coords" });
  });

  it("maps permission denied without a retryable code", async () => {
    mockGeolocation((_ok: GeoSuccess, error?: GeoError) => {
      error?.(positionError(1, "denied"));
    });

    const err = await requestGeolocation().catch((e) => e);
    expect(err).toBeInstanceOf(GeoRequestError);
    expect(err.code).toBe("denied");
    expect(shouldRetryGeoFix(err)).toBe(false);
  });

  it("maps timeout as retryable", async () => {
    mockGeolocation((_ok: GeoSuccess, error?: GeoError) => {
      error?.(positionError(3, "took too long"));
    });

    const err = await requestGeolocation().catch((e) => e);
    expect(err.code).toBe("timeout");
    expect(shouldRetryGeoFix(err)).toBe(true);
  });

  it("rejects unavailable when the Geolocation API is missing", async () => {
    mockGeolocation(null);
    const err = await requestGeolocation().catch((e) => e);
    expect(err.code).toBe("unavailable");
    expect(shouldRetryGeoFix(err)).toBe(false);
  });
});

describe("requestGeolocationWithFallback", () => {
  it("retries a high-accuracy timeout with enableHighAccuracy false and a longer timeout", async () => {
    const getCurrentPosition = vi.fn((success: GeoSuccess, error?: GeoError, options?: PositionOptions) => {
      if (options?.enableHighAccuracy) {
        error?.(positionError(3, "timeout"));
        return;
      }
      success({
        coords: { latitude: 45.4, longitude: 11.8, accuracy: 40 },
      } as GeolocationPosition);
    });
    mockGeolocation(getCurrentPosition);

    await expect(requestGeolocationWithFallback()).resolves.toEqual({ lat: 45.4, lng: 11.8 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual(GEO_HIGH_ACCURACY_OPTIONS);
    expect(getCurrentPosition.mock.calls[1][2]).toEqual(GEO_FALLBACK_OPTIONS);
    expect(GEO_HIGH_ACCURACY_OPTIONS.timeout).toBeGreaterThan(8000);
    expect(GEO_FALLBACK_OPTIONS.timeout).toBeGreaterThan(GEO_HIGH_ACCURACY_OPTIONS.timeout as number);
    expect(GEO_FALLBACK_OPTIONS.enableHighAccuracy).toBe(false);
  });

  it("does not retry a real permission denial", async () => {
    const getCurrentPosition = vi.fn((_ok: GeoSuccess, error?: GeoError) => {
      error?.(positionError(1, "denied"));
    });
    mockGeolocation(getCurrentPosition);

    await expect(requestGeolocationWithFallback()).rejects.toMatchObject({ code: "denied" });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("does not retry a standalone watchdog — fail closed, no invented coords", async () => {
    setStandalone(true);
    const getCurrentPosition = vi.fn(() => {
      /* iOS Ask: never calls back */
    });
    mockGeolocation(getCurrentPosition);
    vi.useFakeTimers();

    const pending = requestGeolocationWithFallback();
    const expectation = expect(pending).rejects.toMatchObject({ code: "standalone_watchdog" });
    await vi.advanceTimersByTimeAsync(GEO_STANDALONE_WATCHDOG_MS);
    await expectation;
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

describe("standalone watchdog", () => {
  it("settles when getCurrentPosition never returns in standalone", async () => {
    setStandalone(true);
    mockGeolocation(() => {
      /* hang — Safari Location=Ask */
    });
    vi.useFakeTimers();

    const pending = requestGeolocation();
    const expectation = expect(pending).rejects.toMatchObject({
      code: "standalone_watchdog",
    });
    await vi.advanceTimersByTimeAsync(GEO_STANDALONE_WATCHDOG_MS);
    const err = await pending.catch((e) => e);
    await expectation;
    expect(err).toBeInstanceOf(GeoRequestError);
    expect(err.message).toContain("Durante l'uso");
    expect(err.message).toContain("Chiedi");
    expect(shouldRetryGeoFix(err)).toBe(false);
  });

  it("settles via display-mode standalone even without navigator.standalone", async () => {
    setStandalone(false, true);
    mockGeolocation(() => {
      /* hang */
    });
    vi.useFakeTimers();

    const pending = requestGeolocation();
    const expectation = expect(pending).rejects.toMatchObject({ code: "standalone_watchdog" });
    await vi.advanceTimersByTimeAsync(GEO_STANDALONE_WATCHDOG_MS);
    await expectation;
  });
});

describe("isValidGeoPosition", () => {
  it("rejects 0,0 and incomplete pairs", () => {
    expect(isValidGeoPosition({ lat: 0, lng: 0 })).toBe(false);
    expect(isValidGeoPosition({ lat: 45.4, lng: 0 })).toBe(true);
    expect(isValidGeoPosition(null)).toBe(false);
    expect(isValidGeoPosition({ lat: 45.4064, lng: 11.8768 })).toBe(true);
  });
});

describe("startShootGeolocation", () => {
  it("starts getCurrentPosition in the same tick when there are no gate coords", () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    const pending = startShootGeolocation({ skipForAddress: false, gatePosition: null });

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(pending).toBeInstanceOf(Promise);
  });

  it("skips GPS when a typed address is present", () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    expect(startShootGeolocation({ skipForAddress: true, gatePosition: { lat: 45.4, lng: 11.8 } })).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reuses valid gate coords without a new request", async () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    await expect(
      startShootGeolocation({ skipForAddress: false, gatePosition: { lat: 45.4064, lng: 11.8768 } }),
    ).resolves.toEqual({ lat: 45.4064, lng: 11.8768 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("does not reuse 0,0 gate coords", () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    const pending = startShootGeolocation({ skipForAddress: false, gatePosition: { lat: 0, lng: 0 } });
    expect(getCurrentPosition).toHaveBeenCalled();
    expect(pending).toBeInstanceOf(Promise);
  });
});
