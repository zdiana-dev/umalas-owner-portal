CREATE TYPE public.staff_role AS ENUM ('admin', 'finance', 'luxso');
CREATE TYPE public.payment_plan_status AS ENUM ('draft', 'published', 'completed', 'cancelled');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.staff_role FROM public.profiles WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id uuid, _role public.staff_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION public.has_staff_role(uuid, public.staff_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_staff_role(uuid, public.staff_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_staff_role(_user_id, 'admin'::public.staff_role)
$$;

CREATE TABLE public.staff_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
GRANT SELECT ON public.staff_project_access TO authenticated;
GRANT ALL ON public.staff_project_access TO service_role;
ALTER TABLE public.staff_project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own project access" ON public.staff_project_access FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_date date NOT NULL DEFAULT current_date,
  status public.payment_plan_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment plans" ON public.payment_plans FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Finance read published payment plans" ON public.payment_plans FOR SELECT TO authenticated USING (public.has_staff_role(auth.uid(), 'finance'::public.staff_role) AND status IN ('published', 'completed'));

CREATE TABLE public.payment_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  priority integer NOT NULL,
  paid_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, report_id),
  UNIQUE (plan_id, priority)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plan_items TO authenticated;
GRANT ALL ON public.payment_plan_items TO service_role;
ALTER TABLE public.payment_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment plan items" ON public.payment_plan_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Finance read published plan items" ON public.payment_plan_items FOR SELECT TO authenticated USING (
  public.has_staff_role(auth.uid(), 'finance'::public.staff_role)
  AND EXISTS (SELECT 1 FROM public.payment_plans p WHERE p.id = plan_id AND p.status IN ('published', 'completed'))
);

CREATE OR REPLACE FUNCTION public.touch_payment_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.touch_payment_plan_updated_at();