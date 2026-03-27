
CREATE TABLE public.r03_asc_aggregates_2021 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dataset text NOT NULL DEFAULT 'R03_21',
  source_year integer NOT NULL DEFAULT 2021,
  comune_istat_code text NOT NULL,
  comune_name text NOT NULL DEFAULT '',
  asc_level integer NOT NULL,
  asc_code text NOT NULL,
  asc_name text,
  population_2021 integer,
  families_2021 integer,
  dwellings_2021 integer,
  occupied_dwellings_2021 integer,
  buildings_2021 integer,
  residential_buildings_2021 integer,
  sections_count integer NOT NULL DEFAULT 0,
  sections_with_data integer NOT NULL DEFAULT 0,
  superficie_kmq numeric,
  density_pop_per_kmq numeric,
  coverage_status text NOT NULL DEFAULT 'available',
  derivation_notes text,
  import_batch_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (source_dataset, asc_level, asc_code)
);

ALTER TABLE public.r03_asc_aggregates_2021 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage r03 aggregates"
  ON public.r03_asc_aggregates_2021 FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read r03 aggregates"
  ON public.r03_asc_aggregates_2021 FOR SELECT
  TO authenticated
  USING (true);
