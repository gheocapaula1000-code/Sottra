
-- Storage bucket for admin dataset uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('territorial-datasets', 'territorial-datasets', false);

-- RLS: Only admins can upload/read/delete
CREATE POLICY "Admins can upload territorial datasets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'territorial-datasets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read territorial datasets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'territorial-datasets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete territorial datasets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'territorial-datasets' AND public.has_role(auth.uid(), 'admin'));

-- Job tracking table
CREATE TABLE public.territorial_dataset_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_type text NOT NULL CHECK (dataset_type IN ('ASC_2021', 'R03_2021', 'R03_CSV_SEZ', 'R03_CSV_ASC1', 'R03_CSV_ASC2', 'R03_CSV_ASC3')),
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'validating', 'ready_to_import', 'importing', 'imported', 'failed')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  records_total integer DEFAULT 0,
  records_imported integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  records_errors integer DEFAULT 0,
  import_batch_id text,
  validation_result jsonb DEFAULT '{}'::jsonb,
  error_log jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  stats jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.territorial_dataset_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dataset jobs"
ON public.territorial_dataset_jobs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_territorial_dataset_jobs_updated_at
  BEFORE UPDATE ON public.territorial_dataset_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
