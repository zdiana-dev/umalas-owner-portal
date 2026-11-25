-- ============ clean out old model ============
DELETE FROM public.payouts;
DELETE FROM public.documents;
DROP TABLE IF EXISTS public.monthly_reports;
DELETE FROM public.ownerships;
DELETE FROM public.units;

-- ============ units revision ============
ALTER TABLE public.units
  DROP COLUMN IF EXISTS bedrooms,
  DROP COLUMN IF EXISTS area_sqm,
  DROP COLUMN IF EXISTS purchase_price_usd,
  ADD COLUMN IF NOT EXISTS floor integer,
  ADD COLUMN IF NOT EXISTS coefficient_default numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS purchase_currency text NOT NULL DEFAULT 'USD';

-- ============ document categories ============
ALTER TYPE public.doc_category RENAME TO doc_category_old;
CREATE TYPE public.doc_category AS ENUM ('mou','lease_agreement','addendum','bast','booking_form','management_agreement','other');
ALTER TABLE public.documents ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.documents ALTER COLUMN category TYPE public.doc_category USING 'other'::public.doc_category;
ALTER TABLE public.documents ALTER COLUMN category SET DEFAULT 'other'::public.doc_category;
ALTER TABLE public.documents ALTER COLUMN is_published SET DEFAULT false;
DROP TYPE public.doc_category_old;

-- ============ report_periods ============
CREATE TABLE public.report_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL DEFAULT 'quarter',
  nights_in_pool numeric NOT NULL DEFAULT 0,
  nights_owner_stay numeric NOT NULL DEFAULT 0,
  nights_available numeric NOT NULL DEFAULT 0,
  nights_sold numeric NOT NULL DEFAULT 0,
  occupancy_percent numeric NOT NULL DEFAULT 0,
  average_room_rate numeric NOT NULL DEFAULT 0,
  total_room_revenue numeric NOT NULL DEFAULT 0,
  management_fee_percent numeric NOT NULL DEFAULT 15,
  management_fee_amount numeric NOT NULL DEFAULT 0,
  owner_pool_revenue numeric NOT NULL DEFAULT 0,
  opex_room numeric NOT NULL DEFAULT 0,
  opex_admin_general numeric NOT NULL DEFAULT 0,
  opex_sales_marketing numeric NOT NULL DEFAULT 0,
  opex_human_resource numeric NOT NULL DEFAULT 0,
  opex_pomec numeric NOT NULL DEFAULT 0,
  opex_other numeric NOT NULL DEFAULT 0,
  opex_total numeric NOT NULL DEFAULT 0,
  pool_profit numeric NOT NULL DEFAULT 0,
  total_coefficients numeric NOT NULL DEFAULT 0,
  profit_per_coefficient numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  pdf_path text,
  status public.report_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_start, period_end)
);

GRANT SELECT ON public.report_periods TO authenticated;
GRANT ALL ON public.report_periods TO service_role;
ALTER TABLE public.report_periods ENABLE ROW LEVEL SECURITY;

-- ============ unit_period_shares ============
CREATE TABLE public.unit_period_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.report_periods(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  coefficient numeric NOT NULL DEFAULT 0,
  share_profit numeric NOT NULL DEFAULT 0,
  service_charge numeric NOT NULL DEFAULT 0,
  owner_stay_nights numeric NOT NULL DEFAULT 0,
  net_payout numeric NOT NULL DEFAULT 0,
  note text,
  status public.report_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, unit_id)
);

GRANT SELECT ON public.unit_period_shares TO authenticated;
GRANT ALL ON public.unit_period_shares TO service_role;
ALTER TABLE public.unit_period_shares ENABLE ROW LEVEL SECURITY;

-- owners: published period + active ownership of a unit inside that period
CREATE POLICY periods_select_owned ON public.report_periods
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      status = 'published'::public.report_status
      AND EXISTS (
        SELECT 1 FROM public.unit_period_shares s
        WHERE s.period_id = report_periods.id
          AND public.has_unit_access(auth.uid(), s.unit_id)
      )
    )
  );

CREATE POLICY shares_select_owned ON public.unit_period_shares
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      status = 'published'::public.report_status
      AND public.has_unit_access(auth.uid(), unit_id)
    )
  );

-- ============ admin write access ============
CREATE POLICY periods_admin_all ON public.report_periods FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY shares_admin_all ON public.unit_period_shares FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY units_admin_all ON public.units FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ownerships_admin_all ON public.ownerships FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY documents_admin_all ON public.documents FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY payouts_admin_all ON public.payouts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY audit_insert_admin ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.report_periods TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.unit_period_shares TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ownerships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payouts TO authenticated;
GRANT INSERT ON public.audit_log TO authenticated;

-- ============ seed units ============
INSERT INTO public.units (code, building, floor, unit_type, coefficient_default, purchase_price, purchase_currency, purchase_date, handover_date, status) VALUES
  ('AG01','A',1,'2 BR',1.75,395000,'USD','2023-02-14','2024-06-28','active'),
  ('AG10A','A',1,'1 BR',1.00,185000,'USD','2023-03-06','2024-06-28','active'),
  ('A102','A',2,'1 BR',1.03,192000,'USD','2023-01-20','2024-06-28','active'),
  ('A110B','A',2,'1 BR',1.03,189000,'USD','2023-04-11','2024-06-28','active'),
  ('A210','A',3,'2 BR',1.91,432000,'USD','2022-11-30','2024-06-28','active'),
  ('A307','A',4,'1 BR',1.19,224000,'USD','2023-05-19','2024-06-28','active'),
  ('BG15','B',1,'1 BR',1.00,182000,'USD','2023-02-27','2024-09-30','active'),
  ('B202A','B',3,'1 BR',1.11,205000,'USD','2023-06-15','2024-09-30','active'),
  ('CG05A','C',1,'1 BR',1.00,181000,'USD','2023-07-04','2024-09-30','active'),
  ('C106B','C',2,'1 BR',1.03,193000,'USD','2023-08-21','2024-09-30','active'),
  ('C205A','C',3,'1 BR',1.11,207000,'USD','2023-03-29','2024-09-30','active'),
  ('C207','C',3,'2 BR',1.91,438000,'USD','2023-04-25','2024-09-30','active'),
  ('DG07B','D',1,'1 BR',1.00,179000,'USD','2023-09-12','2024-12-20','active'),
  ('D205B','D',3,'1 BR',1.11,209000,'USD','2023-10-02','2024-12-20','active'),
  ('D305B','D',4,'1 BR',1.19,228000,'USD','2023-10-30','2024-12-20','active'),
  ('E203','E',3,'2 BR',1.91,445000,'USD','2023-11-14','2025-03-31','active'),
  ('EG03','E',1,'2 BR',1.75,398000,'USD','2023-12-05','2025-03-31','active');

-- ============ seed ownerships ============
-- Anna: AG01, A102, A110B (A110B was on owner stay all period)
INSERT INTO public.ownerships (owner_id, unit_id, share_percent, start_date)
SELECT '30612a34-0f47-433f-a876-0db7dcbb53d1', u.id, 100, '2024-07-01'
FROM public.units u WHERE u.code IN ('AG01','A102','A110B');

-- Dmitry: A307 and C207 (one owner, two units) + co-owns A210 with Maria
INSERT INTO public.ownerships (owner_id, unit_id, share_percent, start_date)
SELECT '38b86693-3fbc-4668-8373-6ae407e8b5da', u.id, 100, '2024-07-01'
FROM public.units u WHERE u.code IN ('A307','C207');
INSERT INTO public.ownerships (owner_id, unit_id, share_percent, start_date)
SELECT '38b86693-3fbc-4668-8373-6ae407e8b5da', u.id, 50, '2024-07-01'
FROM public.units u WHERE u.code = 'A210';

-- Maria: co-owner of A210 + E203
INSERT INTO public.ownerships (owner_id, unit_id, share_percent, start_date)
SELECT '7d22c7ce-d6b2-403f-8af9-2645947a5d67', u.id, 50, '2024-07-01'
FROM public.units u WHERE u.code = 'A210';
INSERT INTO public.ownerships (owner_id, unit_id, share_percent, start_date)
SELECT '7d22c7ce-d6b2-403f-8af9-2645947a5d67', u.id, 100, '2024-07-01'
FROM public.units u WHERE u.code = 'E203';

-- ============ seed the real Apr-Jun 2026 pool statement ============
INSERT INTO public.report_periods (
  label, period_start, period_end, period_type,
  nights_in_pool, nights_owner_stay, nights_available, nights_sold, occupancy_percent, average_room_rate,
  total_room_revenue, management_fee_percent, management_fee_amount, owner_pool_revenue,
  opex_room, opex_admin_general, opex_sales_marketing, opex_human_resource, opex_pomec, opex_other, opex_total,
  pool_profit, total_coefficients, profit_per_coefficient, currency, status, published_at
) VALUES (
  'APRIL - JUNE 2026', '2026-04-01', '2026-06-30', 'quarter',
  11430, 270, 11160, 4173, 37.39, 567053,
  2366310415, 15, 354946562, 2011363852,
  330964417, 347018739, 0, 5250000, 57347924, -6798706, 733782375,
  1277581478, 149.09, 8569196, 'IDR', 'published', now()
);

-- ============ seed per-unit shares ============
INSERT INTO public.unit_period_shares (period_id, unit_id, coefficient, share_profit, service_charge, owner_stay_nights, net_payout, note, status)
SELECT p.id, u.id,
       CASE WHEN u.code = 'A110B' THEN 0 ELSE u.coefficient_default END,
       CASE WHEN u.code = 'A110B' THEN 0 ELSE round(u.coefficient_default * p.profit_per_coefficient) END,
       CASE WHEN u.code = 'A110B' THEN 0 WHEN u.unit_type = '2 BR' THEN 4200000 ELSE 2650000 END,
       CASE WHEN u.code = 'A110B' THEN 91 WHEN u.code IN ('C207','EG03') THEN 6 ELSE 0 END,
       CASE WHEN u.code = 'A110B' THEN 0
            ELSE round(u.coefficient_default * p.profit_per_coefficient)
                 - (CASE WHEN u.unit_type = '2 BR' THEN 4200000 ELSE 2650000 END) END,
       CASE WHEN u.code = 'A110B' THEN 'Unit on owner stay for the whole period — no rental pool share.' ELSE NULL END,
       'published'
FROM public.units u CROSS JOIN public.report_periods p
WHERE p.label = 'APRIL - JUNE 2026';

-- ============ seed payouts ============
INSERT INTO public.payouts (unit_id, owner_id, period, amount, currency, paid_at, method, reference)
SELECT s.unit_id, o.owner_id, p.period_start,
       round(s.net_payout * o.share_percent / 100), p.currency,
       (p.period_end + interval '21 days'), 'Bank transfer',
       'PO-' || to_char(p.period_start, 'YYYYMM') || '-' || u.code
FROM public.unit_period_shares s
JOIN public.report_periods p ON p.id = s.period_id
JOIN public.units u ON u.id = s.unit_id
JOIN public.ownerships o ON o.unit_id = s.unit_id
WHERE s.net_payout > 0;

-- ============ seed placeholder documents (unpublished by default, a few executed) ============
INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'lease_agreement'::public.doc_category, u.code || ' — Lease Agreement (SIGNED ORIGINAL)',
       'demo/' || u.code || '_lease_agreement_signed.pdf', u.purchase_date, true
FROM public.units u;
INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'mou'::public.doc_category, u.code || ' — Memorandum of Understanding (Esigned)',
       'demo/' || u.code || '_mou_esigned.pdf', u.purchase_date, true
FROM public.units u;
INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'bast'::public.doc_category, u.code || ' — BAST Handover Certificate',
       'demo/' || u.code || '_bast_signed.pdf', u.handover_date, true
FROM public.units u;
INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'management_agreement'::public.doc_category, u.code || ' — Rental Pool Management Agreement',
       'demo/' || u.code || '_management_agreement.pdf', u.handover_date, true
FROM public.units u;
INSERT INTO public.documents (unit_id, category, title, file_path, issued_date, is_published)
SELECT u.id, 'addendum'::public.doc_category, u.code || ' — Addendum No.1 (DRAFT — not executed)',
       'demo/' || u.code || '_addendum_draft.pdf', u.handover_date, false
FROM public.units u WHERE u.code IN ('A210','C207');