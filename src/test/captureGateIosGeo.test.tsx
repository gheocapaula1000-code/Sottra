import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import CaptureGate from "@/components/CaptureGate";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function mockPermissions(state: PermissionState) {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn().mockResolvedValue({
        state,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    },
  });
}

function mockGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition,
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CaptureGate iOS Permissions API must not lock Continua", () => {
  it("keeps Continua enabled when permissions.query reports denied", async () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);
    mockPermissions("denied");
    const onContinue = vi.fn();

    render(<CaptureGate onContinue={onContinue} />);

    const continua = await screen.findByRole("button", { name: /continua allo scatto/i });
    expect(continua).toBeEnabled();
    expect(screen.queryByText("Attiva la geolocalizzazione per continuare")).toBeNull();
  });

  it("keeps Continua enabled when permissions.query reports prompt", async () => {
    mockGeolocation(vi.fn());
    mockPermissions("prompt");

    render(<CaptureGate onContinue={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /continua allo scatto/i })).toBeEnabled();
  });

  it("requests a real position on Continua and proceeds even if GPS fails", async () => {
    const getCurrentPosition = vi.fn((_ok, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    mockGeolocation(getCurrentPosition);
    mockPermissions("denied");
    const onContinue = vi.fn();

    render(<CaptureGate onContinue={onContinue} />);

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /continua allo scatto/i }));
    });

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("Usa la mia posizione calls getCurrentPosition without leaving the gate", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 10 },
      } as GeolocationPosition);
    });
    mockGeolocation(getCurrentPosition);
    mockPermissions("prompt");
    const onContinue = vi.fn();

    render(<CaptureGate onContinue={onContinue} />);

    fireEvent.click(await screen.findByRole("button", { name: /usa la mia posizione/i }));

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalled();
    });
    expect(onContinue).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Posizione disponibile")).toBeInTheDocument();
    });
  });

  it("still offers Continua after a failed location request", async () => {
    const getCurrentPosition = vi.fn((_ok, error?: PositionErrorCallback) => {
      error?.({
        code: 3,
        message: "timeout",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    mockGeolocation(getCurrentPosition);
    mockPermissions("denied");
    const onContinue = vi.fn();

    render(<CaptureGate onContinue={onContinue} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /usa la mia posizione/i }));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Puoi continuare e inserire l'indirizzo/).length).toBeGreaterThan(0);
    });

    const continua = screen.getByRole("button", { name: /continua allo scatto/i });
    expect(continua).toBeEnabled();
    await act(async () => {
      fireEvent.click(continua);
    });
    expect(onContinue).toHaveBeenCalled();
  });
});

describe("CaptureGate / Scan source invariants", () => {
  it("CaptureGate never disables Continua from permissions.query denied", () => {
    const gate = src("src/components/CaptureGate.tsx");
    expect(gate).not.toContain("disabled={geoDenied}");
    expect(gate).not.toContain("Attiva la geolocalizzazione per continuare");
    expect(gate).toContain("requestGeolocation");
    expect(gate).toContain("Usa la mia posizione");
    expect(gate).toContain("onContinue()");
    expect(gate).toMatch(/perm\.state === "granted"/);
    expect(gate).not.toMatch(/perm\.state === "denied"\) setGeoStatus\("denied"\)/);
  });

  it("Scan still skips GPS when a typed address is present", () => {
    const scan = src("src/pages/Scan.tsx");
    expect(scan).toContain("manual address provided, skipping GPS");
    expect(scan).toContain("requestGeolocationWithFallback");
    expect(scan).toContain('shootPhase === "gps_denied"');
    expect(scan).toContain("Riprova posizione");
    expect(scan).not.toContain("timeout: 8000");
  });

  it("does not invent coordinates on GPS failure", () => {
    const helper = src("src/lib/requestGeolocation.ts");
    expect(helper).toContain("zero_coords");
    expect(helper).toContain("enableHighAccuracy: false");
    expect(helper).not.toMatch(/lat:\s*45\./);
    expect(helper).not.toMatch(/lng:\s*11\./);
  });
});
