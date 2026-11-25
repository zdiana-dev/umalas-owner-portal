CREATE POLICY "Finance read units" ON public.units FOR SELECT TO authenticated USING (public.has_staff_role(auth.uid(), 'finance'::public.staff_role));
CREATE POLICY "Luxso read assigned units" ON public.units FOR SELECT TO authenticated USING (
  public.has_staff_role(auth.uid(), 'luxso'::public.staff_role)
  AND EXISTS (
    SELECT 1 FROM public.staff_project_access spa
    WHERE spa.user_id = auth.uid() AND spa.project_id = units.project_id
  )
);

CREATE POLICY "Finance read reports" ON public.reports FOR SELECT TO authenticated USING (public.has_staff_role(auth.uid(), 'finance'::public.staff_role));
CREATE POLICY "Luxso read assigned reports" ON public.reports FOR SELECT TO authenticated USING (
  public.has_staff_role(auth.uid(), 'luxso'::public.staff_role)
  AND EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.staff_project_access spa ON spa.project_id = u.project_id
    WHERE u.id = reports.unit_id AND spa.user_id = auth.uid()
  )
);

CREATE POLICY "Finance read ownerships" ON public.ownerships FOR SELECT TO authenticated USING (public.has_staff_role(auth.uid(), 'finance'::public.staff_role));

CREATE OR REPLACE FUNCTION public.complete_payment_plan_item(_item_id uuid, _paid_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_plan_id uuid;
BEGIN
  SELECT i.report_id, i.plan_id INTO v_report_id, v_plan_id
  FROM public.payment_plan_items i
  JOIN public.payment_plans p ON p.id = i.plan_id
  WHERE i.id = _item_id AND p.status = 'published'
  FOR UPDATE;

  IF v_report_id IS NULL THEN
    RAISE EXCEPTION 'Queued payout not found';
  END IF;

  UPDATE public.reports
  SET is_paid = true, paid_at = now()
  WHERE id = v_report_id AND is_published = true AND report_type = 'roi';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROI report is unavailable';
  END IF;

  UPDATE public.payment_plan_items
  SET paid_by = _paid_by, paid_at = now()
  WHERE id = _item_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_plan_items
    WHERE plan_id = v_plan_id AND paid_at IS NULL
  ) THEN
    UPDATE public.payment_plans SET status = 'completed' WHERE id = v_plan_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_payment_plan_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_plan_item(uuid, uuid) TO service_role;