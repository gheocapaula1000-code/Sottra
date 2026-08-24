import { describe, expect, it } from "vitest";
import {
  extractExifGps,
  extractExifGpsFromDataUrl,
  extractExifGpsFromFile,
  resolveScanCoords,
} from "@/lib/exifGps";
import { prefersSystemCameraCapture } from "@/lib/iosCapture";
import {
  buildJpegWithGps,
  buildJpegWithoutExif,
  jpegToDataUrl,
  wrapAsHeicLike,
} from "./helpers/jpegExif";

const REAL = { lat: 45.4012, lng: 11.9123 };

describe("extractExifGps", () => {
  it("reads lat/lng from a JPEG with GPS EXIF", () => {
    const bytes = buildJpegWithGps(REAL.lat, REAL.lng);
    expect(extractExifGps(bytes)).toEqual(REAL);
  });

  it("reads south-west as negative coords", () => {
    const bytes = buildJpegWithGps(-33.87, -151.21);
    const gps = extractExifGps(bytes);
    expect(gps).not.toBeNull();
    expect(gps!.lat).toBeCloseTo(-33.87, 5);
    expect(gps!.lng).toBeCloseTo(-151.21, 5);
  });

  it("rejects 0,0 instead of inventing a position", () => {
    expect(extractExifGps(buildJpegWithGps(0, 0))).toBeNull();
  });

  it("returns null when EXIF GPS is missing", () => {
    expect(extractExifGps(buildJpegWithoutExif())).toBeNull();
    expect(extractExifGps(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(extractExifGps(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("finds an embedded Exif TIFF (HEIC-like container)", () => {
    const jpeg = buildJpegWithGps(REAL.lat, REAL.lng);
    expect(extractExifGps(wrapAsHeicLike(jpeg))).toEqual(REAL);
  });

  it("reads GPS from a data URL of the same JPEG", () => {
    const dataUrl = jpegToDataUrl(buildJpegWithGps(REAL.lat, REAL.lng));
    expect(extractExifGpsFromDataUrl(dataUrl)).toEqual(REAL);
    expect(extractExifGpsFromDataUrl("not-an-image")).toBeNull();
  });

  it("reads GPS from a File and ignores files without EXIF", async () => {
    const withGps = new File([buildJpegWithGps(REAL.lat, REAL.lng) as unknown as BlobPart], "shot.jpg", { type: "image/jpeg" });
    const empty = new File([buildJpegWithoutExif() as unknown as BlobPart], "plain.jpg", { type: "image/jpeg" });
    await expect(extractExifGpsFromFile(withGps)).resolves.toEqual(REAL);
    await expect(extractExifGpsFromFile(empty)).resolves.toBeNull();
  });
});

describe("resolveScanCoords", () => {
  it("uses EXIF when Geolocation failed", () => {
    expect(resolveScanCoords(null, REAL)).toEqual(REAL);
  });

  it("prefers device GPS over EXIF", () => {
    expect(resolveScanCoords({ lat: 45.4064, lng: 11.8768 }, REAL)).toEqual({
      lat: 45.4064,
      lng: 11.8768,
    });
  });

  it("does not invent 0,0 or missing EXIF", () => {
    expect(resolveScanCoords(null, null)).toBeNull();
    expect(resolveScanCoords({ lat: 0, lng: 0 }, null)).toBeNull();
    expect(resolveScanCoords({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeNull();
    expect(resolveScanCoords(undefined, { lat: 0, lng: 0 })).toBeNull();
  });
});

describe("prefersSystemCameraCapture", () => {
  it("is false on the default (non-iPhone) test UA — Android keeps getUserMedia", () => {
    expect(prefersSystemCameraCapture()).toBe(false);
  });

  it("is true for an iPhone user agent", () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    expect(prefersSystemCameraCapture()).toBe(true);
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: original });
  });
});
