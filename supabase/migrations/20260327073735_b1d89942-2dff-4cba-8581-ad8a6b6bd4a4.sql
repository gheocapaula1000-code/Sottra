
-- Fix territorial_registry: make localita_code and asc_code NOT NULL with empty default
-- so we can use a regular unique constraint instead of COALESCE-based functional index

-- Update existing nulls to empty string
UPDATE public.territorial_registry SET localita_code = '' WHERE localita_code IS NULL;
UPDATE public.territorial_registry SET asc_code = '' WHERE asc_code IS NULL;

-- Alter columns to NOT NULL with default ''
ALTER TABLE public.territorial_registry ALTER COLUMN localita_code SET DEFAULT '';
ALTER TABLE public.territorial_registry ALTER COLUMN localita_code SET NOT NULL;
ALTER TABLE public.territorial_registry ALTER COLUMN asc_code SET DEFAULT '';
ALTER TABLE public.territorial_registry ALTER COLUMN asc_code SET NOT NULL;

-- Drop the old functional unique index
DROP INDEX IF EXISTS idx_territorial_registry_unique;

-- Create a regular unique constraint (PostgREST-compatible)
ALTER TABLE public.territorial_registry 
  ADD CONSTRAINT uq_territorial_registry_key 
  UNIQUE (comune_istat_code, geographic_level, localita_code, asc_code);

-- Add index for località lookups
CREATE INDEX IF NOT EXISTS idx_territorial_registry_localita 
  ON public.territorial_registry (comune_istat_code, geographic_level, localita_code) 
  WHERE geographic_level = 'localita';
