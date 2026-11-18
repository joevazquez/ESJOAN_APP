-- =====================================================================
--  ESJOAN · 15) Evidencia del consentimiento del aviso de privacidad
--
--  Antes: el registro obligaba a marcar "Acepto el aviso de privacidad",
--  pero no quedaba guardado en ningún lado. Ahora el perfil guarda CUÁNDO
--  lo aceptó el cliente y QUÉ VERSIÓN del aviso aceptó.
--
--  · aviso_aceptado_en: la pone el servidor (now()) al crear la cuenta,
--    nunca el navegador, para que no se pueda falsear la fecha.
--  · aviso_version: la manda la pantalla de registro (constante
--    AVISO_PRIVACIDAD_VERSION en js/pages/auth.js).
--  · El cliente NO puede modificar estas columnas: el permiso de UPDATE
--    sobre profiles sigue limitado a nombre_completo y telefono
--    (ver 02_seguridad.sql).
--  · Usuarios que se registraron antes de este cambio quedan en NULL.
--
--  Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
--  Se puede correr más de una vez sin romper nada.
-- =====================================================================

-- ---------- 1) Columnas nuevas en el perfil ---------------------------
alter table public.profiles
  add column if not exists aviso_version     text,
  add column if not exists aviso_aceptado_en timestamptz;

comment on column public.profiles.aviso_version is
  'Versión del aviso de privacidad que aceptó el usuario al registrarse.';
comment on column public.profiles.aviso_aceptado_en is
  'Fecha y hora (del servidor) en que el usuario aceptó el aviso de privacidad.';

-- ---------- 2) El disparador de registro ahora guarda el consentimiento
-- Misma función que en 01_esquema.sql, con las dos columnas nuevas.
-- El rol SIEMPRE nace como 'cliente' (nunca se lee del metadata).
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_aviso text := left(nullif(btrim(new.raw_user_meta_data ->> 'aviso_version'), ''), 20);
begin
  insert into public.profiles (id, email, nombre_completo, telefono, rol, aviso_version, aviso_aceptado_en)
  values (
    new.id,
    coalesce(new.email, ''),
    left(nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), ''), 120),
    left(nullif(btrim(new.raw_user_meta_data ->> 'telefono'), ''), 30),
    'cliente',
    v_aviso,
    case when v_aviso is not null then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- (El trigger on_auth_user_created ya apunta a esta función; no hay que
--  volver a crearlo.)

-- ---------- 3) Verificación rápida ------------------------------------
-- Después de registrar un cliente de prueba, esto debe mostrar su versión
-- y la fecha de aceptación:
--   select email, aviso_version, aviso_aceptado_en
--   from public.profiles order by created_at desc limit 5;