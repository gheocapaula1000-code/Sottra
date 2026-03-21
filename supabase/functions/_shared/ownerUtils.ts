/**
 * Shared owner/admin email resolution for Edge Functions.
 * Reads from the OWNER_EMAILS env var (comma-separated).
 * NEVER hardcodes email addresses.
 */

let _cached: string[] | null = null;

export function getOwnerEmails(): string[] {
  if (_cached) return _cached;
  const raw = Deno.env.get("OWNER_EMAILS") ?? "";
  _cached = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return _cached;
}

export function isOwnerEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getOwnerEmails().includes(normalized);
}
