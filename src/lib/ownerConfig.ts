/**
 * Single source of truth for the owner/super-admin account.
 * This account gets full bypass of all restrictions but sees
 * the same UI as a normal user (except a discrete admin link).
 */
export const OWNER_EMAIL = "gheocapaula@gmail.com";

export const isOwnerEmail = (email: string | undefined | null): boolean =>
  !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();
