CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL DEFAULT '',
  logo_url text,
  accent text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select_authenticated ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY projects_admin_all ON public.projects
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.projects (code, name, short_name, sort_order) VALUES
  ('umalas', 'The Umalas Signature', 'Umalas', 1),
  ('anoya', 'Anoya Villas', 'Anoya', 2),
  ('skystar', 'Sky Star Villas', 'Sky Star', 3);

ALTER TABLE public.units
  ADD COLUMN project_id uuid REFERENCES public.projects(id);

UPDATE public.units SET project_id = (SELECT id FROM public.projects WHERE code = 'umalas');

CREATE INDEX units_project_id_idx ON public.units (project_id);