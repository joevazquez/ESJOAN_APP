// ESJOAN · Elimina por completo la cuenta de un usuario (cliente o broker):
// borra su registro de Authentication (profiles se borra solo, por
// ON DELETE CASCADE) para que ya no pueda iniciar sesión y tenga que
// registrarse de nuevo si vuelve.
//
// Esto corre en Supabase (Edge Functions, Deno), NO en el navegador, porque
// borrar una cuenta de Authentication requiere la Admin API con la llave
// service_role — esa llave nunca debe llegar al navegador.
//
// La llama directo la pantalla "Usuarios y roles" (fetch autenticado con el
// JWT del administrador que da clic en "Eliminar"), a diferencia de
// notificar-expediente que la dispara un Database Webhook.
//
// Reglas de negocio (confirmadas con el Business Owner):
//   - Un cliente con expedientes NO se puede eliminar: por disposición legal
//     los expedientes se conservan mínimo 5 años; hay que esperar a que se
//     depuren antes de poder borrar la cuenta.
//   - Un broker SÍ se puede eliminar, pero antes:
//       · sus expedientes YA FIRMADOS se reasignan automáticamente al
//         administrador que hace el borrado (para que no queden huérfanos).
//       · sus expedientes activos (no firmados ni cancelados) deben venir
//         reasignados a otro broker en la petición; si falta alguno, se
//         rechaza la operación y se informa cuáles faltan.
//   - No se puede eliminar la propia cuenta, ni la de otro administrador.
//
// No necesita secretos propios: SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase solo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    // Quién llama: se identifica con su propio JWT (el que manda el navegador).
    const sbComoLlamante = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user: llamante }, error: errUser } = await sbComoLlamante.auth.getUser();
    if (errUser || !llamante) return json({ error: 'No autenticado' }, 401);

    // De aquí en adelante, service_role: hace el trabajo real sin pasar por RLS.
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: perfilLlamante } = await sb.from('profiles').select('rol, activo').eq('id', llamante.id).maybeSingle();
    if (!perfilLlamante || perfilLlamante.rol !== 'admin' || !perfilLlamante.activo) {
      return json({ error: 'Solo un administrador activo puede eliminar usuarios.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const usuarioId = body.usuario_id as string | undefined;
    const reasignaciones = (body.reasignaciones || {}) as Record<string, string>; // { expediente_id: nuevo_broker_id }
    if (!usuarioId) return json({ error: 'Falta usuario_id.' }, 400);
    if (usuarioId === llamante.id) return json({ error: 'No puedes eliminar tu propia cuenta.' }, 400);

    const { data: objetivo, error: errObjetivo } = await sb
      .from('profiles').select('id, rol, email, nombre_completo').eq('id', usuarioId).maybeSingle();
    if (errObjetivo) throw errObjetivo;
    if (!objetivo) return json({ error: 'Usuario no encontrado.' }, 404);
    if (objetivo.rol === 'admin') return json({ error: 'No se puede eliminar una cuenta de administrador desde aquí.' }, 400);

    if (objetivo.rol === 'cliente') {
      const { count, error: errCount } = await sb
        .from('expedientes').select('id', { count: 'exact', head: true }).eq('cliente_id', usuarioId);
      if (errCount) throw errCount;
      if ((count || 0) > 0) {
        return json({
          error: 'Este cliente tiene expedientes registrados. Por disposición legal se conservan al menos 5 años: no se puede eliminar la cuenta mientras existan. Cuando se depuren (pasados los 5 años) podrás eliminarla.',
        }, 409);
      }
    }

    if (objetivo.rol === 'broker') {
      const { data: expedientesBroker, error: errExp } = await sb
        .from('expedientes').select('id, folio, estatus').eq('broker_id', usuarioId);
      if (errExp) throw errExp;

      const firmados = (expedientesBroker || []).filter((e) => e.estatus === 'firmado');
      const activos = (expedientesBroker || []).filter((e) => e.estatus !== 'firmado' && e.estatus !== 'cancelado');

      const faltantes = activos.filter((e) => !reasignaciones[e.id]);
      if (faltantes.length) {
        return json({
          error: 'Hay expedientes activos de este broker sin reasignar a otro broker.',
          faltantes: faltantes.map((e) => ({ id: e.id, folio: e.folio, estatus: e.estatus })),
        }, 409);
      }

      // Firmados: quedan en resguardo del administrador que elimina (nunca huérfanos; se conservan por ley).
      for (const e of firmados) {
        const { error: errUpd } = await sb.from('expedientes').update({ broker_id: llamante.id }).eq('id', e.id);
        if (errUpd) throw errUpd;
        await sb.from('expediente_historial').insert({
          expediente_id: e.id, actor_id: llamante.id, evento: 'broker_asignado',
          detalle: `Reasignado automáticamente al administrador al eliminarse la cuenta del broker ${objetivo.email} (expediente ya firmado; se conserva por disposición legal).`,
        });
      }
      // Activos: al nuevo broker que indicó el administrador.
      for (const e of activos) {
        const nuevoBroker = reasignaciones[e.id];
        const { error: errUpd } = await sb.from('expedientes').update({ broker_id: nuevoBroker }).eq('id', e.id);
        if (errUpd) throw errUpd;
        await sb.from('expediente_historial').insert({
          expediente_id: e.id, actor_id: llamante.id, evento: 'broker_asignado',
          detalle: `Reasignado a otro broker al eliminarse la cuenta de ${objetivo.email}.`,
        });
      }
    }

    // Auditoría antes de borrar (después de eliminar ya no habrá fila de profiles que leer).
    await sb.from('auditoria').insert({
      tabla: 'profiles', registro_id: usuarioId, accion: 'ELIMINAR_USUARIO', actor_id: llamante.id,
      antes: objetivo, despues: null,
    });

    // Borra la cuenta de Authentication; profiles se borra solo (ON DELETE CASCADE).
    const { error: errDelete } = await sb.auth.admin.deleteUser(usuarioId);
    if (errDelete) throw errDelete;

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});