-- =====================================================================
--  06 · ANÁLISIS DE CAPACIDAD DE PAGO (estado de cuenta + Buró de Crédito)
--
--  Qué agrega: el broker ya no arma la comparación de bancos solo con el
--  monto solicitado — el sistema PRE-LLENA ingreso, deudas existentes y
--  banda de riesgo crediticio a partir de los documentos que subió el
--  cliente (estado de cuenta y Buró de Crédito), extrayéndolos de forma
--  automática (heurísticas de texto, sin machine learning). El broker
--  SIEMPRE revisa y puede corregir esos valores antes de confirmarlos —
--  nada llega al cliente sin que el broker lo apruebe (ver `confirmado_por`
--  y el flujo de "compartida" que ya existía en simulaciones).
--
--  Ejecuta este script UNA vez, después de 01/02/03 (y de 04/05 si ya
--  los corriste).
-- =====================================================================

-- ---------- 1) Nuevo tipo de documento: Buró de Crédito ----------------
insert into public.tipos_documento (clave, nombre, descripcion, obligatorio, aplica_tipos, orden) values
 ('reporte_buro','Reporte de Buró de Crédito','Reporte de Crédito Especial, con menos de 30 días de antigüedad',true,null,65)
on conflict (clave) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, obligatorio = excluded.obligatorio,
  aplica_tipos = excluded.aplica_tipos, orden = excluded.orden;

-- ---------- 2) Tarifas: dimensión de banda de riesgo crediticio ---------
alter table public.bancos_tasas add column if not exists banda_riesgo text;
comment on column public.bancos_tasas.banda_riesgo is
  'Segmento de riesgo crediticio al que aplica esta tarifa (p. ej. "NR 1 y 2 +"). NULL o ''*'' = aplica a cualquier banda.';

-- Backfill: en HSBC, la banda ya viene codificada dentro de "perfil"
-- (ej. "No Premier · Nómina · NR 1 y 2 +"). Se extrae el último segmento.
update public.bancos_tasas t
   set banda_riesgo = trim(split_part(t.perfil, '·', 3))
  from public.bancos b
 where t.banco_id = b.id and b.clave = 'hsbc'
   and t.perfil like '%·%·%'
   and (t.banda_riesgo is null or t.banda_riesgo = '');

-- ---------- 3) Mapeo Buró → banda de riesgo (regla de negocio, no ML) --
-- Basado en el hallazgo del EDA (analisis/EDA_tasas_hipotecarias.ipynb):
-- dentro de HSBC, la banda de riesgo es el factor que más mueve la tasa
-- (ANOVA p<0.0001). Este mapeo es una heurística inicial de score de Buró
-- a esas mismas bandas; el broker puede corregirla manualmente por cliente.
create or replace function public.mapear_score_a_banda(p_score int)
returns text
language sql
immutable
as $$
  select case
    when p_score is null then null
    when p_score >= 750 then 'NR 1 y 2 +'
    when p_score >= 700 then 'NR 3 +'
    when p_score >= 650 then 'NR 1 y 2'
    else 'NR 3'
  end;
$$;
comment on function public.mapear_score_a_banda is
  'Heurística de negocio (no un modelo estadístico) para sugerir una banda de riesgo a partir del score de Buró. Punto de partida editable por el broker, no una decisión automática final.';

grant execute on function public.mapear_score_a_banda to authenticated;

-- ---------- 4) Tabla: análisis de capacidad de pago por expediente -----
-- Una fila por expediente (se reemplaza, no se acumula historial aquí;
-- el historial de cambios de estatus y auditoría ya cubren trazabilidad
-- de alto nivel). Visible SOLO para personal (broker/admin) — el cliente
-- nunca ve esta tabla directamente, solo las simulaciones que el broker
-- decida compartir.
create table if not exists public.analisis_financiero (
  id                      uuid primary key default gen_random_uuid(),
  expediente_id           uuid not null unique references public.expedientes(id) on delete cascade,

  -- lo que el sistema extrajo automáticamente de los PDF (sin revisar)
  extraido                jsonb not null default '{}'::jsonb,

  -- lo que el broker confirmó (esto es lo único que usa el comparador)
  ingreso_mensual         numeric,
  deuda_mensual           numeric,               -- suma de pagos de créditos activos vigentes
  score_buro              int,
  banda_riesgo            text,
  num_creditos_activos    int,
  monto_creditos_activos  numeric,
  tiene_atrasos           boolean,

  fuente_estado_cuenta_id uuid references public.documentos(id) on delete set null,
  fuente_buro_id          uuid references public.documentos(id) on delete set null,

  confirmado_por          uuid references public.profiles(id),
  confirmado_en           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.analisis_financiero enable row level security;

drop policy if exists analisis_fin_select on public.analisis_financiero;
create policy analisis_fin_select on public.analisis_financiero for select to authenticated
  using (public.es_staff_de_expediente(expediente_id));

drop policy if exists analisis_fin_insert on public.analisis_financiero;
create policy analisis_fin_insert on public.analisis_financiero for insert to authenticated
  with check (public.es_staff_de_expediente(expediente_id));

drop policy if exists analisis_fin_update on public.analisis_financiero;
create policy analisis_fin_update on public.analisis_financiero for update to authenticated
  using (public.es_staff_de_expediente(expediente_id))
  with check (public.es_staff_de_expediente(expediente_id));
-- (sin política DELETE: para "empezar de nuevo" se sobrescribe con guardar_analisis_financiero)

create index if not exists analisis_fin_exp_idx on public.analisis_financiero (expediente_id);

revoke all on public.analisis_financiero from anon, authenticated;
grant select, insert, update on public.analisis_financiero to authenticated;

-- ---------- 5) RPC: guardar/confirmar el análisis (valida rol y registra quién confirmó) --
create or replace function public.guardar_analisis_financiero(
  p_expediente uuid,
  p_extraido jsonb,
  p_ingreso_mensual numeric,
  p_deuda_mensual numeric,
  p_score_buro int,
  p_banda_riesgo text,
  p_num_creditos_activos int,
  p_monto_creditos_activos numeric,
  p_tiene_atrasos boolean,
  p_fuente_estado_cuenta uuid,
  p_fuente_buro uuid
)
returns public.analisis_financiero
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.analisis_financiero;
begin
  if not public.es_staff_de_expediente(p_expediente) then
    raise exception 'No autorizado para confirmar el análisis de este expediente' using errcode = '42501';
  end if;

  insert into public.analisis_financiero (
    expediente_id, extraido, ingreso_mensual, deuda_mensual, score_buro, banda_riesgo,
    num_creditos_activos, monto_creditos_activos, tiene_atrasos,
    fuente_estado_cuenta_id, fuente_buro_id, confirmado_por, confirmado_en, updated_at
  ) values (
    p_expediente, coalesce(p_extraido, '{}'::jsonb), p_ingreso_mensual, p_deuda_mensual, p_score_buro, p_banda_riesgo,
    p_num_creditos_activos, p_monto_creditos_activos, p_tiene_atrasos,
    p_fuente_estado_cuenta, p_fuente_buro, (select auth.uid()), now(), now()
  )
  on conflict (expediente_id) do update set
    extraido = excluded.extraido,
    ingreso_mensual = excluded.ingreso_mensual,
    deuda_mensual = excluded.deuda_mensual,
    score_buro = excluded.score_buro,
    banda_riesgo = excluded.banda_riesgo,
    num_creditos_activos = excluded.num_creditos_activos,
    monto_creditos_activos = excluded.monto_creditos_activos,
    tiene_atrasos = excluded.tiene_atrasos,
    fuente_estado_cuenta_id = excluded.fuente_estado_cuenta_id,
    fuente_buro_id = excluded.fuente_buro_id,
    confirmado_por = excluded.confirmado_por,
    confirmado_en = excluded.confirmado_en,
    updated_at = now()
  returning * into v_fila;

  perform public.log_evento(p_expediente, 'analisis_financiero_confirmado',
    format('Ingreso: %s · Banda: %s · Score: %s', p_ingreso_mensual, p_banda_riesgo, p_score_buro));

  return v_fila;
end;
$$;

grant execute on function public.guardar_analisis_financiero to authenticated;
