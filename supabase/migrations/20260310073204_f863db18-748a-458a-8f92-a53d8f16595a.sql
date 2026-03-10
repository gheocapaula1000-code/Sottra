
-- Create scan_events table for idempotent scan counting
CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_events_scan_id_unique UNIQUE (scan_id)
);

-- Enable RLS
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own scan events
CREATE POLICY "Users can view own scan events"
  ON public.scan_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own scan events
CREATE POLICY "Users can insert own scan events"
  ON public.scan_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create the idempotent function to record a scan and increment counter
CREATE OR REPLACE FUNCTION public.record_scan(_user_id uuid, _scan_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted boolean := false;
  _trial record;
BEGIN
  -- Try to insert the scan event (idempotent via unique constraint)
  BEGIN
    INSERT INTO public.scan_events (user_id, scan_id)
    VALUES (_user_id, _scan_id);
    _inserted := true;
  EXCEPTION WHEN unique_violation THEN
    _inserted := false;
  END;

  -- Only increment scans_used if this was a new scan
  IF _inserted THEN
    UPDATE public.user_trials
    SET scans_used = scans_used + 1
    WHERE user_id = _user_id;
  END IF;

  -- Return current trial state
  SELECT scans_used, max_scans, trial_end
  INTO _trial
  FROM public.user_trials
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'recorded', _inserted,
    'scans_used', COALESCE(_trial.scans_used, 0),
    'max_scans', COALESCE(_trial.max_scans, 5),
    'trial_end', _trial.trial_end
  );
END;
$$;

-- Ensure the trial trigger exists on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_trials (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate trigger (DROP IF EXISTS + CREATE)
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();
