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
    await waitFor(() => {
      expect(onContinue).toHaveBeenCalledTimes(1);
    });
    expect(onContinue).toHaveBeenCalledWith({ position: null, errorCode: "denied" });
  });

  it("awaits getCurrentPosition before onContinue and passes granted coords", async () => {
    let succeed: PositionCallback = () => {};
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      succeed = success;
    });
    mockGeolocation(getCurrentPosition);
    mockPermissions("prompt");
    const onContinue = vi.fn();

    render(<CaptureGate onContinue={onContinue} />);

    fireEvent.click(await screen.findByRole("button", { name: /continua allo scatto/i }));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /richiesta posizione/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /usa la mia posizione/i })).toBeDisabled();

    await act(async () => {
      succeed({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 8 },
      } as GeolocationPosition);
    });

    await waitFor(() => {
      expect(onContinue).toHaveBeenCalledTimes(1);
    });
    expect(onContinue).toHaveBeenCalledWith({
      position: { lat: 45.4064, lng: 11.8768 },
      errorCode: null,
    });
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
    await waitFor(() => {
      expect(onContinue).toHaveBeenCalled();
    });
  });
});

describe("CaptureGate / Scan source invariants", () => {
  it("CaptureGate never disables Continua from permissions.query denied", () => {
    const gate = src("src/components/CaptureGate.tsx");
    expect(gate).not.toContain("disabled={geoDenied}");
    expect(gate).not.toContain("Attiva la geolocalizzazione per continuare");
    expect(gate).toContain("requestGeolocation");
    expect(gate).toContain("Usa la mia posizione");
    expect(gate).toContain("await requestGeolocation");
    expect(gate).toMatch(/onContinue\(\{/);
    expect(gate).toMatch(/perm\.state === "granted"/);
    expect(gate).not.toMatch(/perm\.state === "denied"\) setGeoStatus\("denied"\)/);
  });

  it("Scan still skips GPS when a typed address is present", () => {
    const scan = src("src/pages/Scan.tsx");
    expect(scan).toContain("manual address provided, skipping GPS");
    expect(scan).toContain("startShootGeolocation");
    expect(scan).toContain('shootPhase === "gps_denied"');
    expect(scan).toContain("Riprova posizione");
    expect(scan).toContain("Continua con l'indirizzo");
    expect(scan).toContain("navigateWithTypedAddress");
    expect(scan).not.toContain("timeout: 8000");
  });

  it("shutter starts GPS in the click tick, before setTimeout", () => {
    const scan = src("src/pages/Scan.tsx");
    const shootStart = scan.indexOf("const handleShoot");
    const fileStart = scan.indexOf("const handleFileUpload");
    const shoot = scan.slice(shootStart, fileStart);
    const kickoff = shoot.indexOf("const gpsPromise = startShootGeolocation");
    const flashDelay = shoot.indexOf("setTimeout(() => {");
    expect(kickoff).toBeGreaterThan(-1);
    expect(flashDelay).toBeGreaterThan(-1);
    expect(kickoff).toBeLessThan(flashDelay);
  });

  it("does not change PWA manifest display", () => {
    expect(src("public/manifest.webmanifest")).toContain('"display": "standalone"');
    expect(src("vite.config.ts")).toMatch(/display:\s*"standalone"/);
  });

  it("does not invent coordinates on GPS failure", () => {
    const helper = src("src/lib/requestGeolocation.ts");
    expect(helper).toContain("zero_coords");
    expect(helper).toContain("enableHighAccuracy: false");
    expect(helper).not.toMatch(/lat:\s*45\./);
    expect(helper).not.toMatch(/lng:\s*11\./);
  });
});
