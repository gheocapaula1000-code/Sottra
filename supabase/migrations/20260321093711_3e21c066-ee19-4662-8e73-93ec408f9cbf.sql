
-- KeyDraft imports table
CREATE TABLE public.keydraft_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  run_id text,
  status text NOT NULL DEFAULT 'importata' CHECK (status IN ('importata', 'in_lavorazione', 'completata', 'archiviata')),
  source_app text NOT NULL DEFAULT 'keydraft',
  bridge_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sottra_completions jsonb NOT NULL DEFAULT '{}'::jsonb,
  origin_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for idempotency on listing_id
CREATE UNIQUE INDEX idx_keydraft_imports_listing_id ON public.keydraft_imports (listing_id);

-- Index for user lookups
CREATE INDEX idx_keydraft_imports_user_id ON public.keydraft_imports (user_id);

-- Enable RLS
ALTER TABLE public.keydraft_imports ENABLE ROW LEVEL SECURITY;

-- Users can view their own imports
CREATE POLICY "Users can view own imports"
  ON public.keydraft_imports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own imports (for completions)
CREATE POLICY "Users can update own imports"
  ON public.keydraft_imports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role inserts (from edge function using service_role key)
-- No INSERT policy needed for authenticated users since imports come through the edge function

-- Auto-update updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.keydraft_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
