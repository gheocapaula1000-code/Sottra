
-- Table: sub_municipal_areas_2021
-- Non-destructive, dedicated table for ISTAT ASC/census sub-municipal areas
-- Ready for future import of ASC_21 and R03_21 datasets

CREATE TABLE IF NOT EXISTS public.sub_municipal_areas_2021 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dataset text NOT NULL,           -- e.g. 'ASC_21', 'R03_21'
  source_year integer NOT NULL DEFAULT 2021,
  source_label text NOT NULL DEFAULT 'ISTAT Censimento 2021',
  asc_level integer,                      -- 1, 2, or 3 for ASC layers; NULL for census sections
  area_code text NOT NULL,                -- ISTAT area code from dataset
  area_name text NOT NULL DEFAULT '',
  area_type text NOT NULL DEFAULT 'area_sub_comunale', -- area_sub_comunale, sezione_censuaria, localita
  comune_istat_code text,                 -- ISTAT municipality code
  comune_catastale_code text,             -- Belfiore code
  comune_name text NOT NULL DEFAULT '',
  provincia_code text,
  provincia_name text,
  regione_code text,
  regione_name text,
  popolazione integer,
  nuclei_familiari integer,
  densita numeric,
  eta_media numeric,
  superficie_kmq numeric,
  centroid_lat numeric,
  centroid_lng numeric,
  bbox jsonb,                             -- bounding box as [minLng, minLat, maxLng, maxLat]
  polygon_coords jsonb,                   -- GeoJSON geometry
  metadata_json jsonb DEFAULT '{}'::jsonb, -- extra attributes from source
  import_batch_id text,
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT sub_municipal_areas_2021_dedup_key 
    UNIQUE (source_dataset, asc_level, area_code)
);

-- Spatial-like index for point-in-polygon queries via centroid
CREATE INDEX IF NOT EXISTS idx_sma2021_centroid 
  ON public.sub_municipal_areas_2021 (centroid_lat, centroid_lng) 
  WHERE centroid_lat IS NOT NULL;

-- Lookup by municipality
CREATE INDEX IF NOT EXISTS idx_sma2021_comune 
  ON public.sub_municipal_areas_2021 (comune_catastale_code, asc_level);

-- Lookup by region
CREATE INDEX IF NOT EXISTS idx_sma2021_regione 
  ON public.sub_municipal_areas_2021 (regione_code, asc_level);

-- Enable RLS
ALTER TABLE public.sub_municipal_areas_2021 ENABLE ROW LEVEL SECURITY;

-- RLS: admin full access
CREATE POLICY "Admins can manage sub_municipal_areas"
  ON public.sub_municipal_areas_2021
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: authenticated read
CREATE POLICY "Authenticated users can read sub_municipal_areas"
  ON public.sub_municipal_areas_2021
  FOR SELECT
  TO authenticated
  USING (true);
