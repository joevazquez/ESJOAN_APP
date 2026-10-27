// Capa de acceso a datos. Toda la seguridad real vive en la base (RLS); aquí solo
// se llaman consultas/RPC y se traducen los errores a mensajes claros en español.
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from '../config.js';

export const configurado = !/TU-PROYECTO|TU-LLAVE/.test(SUPABASE_URL + SUPABASE_ANON_KEY);
const { createClient } = window.supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ---- Errores ---------------------------------------------------------------------------------
const TRADUCCION = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Aún no confirmas tu correo. Revisa tu bandeja (y el spam).'],
  [/user already registered|already been registered/i, 'Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.'],
  [/password should be at least|weak.?password/i, 'La contraseña es muy débil. Usa al menos 10 caracteres, con letras y números.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
  [/row-level security|permission denied|42501|no autorizado/i, 'No tienes permiso para realizar esta acción.'],
  [/duplicate key|already exists/i, 'Ese registro ya existe.'],
  [/violates check constraint/i, 'Alguno de los datos está fuera del rango permitido.'],
  [/failed to fetch|networkerror|load failed/i, 'Sin conexión con el servidor. Revisa tu internet e inténtalo otra vez.'],
  [/mime type|not allowed|invalid_mime/i, 'Solo se aceptan archivos PDF.'],
  [/exceeded the maximum allowed size|payload too large|too large/i, 'El archivo excede el tamaño máximo de 10 MB.'],
  [/jwt expired|invalid jwt/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
];
export function mensajeError(e) {
  const crudo = (e && (e.message || e.error_description || e.msg)) || String(e || 'Error desconocido');
  for (const [re, txt] of TRADUCCION) if (re.test(crudo) || re.test(e && e.code ? String(e.code) : '')) return txt;
  return crudo.length > 220 ? 'Ocurrió un error inesperado. Inténtalo de nuevo.' : crudo;
}
function ok({ data, error }) { if (error) throw error; return data; }

// ---- Perfil y usuarios -----------------------------------------------------------------------
export const perfilPropio = async (uid) => ok(await sb.from('profiles').select('*').eq('id', uid).maybeSingle());
export const actualizarMiPerfil = async (uid, { nombre_completo, telefono }) =>
  ok(await sb.from('profiles').update({ nombre_completo, telefono }).eq('id', uid).select().single());
export const listarPerfiles = async () => ok(await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000));
export async function perfilesPorId(ids) {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return {};
  const filas = ok(await sb.from('profiles').select('id,nombre_completo,email,telefono,rol').in('id', u));
  return Object.fromEntries(filas.map((p) => [p.id, p]));
}
export const adminActualizarUsuario = async (id, rol, activo) => ok(await sb.rpc('admin_actualizar_usuario', { p_usuario: id, p_rol: rol, p_activo: activo }));
export const listarBrokers = async () => ok(await sb.from('profiles').select('id,nombre_completo,email').eq('rol', 'broker').eq('activo', true).order('nombre_completo'));

// ---- Expedientes -------------------------------------------------------------------------------
export const listarExpedientes = async () => ok(await sb.from('expedientes').select('*').order('created_at', { ascending: false }).limit(1000));
/**
 * Búsqueda paginada de expedientes (miles de filas, muchos brokers a la vez):
 * el filtro y el conteo corren dentro de Postgres, respetando RLS — cada
 * quien recibe solo lo suyo, sin importar cuántos expedientes existan en total.
 */
export const buscarExpedientes = async ({ q = null, estatus = null, broker = null, sinBroker = false, limite = 50, offset = 0 } = {}) =>
  ok(await sb.rpc('buscar_expedientes', { p_q: q || null, p_estatus: estatus || null, p_broker: broker || null, p_sin_broker: sinBroker, p_limite: limite, p_offset: offset }));
export const contarExpedientesPorEstatus = async () => ok(await sb.rpc('contar_expedientes_por_estatus'));
export const obtenerExpediente = async (id) => ok(await sb.from('expedientes').select('*').eq('id', id).maybeSingle());
export const crearExpediente = async (d) => ok(await sb.from('expedientes').insert(d).select().single());
export const actualizarExpediente = async (id, d) => ok(await sb.from('expedientes').update(d).eq('id', id).select().single());
export const asignarBroker = (exp, broker) => sb.rpc('asignar_broker', { p_expediente: exp, p_broker: broker || null }).then(ok);
export const asignarAvaluo = (exp, valuador, fecha) => sb.rpc('asignar_avaluo', { p_expediente: exp, p_valuador: valuador, p_fecha: fecha }).then(ok);
export const asignarFirma = (exp, fechaIso, notaria) => sb.rpc('asignar_firma', { p_expediente: exp, p_fecha: fechaIso, p_notaria: notaria || null }).then(ok);
export const confirmarFirma = (exp) => sb.rpc('confirmar_firma', { p_expediente: exp }).then(ok);
export const cambiarEstatusAdmin = (exp, estatus, motivo) => sb.rpc('cambiar_estatus_admin', { p_expediente: exp, p_estatus: estatus, p_motivo: motivo }).then(ok);
export const cancelarExpediente = (exp, motivo) => sb.rpc('cancelar_expediente', { p_expediente: exp, p_motivo: motivo || null }).then(ok);
export const historial = async (exp) => ok(await sb.from('expediente_historial').select('*').eq('expediente_id', exp).order('created_at', { ascending: false }).limit(300));
export const notas = async (exp) => ok(await sb.from('expediente_notas').select('*').eq('expediente_id', exp).order('created_at', { ascending: false }).limit(300));
export const agregarNota = async (exp, autor, nota) => ok(await sb.from('expediente_notas').insert({ expediente_id: exp, autor_id: autor, nota }).select().single());

// ---- Documentos ---------------------------------------------------------------------------------
export const tiposDocumento = async () => ok(await sb.from('tipos_documento').select('*').order('orden'));
export const documentos = async (exp) => ok(await sb.from('documentos').select('*').eq('expediente_id', exp).order('created_at', { ascending: false }));
export const revisarDocumento = (id, estado, motivo) => sb.rpc('revisar_documento', { p_documento: id, p_estado: estado, p_motivo: motivo || null }).then(ok);

export const MAX_PDF = 10 * 1024 * 1024;
/** Valida que sea realmente un PDF (tipo, tamaño y firma "%PDF"), no solo la extensión */
export async function validarPDF(file) {
  if (!file) throw new Error('Selecciona un archivo.');
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) throw new Error('Solo se aceptan archivos PDF.');
  if (file.size === 0) throw new Error('El archivo está vacío.');
  if (file.size > MAX_PDF) throw new Error('El archivo excede el tamaño máximo de 10 MB.');
  const cab = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...cab) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
}
export async function subirDocumento(expId, tipoClave, file, uid) {
  await validarPDF(file);
  const ruta = `${expId}/${crypto.randomUUID()}.pdf`;
  const up = await sb.storage.from(BUCKET).upload(ruta, file, { contentType: 'application/pdf', upsert: false, cacheControl: '0' });
  if (up.error) throw up.error;
  const nombre = file.name.replace(/[\u0000-\u001f]/g, '').slice(0, 200);
  const ins = await sb.from('documentos').insert({ expediente_id: expId, tipo_clave: tipoClave, nombre_archivo: nombre, storage_path: ruta, tamano_bytes: file.size, subido_por: uid }).select().single();
  if (ins.error) { await sb.storage.from(BUCKET).remove([ruta]); throw ins.error; }
  return ins.data;
}
export async function urlDocumento(ruta, segundos = 90) {
  const r = await sb.storage.from(BUCKET).createSignedUrl(ruta, segundos);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}
export async function eliminarDocumento(doc) {
  ok(await sb.from('documentos').delete().eq('id', doc.id));
  await sb.storage.from(BUCKET).remove([doc.storage_path]); // si falla queda huérfano pero inaccesible
}

// ---- Bancos, tarifas y simulaciones ------------------------------------------------------------------
export async function bancosConTasas() {
  const bancos = ok(await sb.from('bancos').select('*').order('nombre'));
  let tasas = [];
  for (let desde = 0; ; desde += 1000) {
    const bloque = ok(await sb.from('bancos_tasas').select('*').order('tasa').range(desde, desde + 999));
    tasas = tasas.concat(bloque);
    if (bloque.length < 1000) break;
  }
  const por = {};
  for (const t of tasas) (por[t.banco_id] ||= []).push(t);
  return bancos.map((b) => ({ ...b, tasas: por[b.id] || [] }));
}
export const actualizarBanco = async (id, d) => ok(await sb.from('bancos').update({ ...d, updated_at: new Date().toISOString() }).eq('id', id).select().single());
export const crearBanco = async (d) => ok(await sb.from('bancos').insert(d).select().single());
export const reemplazarTasas = (bancoId, filas) => sb.rpc('reemplazar_tasas', { p_banco: bancoId, p_tasas: filas }).then(ok);

export const simulaciones = async (exp) => ok(await sb.from('simulaciones').select('*').eq('expediente_id', exp).order('created_at', { ascending: false }));
export const guardarSimulacion = async (d) => ok(await sb.from('simulaciones').insert(d).select().single());
export const actualizarSimulacion = async (id, d) => ok(await sb.from('simulaciones').update(d).eq('id', id).select().single());
export const eliminarSimulacion = async (id) => ok(await sb.from('simulaciones').delete().eq('id', id));
export const marcarRecomendada = (id, valor) => sb.rpc('marcar_recomendada', { p_simulacion: id, p_valor: valor }).then(ok);

// ---- Catálogo de documentos (admin) y auditoría ------------------------------------------------------------
export const guardarTipoDocumento = async (d) => ok(await sb.from('tipos_documento').upsert(d, { onConflict: 'clave' }).select().single());
export const eliminarTipoDocumento = async (clave) => ok(await sb.from('tipos_documento').delete().eq('clave', clave));
export const auditoria = async () => ok(await sb.from('auditoria').select('*').order('created_at', { ascending: false }).limit(200));
export const docsPendientes = async () => ok(await sb.from('documentos').select('expediente_id').eq('estado', 'pendiente').limit(5000));
/** Búsqueda acotada de clientes (nombre o correo, 3+ letras) para elegir a quién crear un expediente nuevo. Solo broker/admin. */
export const buscarClientesParaExpediente = async (q) => ok(await sb.rpc('buscar_clientes_para_expediente', { p_q: q }));

// ---- Análisis de capacidad de pago (estado de cuenta + Buró) ------------------------------------------
export const obtenerAnalisisFinanciero = async (expId) => ok(await sb.from('analisis_financiero').select('*').eq('expediente_id', expId).maybeSingle());
export const mapearScoreABanda = async (score) => (score == null ? null : ok(await sb.rpc('mapear_score_a_banda', { p_score: score })));
export async function guardarAnalisisFinanciero(d) {
  return ok(await sb.rpc('guardar_analisis_financiero', {
    p_expediente: d.expedienteId, p_extraido: d.extraido || {}, p_ingreso_mensual: d.ingresoMensual,
    p_deuda_mensual: d.deudaMensual, p_score_buro: d.scoreBuro, p_banda_riesgo: d.bandaRiesgo,
    p_num_creditos_activos: d.numCreditosActivos, p_monto_creditos_activos: d.montoCreditosActivos,
    p_tiene_atrasos: d.tieneAtrasos, p_fuente_estado_cuenta: d.fuenteEstadoCuentaId || null, p_fuente_buro: d.fuenteBuroId || null,
  }));
}