ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS coefficient numeric,
  ADD COLUMN IF NOT EXISTS ma_number text,
  ADD COLUMN IF NOT EXISTS ma_start date,
  ADD COLUMN IF NOT EXISTS ma_end date;

CREATE UNIQUE INDEX IF NOT EXISTS units_code_key ON public.units (code);
CREATE UNIQUE INDEX IF NOT EXISTS ownerships_owner_unit_open_key
  ON public.ownerships (owner_id, unit_id)
  WHERE end_date IS NULL;