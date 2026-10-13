-- =====================================================================
--  04 · PRIMER ADMINISTRADOR  (ejecútalo UNA sola vez, a mano)
--
--  1) Primero crea tu cuenta desde la página (Registro) y confirma tu correo.
--  2) Cambia el correo de abajo por el tuyo y ejecuta este script en
--     Supabase → SQL Editor.
--  El navegador jamás puede cambiar roles; solo tú, desde aquí, o un
--  administrador desde "Usuarios y roles".
-- =====================================================================
update public.profiles
   set rol = 'admin'
 where email = lower('joe._vazquez@hotmail.com');
 -- Vazquez#77

-- Verificación: debe regresar 1 fila con rol = admin
select email, rol, activo from public.profiles where rol = 'admin';
