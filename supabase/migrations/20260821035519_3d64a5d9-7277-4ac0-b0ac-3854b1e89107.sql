DROP TABLE IF EXISTS public.unit_period_shares CASCADE;
DROP TABLE IF EXISTS public.report_periods CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;

ALTER TABLE public.units
  DROP COLUMN IF EXISTS coefficient_default,
  DROP COLUMN IF EXISTS handover_date,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS photo_url,
  DROP COLUMN IF EXISTS area_sqm,
  DROP COLUMN IF EXISTS bedrooms,
  DROP COLUMN IF EXISTS purchase_price_usd;

ALTER TABLE public.ownerships DROP COLUMN IF EXISTS share_percent;

DROP POLICY IF EXISTS documents_select_owned ON public.documents;
ALTER TABLE public.documents DROP COLUMN IF EXISTS owner_id;
ALTER TABLE public.documents ALTER COLUMN is_published SET DEFAULT false;

CREATE POLICY documents_select_owned ON public.documents
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (is_published AND unit_id IS NOT NULL AND public.has_unit_access(auth.uid(), unit_id)));

DROP TYPE IF EXISTS public.report_type CASCADE;
CREATE TYPE public.report_type AS ENUM ('roi', 'ipl', 'other');

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  report_type public.report_type NOT NULL DEFAULT 'roi',
  period_label text NOT NULL,
  period_start date,
  period_end date,
  file_path text NOT NULL,
  net_payout numeric,
  currency text NOT NULL DEFAULT 'IDR',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_owned ON public.reports;
CREATE POLICY reports_select_owned ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (is_published AND public.has_unit_access(auth.uid(), unit_id)));

CREATE INDEX IF NOT EXISTS reports_unit_idx ON public.reports (unit_id, period_start DESC);