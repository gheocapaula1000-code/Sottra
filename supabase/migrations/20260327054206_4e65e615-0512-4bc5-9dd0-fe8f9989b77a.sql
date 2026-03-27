
-- Drop old unique constraint and create new comune-aware one
ALTER TABLE public.r03_asc_aggregates_2021
  DROP CONSTRAINT IF EXISTS r03_asc_aggregates_2021_source_dataset_asc_level_asc_code_key;

ALTER TABLE public.r03_asc_aggregates_2021
  ADD CONSTRAINT r03_asc_agg_dataset_comune_level_code_key
  UNIQUE (source_dataset, comune_istat_code, asc_level, asc_code);

-- Index for lookup by comune + asc
CREATE INDEX IF NOT EXISTS idx_r03_asc_agg_comune_level_code
  ON public.r03_asc_aggregates_2021 (comune_istat_code, asc_level, asc_code);
