
CREATE TABLE public.omi_polygons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_comune_catastale text NOT NULL,
  zona_omi text NOT NULL,
  comune_label text NOT NULL DEFAULT '',
  polygon_coords jsonb NOT NULL,
  anno integer NOT NULL DEFAULT 2025,
  semestre integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (codice_comune_catastale, zona_omi, anno, semestre)
);

ALTER TABLE public.omi_polygons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read OMI polygons"
  ON public.omi_polygons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert OMI polygons"
  ON public.omi_polygons FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update OMI polygons"
  ON public.omi_polygons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete OMI polygons"
  ON public.omi_polygons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
