
CREATE TABLE IF NOT EXISTS public.census_sections_r03_2021 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dataset text NOT NULL DEFAULT 'R03_21',
  source_year integer NOT NULL DEFAULT 2021,
  source_label text NOT NULL DEFAULT 'ISTAT Censimento 2021 — Lombardia',
  regione_code text DEFAULT '03',
  regione_name text DEFAULT 'Lombardia',
  provincia_code text,
  provincia_name text,
  comune_istat_code text,
  comune_catastale_code text,
  comune_name text NOT NULL DEFAULT '',
  section_code text NOT NULL,
  asc1_code text,
  asc2_code text,
  asc3_code text,
  population_2021 integer,
  males_2021 integer,
  females_2021 integer,
  families_2021 integer,
  dwellings_2021 integer,
  occupied_dwellings_2021 integer,
  buildings_2021 integer,
  residential_buildings_2021 integer,
  superficie_kmq numeric,
  centroid_lat numeric,
  centroid_lng numeric,
  bbox jsonb,
  polygon_coords jsonb,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  import_batch_id text,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (source_dataset, section_code)
);

CREATE INDEX IF NOT EXISTS idx_census_r03_comune ON public.census_sections_r03_2021 (comune_istat_code);
CREATE INDEX IF NOT EXISTS idx_census_r03_catastale ON public.census_sections_r03_2021 (comune_catastale_code);
CREATE INDEX IF NOT EXISTS idx_census_r03_asc1 ON public.census_sections_r03_2021 (asc1_code);
CREATE INDEX IF NOT EXISTS idx_census_r03_asc2 ON public.census_sections_r03_2021 (asc2_code);
CREATE INDEX IF NOT EXISTS idx_census_r03_centroid ON public.census_sections_r03_2021 (centroid_lat, centroid_lng);
CREATE INDEX IF NOT EXISTS idx_census_r03_batch ON public.census_sections_r03_2021 (import_batch_id);

ALTER TABLE public.census_sections_r03_2021 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage census sections"
  ON public.census_sections_r03_2021
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read census sections"
  ON public.census_sections_r03_2021
  FOR SELECT
  TO authenticated
  USING (true);
