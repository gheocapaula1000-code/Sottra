
-- Create OMI quotazioni table for storing real OMI data from Agenzia delle Entrate
CREATE TABLE IF NOT EXISTS public.omi_quotazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_comune_catastale text NOT NULL,
  codice_comune_istat text,
  comune_label text NOT NULL,
  provincia text,
  zona_omi text NOT NULL,
  zona_omi_label text,
  tipologia text NOT NULL DEFAULT 'Abitazioni civili',
  stato_conservazione text DEFAULT 'NORMALE',
  quotazione_min numeric(10,2) NOT NULL,
  quotazione_max numeric(10,2) NOT NULL,
  superficie_ref text DEFAULT 'L',
  semestre integer NOT NULL,
  anno integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(codice_comune_catastale, zona_omi, tipologia, stato_conservazione, semestre, anno)
);

ALTER TABLE public.omi_quotazioni ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read OMI data
CREATE POLICY "Authenticated users can read OMI data"
  ON public.omi_quotazioni FOR SELECT TO authenticated USING (true);

-- Only admins can write OMI data
CREATE POLICY "Admins can insert OMI data"
  ON public.omi_quotazioni FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update OMI data"
  ON public.omi_quotazioni FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete OMI data"
  ON public.omi_quotazioni FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for efficient lookup
CREATE INDEX idx_omi_catastale ON public.omi_quotazioni(codice_comune_catastale);
CREATE INDEX idx_omi_istat ON public.omi_quotazioni(codice_comune_istat) WHERE codice_comune_istat IS NOT NULL;
CREATE INDEX idx_omi_anno_sem ON public.omi_quotazioni(anno DESC, semestre DESC);
