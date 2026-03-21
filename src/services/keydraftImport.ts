/**
 * Service layer for KeyDraft bridge imports.
 * Communicates with the keydraft_imports table through Supabase client.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  KeyDraftImportRecord,
  ImportDraftStatus,
  SottraCompletionFields,
} from "@/types/keydraft";

/**
 * Fetch all imports for the current user, ordered by most recent.
 */
export async function fetchImports(): Promise<KeyDraftImportRecord[]> {
  const { data, error } = await supabase
    .from("keydraft_imports" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[keydraftImport] fetchImports error:", error);
    throw new Error("Impossibile caricare le bozze importate");
  }

  return (data ?? []) as unknown as KeyDraftImportRecord[];
}

/**
 * Fetch a single import by ID.
 */
export async function fetchImportById(id: string): Promise<KeyDraftImportRecord | null> {
  const { data, error } = await supabase
    .from("keydraft_imports" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[keydraftImport] fetchImportById error:", error);
    throw new Error("Impossibile caricare la bozza");
  }

  return (data as unknown as KeyDraftImportRecord) ?? null;
}

/**
 * Update the Sottra completion fields for a given import.
 */
export async function updateCompletions(
  id: string,
  completions: Partial<SottraCompletionFields>,
): Promise<void> {
  // Fetch current to merge
  const current = await fetchImportById(id);
  if (!current) throw new Error("Bozza non trovata");

  const merged = { ...current.sottra_completions, ...completions };

  const { error } = await supabase
    .from("keydraft_imports" as never)
    .update({
      sottra_completions: merged,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[keydraftImport] updateCompletions error:", error);
    throw new Error("Errore durante il salvataggio");
  }
}

/**
 * Update the draft status.
 */
export async function updateDraftStatus(
  id: string,
  status: ImportDraftStatus,
): Promise<void> {
  const { error } = await supabase
    .from("keydraft_imports" as never)
    .update({
      status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[keydraftImport] updateDraftStatus error:", error);
    throw new Error("Errore durante l'aggiornamento dello stato");
  }
}
