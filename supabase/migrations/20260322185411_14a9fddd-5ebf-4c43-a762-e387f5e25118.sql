-- Server-side owner access table replacing email-based OWNER_EMAILS bypass
CREATE TABLE IF NOT EXISTS public.owner_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_access ENABLE ROW LEVEL SECURITY;

-- Only admins can manage owner_access
CREATE POLICY "Admins can manage owner_access"
  ON public.owner_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owners can read their own record
CREATE POLICY "Owners can view own record"
  ON public.owner_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check owner status by user_id
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.owner_access WHERE user_id = _user_id
  )
$$;