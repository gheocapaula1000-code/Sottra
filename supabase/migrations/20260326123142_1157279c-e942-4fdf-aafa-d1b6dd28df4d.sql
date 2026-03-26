
-- Drop the old unique constraint on (zona_key, codice_comune_catastale)
ALTER TABLE public.demographic_zones DROP CONSTRAINT IF EXISTS demographic_zones_zona_key_codice_comune_catastale_key;

-- Create new unique constraint on (zona_key, codice_comune_catastale, anno_rilevazione, source_label)
-- anno_rilevazione and source_label have defaults, so we need COALESCE for nulls
-- Instead, let's make anno_rilevazione NOT NULL with a default
ALTER TABLE public.demographic_zones ALTER COLUMN anno_rilevazione SET DEFAULT '0000';
UPDATE public.demographic_zones SET anno_rilevazione = '0000' WHERE anno_rilevazione IS NULL;
ALTER TABLE public.demographic_zones ALTER COLUMN anno_rilevazione SET NOT NULL;

-- Now create the composite unique constraint
ALTER TABLE public.demographic_zones ADD CONSTRAINT demographic_zones_dedup_key UNIQUE (zona_key, codice_comune_catastale, anno_rilevazione, source_label);

-- Add index for faster lookups during report resolution
CREATE INDEX IF NOT EXISTS idx_demographic_zones_comune_zona_omi ON public.demographic_zones (codice_comune_catastale, zona_omi) WHERE zona_omi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demographic_zones_coverage ON public.demographic_zones (codice_comune_catastale, coverage_level);
