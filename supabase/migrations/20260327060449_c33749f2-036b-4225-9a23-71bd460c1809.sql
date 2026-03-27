
-- Source Registry: central catalog of all data sources
CREATE TABLE IF NOT EXISTS public.data_source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_label text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'official',
  source_family text NOT NULL DEFAULT 'territorial',
  source_year integer,
  source_version text,
  provider_label text NOT NULL DEFAULT '',
  officiality_level text NOT NULL DEFAULT 'official',
  geographic_level_supported text NOT NULL DEFAULT 'comune',
  geographic_scope text NOT NULL DEFAULT 'nazionale',
  regions_supported text[] DEFAULT '{}',
  report_sections_supported text[] DEFAULT '{}',
  dataset_status text NOT NULL DEFAULT 'inactive',
  ingestion_mode text NOT NULL DEFAULT 'manual_upload',
  refresh_mode text NOT NULL DEFAULT 'manual',
  last_import_job_id text,
  last_imported_at timestamptz,
  last_validated_at timestamptz,
  current_coverage_status text NOT NULL DEFAULT 'unavailable',
  record_count integer DEFAULT 0,
  coverage_comuni integer DEFAULT 0,
  coverage_regioni integer DEFAULT 0,
  notes text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_source_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage source registry"
  ON public.data_source_registry FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read source registry"
  ON public.data_source_registry FOR SELECT TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_data_source_registry_updated_at
  BEFORE UPDATE ON public.data_source_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
