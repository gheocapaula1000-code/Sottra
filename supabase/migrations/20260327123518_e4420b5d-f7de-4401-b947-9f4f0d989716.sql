
-- Allow owners to manage territorial_dataset_jobs (same as admins)
CREATE POLICY "Owners can manage dataset jobs"
  ON public.territorial_dataset_jobs
  FOR ALL
  TO authenticated
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- Storage: allow owners to upload/read/delete in territorial-datasets bucket
CREATE POLICY "Owners can upload territorial datasets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'territorial-datasets' AND is_owner(auth.uid()));

CREATE POLICY "Owners can read territorial datasets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'territorial-datasets' AND is_owner(auth.uid()));

CREATE POLICY "Owners can delete territorial datasets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'territorial-datasets' AND is_owner(auth.uid()));
