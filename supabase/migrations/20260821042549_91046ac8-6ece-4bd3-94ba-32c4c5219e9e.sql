REVOKE ALL ON FUNCTION public.prevent_self_role_change() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.has_unit_access(uuid, uuid) FROM anon, authenticated, PUBLIC;