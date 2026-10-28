-- =====================================================================
--  14 · Permisos para que la Edge Function "extraer-pdf" pueda leer el
--  documento y verificar que quien pide la extracción sí tiene acceso
--  a ese expediente.
--
--  Igual que 09, 12 y 13: el rol "service_role" necesita permisos de
--  tabla explícitos aunque no esté sujeto a RLS.
--
--  Ejecuta este script UNA vez en el SQL Editor de Supabase.
-- =====================================================================

grant select on public.documentos to service_role;
grant select on public.expedientes to service_role; -- ya estaba (13), se repite por si acaso
grant select on public.profiles to service_role;     -- ya estaba (09), se repite por si acaso