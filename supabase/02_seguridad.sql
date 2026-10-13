-- =====================================================================
--  ESJOAN · Expedientes hipotecarios
--  02 · SEGURIDAD: Row Level Security, permisos mínimos y Storage privado
--
--  Modelo:  cliente  → solo SU información
--           broker   → solo los expedientes que el admin le asignó
--           admin    → todo
--  La seguridad vive AQUÍ, en la base de datos. La página web (GitHub Pages)
--  es solo una interfaz: aunque alguien la modifique, la base no le entrega
--  datos que no le corresponden.
-- =====================================================================

-- ---------- 1) Activar RLS en TODAS las tablas ------------------------
alter table public.profiles             enable row level security;
alter table public.tipos_documento      enable row level security;
alter table public.expedientes          enable row level security;
alter table public.documentos           enable row level security;
alter table public.expediente_historial enable row level security;
alter table public.expediente_notas     enable row level security;
alter table public.bancos               enable row level security;
alter table public.bancos_tasas         enable row level security;
alter table public.simulaciones         enable row level security;
alter table public.auditoria            enable row level security;

-- ---------- 2) Permisos mínimos (principio de menor privilegio) -------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;

-- Lectura
grant select on public.profiles, public.tipos_documento, public.expedientes, public.documentos,
                public.expediente_historial, public.expediente_notas, public.bancos,
                public.bancos_tasas, public.simulaciones, public.auditoria
  to authenticated;

-- Escritura acotada POR COLUMNA: el navegador jamás puede tocar rol, estatus,
-- broker, avalúo o firma. Eso solo ocurre a través de las funciones (RPC) de abajo.
grant update (nombre_completo, telefono) on public.profiles to authenticated;

grant insert (cliente_id, tipo, valor_inmueble, monto_solicitado, plazo_anios, ingreso_mensual, estado_inmueble)
  on public.expedientes to authenticated;
grant update (tipo, valor_inmueble, monto_solicitado, plazo_anios, ingreso_mensual, estado_inmueble)
  on public.expedientes to authenticated;

grant insert (expediente_id, tipo_clave, nombre_archivo, storage_path, tamano_bytes, subido_por)
  on public.documentos to authenticated;
grant delete on public.documentos to authenticated;

grant insert (expediente_id, autor_id, nota) on public.expediente_notas to authenticated;

grant insert (expediente_id, creado_por, nombre, banco_clave, banco_nombre, parametros, resultado, nota, compartida)
  on public.simulaciones to authenticated;
grant update (nombre, nota, compartida) on public.simulaciones to authenticated;
grant delete on public.simulaciones to authenticated;

grant insert, update, delete on public.tipos_documento to authenticated;              -- RLS: solo admin
grant update (nombre, color, activo, parametros, fuente, vigencia, verificado, notas, updated_at, updated_by)
  on public.bancos to authenticated;                                                   -- RLS: solo admin
grant insert on public.bancos to authenticated;                                        -- RLS: solo admin

-- Funciones que el navegador SÍ puede invocar (todas validan el rol por dentro)
grant execute on function
  public.aal_ok(), public.usuario_activo(), public.rol_actual(), public.es_admin(), public.es_broker(),
  public.es_staff(), public.es_staff_de_expediente(uuid), public.puede_ver_expediente(uuid),
  public.cliente_puede_editar(uuid), public.expediente_de_ruta(text),
  public.asignar_broker(uuid, uuid),
  public.revisar_documento(uuid, public.estado_documento, text),
  public.asignar_avaluo(uuid, text, date),
  public.asignar_firma(uuid, timestamptz, text),
  public.confirmar_firma(uuid),
  public.cambiar_estatus_admin(uuid, public.estatus_expediente, text),
  public.admin_actualizar_usuario(uuid, public.rol_usuario, boolean),
  public.marcar_recomendada(uuid, boolean),
  public.reemplazar_tasas(uuid, jsonb)
  to authenticated;
-- (log_evento, log_auditoria, recalcular_estatus_docs y los triggers NO son invocables desde el API)

-- ---------- 3) Políticas por tabla ------------------------------------

-- PROFILES -----------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  (select public.usuario_activo()) and (
       id = (select auth.uid())
    or (select public.es_admin())
    -- el broker ve a los clientes de sus expedientes
    or exists (select 1 from public.expedientes e
               where e.cliente_id = profiles.id and e.broker_id = (select auth.uid()) and (select public.es_broker()))
    -- el cliente ve a su broker (nombre y contacto)
    or exists (select 1 from public.expedientes e
               where e.broker_id = profiles.id and e.cliente_id = (select auth.uid()))
  )
);

drop policy if exists profiles_update_propio on public.profiles;
create policy profiles_update_propio on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.usuario_activo()))
  with check (id = (select auth.uid()));

-- TIPOS DE DOCUMENTO -------------------------------------------------
drop policy if exists tipos_doc_select on public.tipos_documento;
create policy tipos_doc_select on public.tipos_documento for select to authenticated
  using ((select public.usuario_activo()));
drop policy if exists tipos_doc_admin on public.tipos_documento;
create policy tipos_doc_admin on public.tipos_documento for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- EXPEDIENTES --------------------------------------------------------
drop policy if exists exp_select on public.expedientes;
create policy exp_select on public.expedientes for select to authenticated using (
  (select public.usuario_activo()) and (
       cliente_id = (select auth.uid())
    or (select public.es_admin())
    or (broker_id = (select auth.uid()) and (select public.es_broker()))
  )
);

drop policy if exists exp_insert on public.expedientes;
create policy exp_insert on public.expedientes for insert to authenticated with check (
  (select public.usuario_activo()) and (
       (cliente_id = (select auth.uid()) and (select public.rol_actual()) = 'cliente')
    or (select public.es_admin())
  )
);

drop policy if exists exp_update on public.expedientes;
create policy exp_update on public.expedientes for update to authenticated
using (
  (select public.usuario_activo()) and (
       (select public.es_admin())
    or (broker_id = (select auth.uid()) and (select public.es_broker()))
    or (cliente_id = (select auth.uid()) and estatus in ('creado', 'en_revision_documentacion'))
  )
)
with check (
  (select public.usuario_activo()) and (
       (select public.es_admin())
    or (broker_id = (select auth.uid()) and (select public.es_broker()))
    or (cliente_id = (select auth.uid()) and estatus in ('creado', 'en_revision_documentacion'))
  )
);
-- (sin política DELETE: los expedientes no se borran desde la app)

-- DOCUMENTOS ---------------------------------------------------------
drop policy if exists doc_select on public.documentos;
create policy doc_select on public.documentos for select to authenticated
  using (public.puede_ver_expediente(expediente_id));

drop policy if exists doc_insert on public.documentos;
create policy doc_insert on public.documentos for insert to authenticated with check (
  subido_por = (select auth.uid())
  and public.expediente_de_ruta(storage_path) = expediente_id
  and (public.es_staff_de_expediente(expediente_id) or public.cliente_puede_editar(expediente_id))
);

drop policy if exists doc_delete on public.documentos;
create policy doc_delete on public.documentos for delete to authenticated using (
  (select public.es_admin())
  or (estado <> 'aprobado' and public.cliente_puede_editar(expediente_id))
);
-- (sin política UPDATE: aprobar/rechazar solo por la función revisar_documento)

-- HISTORIAL (solo lectura; lo escriben triggers y funciones) ---------
drop policy if exists hist_select on public.expediente_historial;
create policy hist_select on public.expediente_historial for select to authenticated
  using (public.puede_ver_expediente(expediente_id));

-- NOTAS INTERNAS (solo personal; el cliente NO las ve) ----------------
drop policy if exists notas_select on public.expediente_notas;
create policy notas_select on public.expediente_notas for select to authenticated
  using (public.es_staff_de_expediente(expediente_id));
drop policy if exists notas_insert on public.expediente_notas;
create policy notas_insert on public.expediente_notas for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.es_staff_de_expediente(expediente_id));

-- BANCOS Y TARIFAS (información comercial: solo personal; edita solo admin) --
drop policy if exists bancos_select on public.bancos;
create policy bancos_select on public.bancos for select to authenticated using ((select public.es_staff()));
drop policy if exists bancos_admin_ins on public.bancos;
create policy bancos_admin_ins on public.bancos for insert to authenticated
  with check ((select public.es_admin()));
drop policy if exists bancos_admin_upd on public.bancos;
create policy bancos_admin_upd on public.bancos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy if exists tasas_select on public.bancos_tasas;
create policy tasas_select on public.bancos_tasas for select to authenticated using ((select public.es_staff()));
-- (las tasas se escriben solo con reemplazar_tasas(), que valida rol y audita)

-- SIMULACIONES --------------------------------------------------------
drop policy if exists sim_select on public.simulaciones;
create policy sim_select on public.simulaciones for select to authenticated using (
  public.es_staff_de_expediente(expediente_id)
  or (compartida and public.puede_ver_expediente(expediente_id))
);
drop policy if exists sim_insert on public.simulaciones;
create policy sim_insert on public.simulaciones for insert to authenticated
  with check (creado_por = (select auth.uid()) and public.es_staff_de_expediente(expediente_id));
drop policy if exists sim_update on public.simulaciones;
create policy sim_update on public.simulaciones for update to authenticated
  using (public.es_staff_de_expediente(expediente_id))
  with check (public.es_staff_de_expediente(expediente_id));
drop policy if exists sim_delete on public.simulaciones;
create policy sim_delete on public.simulaciones for delete to authenticated
  using (public.es_staff_de_expediente(expediente_id));

-- AUDITORÍA (solo lectura, solo admin) --------------------------------
drop policy if exists audit_select on public.auditoria;
create policy audit_select on public.auditoria for select to authenticated using ((select public.es_admin()));

-- ---------- 4) STORAGE: bucket privado, solo PDF, máx. 10 MB ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- Ruta obligatoria de cada archivo:  <id_del_expediente>/<uuid>.pdf
drop policy if exists exp_storage_select on storage.objects;
create policy exp_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'expedientes'
  and public.expediente_de_ruta(name) is not null
  and public.puede_ver_expediente(public.expediente_de_ruta(name))
);

drop policy if exists exp_storage_insert on storage.objects;
create policy exp_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'expedientes'
  and public.expediente_de_ruta(name) is not null
  and (
       public.es_staff_de_expediente(public.expediente_de_ruta(name))
    or public.cliente_puede_editar(public.expediente_de_ruta(name))
  )
);

drop policy if exists exp_storage_delete on storage.objects;
create policy exp_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'expedientes'
  and public.expediente_de_ruta(name) is not null
  and (
       (select public.es_admin())
    or (
         public.cliente_puede_editar(public.expediente_de_ruta(name))
         and not exists (select 1 from public.documentos d where d.storage_path = name and d.estado = 'aprobado')
       )
  )
);
-- (sin política UPDATE: los archivos son inmutables; para corregir se sube uno nuevo)
