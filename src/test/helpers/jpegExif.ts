/** Minimal JPEG + EXIF GPS for unit tests. Not a product fixture / not a real place. */

function u16(n: number, le = true): number[] {
  return le ? [n & 0xff, (n >> 8) & 0xff] : [(n >> 8) & 0xff, n & 0xff];
}

function u32(n: number, le = true): number[] {
  return le
    ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
    : [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function ifdEntry(tag: number, type: number, count: number, value: number, le = true): number[] {
  return [...u16(tag, le), ...u16(type, le), ...u32(count, le), ...u32(value, le)];
}

function rational(num: number, den: number, le = true): number[] {
  return [...u32(num, le), ...u32(den, le)];
}

/**
 * Build a tiny JPEG whose APP1 Exif GPS is `lat`/`lng`.
 * Uses degree-only rationals (deg/1e6, 0, 0).
 */
export function buildJpegWithGps(lat: number, lng: number): Uint8Array {
  const le = true;
  const scale = 1_000_000;
  const latNum = Math.round(Math.abs(lat) * scale);
  const lngNum = Math.round(Math.abs(lng) * scale);
  const latRef = lat < 0 ? 0x53 : 0x4e; // S / N
  const lngRef = lng < 0 ? 0x57 : 0x45; // W / E

  const tiff: number[] = [];
  tiff.push(0x49, 0x49, 0x2a, 0x00); // II *
  tiff.push(...u32(8, le)); // IFD0 at 8
  tiff.push(...u16(1, le)); // 1 entry
  tiff.push(...ifdEntry(0x8825, 4, 1, 26, le)); // GPS IFD
  tiff.push(...u32(0, le)); // next IFD

  // GPS IFD at 26
  tiff.push(...u16(4, le));
  tiff.push(...ifdEntry(0x0001, 2, 2, latRef, le)); // lat ref inline
  tiff.push(...ifdEntry(0x0002, 5, 3, 80, le)); // lat rationals at 80
  tiff.push(...ifdEntry(0x0003, 2, 2, lngRef, le));
  tiff.push(...ifdEntry(0x0004, 5, 3, 104, le));
  tiff.push(...u32(0, le));

  while (tiff.length < 80) tiff.push(0);
  tiff.push(...rational(latNum, scale, le), ...rational(0, 1, le), ...rational(0, 1, le));
  while (tiff.length < 104) tiff.push(0);
  tiff.push(...rational(lngNum, scale, le), ...rational(0, 1, le), ...rational(0, 1, le));

  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const app1Len = 2 + exif.length;
  const jpeg = [
    0xff, 0xd8,
    0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff,
    ...exif,
    0xff, 0xd9,
  ];
  return Uint8Array.from(jpeg);
}

export function buildJpegWithoutExif(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

export function jpegToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

export function wrapAsHeicLike(tiffJpeg: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode("ftypheic\0\0dummy");
  const out = new Uint8Array(prefix.length + tiffJpeg.length);
  out.set(prefix, 0);
  out.set(tiffJpeg, prefix.length);
  return out;
}
