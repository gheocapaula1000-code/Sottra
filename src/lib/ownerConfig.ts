/**
 * Single source of truth for the owner/super-admin account.
 * This account gets full bypass of all restrictions but sees
 * the same UI as a normal user (except a discrete admin link).
 */
export const OWNER_EMAILS: readonly string[] = [
  "gheocapaula@gmail.com",
  "gheocapaula1000@gmail.com",
];

/** Keep legacy single export for any external consumer */
export const OWNER_EMAIL = OWNER_EMAILS[0];

export const isOwnerEmail = (email: string | undefined | null): boolean =>
  !!email && OWNER_EMAILS.some((o) => o.toLowerCase() === email.toLowerCase());
