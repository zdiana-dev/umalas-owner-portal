UPDATE public.reports r
SET is_published = true
FROM public.units u
WHERE u.id = r.unit_id
  AND r.is_published = false
  AND u.code IN ('A105','A208','B208','CG06A');