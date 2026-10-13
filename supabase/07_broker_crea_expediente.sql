-- =====================================================================
--  07 · El broker puede crear expedientes para sus clientes
--
--  Antes: solo el cliente (para sí mismo) o el admin podían insertar en
--  "expedientes"; el broker no podía dar de alta un trámite nuevo.
--
--  Ahora el broker también puede, siempre que:
--    - se asigne a sí mismo como broker_id (no puede crear "a nombre de"
--      otro broker), y
--    - el cliente_id corresponda a un cliente activo que de verdad existe.
--
--  Para elegir al cliente sin exponer la tabla completa de "profiles"
--  (un broker normalmente solo ve, vía profiles_select, a los clientes
--  que YA tiene en un expediente suyo — y antes de crear el primero, ese
--  cliente todavía no aparece ahí), se agrega una función de búsqueda
--  acotada: solo nombre/correo, solo clientes activos, mínimo 3
--  caracteres y máximo 15 resultados.
--
--  Ejecuta este script UNA vez en el SQL Editor de Supabase, después de
--  haber corrido 01-06.
-- =====================================================================

-- El navegador ahora también puede mandar broker_id al crear un expediente
-- (antes no podía); la política de abajo exige que sea el propio broker,
-- o nulo si lo crea el cliente o el admin.
grant insert (broker_id) on public.expedientes to authenticated;

drop policy if exists exp_insert on public.expedientes;
create policy exp_insert on public.expedientes for insert to authenticated with check (
  (select public.usuario_activo()) and (
       (select public.es_admin())
    or (cliente_id = (select auth.uid()) and (select public.rol_actual()) = 'cliente' and broker_id is null)
    or (
         (select public.rol_actual()) = 'broker'
         and broker_id = (select auth.uid())
         and exists (select 1 from public.profiles c where c.id = cliente_id and c.rol = 'cliente' and c.activo)
       )
  )
);

-- Búsqueda acotada de clientes para elegir al crear un expediente nuevo.
-- SECURITY DEFINER porque, antes de existir un expediente con ese cliente,
-- el broker no puede verlo vía profiles_select; esta función es el único
-- "agujero" controlado: solo personal (es_staff), solo 3 campos, mínimo
-- 3 caracteres y máximo 15 filas — no sirve para listar a todos los
-- clientes de golpe.
create or replace function public.buscar_clientes_para_expediente(p_q text)
returns table (id uuid, nombre_completo text, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre_completo, p.email
  from public.profiles p
  where public.es_staff()
    and p.rol = 'cliente' and p.activo
    and length(btrim(coalesce(p_q, ''))) >= 3
    and (p.nombre_completo ilike '%' || btrim(p_q) || '%' or p.email ilike '%' || btrim(p_q) || '%')
  order by p.nombre_completo
  limit 15;
$$;

comment on function public.buscar_clientes_para_expediente is
  'Búsqueda acotada de clientes activos por nombre o correo, para que un broker/admin elija a quién crear un expediente nuevo. Requiere 3+ caracteres, máximo 15 resultados, solo personal (es_staff()).';

grant execute on function public.buscar_clientes_para_expediente(text) to authenticated;