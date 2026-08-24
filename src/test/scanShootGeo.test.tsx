import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Scan from "@/pages/Scan";

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
    normalizeImage: vi.fn(async (src: string) => src),
    isValidImageDataUrl: () => true,
  };
});

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

async function continuePastGate() {
  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: /continua allo scatto/i }));
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /scatta foto/i })).toBeInTheDocument();
  });
}

describe("Scan shutter GPS gesture", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockCamera();
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

  it("starts getCurrentPosition in the shutter click tick when gate coords are missing", async () => {
    let gateCalls = 0;
    const getCurrentPosition = vi.fn((_ok: PositionCallback, error?: PositionErrorCallback) => {
      gateCalls += 1;
      if (gateCalls === 1) {
        error?.(positionError(1, "denied"));
      }
      // later calls hang — still counts as started in the click tick
    });
    mockGeolocation(getCurrentPosition);

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );

    await continuePastGate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/GPS o dalla foto/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("skips GPS on shutter when a typed address is present", async () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, error?: PositionErrorCallback) => {
      error?.(positionError(1, "denied"));
    });
    mockGeolocation(getCurrentPosition);

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );

    await continuePastGate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(/via roma/i), {
      target: { value: "Via Roma 15, Padova" },
    });
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("reuses granted gate coords and does not request GPS again on shutter", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 45.4064, longitude: 11.8768, accuracy: 8 },
      } as GeolocationPosition);
    });
    mockGeolocation(getCurrentPosition);

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );

    await continuePastGate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Posizione acquisita/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("gps_denied overlay lets her proceed with a typed address (same geocode path)", async () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, error?: PositionErrorCallback) => {
      error?.(positionError(1, "denied"));
    });
    mockGeolocation(getCurrentPosition);

    render(
      <MemoryRouter>
        <Scan />
      </MemoryRouter>,
    );

    await continuePastGate();
    fireEvent.click(screen.getByRole("button", { name: /scatta foto/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /riprova posizione/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /continua con l'indirizzo/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/via roma/i), {
      target: { value: "Via Roma 15, Padova" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continua con l'indirizzo/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/result", {
        replace: true,
        state: {
          photo: expect.stringMatching(/^data:image\//),
          lat: 0,
          lng: 0,
          manualAddress: "Via Roma 15, Padova",
        },
      });
    });
  });
});
