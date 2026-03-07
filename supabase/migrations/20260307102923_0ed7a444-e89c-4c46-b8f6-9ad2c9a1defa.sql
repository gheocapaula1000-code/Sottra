-- Create user_trials table to track trial status and scan usage
CREATE TABLE public.user_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  trial_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '3 days'),
  scans_used INTEGER NOT NULL DEFAULT 0,
  max_scans INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_trials ENABLE ROW LEVEL SECURITY;

-- Users can read their own trial
CREATE POLICY "Users can view their own trial"
  ON public.user_trials FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own trial (for incrementing scans)
CREATE POLICY "Users can update their own trial"
  ON public.user_trials FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (triggered on signup)
CREATE POLICY "Service role can insert trials"
  ON public.user_trials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create trial on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_trials (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- Timestamp updater
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_trials_updated_at
  BEFORE UPDATE ON public.user_trials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();