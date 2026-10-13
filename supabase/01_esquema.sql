-- =====================================================================
--  ESJOAN · Expedientes hipotecarios
--  01 · ESQUEMA: tablas, funciones de rol, triggers y RPCs
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este
--  archivo → Run. Después ejecuta 02_seguridad.sql y 03_datos_iniciales.sql.
--  Es idempotente: puedes volver a correrlo sin romper nada.
-- =====================================================================

-- ---------- Tipos ----------------------------------------------------
do $$ begin
  create type public.rol_usuario as enum ('cliente', 'broker', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estatus_expediente as enum (
    'creado',
    'en_revision_documentacion',
    'documentacion_completa',
    'en_avaluo',
    'en_proceso_firma',
    'firmado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_documento as enum ('pendiente', 'aprobado', 'rechazado');
exception when duplicate_object then null; end $$;

-- ---------- Perfiles -------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  nombre_completo text,
  telefono        text,
  rol             public.rol_usuario not null default 'cliente',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Catálogo de documentos ----------------------------------
create table if not exists public.tipos_documento (
  clave        text primary key check (clave ~ '^[a-z0-9_]{2,60}$'),
  nombre       text not null,
  descripcion  text,
  obligatorio  boolean not null default true,
  aplica_tipos text[],            -- null = aplica a todos los tipos de expediente
  orden        int not null default 100,
  activo       boolean not null default true
);

-- ---------- Expedientes ----------------------------------------------
create table if not exists public.expedientes (
  id                   uuid primary key default gen_random_uuid(),
  folio                bigint generated always as identity,
  cliente_id           uuid not null references public.profiles (id) on delete restrict,
  broker_id            uuid references public.profiles (id) on delete set null,
  tipo                 text not null check (tipo in
                         ('adquisicion','cofinavit','apoyo_infonavit','sustitucion','liquidez','mejora','construccion')),
  estatus              public.estatus_expediente not null default 'creado',
  valor_inmueble       numeric(14,2) check (valor_inmueble is null or valor_inmueble >= 0),
  monto_solicitado     numeric(14,2) check (monto_solicitado is null or monto_solicitado >= 0),
  plazo_anios          int check (plazo_anios is null or plazo_anios between 1 and 30),
  ingreso_mensual      numeric(14,2) check (ingreso_mensual is null or ingreso_mensual >= 0),
  estado_inmueble      text,
  avaluo_valuador      text,
  avaluo_fecha         date,
  firma_fecha          timestamptz,
  firma_notaria        text,
  firma_confirmada_en  timestamptz,
  estatus_actualizado_en timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists expedientes_cliente_idx on public.expedientes (cliente_id);
create index if not exists expedientes_broker_idx  on public.expedientes (broker_id);
create index if not exists expedientes_estatus_idx on public.expedientes (estatus);

-- ---------- Documentos (PDF en Storage, metadatos aquí) ---------------
create table if not exists public.documentos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references public.expedientes (id) on delete cascade,
  tipo_clave     text not null references public.tipos_documento (clave),
  nombre_archivo text not null check (char_length(nombre_archivo) between 1 and 200),
  storage_path   text not null unique,
  tamano_bytes   bigint check (tamano_bytes is null or tamano_bytes <= 10485760),
  estado         public.estado_documento not null default 'pendiente',
  motivo_rechazo text,
  subido_por     uuid references public.profiles (id) on delete set null,
  revisado_por   uuid references public.profiles (id) on delete set null,
  revisado_en    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists documentos_exp_idx on public.documentos (expediente_id);

-- ---------- Historial y notas internas ---------------------------------
create table if not exists public.expediente_historial (
  id               bigint generated always as identity primary key,
  expediente_id    uuid not null references public.expedientes (id) on delete cascade,
  actor_id         uuid references public.profiles (id) on delete set null,
  evento           text not null,
  estatus_anterior public.estatus_expediente,
  estatus_nuevo    public.estatus_expediente,
  detalle          text,
  created_at       timestamptz not null default now()
);
create index if not exists historial_exp_idx on public.expediente_historial (expediente_id, created_at desc);

-- Notas internas: SOLO personal (admin / broker asignado). El cliente nunca las ve.
create table if not exists public.expediente_notas (
  id            bigint generated always as identity primary key,
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  autor_id      uuid references public.profiles (id) on delete set null,
  nota          text not null check (char_length(nota) between 1 and 4000),
  created_at    timestamptz not null default now()
);
create index if not exists notas_exp_idx on public.expediente_notas (expediente_id, created_at desc);

-- ---------- Bancos y tarifas (simuladores) -----------------------------
create table if not exists public.bancos (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique check (clave ~ '^[a-z0-9_]{2,30}$'),
  nombre      text not null,
  color       text default '#292E54',
  activo      boolean not null default true,
  parametros  jsonb not null default '{}'::jsonb,
  fuente      text,
  vigencia    date,
  verificado  boolean not null default false,
  notas       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

create table if not exists public.bancos_tasas (
  id                 uuid primary key default gen_random_uuid(),
  banco_id           uuid not null references public.bancos (id) on delete cascade,
  producto           text,
  destino            text not null default '*',
  programa           text not null default '*',
  esquema            text not null default 'fijo' check (esquema in ('fijo','creciente')),
  perfil             text,
  tasa               numeric(7,5) not null check (tasa > 0 and tasa < 1),
  plazo_min          int not null default 1  check (plazo_min between 1 and 40),
  plazo_max          int not null default 30 check (plazo_max between 1 and 40),
  aforo_min          numeric(5,4) not null default 0 check (aforo_min between 0 and 1),
  aforo_max          numeric(5,4) not null default 1 check (aforo_max between 0 and 1),
  monto_min          numeric(14,2),
  monto_max          numeric(14,2),
  comision_apertura  numeric(6,5) check (comision_apertura is null or comision_apertura between 0 and 0.2),
  pti                numeric(4,3) check (pti is null or pti between 0.05 and 1),
  incremento_anual   numeric(6,5) not null default 0 check (incremento_anual between 0 and 0.2),
  incremento_anios   int not null default 0 check (incremento_anios between 0 and 40),
  activo             boolean not null default true,
  notas              text,
  updated_at         timestamptz not null default now(),
  check (plazo_min <= plazo_max),
  check (aforo_min <= aforo_max)
);
create index if not exists bancos_tasas_banco_idx on public.bancos_tasas (banco_id);

-- ---------- Simulaciones guardadas en el expediente --------------------
create table if not exists public.simulaciones (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references public.expedientes (id) on delete cascade,
  creado_por     uuid references public.profiles (id) on delete set null,
  nombre         text not null check (char_length(nombre) between 1 and 120),
  banco_clave    text,
  banco_nombre   text,
  parametros     jsonb not null default '{}'::jsonb,
  resultado      jsonb not null default '{}'::jsonb,
  nota           text check (nota is null or char_length(nota) <= 2000),
  recomendada    boolean not null default false,
  compartida     boolean not null default false,   -- true = el cliente la puede ver
  created_at     timestamptz not null default now()
);
create index if not exists simulaciones_exp_idx on public.simulaciones (expediente_id, created_at desc);
create unique index if not exists simulaciones_una_recomendada
  on public.simulaciones (expediente_id) where recomendada;

-- ---------- Bitácora de auditoría (solo admin la lee) -----------------
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text,
  accion      text not null,
  actor_id    uuid,
  antes       jsonb,
  despues     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists auditoria_fecha_idx on public.auditoria (created_at desc);

-- =====================================================================
--  FUNCIONES DE ROL  (security definer + search_path vacío = seguras)
-- =====================================================================

-- Si el usuario activó verificación en 2 pasos, la sesión debe estar en aal2.
create or replace function public.aal_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
           select 1 from auth.mfa_factors f
           where f.user_id = (select auth.uid()) and f.status = 'verified'
         );
$$;

create or replace function public.usuario_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.activo)
     and public.aal_ok();
$$;

create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select p.rol from public.profiles p
  where p.id = (select auth.uid()) and p.activo and public.aal_ok();
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() = 'admin', false);
$$;

create or replace function public.es_broker()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() = 'broker', false);
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() in ('admin', 'broker'), false);
$$;

-- Admin, o broker asignado a ese expediente
create or replace function public.es_staff_de_expediente(p_exp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_admin()
      or exists (
           select 1 from public.expedientes e
           where e.id = p_exp and e.broker_id = (select auth.uid()) and public.es_broker()
         );
$$;

-- Staff de ese expediente, o el cliente dueño
create or replace function public.puede_ver_expediente(p_exp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_staff_de_expediente(p_exp)
      or (public.usuario_activo() and exists (
            select 1 from public.expedientes e where e.id = p_exp and e.cliente_id = (select auth.uid())
         ));
$$;

-- El cliente dueño puede modificar/subir mientras el expediente esté abierto
create or replace function public.cliente_puede_editar(p_exp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.usuario_activo() and exists (
    select 1 from public.expedientes e
    where e.id = p_exp and e.cliente_id = (select auth.uid())
      and e.estatus in ('creado', 'en_revision_documentacion')
  );
$$;


-- Extrae el id del expediente de una ruta de Storage "<uuid>/<archivo>.pdf" (null si es inválida)
create or replace function public.expediente_de_ruta(p_ruta text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_ruta, '/', 1)::uuid;
exception when others then
  return null;
end $$;

-- =====================================================================
--  UTILIDADES INTERNAS (no expuestas al API)
-- =====================================================================

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();
drop trigger if exists expedientes_updated on public.expedientes;
create trigger expedientes_updated before update on public.expedientes
  for each row execute function public.tg_set_updated_at();

create or replace function public.log_evento(
  p_exp uuid, p_evento text, p_detalle text default null,
  p_ant public.estatus_expediente default null, p_nuevo public.estatus_expediente default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.expediente_historial (expediente_id, actor_id, evento, estatus_anterior, estatus_nuevo, detalle)
  values (p_exp, auth.uid(), p_evento, p_ant, p_nuevo, p_detalle);
$$;

create or replace function public.log_auditoria(
  p_tabla text, p_registro text, p_accion text, p_antes jsonb, p_despues jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.auditoria (tabla, registro_id, accion, actor_id, antes, despues)
  values (p_tabla, p_registro, p_accion, auth.uid(), p_antes, p_despues);
$$;

-- Perfil automático al registrarse. El rol SIEMPRE nace como 'cliente'
-- (nunca se lee del metadata que envía el navegador).
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, nombre_completo, telefono, rol)
  values (
    new.id,
    coalesce(new.email, ''),
    left(nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), ''), 120),
    left(nullif(btrim(new.raw_user_meta_data ->> 'telefono'), ''), 30),
    'cliente'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

-- Si cambia el correo en auth, se refleja en el perfil
create or replace function public.tg_sync_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, email) where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.tg_sync_email();

-- ---------- Historial automático del expediente -------------------------
create or replace function public.tg_expediente_historial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.expediente_historial (expediente_id, actor_id, evento, estatus_nuevo)
  values (new.id, auth.uid(), 'creado', new.estatus);
  return null;
end $$;

drop trigger if exists expedientes_historial_ins on public.expedientes;
create trigger expedientes_historial_ins after insert on public.expedientes
  for each row execute function public.tg_expediente_historial();

-- (BEFORE UPDATE para poder sellar estatus_actualizado_en)
create or replace function public.tg_expediente_historial_upd()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_detalle text := nullif(current_setting('app.evento_detalle', true), '');
begin
  if new.estatus is distinct from old.estatus then
    new.estatus_actualizado_en := now();
    insert into public.expediente_historial (expediente_id, actor_id, evento, estatus_anterior, estatus_nuevo, detalle)
    values (new.id, auth.uid(), 'cambio_estatus', old.estatus, new.estatus, v_detalle);
  end if;
  return new;
end $$;

drop trigger if exists expedientes_historial_upd on public.expedientes;
create trigger expedientes_historial_upd before update on public.expedientes
  for each row execute function public.tg_expediente_historial_upd();

-- =====================================================================
--  ESTATUS AUTOMÁTICO POR DOCUMENTACIÓN
--    creado  → en_revision_documentacion : el cliente subió todos los obligatorios
--    en_revision → documentacion_completa : el broker aprobó todo
--    (si se rechaza o borra un documento, regresa al estatus que corresponda)
-- =====================================================================
create or replace function public.recalcular_estatus_docs(p_exp uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tipo   text;
  v_est    public.estatus_expediente;
  v_nuevo  public.estatus_expediente;
  v_total  int;
  v_falta  int;
  v_pend   int;
begin
  select tipo, estatus into v_tipo, v_est from public.expedientes where id = p_exp for update;
  if not found then return; end if;
  if v_est not in ('creado', 'en_revision_documentacion', 'documentacion_completa') then
    return;  -- de avalúo en adelante ya no se mueve solo
  end if;

  select count(*) into v_total from public.documentos where expediente_id = p_exp;

  select count(*) into v_falta
  from public.tipos_documento t
  where t.activo and t.obligatorio
    and (t.aplica_tipos is null or v_tipo = any (t.aplica_tipos))
    and not exists (
      select 1 from public.documentos d
      where d.expediente_id = p_exp and d.tipo_clave = t.clave and d.estado <> 'rechazado'
    );

  select count(*) into v_pend from public.documentos
  where expediente_id = p_exp and estado = 'pendiente';

  if v_total = 0 or v_falta > 0 then
    v_nuevo := 'creado';
  elsif v_pend > 0 then
    v_nuevo := 'en_revision_documentacion';
  else
    v_nuevo := 'documentacion_completa';
  end if;

  if v_nuevo <> v_est then
    perform set_config('app.evento_detalle',
      case v_nuevo
        when 'creado' then 'Falta documentación obligatoria o fue rechazada'
        when 'en_revision_documentacion' then 'Documentación completa enviada; pendiente de revisión'
        else 'Todos los documentos fueron aprobados'
      end, true);
    update public.expedientes set estatus = v_nuevo where id = p_exp;
    perform set_config('app.evento_detalle', '', true);
  end if;
end $$;

create or replace function public.tg_documentos_cambio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_exp uuid := coalesce(new.expediente_id, old.expediente_id);
begin
  if tg_op = 'INSERT' then
    perform public.log_evento(v_exp, 'documento_subido', new.nombre_archivo);
  elsif tg_op = 'DELETE' then
    perform public.log_evento(v_exp, 'documento_eliminado', old.nombre_archivo);
  end if;
  perform public.recalcular_estatus_docs(v_exp);
  return null;
end $$;

drop trigger if exists documentos_cambio on public.documentos;
create trigger documentos_cambio after insert or delete or update of estado on public.documentos
  for each row execute function public.tg_documentos_cambio();

-- Si cambia el tipo de expediente cambian los documentos requeridos
create or replace function public.tg_expediente_tipo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_estatus_docs(new.id);
  return null;
end $$;

drop trigger if exists expedientes_tipo on public.expedientes;
create trigger expedientes_tipo after update of tipo on public.expedientes
  for each row when (old.tipo is distinct from new.tipo)
  execute function public.tg_expediente_tipo();

-- ---------- Auditoría automática de catálogos ---------------------------
create or replace function public.tg_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (tabla, registro_id, accion, actor_id, antes, despues)
  values (
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(new) ->> 'clave'), (to_jsonb(old) ->> 'id'), (to_jsonb(old) ->> 'clave')),
    tg_op, auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

drop trigger if exists bancos_auditar on public.bancos;
create trigger bancos_auditar after insert or update or delete on public.bancos
  for each row execute function public.tg_auditar();
drop trigger if exists tipos_documento_auditar on public.tipos_documento;
create trigger tipos_documento_auditar after insert or update or delete on public.tipos_documento
  for each row execute function public.tg_auditar();

-- =====================================================================
--  RPCs (lo único que puede cambiar estatus, asignaciones y roles)
-- =====================================================================

create or replace function public.asignar_broker(p_expediente uuid, p_broker uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nombre text;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede asignar brokers' using errcode = '42501'; end if;
  if p_broker is not null then
    select coalesce(nombre_completo, email) into v_nombre
    from public.profiles where id = p_broker and rol = 'broker' and activo;
    if not found then raise exception 'El usuario elegido no es un broker activo'; end if;
  end if;
  update public.expedientes set broker_id = p_broker where id = p_expediente;
  if not found then raise exception 'Expediente no encontrado'; end if;
  perform public.log_evento(p_expediente,
    case when p_broker is null then 'broker_retirado' else 'broker_asignado' end, v_nombre);
end $$;

create or replace function public.revisar_documento(
  p_documento uuid, p_estado public.estado_documento, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_exp uuid; v_nombre text;
begin
  select expediente_id, nombre_archivo into v_exp, v_nombre from public.documentos where id = p_documento;
  if v_exp is null or not public.es_staff_de_expediente(v_exp) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_estado = 'rechazado' and coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Indica el motivo del rechazo';
  end if;
  update public.documentos
     set estado = p_estado,
         motivo_rechazo = case when p_estado = 'rechazado' then left(btrim(p_motivo), 500) end,
         revisado_por = auth.uid(),
         revisado_en = now()
   where id = p_documento;
  perform public.log_evento(v_exp,
    case p_estado when 'aprobado' then 'documento_aprobado' when 'rechazado' then 'documento_rechazado' else 'documento_pendiente' end,
    v_nombre || case when p_estado = 'rechazado' then ' — ' || left(btrim(p_motivo), 200) else '' end);
end $$;

create or replace function public.asignar_avaluo(p_expediente uuid, p_valuador text, p_fecha date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_est public.estatus_expediente;
begin
  if not public.es_staff_de_expediente(p_expediente) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if coalesce(btrim(p_valuador), '') = '' or p_fecha is null then raise exception 'Indica valuador y fecha del avalúo'; end if;
  select estatus into v_est from public.expedientes where id = p_expediente for update;
  if v_est not in ('documentacion_completa', 'en_avaluo') then
    raise exception 'El avalúo solo se asigna cuando la documentación está completa';
  end if;
  perform set_config('app.evento_detalle', 'Avalúo asignado: ' || btrim(p_valuador), true);
  update public.expedientes
     set avaluo_valuador = left(btrim(p_valuador), 160), avaluo_fecha = p_fecha, estatus = 'en_avaluo'
   where id = p_expediente;
  perform set_config('app.evento_detalle', '', true);
  perform public.log_evento(p_expediente, 'avaluo_asignado', btrim(p_valuador) || ' · ' || to_char(p_fecha, 'DD/MM/YYYY'));
end $$;

create or replace function public.asignar_firma(p_expediente uuid, p_fecha timestamptz, p_notaria text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_est public.estatus_expediente;
begin
  if not public.es_staff_de_expediente(p_expediente) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_fecha is null then raise exception 'Indica la fecha de firma'; end if;
  select estatus into v_est from public.expedientes where id = p_expediente for update;
  if v_est not in ('en_avaluo', 'en_proceso_firma') then
    raise exception 'La firma se asigna después de asignar el avalúo';
  end if;
  perform set_config('app.evento_detalle', 'Día de firma asignado', true);
  update public.expedientes
     set firma_fecha = p_fecha, firma_notaria = left(nullif(btrim(p_notaria), ''), 200), estatus = 'en_proceso_firma'
   where id = p_expediente;
  perform set_config('app.evento_detalle', '', true);
  perform public.log_evento(p_expediente, 'firma_asignada',
    to_char(p_fecha at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') || coalesce(' · ' || nullif(btrim(p_notaria), ''), ''));
end $$;

create or replace function public.confirmar_firma(p_expediente uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_est public.estatus_expediente;
begin
  if not public.es_staff_de_expediente(p_expediente) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select estatus into v_est from public.expedientes where id = p_expediente for update;
  if v_est <> 'en_proceso_firma' then raise exception 'Solo se confirma la firma de un expediente en proceso de firma'; end if;
  perform set_config('app.evento_detalle', 'Firma confirmada por el broker', true);
  update public.expedientes set estatus = 'firmado', firma_confirmada_en = now() where id = p_expediente;
  perform set_config('app.evento_detalle', '', true);
end $$;

create or replace function public.cambiar_estatus_admin(
  p_expediente uuid, p_estatus public.estatus_expediente, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede corregir el estatus' using errcode = '42501'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Indica el motivo del cambio'; end if;
  perform set_config('app.evento_detalle', 'Corrección de administrador: ' || left(btrim(p_motivo), 300), true);
  update public.expedientes set estatus = p_estatus where id = p_expediente;
  perform set_config('app.evento_detalle', '', true);
end $$;

create or replace function public.admin_actualizar_usuario(
  p_usuario uuid, p_rol public.rol_usuario, p_activo boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_antes jsonb;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede cambiar usuarios' using errcode = '42501'; end if;
  if p_usuario = auth.uid() and (p_rol <> 'admin' or not p_activo) then
    raise exception 'No puedes quitarte el rol de administrador ni desactivarte a ti mismo';
  end if;
  select to_jsonb(p) - 'created_at' - 'updated_at' into v_antes from public.profiles p where p.id = p_usuario;
  if v_antes is null then raise exception 'Usuario no encontrado'; end if;
  update public.profiles set rol = p_rol, activo = p_activo where id = p_usuario;
  perform public.log_auditoria('profiles', p_usuario::text, 'CAMBIO_ROL', v_antes,
    jsonb_build_object('rol', p_rol, 'activo', p_activo));
end $$;

create or replace function public.marcar_recomendada(p_simulacion uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_exp uuid;
begin
  select expediente_id into v_exp from public.simulaciones where id = p_simulacion;
  if v_exp is null or not public.es_staff_de_expediente(v_exp) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.simulaciones set recomendada = false where expediente_id = v_exp and recomendada;
  if p_valor then
    update public.simulaciones set recomendada = true where id = p_simulacion;
  end if;
end $$;

-- Reemplaza TODAS las tasas de un banco en una sola transacción (grid, pegar desde Excel o CSV)
create or replace function public.reemplazar_tasas(p_banco uuid, p_tasas jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int; v_antes jsonb;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede editar tarifas' using errcode = '42501'; end if;
  if jsonb_typeof(p_tasas) <> 'array' then raise exception 'Formato inválido: se esperaba una lista de tasas'; end if;
  if not exists (select 1 from public.bancos where id = p_banco) then raise exception 'Banco no encontrado'; end if;

  select coalesce(jsonb_agg(to_jsonb(t) - 'updated_at'), '[]'::jsonb) into v_antes
  from public.bancos_tasas t where t.banco_id = p_banco;

  delete from public.bancos_tasas where banco_id = p_banco;

  insert into public.bancos_tasas (
    banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max,
    aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti,
    incremento_anual, incremento_anios, activo, notas)
  select p_banco, r.producto, coalesce(nullif(r.destino, ''), '*'), coalesce(nullif(r.programa, ''), '*'),
         coalesce(nullif(r.esquema, ''), 'fijo'), r.perfil, r.tasa,
         coalesce(r.plazo_min, 1), coalesce(r.plazo_max, 30),
         coalesce(r.aforo_min, 0), coalesce(r.aforo_max, 1), r.monto_min, r.monto_max,
         r.comision_apertura, r.pti, coalesce(r.incremento_anual, 0), coalesce(r.incremento_anios, 0),
         coalesce(r.activo, true), r.notas
  from jsonb_to_recordset(p_tasas) as r(
    producto text, destino text, programa text, esquema text, perfil text, tasa numeric,
    plazo_min int, plazo_max int, aforo_min numeric, aforo_max numeric, monto_min numeric, monto_max numeric,
    comision_apertura numeric, pti numeric, incremento_anual numeric, incremento_anios int,
    activo boolean, notas text);
  get diagnostics v_n = row_count;

  update public.bancos set updated_at = now(), updated_by = auth.uid() where id = p_banco;
  perform public.log_auditoria('bancos_tasas', p_banco::text, 'REEMPLAZO', v_antes, p_tasas);
  return v_n;
end $$;
