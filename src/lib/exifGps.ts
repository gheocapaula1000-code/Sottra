import { isValidGps } from "@/lib/imageUtils";

export type ExifGps = {
  lat: number;
  lng: number;
};

const EXIF_ASCII = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // Exif\0\0
const TIFF_MAGIC = 0x002a;
const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;
const TYPE_ASCII = 2;
const TYPE_RATIONAL = 5;
const TYPE_LONG = 4;

/**
 * Read GPS from a JPEG (APP1) or any container that embeds a TIFF Exif block
 * (HEIC often has "Exif\0\0" + TIFF). Never invents coords. Rejects 0,0.
 *
 * Call this on the original File / bytes. Canvas toDataURL strips EXIF.
 */
export function extractExifGps(input: ArrayBuffer | Uint8Array): ExifGps | null {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length < 16) return null;

    const jpegGps = extractFromJpegApp1(bytes);
    if (jpegGps) return jpegGps;

    // HEIC / generic: scan for Exif\0\0 then parse TIFF
    for (const tiffStart of findExifTiffStarts(bytes)) {
      const gps = parseTiffGps(bytes.subarray(tiffStart));
      if (gps) return gps;
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractExifGpsFromFile(file: File): Promise<ExifGps | null> {
  if (!file) return null;
  try {
    if (typeof file.arrayBuffer === "function") {
      const fromAb = extractExifGps(await file.arrayBuffer());
      if (fromAb) return fromAb;
    }
  } catch {
    // jsdom File.arrayBuffer can be empty — FileReader fallback below
  }
  try {
    return extractExifGpsFromDataUrl(await readFileAsDataUrl(file));
  } catch {
    return null;
  }
}

export function extractExifGpsFromDataUrl(dataUrl: string): ExifGps | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  try {
    const b64 = dataUrl.slice(comma + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return extractExifGps(bytes);
  } catch {
    return null;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Impossibile leggere il file"));
    };
    reader.onerror = () => reject(new Error("Impossibile leggere il file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Device GPS wins when valid. Photo EXIF is the fallback. Never invents 0,0.
 */
export function resolveScanCoords(
  geo: { lat: number; lng: number } | null | undefined,
  exif: { lat: number; lng: number } | null | undefined,
): ExifGps | null {
  if (isValidGps(geo?.lat, geo?.lng)) return { lat: geo.lat, lng: geo.lng };
  if (isValidGps(exif?.lat, exif?.lng)) return { lat: exif.lat, lng: exif.lng };
  return null;
}

function extractFromJpegApp1(bytes: Uint8Array): ExifGps | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }
    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (len < 2 || offset + 2 + len > bytes.length) break;
    if (marker === 0xe1) {
      const payload = bytes.subarray(offset + 4, offset + 2 + len);
      if (startsWithExifHeader(payload)) {
        const gps = parseTiffGps(payload.subarray(6));
        if (gps) return gps;
      }
    }
    offset += 2 + len;
  }
  return null;
}

function startsWithExifHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  return EXIF_ASCII.every((b, i) => bytes[i] === b);
}

function findExifTiffStarts(bytes: Uint8Array): number[] {
  const starts: number[] = [];
  for (let i = 0; i <= bytes.length - 8; i++) {
    if (startsWithExifHeader(bytes.subarray(i, i + 6))) {
      starts.push(i + 6);
    }
  }
  return starts;
}

function parseTiffGps(tiff: Uint8Array): ExifGps | null {
  if (tiff.length < 8) return null;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const b0 = view.getUint8(0);
  const b1 = view.getUint8(1);
  const little = b0 === 0x49 && b1 === 0x49;
  const big = b0 === 0x4d && b1 === 0x4d;
  if (!little && !big) return null;
  if (readU16(view, 2, little) !== TIFF_MAGIC) return null;
  const ifd0 = readU32(view, 4, little);
  const gpsIfd = findGpsIfdOffset(view, ifd0, little);
  if (gpsIfd == null) return null;
  return readGpsCoords(view, gpsIfd, little);
}

function findGpsIfdOffset(view: DataView, ifdOffset: number, le: boolean): number | null {
  for (const entry of readIfdEntries(view, ifdOffset, le)) {
    if (entry.tag === TAG_GPS_IFD && (entry.type === TYPE_LONG || entry.type === 13)) {
      return entry.valueOrOffset;
    }
  }
  return null;
}

function readGpsCoords(view: DataView, ifdOffset: number, le: boolean): ExifGps | null {
  const entries = readIfdEntries(view, ifdOffset, le);
  let latRef = "";
  let lngRef = "";
  let lat: number | null = null;
  let lng: number | null = null;

  for (const entry of entries) {
    if (entry.tag === TAG_GPS_LAT_REF) latRef = readAscii(view, entry, le);
    else if (entry.tag === TAG_GPS_LNG_REF) lngRef = readAscii(view, entry, le);
    else if (entry.tag === TAG_GPS_LAT) lat = readDms(view, entry, le);
    else if (entry.tag === TAG_GPS_LNG) lng = readDms(view, entry, le);
  }

  if (lat == null || lng == null) return null;
  if (/^[Ss]$/.test(latRef)) lat = -Math.abs(lat);
  if (/^[Ww]$/.test(lngRef)) lng = -Math.abs(lng);
  if (!isValidGps(lat, lng)) return null;
  return { lat, lng };
}

type IfdEntry = {
  tag: number;
  type: number;
  count: number;
  valueOrOffset: number;
  fieldOffset: number;
};

function readIfdEntries(view: DataView, ifdOffset: number, le: boolean): IfdEntry[] {
  if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) return [];
  const count = readU16(view, ifdOffset, le);
  if (count <= 0 || count > 64) return [];
  const entries: IfdEntry[] = [];
  for (let i = 0; i < count; i++) {
    const off = ifdOffset + 2 + i * 12;
    if (off + 12 > view.byteLength) break;
    entries.push({
      tag: readU16(view, off, le),
      type: readU16(view, off + 2, le),
      count: readU32(view, off + 4, le),
      valueOrOffset: readU32(view, off + 8, le),
      fieldOffset: off + 8,
    });
  }
  return entries;
}

function readAscii(view: DataView, entry: IfdEntry, _le: boolean): string {
  const count = entry.count;
  if (count <= 0 || count > 8) return "";
  const inline = count <= 4;
  const start = inline ? entry.fieldOffset : entry.valueOrOffset;
  if (start < 0 || start + count > view.byteLength) return "";
  let out = "";
  for (let i = 0; i < count; i++) {
    const b = view.getUint8(start + i);
    if (b === 0) break;
    out += String.fromCharCode(b);
  }
  return out;
}

function readDms(view: DataView, entry: IfdEntry, le: boolean): number | null {
  if (entry.type !== TYPE_RATIONAL || entry.count < 1) return null;
  const start = entry.count * 8 <= 4 ? entry.fieldOffset : entry.valueOrOffset;
  if (start < 0 || start + 8 > view.byteLength) return null;
  const deg = readRational(view, start, le);
  if (deg == null) return null;
  if (entry.count === 1) return deg;
  if (start + 16 > view.byteLength) return deg;
  const min = readRational(view, start + 8, le) ?? 0;
  const sec = entry.count >= 3 && start + 24 <= view.byteLength
    ? (readRational(view, start + 16, le) ?? 0)
    : 0;
  return deg + min / 60 + sec / 3600;
}

function readRational(view: DataView, offset: number, le: boolean): number | null {
  if (offset + 8 > view.byteLength) return null;
  const num = readU32(view, offset, le);
  const den = readU32(view, offset + 4, le);
  if (den === 0) return null;
  return num / den;
}

function readU16(view: DataView, offset: number, le: boolean): number {
  return view.getUint16(offset, le);
}

function readU32(view: DataView, offset: number, le: boolean): number {
  return view.getUint32(offset, le);
}
