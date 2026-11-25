CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount numeric,
  currency text,
  period_label text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX notifications_owner_idx ON public.notifications (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_owners_of_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  IF NEW.report_type <> 'roi' OR NOT NEW.is_published THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_kind := 'payout_new';
  ELSIF COALESCE(OLD.is_paid, false) = false AND COALESCE(NEW.is_paid, false) = true THEN
    v_kind := 'payout_paid';
  ELSIF COALESCE(OLD.is_published, false) = false THEN
    v_kind := 'payout_new';
  ELSIF COALESCE(OLD.net_payout, -1) <> COALESCE(NEW.net_payout, -1) THEN
    v_kind := 'payout_new';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (owner_id, unit_id, report_id, kind, amount, currency, period_label)
  SELECT o.owner_id, NEW.unit_id, NEW.id, v_kind, NEW.net_payout, NEW.currency, NEW.period_label
  FROM public.ownerships o
  WHERE o.unit_id = NEW.unit_id
    AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE);

  RETURN NEW;
END;
$$;

CREATE TRIGGER reports_notify_owners
AFTER INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_owners_of_payout();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;