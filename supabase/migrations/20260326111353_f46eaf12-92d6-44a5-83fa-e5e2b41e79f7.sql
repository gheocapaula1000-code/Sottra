ALTER TABLE public.demographic_zones
  ADD COLUMN IF NOT EXISTS centroid_lat numeric,
  ADD COLUMN IF NOT EXISTS centroid_lng numeric,
  ADD COLUMN IF NOT EXISTS coverage_level text NOT NULL DEFAULT 'zona',
  ADD COLUMN IF NOT EXISTS data_quality text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_demographic_zones_centroid
  ON public.demographic_zones (centroid_lat, centroid_lng)
  WHERE centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demographic_zones_comune_omi
  ON public.demographic_zones (codice_comune_catastale, zona_omi)
  WHERE zona_omi IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.safety_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_comune_catastale text NOT NULL,
  codice_comune_istat text,
  comune_label text NOT NULL DEFAULT '',
  zona_key text NOT NULL,
  zona_label text NOT NULL DEFAULT '',
  zona_type text NOT NULL DEFAULT 'quartiere',
  zona_omi text,
  polygon_coords jsonb,
  centroid_lat numeric,
  centroid_lng numeric,
  reati_totali integer,
  reati_per_1000_abitanti numeric,
  furti_abitazione integer,
  rapine integer,
  indice_sicurezza_percepita numeric,
  anno_rilevazione text,
  source_label text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'official',
  coverage_level text NOT NULL DEFAULT 'quartiere',
  data_quality text NOT NULL DEFAULT 'standard',
  is_official boolean NOT NULL DEFAULT true,
  notes text,
  import_batch_id text,
  source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_zones_comune ON public.safety_zones (codice_comune_catastale);
CREATE INDEX IF NOT EXISTS idx_safety_zones_omi ON public.safety_zones (zona_omi) WHERE zona_omi IS NOT NULL;

ALTER TABLE public.safety_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read safety zones"
  ON public.safety_zones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage safety zones"
  ON public.safety_zones FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role))