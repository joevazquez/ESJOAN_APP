-- =====================================================================
--  13 · Permisos para que la Edge Function "eliminar-usuario" pueda
--  reasignar expedientes y dejar registro en auditoría antes de borrar
--  la cuenta.
--
--  Igual que 09 y 12: el rol "service_role" (el que usa la Edge Function)
--  necesita permisos de tabla explícitos aunque no esté sujeto a RLS.
--
--  Ejecuta este script UNA vez en el SQL Editor de Supabase.
-- =====================================================================

grant select, update (broker_id) on public.expedientes to service_role;
grant insert on public.auditoria to service_role;
grant insert on public.expediente_historial to service_role;
grant select on public.profiles to service_role; -- ya estaba (09), se repite por si acaso