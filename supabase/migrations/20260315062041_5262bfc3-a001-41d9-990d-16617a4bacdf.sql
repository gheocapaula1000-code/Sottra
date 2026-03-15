
ALTER TABLE public.omi_polygons
  ADD COLUMN IF NOT EXISTS source_file text DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_hash text DEFAULT '',
  ADD COLUMN IF NOT EXISTS imported_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS import_batch_id text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_omi_polygons_source_hash ON public.omi_polygons (source_hash);
CREATE INDEX IF NOT EXISTS idx_omi_polygons_source_file ON public.omi_polygons (source_file);
CREATE INDEX IF NOT EXISTS idx_omi_polygons_codcom_zona ON public.omi_polygons (codice_comune_catastale, zona_omi);
