
CREATE TYPE public.app_role AS ENUM ('owner','admin');
CREATE TYPE public.doc_category AS ENUM ('contract','certificate','act','invoice','tax','other');
CREATE TYPE public.report_status AS ENUM ('draft','published');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  preferred_language text NOT NULL DEFAULT 'ru' CHECK (preferred_language IN ('ru','en')),
  role public.app_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  building text,
  unit_type text,
  bedrooms int,
  area_sqm numeric(10,2),
  purchase_price_usd numeric(14,2),
  purchase_date date,
  handover_date date,
  status text NOT NULL DEFAULT 'active',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ownerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  share_percent numeric(6,3) NOT NULL DEFAULT 100,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ownerships TO authenticated;
GRANT ALL ON public.ownerships TO service_role;
ALTER TABLE public.ownerships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_unit_access(_user_id uuid, _unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ownerships o
    WHERE o.owner_id = _user_id
      AND o.unit_id = _unit_id
      AND o.start_date <= current_date
      AND (o.end_date IS NULL OR o.end_date > current_date)
  )
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "units_select_owned" ON public.units FOR SELECT TO authenticated
  USING (public.has_unit_access(auth.uid(), id) OR public.is_admin(auth.uid()));

CREATE POLICY "ownerships_select_own" ON public.ownerships FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  category public.doc_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_path text NOT NULL,
  issued_date date,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_owned" ON public.documents FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (is_published AND (
      (unit_id IS NOT NULL AND public.has_unit_access(auth.uid(), unit_id))
      OR (owner_id IS NOT NULL AND owner_id = auth.uid())
    ))
  );

CREATE TABLE public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  period date NOT NULL,
  gross_revenue numeric(14,2) NOT NULL DEFAULT 0,
  occupancy_percent numeric(6,2) NOT NULL DEFAULT 0,
  adr numeric(14,2) NOT NULL DEFAULT 0,
  management_fee numeric(14,2) NOT NULL DEFAULT 0,
  operating_expenses numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_payout numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  pdf_path text,
  status public.report_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period)
);
GRANT SELECT ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_owned" ON public.monthly_reports FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (status = 'published' AND public.has_unit_access(auth.uid(), unit_id))
  );

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  period date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  paid_at timestamptz,
  method text,
  reference text,
  proof_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_select_owned" ON public.payouts FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (owner_id = auth.uid() AND public.has_unit_access(auth.uid(), unit_id))
  );

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "storage_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('documents','reports') AND public.is_admin(auth.uid()));

INSERT INTO public.units (code, building, unit_type, bedrooms, area_sqm, purchase_price_usd, purchase_date, handover_date, status) VALUES
  ('US-A-201','Umalas Signature A','Apartment',1,58.00,185000,'2023-02-14','2023-11-01','active'),
  ('US-A-305','Umalas Signature A','Apartment',2,86.50,268000,'2023-04-02','2023-12-15','active'),
  ('US-B-102','Umalas Signature B','Villa',2,142.00,395000,'2022-11-20','2023-08-10','active'),
  ('US-B-204','Umalas Signature B','Apartment',1,61.00,192000,'2023-06-08','2024-02-01','active'),
  ('US-C-011','Umalas Signature C','Villa',3,208.00,545000,'2022-09-05','2023-07-01','active'),
  ('US-C-107','Umalas Signature C','Apartment',2,79.00,245000,'2023-08-19','2024-03-20','active');

INSERT INTO public.monthly_reports (unit_id, period, gross_revenue, occupancy_percent, adr, management_fee, operating_expenses, other_deductions, net_payout, currency, status, published_at)
SELECT u.id,
       p::date,
       calc.g,
       calc.occ,
       round(calc.g / greatest(1, (calc.occ/100.0) * 30), 2),
       round(calc.g * 0.20, 2),
       round(calc.g * 0.11, 2),
       round(calc.g * 0.02, 2),
       round(calc.g * 0.67, 2),
       'USD',
       'published'::public.report_status,
       (p + interval '1 month' + interval '5 days')
FROM public.units u
CROSS JOIN generate_series(
  date_trunc('month', current_date) - interval '18 months',
  date_trunc('month', current_date) - interval '1 month',
  interval '1 month'
) AS p
CROSS JOIN LATERAL (
  SELECT
    round((u.purchase_price_usd * 0.0135 * (0.78 + 0.44 * abs(sin(extract(month from p)::numeric * 1.7 + u.area_sqm))))::numeric, 2) AS g,
    round((62 + 33 * abs(sin(extract(month from p)::numeric * 1.1 + coalesce(u.bedrooms,1))))::numeric, 2) AS occ
) calc;

INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'contract'::public.doc_category, 'Management Agreement ' || u.code, 'demo/' || u.code || '_contract.pdf', u.purchase_date, true FROM public.units u
UNION ALL
SELECT u.id, 'certificate'::public.doc_category, 'Ownership Certificate ' || u.code, 'demo/' || u.code || '_certificate.pdf', u.handover_date, true FROM public.units u
UNION ALL
SELECT u.id, 'act'::public.doc_category, 'Handover Act ' || u.code, 'demo/' || u.code || '_act.pdf', u.handover_date, true FROM public.units u
UNION ALL
SELECT u.id, 'tax'::public.doc_category, 'Annual Tax Statement ' || u.code, 'demo/' || u.code || '_tax_2025.pdf', date '2026-01-31', true FROM public.units u;
