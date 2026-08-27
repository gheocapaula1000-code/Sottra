import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Scan from "@/pages/Scan";
import { buildJpegWithGps, buildJpegWithoutExif } from "./helpers/jpegExif";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/lib/imageUtils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/imageUtils")>("@/lib/imageUtils");
  return {
    ...actual,
    normalizeImage: vi.fn(async (src: string) =>
      src.startsWith("data:image/") ? src : `data:image/jpeg;base64,${"A".repeat(200)}`,
    ),
    isValidImageDataUrl: () => true,
  };
});

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function positionError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
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

function mockCamera() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
}

function setIphoneUa(on: boolean) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: on
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
  });
}

async function continuePastGate() {
  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: /continua allo scatto/i }));
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /scatta foto/i })).toBeInTheDocument();
  });
}

async function pickCaptureFile(bytes: Uint8Array) {
  const input = document.querySelector('[data-testid="scan-capture-input"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  const file = new File([bytes as unknown as BlobPart], "scatto.jpg", { type: "image/jpeg" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

describe("iPhone scan uses photo EXIF when Geolocation fails", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockCamera();
    setIphoneUa(true);
  });

  afterEach(() => {
    cleanup();
    setIphoneUa(false);
    vi.restoreAllMocks();
  });

  it("does not start getUserMedia on iPhone — system camera keeps EXIF", async () => {
    mockGeolocation((_ok, error) => {
      error?.(positionError(1, "denied"));
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/scatta con la fotocamera iphone/i)).toBeInTheDocument();
    expect(screen.queryByText(/Impostazioni →/)).toBeNull();
    expect(screen.queryByText(/Privacy e sicurezza/)).toBeNull();
  });

  it("uses EXIF GPS when Geolocation failed and the photo has coords", async () => {
    mockGeolocation((_ok, error) => {
      error?.(positionError(1, "denied"));
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));
    await pickCaptureFile(buildJpegWithGps(45.4012, 11.9123));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/result", {
        replace: true,
        state: {
          photo: expect.stringMatching(/^data:image\//),
          lat: 45.4012,
          lng: 11.9123,
        },
      });
    });
    expect(navigate.mock.calls[0][1].state.manualAddress).toBeUndefined();
  });

  it("does not invent coords when EXIF is missing — same-screen address form", async () => {
    mockGeolocation((_ok, error) => {
      error?.(positionError(3, "timeout"));
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));
    await pickCaptureFile(buildJpegWithoutExif());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continua con l'indirizzo/i })).toBeInTheDocument();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/Impostazioni →/)).toBeNull();
    expect(screen.getByText(/GPS e foto senza coordinate/i)).toBeInTheDocument();
  });

  it("does not invent 0,0 EXIF — address form, not a fake point", async () => {
    mockGeolocation((_ok, error) => {
      error?.(positionError(1, "denied"));
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));
    await pickCaptureFile(buildJpegWithGps(0, 0));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continua con l'indirizzo/i })).toBeInTheDocument();
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps device GPS when Geolocation succeeded, even if EXIF differs", async () => {
    mockGeolocation((success) => {
      success({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 8 },
      } as GeolocationPosition);
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));
    await pickCaptureFile(buildJpegWithGps(45.4012, 11.9123));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/result", {
        replace: true,
        state: {
          photo: expect.stringMatching(/^data:image\//),
          lat: 45.4064,
          lng: 11.8768,
        },
      });
    });
  });
});

describe("Android scan still uses device GPS + getUserMedia", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockCamera();
    setIphoneUa(false);
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 480,
    });
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => `data:image/jpeg;base64,${"A".repeat(200)}`,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts getUserMedia and navigates with device GPS, not photo EXIF", async () => {
    mockGeolocation((success) => {
      success({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 8 },
      } as GeolocationPosition);
    });

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );
    await continuePastGate();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    expect(screen.getByText(/inquadra un edificio/i)).toBeInTheDocument();
    expect(screen.queryByText(/fotocamera iphone/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/result", {
        replace: true,
        state: {
          photo: expect.stringMatching(/^data:image\//),
          lat: 45.4064,
          lng: 11.8768,
        },
      });
    });
  });
});

describe("iPhone EXIF / Settings product invariants", () => {
  it("Scan uses system camera + EXIF fallback and does not lecture Impostazioni", () => {
    const scan = src("src/pages/Scan.tsx");
    expect(scan).toContain("prefersSystemCameraCapture");
    expect(scan).toContain("fileToJpegDataUrl");
    expect(scan).toContain("extractExifGpsFromFile");
    expect(scan).toContain("resolveScanCoords");
    expect(scan).toContain("getUserMedia");
    expect(scan).toContain("gps_denied");
    expect(scan).toContain("Continua con l'indirizzo");
    expect(scan).not.toContain("Impostazioni →");
    expect(scan).not.toContain("Privacy e sicurezza");
  });

  it("CaptureGate still awaits GPS but does not send her to Impostazioni", () => {
    const gate = src("src/components/CaptureGate.tsx");
    expect(gate).toContain("await requestGeolocation");
    expect(gate).toContain("Usa la mia posizione");
    expect(gate).not.toContain("Impostazioni →");
    expect(gate).not.toContain("disabled={geoDenied}");
    expect(src("src/lib/requestGeolocation.ts")).not.toContain("Impostazioni → Privacy");
  });
});
