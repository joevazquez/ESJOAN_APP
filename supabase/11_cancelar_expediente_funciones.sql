-- =====================================================================
--  11 · Cancelar / archivar un expediente — funciones y permisos
--
--  Corre ESTE script DESPUÉS de 10_cancelar_expediente.sql (ese agrega
--  el valor 'cancelado' al enum; debe quedar confirmado antes de usarlo
--  aquí, por eso van en scripts separados).
-- =====================================================================

-- 2) La función que hace el cambio. Mismo patrón que cambiar_estatus_admin:
-- el trigger expedientes_historial_upd ya registra el cambio de estatus en
-- el historial automáticamente (usa app.evento_detalle para el motivo).
create or replace function public.cancelar_expediente(p_expediente uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_est public.estatus_expediente; v_broker uuid;
begin
  select estatus, broker_id into v_est, v_broker from public.expedientes where id = p_expediente for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if not (public.es_admin() or (public.es_broker() and v_broker = (select auth.uid()))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_est = 'cancelado' then raise exception 'Ese expediente ya está cancelado'; end if;
  if v_est = 'firmado' then raise exception 'No se puede cancelar un expediente ya firmado'; end if;
  perform set_config('app.evento_detalle',
    'Expediente cancelado' || case when coalesce(btrim(p_motivo), '') <> '' then ': ' || left(btrim(p_motivo), 300) else '' end,
    true);
  update public.expedientes set estatus = 'cancelado' where id = p_expediente;
  perform set_config('app.evento_detalle', '', true);
end $$;

comment on function public.cancelar_expediente is
  'Cancela/archiva un expediente (estatus "cancelado"): no borra nada, solo lo oculta de la lista normal. Admin: cualquier expediente salvo ya cancelado o firmado. Broker: solo los suyos (broker_id = auth.uid()).';

grant execute on function public.cancelar_expediente(uuid, text) to authenticated;

-- 3) La lista de "Expedientes" de broker/admin deja de mostrar los
-- cancelados por defecto. Si alguien filtra explícitamente por el
-- estatus "Cancelado", sí los ve (así el admin puede revisarlos o
-- reactivarlos con la herramienta de "Corrección manual").
create or replace function public.buscar_expedientes(
  p_q         text default null,
  p_estatus   public.estatus_expediente default null,
  p_broker    uuid default null,
  p_sin_broker boolean default false,
  p_limite    int default 50,
  p_offset    int default 0
)
returns table (
  id                      uuid,
  folio                   int,
  cliente_id              uuid,
  broker_id               uuid,
  tipo                    text,
  estatus                 public.estatus_expediente,
  valor_inmueble          numeric,
  monto_solicitado        numeric,
  plazo_anios             int,
  estatus_actualizado_en  timestamptz,
  created_at              timestamptz,
  cliente_nombre          text,
  cliente_email           text,
  broker_nombre           text,
  broker_email            text,
  documentos_pendientes   bigint,
  total_filas             bigint
)
language sql
stable
as $$
  with filtrados as (
    select e.id, e.created_at
    from public.expedientes e
    where
      (p_estatus is null or e.estatus = p_estatus)
      and (p_estatus = 'cancelado' or e.estatus <> 'cancelado')  -- oculto por defecto, visible si se filtra a propósito
      and (p_broker is null or e.broker_id = p_broker)
      and (not p_sin_broker or e.broker_id is null)
      and (
        p_q is null or btrim(p_q) = '' or
        e.folio::text ilike '%' || btrim(p_q) || '%' or
        exists (
          select 1 from public.profiles c
          where c.id = e.cliente_id
            and (c.nombre_completo ilike '%' || btrim(p_q) || '%'
                 or c.email ilike '%' || btrim(p_q) || '%')
        )
      )
  ),
  total as (
    select count(*) as n from filtrados
  ),
  pagina as (
    select id from filtrados
    order by created_at desc
    limit greatest(p_limite, 1) offset greatest(p_offset, 0)
  )
  select
    e.id, e.folio, e.cliente_id, e.broker_id, e.tipo, e.estatus,
    e.valor_inmueble, e.monto_solicitado, e.plazo_anios,
    e.estatus_actualizado_en, e.created_at,
    c.nombre_completo, c.email,
    b.nombre_completo, b.email,
    coalesce(dp.n, 0),
    total.n
  from pagina p
  join public.expedientes e on e.id = p.id
  join public.profiles c on c.id = e.cliente_id
  left join public.profiles b on b.id = e.broker_id
  left join (
    select expediente_id, count(*) as n
    from public.documentos
    where estado = 'pendiente'
    group by expediente_id
  ) dp on dp.expediente_id = e.id
  cross join total
  order by e.created_at desc;
$$;

comment on function public.buscar_expedientes is
  'Búsqueda paginada de expedientes con datos del cliente/broker y conteo de documentos pendientes. Respeta RLS. Oculta los "cancelado" salvo que se filtre explícitamente por ese estatus.';

grant execute on function public.buscar_expedientes to authenticated;