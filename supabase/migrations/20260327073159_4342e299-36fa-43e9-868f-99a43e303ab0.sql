
-- Territorial Registry: unified backbone for comuni, località, ASC
CREATE TABLE IF NOT EXISTS public.territorial_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Geographic hierarchy
  comune_istat_code text NOT NULL,
  comune_name text NOT NULL DEFAULT '',
  provincia_code text,
  provincia_name text,
  regione_code text,
  regione_name text,
  -- Località layer
  localita_code text,
  localita_name text,
  localita_type text, -- capoluogo, localita, case_sparse
  -- ASC layer
  asc_level integer,
  asc_code text,
  asc_name text,
  asc_type text,
  -- Metadata
  geographic_level text NOT NULL DEFAULT 'comune', -- comune, localita, asc
  source_key text NOT NULL DEFAULT 'istat_comuni',
  source_label text NOT NULL DEFAULT 'ISTAT',
  source_year integer,
  dataset_status text NOT NULL DEFAULT 'active',
  coverage_status text NOT NULL DEFAULT 'available',
  centroid_lat numeric,
  centroid_lng numeric,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  import_batch_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: one entry per geographic entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_territorial_registry_unique
  ON public.territorial_registry (comune_istat_code, geographic_level, COALESCE(localita_code, ''), COALESCE(asc_code, ''));

-- Lookup indices
CREATE INDEX IF NOT EXISTS idx_territorial_registry_comune ON public.territorial_registry (comune_istat_code);
CREATE INDEX IF NOT EXISTS idx_territorial_registry_regione ON public.territorial_registry (regione_code);
CREATE INDEX IF NOT EXISTS idx_territorial_registry_level ON public.territorial_registry (geographic_level);

-- RLS
ALTER TABLE public.territorial_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage territorial_registry"
  ON public.territorial_registry FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read territorial_registry"
  ON public.territorial_registry FOR SELECT TO authenticated
  USING (true);
