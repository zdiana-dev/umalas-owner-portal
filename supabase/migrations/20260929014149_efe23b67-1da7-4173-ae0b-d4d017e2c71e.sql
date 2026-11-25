CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_staff_role(_user_id uuid, _role public.staff_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_staff_role(uuid, public.staff_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_staff_role(uuid, public.staff_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.has_staff_role(_user_id, 'admin'::public.staff_role)
$$;

DROP POLICY "Finance read published payment plans" ON public.payment_plans;
CREATE POLICY "Finance read published payment plans" ON public.payment_plans FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'finance'::public.staff_role) AND status IN ('published', 'completed'));
DROP POLICY "Finance read published plan items" ON public.payment_plan_items;
CREATE POLICY "Finance read published plan items" ON public.payment_plan_items FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'finance'::public.staff_role) AND EXISTS (SELECT 1 FROM public.payment_plans p WHERE p.id = plan_id AND p.status IN ('published', 'completed')));
DROP POLICY "Finance read units" ON public.units;
CREATE POLICY "Finance read units" ON public.units FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'finance'::public.staff_role));
DROP POLICY "Luxso read assigned units" ON public.units;
CREATE POLICY "Luxso read assigned units" ON public.units FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'luxso'::public.staff_role) AND EXISTS (SELECT 1 FROM public.staff_project_access spa WHERE spa.user_id = auth.uid() AND spa.project_id = units.project_id));
DROP POLICY "Finance read reports" ON public.reports;
CREATE POLICY "Finance read reports" ON public.reports FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'finance'::public.staff_role));
DROP POLICY "Luxso read assigned reports" ON public.reports;
CREATE POLICY "Luxso read assigned reports" ON public.reports FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'luxso'::public.staff_role) AND EXISTS (SELECT 1 FROM public.units u JOIN public.staff_project_access spa ON spa.project_id = u.project_id WHERE u.id = reports.unit_id AND spa.user_id = auth.uid()));
DROP POLICY "Finance read ownerships" ON public.ownerships;
CREATE POLICY "Finance read ownerships" ON public.ownerships FOR SELECT TO authenticated USING (private.has_staff_role(auth.uid(), 'finance'::public.staff_role));
DROP POLICY "Finance read owner profiles" ON public.profiles;
DROP FUNCTION public.has_staff_role(uuid, public.staff_role);