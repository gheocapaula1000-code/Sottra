/**
 * Postazioni agenzia — telefoni illimitati sotto UN solo abbonamento.
 *
 * Agente (79 €, 80 scansioni) resta legato a un solo telefono/account: nessuna
 * eredità di accesso. Agenzia (249 €, 600) e Rete (690 €, 2000) sono venduti con
 * telefoni illimitati: l'account che paga possiede l'abbonamento, gli altri agenti
 * loggati della stessa agenzia ereditano l'accesso e condividono lo stesso tetto
 * scansioni mensile.
 *
 * Fail-closed: senza appartenenza all'agenzia e senza abbonamento condiviso attivo
 * non si passa. La condivisione delle credenziali resta vietata (Termini).
 *
 * Nessuna dipendenza runtime: modulo puro, testabile lato client.
 */

/** Price ID con posti condivisi (telefoni illimitati). Specchio di src/lib/plans.ts. */
export const SHARED_SEAT_PRICE_IDS: readonly string[] = [
  // Agenzia — 249 €/mese, 600 scansioni condivise
  "price_1UBRDpGhKJTTu87hNtUKeWJ3",
  // Rete — 690 €/mese, 2000 scansioni condivise
  "price_1UBRDqGhKJTTu87h7Qj9n6Hd",
];

/** Price ID a postazione singola: nessuna eredità di accesso. */
export const SINGLE_SEAT_PRICE_IDS: readonly string[] = [
  // Agente — 79 €/mese, 80 scansioni, 1 telefono
  "price_1UBRDoGhKJTTu87hDT1WGBdS",
];

const ACTIVE_STATUSES: readonly string[] = ["active", "trialing"];

export function isSharedSeatPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return SHARED_SEAT_PRICE_IDS.includes(priceId);
}

export interface SharedSubscriptionRow {
  owner_user_id?: string | null;
  price_id?: string | null;
  status?: string | null;
}

/**
 * Un agente eredita l'accesso solo se l'abbonamento dell'agenzia è attivo/trialing
 * ED è un piano a posti condivisi (Agenzia o Rete). Piano Agente → mai ereditato.
 */
export function inheritsAgencySeat(row: SharedSubscriptionRow | null | undefined): boolean {
  if (!row) return false;
  if (!ACTIVE_STATUSES.includes(row.status ?? "")) return false;
  return isSharedSeatPriceId(row.price_id);
}

/** Utenti che condividono lo stesso tetto mensile (sempre incluso l'utente stesso). */
export function sharedCapUserIds(userId: string, peerIds: readonly string[] | null | undefined): string[] {
  const set = new Set<string>([userId]);
  for (const id of peerIds ?? []) {
    if (typeof id === "string" && id) set.add(id);
  }
  return [...set];
}
