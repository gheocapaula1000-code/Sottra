import { describe, expect, it } from "vitest";
import { isValidImageDataUrl } from "@/lib/imageUtils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const jpeg = `data:image/jpeg;base64,${"A".repeat(200)}`;

describe("isValidImageDataUrl — only displayable raster", () => {
  it("accepts jpeg/png data URLs", () => {
    expect(isValidImageDataUrl(jpeg)).toBe(true);
    expect(isValidImageDataUrl(`data:image/png;base64,${"B".repeat(200)}`)).toBe(true);
  });

  it("rejects HEIC/HEIF so iPhone files cannot ship unrenderable", () => {
    const heic = `data:image/heic;base64,${"C".repeat(200)}`;
    const heif = `data:image/heif;base64,${"D".repeat(200)}`;
    expect(isValidImageDataUrl(heic)).toBe(false);
    expect(isValidImageDataUrl(heif)).toBe(false);
    expect(isValidImageDataUrl("data:image/heic;base64,AAAA")).toBe(false);
  });
});

describe("Scan iPhone capture does not keep raw HEIC", () => {
  it("converts via fileToJpegDataUrl; HEIC has no raw fallback", () => {
    const scan = readFileSync(resolve(process.cwd(), "src/pages/Scan.tsx"), "utf8");
    expect(scan).toContain("fileToJpegDataUrl");
    expect(scan).toContain("prefersSystemCameraCapture");
    expect(scan).toContain("jpeg|jpg|png|webp|gif");
    expect(scan).toContain("Scatta con la fotocamera iPhone");
    expect(scan).toContain("cameraState !== \"system\"");
  });
});
