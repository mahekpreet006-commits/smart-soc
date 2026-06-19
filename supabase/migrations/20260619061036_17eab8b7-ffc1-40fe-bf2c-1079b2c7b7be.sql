
DROP POLICY IF EXISTS "public insert endpoints" ON public.endpoints;
DROP POLICY IF EXISTS "public update endpoints" ON public.endpoints;
DROP POLICY IF EXISTS "public insert events" ON public.endpoint_events;
REVOKE INSERT, UPDATE ON public.endpoints FROM anon;
REVOKE INSERT ON public.endpoint_events FROM anon;
