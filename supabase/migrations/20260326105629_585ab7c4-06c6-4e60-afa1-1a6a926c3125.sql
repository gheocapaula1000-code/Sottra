
-- Sub-municipal demographic zones table
-- Stores real demographic data at sub-municipal level (microzona, quartiere, sezione censuaria)
CREATE TABLE public.demographic_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Geographic keys
  codice_comune_catastale text NOT NULL,
  codice_comune_istat text,
  comune_label text NOT NULL DEFAULT '',
  -- Zone identification (can link to OMI zone or census section)
  zona_key text NOT NULL,
  zona_label text NOT NULL DEFAULT '',
  zona_type text NOT NULL DEFAULT 'sezione_censuaria', -- sezione_censuaria, quartiere, microzona_omi, circoscrizione
  -- Optional link to OMI zone
  zona_omi text,
  -- Demographic metrics
  popolazione integer,
  nuclei_familiari integer,
  densita numeric,
  eta_media numeric,
  indice_vecchiaia numeric,
  percentuale_stranieri numeric,
  percentuale_giovani numeric,
  percentuale_famiglie numeric,
  flusso_residenti_12m numeric,
  -- Geographic polygon for point-in-polygon matching
  polygon_coords jsonb,
  -- Source metadata
  anno_rilevazione text,
  source_label text NOT NULL DEFAULT 'ISTAT Censimento',
  source_type text NOT NULL DEFAULT 'official',
  -- Import tracking
  import_batch_id text,
  source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for spatial lookups by comune
CREATE INDEX idx_demographic_zones_comune ON public.demographic_zones (codice_comune_catastale);
CREATE INDEX idx_demographic_zones_omi ON public.demographic_zones (zona_omi) WHERE zona_omi IS NOT NULL;

-- RLS
ALTER TABLE public.demographic_zones ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read demographic zones"
  ON public.demographic_zones FOR SELECT TO authenticated
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage demographic zones"
  ON public.demographic_zones FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
