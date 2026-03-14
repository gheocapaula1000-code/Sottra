
CREATE TABLE public.omi_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_comune_catastale text NOT NULL,
  codice_comune_istat text,
  comune_label text NOT NULL DEFAULT '',
  provincia text DEFAULT '',
  fascia text DEFAULT '',
  zona_omi text NOT NULL,
  zona_descr text DEFAULT '',
  link_zona text DEFAULT '',
  tipologia_prevalente text DEFAULT '',
  microzona integer DEFAULT 0,
  semestre integer NOT NULL,
  anno integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (codice_comune_catastale, zona_omi, semestre, anno)
);

ALTER TABLE public.omi_zone ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read OMI zone data"
  ON public.omi_zone FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert OMI zone data"
  ON public.omi_zone FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update OMI zone data"
  ON public.omi_zone FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete OMI zone data"
  ON public.omi_zone FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
