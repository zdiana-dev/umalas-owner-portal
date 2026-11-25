CREATE OR REPLACE FUNCTION public.complete_payment_plan_item(_item_id uuid, _paid_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_plan_id uuid;
  v_paid_at timestamptz := now();
BEGIN
  SELECT i.report_id, i.plan_id INTO v_report_id, v_plan_id
  FROM public.payment_plan_items i
  JOIN public.payment_plans p ON p.id = i.plan_id
  JOIN public.reports r ON r.id = i.report_id
  WHERE i.id = _item_id
    AND i.paid_at IS NULL
    AND p.status = 'published'
    AND r.is_published = true
    AND r.report_type = 'roi'
    AND r.is_paid = false
  FOR UPDATE OF i, r;

  IF v_report_id IS NULL THEN
    RAISE EXCEPTION 'Queued payout is unavailable or already paid';
  END IF;

  UPDATE public.reports
  SET is_paid = true, paid_at = v_paid_at
  WHERE id = v_report_id AND is_paid = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROI report is unavailable or already paid';
  END IF;

  UPDATE public.payment_plan_items
  SET paid_by = _paid_by, paid_at = v_paid_at
  WHERE id = _item_id AND paid_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queued payout was already completed';
  END IF;

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