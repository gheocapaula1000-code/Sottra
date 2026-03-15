/**
 * Defensive rendering utilities to prevent React Error #31
 * ("Objects are not valid as a React child").
 *
 * Any dynamic value from backend payloads MUST pass through
 * safeText() or safeValue() before being rendered in JSX.
 */

const TEXT_KEYS = [
  "label", "Label",
  "value", "Value",
  "message", "Message",
  "text", "Text",
  "title", "Title",
  "name", "Name",
  "description", "Description",
  "detail", "Detail",
];

/**
 * Safely extract displayable text from any unknown value.
 * - string/number/boolean → string
 * - null/undefined → fallback
 * - array of primitives → comma-joined
 * - array of objects → extract text from each, comma-joined
 * - object with known text keys → first found value
 * - unknown object → fallback (never "[object Object]")
 */
export function safeText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    const texts = v.map((item) => safeText(item, "")).filter(Boolean);
    return texts.length > 0 ? texts.join(", ") : fallback;
  }

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const val = obj[key];
      if (typeof val === "string" && val.length > 0) return val;
      if (typeof val === "number") return String(val);
    }
    // Check if object has any own keys worth showing
    const keys = Object.keys(obj);
    if (keys.length === 0) return fallback;
    // Last resort: try JSON but cap length
    try {
      const json = JSON.stringify(v);
      if (json.length <= 200) return json;
    } catch { /* ignore */ }
    if (import.meta.env.DEV) {
      console.warn("[safeText] non-renderable object:", v);
    }
    return fallback;
  }

  return String(v);
}

/**
 * Check if a value is safe to render directly in JSX.
 */
export function isRenderablePrimitive(v: unknown): v is string | number | boolean | null | undefined {
  return v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
