-- =====================================================================
--  05 · BÚSQUEDA Y PAGINACIÓN DE EXPEDIENTES A ESCALA
--
--  Por qué existe este script: con miles de expedientes y varios
--  brokers trabajando a la vez, la pantalla de "Expedientes" ya no
--  puede traer TODOS los registros al navegador y filtrar ahí (eso
--  es lo que hacía la versión anterior, con un límite fijo de 1000).
--  Esta función hace el filtro, la búsqueda y la paginación DENTRO
--  de Postgres, y solo arma los datos de cliente/broker/documentos
--  para las filas de la página que se va a mostrar — no para todo
--  el conjunto que cumple el filtro. Esto importa: unir esos datos
--  para miles de filas en cada consulta sería tan lento como traerlas
--  todas al navegador; aquí ese trabajo caro solo se hace 50 veces
--  (el tamaño de página), sin importar si el filtro tiene 100 o
--  20,000 expedientes.
--
--  Seguridad: son funciones normales (NO "security definer"), así que
--  corren con los permisos de quien las llama y las políticas RLS de
--  "expedientes" y "profiles" — las mismas 94 veces probadas en
--  02_seguridad.sql — se aplican automáticamente. Un broker solo
--  puede buscar/contar entre SUS expedientes asignados, un cliente
--  normal no obtiene nada útil, y el admin ve todo. No hay lógica de
--  permisos duplicada aquí.
--
--  Ejecuta este script UNA vez en el SQL Editor de Supabase, después
--  de 01/02/03 (y después de 04 si ya creaste tu admin).
-- =====================================================================

create or replace function public.buscar_expedientes(
  p_q         text default null,             -- folio, nombre o correo del cliente
  p_estatus   public.estatus_expediente default null,
  p_broker    uuid default null,             -- filtrar por broker específico
  p_sin_broker boolean default false,        -- filtrar solo "sin asignar"
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
  total_filas             bigint   -- total de filas que cumplen el filtro (igual en todas las filas de la página)
)
language sql
stable
as $$
  with filtrados as (
    -- Paso 1 (barato): qué expedientes cumplen el filtro. Solo toca
    -- "profiles" cuando hay texto de búsqueda, y solo vía EXISTS
    -- (no arrastra columnas de cliente para cada fila).
    select e.id, e.created_at
    from public.expedientes e
    where
      (p_estatus is null or e.estatus = p_estatus)
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
    select count(*) as n from filtrados   -- una sola vez; Postgres reutiliza "filtrados" al estar referenciada 2 veces
  ),
  pagina as (
    select id from filtrados
    order by created_at desc
    limit greatest(p_limite, 1) offset greatest(p_offset, 0)
  )
  -- Paso 2 (el único caro, pero solo para la página): datos completos
  -- de cliente, broker y documentos pendientes de estas <= p_limite filas.
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
  'Búsqueda paginada de expedientes con datos del cliente/broker y conteo de documentos pendientes. Respeta RLS: cada quien solo ve lo suyo. El filtro es barato (solo toca expedientes, y profiles solo por EXISTS al buscar texto); el join completo solo corre para la página devuelta.';

grant execute on function public.buscar_expedientes to authenticated;

-- ---------------------------------------------------------------------
--  Conteo por estatus para las tarjetas KPI del panel — también sin
--  cargar los expedientes completos, y también respetando RLS.
-- ---------------------------------------------------------------------
create or replace function public.contar_expedientes_por_estatus()
returns table (estatus public.estatus_expediente, total bigint)
language sql
stable
as $$
  select estatus, count(*) from public.expedientes group by estatus;
$$;

comment on function public.contar_expedientes_por_estatus is
  'Conteo de expedientes por estatus, respetando RLS (un broker cuenta solo los suyos).';

grant execute on function public.contar_expedientes_por_estatus to authenticated;
