// =====================================================================
//  CONFIGURACIÓN  ·  edita SOLO estas dos líneas
//  Supabase → Project Settings → API:
//    URL          → "Project URL"
//    ANON_KEY     → "anon public"  (es una llave PÚBLICA por diseño; la
//                    seguridad real está en las políticas RLS de la base).
//  ¡NUNCA pegues aquí la llave "service_role"!
// =====================================================================
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-LLAVE-ANON-PUBLICA';

// Nombre del bucket de Storage (ya lo crea 02_seguridad.sql)
export const BUCKET = 'expedientes';
// Porcentaje de gastos notariales que sugiere el simulador (editable en pantalla)
export const GASTOS_NOTARIALES_DEFECTO = 0.05;
