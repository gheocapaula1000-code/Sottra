
-- ANNCSU streets storage table
CREATE TABLE public.anncsu_streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comune_istat_code TEXT NOT NULL,
  regione_code TEXT,
  provincia_code TEXT,
  comune_label TEXT,
  cod_strada TEXT,
  street_type TEXT,
  street_name TEXT NOT NULL,
  street_full_name TEXT,
  civic_normalized TEXT,
  esponente TEXT,
  barrato TEXT,
  civic_full_label TEXT,
  localita_code TEXT,
  sezione_censuaria TEXT,
  street_status TEXT NOT NULL DEFAULT 'complete',
  civic_status TEXT NOT NULL DEFAULT 'present',
  ingest_readiness TEXT NOT NULL DEFAULT 'ready',
  ambiguity_flags TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  raw_completeness NUMERIC DEFAULT 0,
  source_version TEXT,
  source_date TEXT,
  import_batch_id TEXT,
  import_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dedup key: comune + street code + civic + esponente
CREATE UNIQUE INDEX anncsu_streets_dedup_idx ON public.anncsu_streets
  (comune_istat_code, COALESCE(cod_strada, ''), street_name, COALESCE(civic_normalized, ''), COALESCE(esponente, ''));

-- Query indexes
CREATE INDEX anncsu_streets_comune_idx ON public.anncsu_streets (comune_istat_code);
CREATE INDEX anncsu_streets_street_idx ON public.anncsu_streets (comune_istat_code, street_name);
CREATE INDEX anncsu_streets_batch_idx ON public.anncsu_streets (import_batch_id);

-- RLS
ALTER TABLE public.anncsu_streets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage anncsu_streets"
  ON public.anncsu_streets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read anncsu_streets"
  ON public.anncsu_streets FOR SELECT TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_anncsu_streets_updated_at
  BEFORE UPDATE ON public.anncsu_streets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
