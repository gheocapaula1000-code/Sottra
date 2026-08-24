-- Restrict EXECUTE on SECURITY DEFINER functions to the roles that actually need them.

-- Trigger-only function: never called through the API.
REVOKE ALL ON FUNCTION public.handle_new_user_trial() FROM anon, authenticated, public;

-- Scan accounting: only the record-scan edge function (service_role) may call it.
REVOKE ALL ON FUNCTION public.record_scan(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_scan(uuid, text) TO service_role;

-- RLS helpers: needed by signed-in users for policy evaluation, not by anonymous visitors.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, service_role;