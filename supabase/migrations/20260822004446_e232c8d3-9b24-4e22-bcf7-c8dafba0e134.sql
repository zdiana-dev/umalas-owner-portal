ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS is_investment_contract boolean NOT NULL DEFAULT false;