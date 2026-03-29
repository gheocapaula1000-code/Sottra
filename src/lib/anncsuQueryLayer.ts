/**
 * ANNCSU Query Layer — Internal helpers for querying stored ANNCSU data.
 *
 * Used by admin pages and future address resolver integration.
 * All queries go through the Supabase client (RLS-aware).
 *
 * IMPORTANT: These helpers do NOT promote any result to building truth.
 */

import { supabase } from "@/integrations/supabase/client";

export interface AnncsuStreetRecord {
  id: string;
  comune_istat_code: string;
  regione_code: string | null;
  provincia_code: string | null;
  comune_label: string | null;
  cod_strada: string | null;
  street_type: string | null;
  street_name: string;
  street_full_name: string | null;
  civic_normalized: string | null;
  esponente: string | null;
  barrato: string | null;
  civic_full_label: string | null;
  localita_code: string | null;
  sezione_censuaria: string | null;
  street_status: string;
  civic_status: string;
  ingest_readiness: string;
  ambiguity_flags: string[];
  warnings: string[];
  raw_completeness: number;
  source_version: string | null;
  source_date: string | null;
  import_batch_id: string | null;
  created_at: string;
}

/** Query ANNCSU records by comune ISTAT code */
export async function queryAnncsuByComune(
  comuneIstatCode: string,
  limit = 100,
): Promise<{ ok: true; records: AnncsuStreetRecord[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("anncsu_streets" as never)
    .select("*")
    .eq("comune_istat_code", comuneIstatCode)
    .limit(limit) as { data: AnncsuStreetRecord[] | null; error: { message: string } | null };

  if (error) return { ok: false, error: error.message };
  return { ok: true, records: data ?? [] };
}

/** Query ANNCSU street candidates by partial name within a comune */
export async function queryAnncsuStreetCandidates(
  comuneIstatCode: string,
  streetNamePartial: string,
  limit = 20,
): Promise<{ ok: true; records: AnncsuStreetRecord[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("anncsu_streets" as never)
    .select("*")
    .eq("comune_istat_code", comuneIstatCode)
    .ilike("street_name", `%${streetNamePartial}%`)
    .limit(limit) as { data: AnncsuStreetRecord[] | null; error: { message: string } | null };

  if (error) return { ok: false, error: error.message };
  return { ok: true, records: data ?? [] };
}

/** Query exact street match in a comune */
export async function queryAnncsuExactStreet(
  comuneIstatCode: string,
  streetName: string,
  limit = 50,
): Promise<{ ok: true; records: AnncsuStreetRecord[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("anncsu_streets" as never)
    .select("*")
    .eq("comune_istat_code", comuneIstatCode)
    .eq("street_name", streetName)
    .limit(limit) as { data: AnncsuStreetRecord[] | null; error: { message: string } | null };

  if (error) return { ok: false, error: error.message };
  return { ok: true, records: data ?? [] };
}

/** Query civic candidates for a specific street in a comune */
export async function queryAnncsuCivicCandidates(
  comuneIstatCode: string,
  streetName: string,
  civicNumber?: string,
  limit = 20,
): Promise<{ ok: true; records: AnncsuStreetRecord[] } | { ok: false; error: string }> {
  let query = supabase
    .from("anncsu_streets" as never)
    .select("*")
    .eq("comune_istat_code", comuneIstatCode)
    .eq("street_name", streetName)
    .not("civic_normalized", "is", null) as ReturnType<typeof supabase.from>;

  if (civicNumber) {
    query = query.eq("civic_normalized", civicNumber);
  }

  const { data, error } = await query.limit(limit) as { data: AnncsuStreetRecord[] | null; error: { message: string } | null };

  if (error) return { ok: false, error: error.message };
  return { ok: true, records: data ?? [] };
}

/** Get aggregate stats for stored ANNCSU data */
export async function queryAnncsuStats(): Promise<{
  total: number;
  comuni_count: number;
  with_civic: number;
  ready: number;
}> {
  const totalRes = await supabase.from("anncsu_streets" as never).select("id", { count: "exact", head: true });
  const civicRes = await supabase.from("anncsu_streets" as never).select("id", { count: "exact", head: true }).not("civic_normalized", "is", null);
  const readyRes = await supabase.from("anncsu_streets" as never).select("id", { count: "exact", head: true }).eq("ingest_readiness", "ready");

  return {
    total: (totalRes as unknown as { count: number | null }).count ?? 0,
    comuni_count: 0,
    with_civic: (civicRes as unknown as { count: number | null }).count ?? 0,
    ready: (readyRes as unknown as { count: number | null }).count ?? 0,
  };
}
