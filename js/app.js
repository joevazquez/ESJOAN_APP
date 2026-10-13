// ESJOAN · arranque, sesión y enrutador (rutas con #/ para funcionar en GitHub Pages)
import { sb, configurado, perfilPropio, mensajeError } from './lib/api.js';
import { h, montar, icono, cargando, toast, banner } from './lib/ui.js';
import { ROLES } from './lib/constantes.js';
import * as auth from './pages/auth.js';

// Anti-clickjacking (GitHub Pages no permite cabeceras): no se muestra dentro de un iframe ajeno
if (window.top !== window.self) { document.documentElement.replaceChildren(); throw new Error('Marco no permitido'); }

const raiz = document.getElementById('app');
const estado = { sesion: null, perfil: null, mfaPendiente: false, mfaObligatorioPendiente: false, recuperando: false, listo: false };
let ticket = 0;

export const ir = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
const partes = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
export const consulta = () => new URLSearchParams((location.hash.split('?')[1]) || '');

// ---- Rutas -------------------------------------------------------------------------------------------------
const RUTAS = [
  { p: [], m: 'inicio' },
  { p: ['nuevo'], m: 'nuevo', roles: ['broker', 'admin'] },
  { p: ['expediente', ':id'], m: 'expediente' },
  { p: ['expediente', ':id', ':tab'], m: 'expediente' },
  { p: ['perfil'], m: 'perfil' },
  { p: ['admin', 'usuarios'], m: 'admin', roles: ['admin'], k: 'usuarios' },
  { p: ['admin', 'bancos'], m: 'admin', roles: ['admin'], k: 'bancos' },
  { p: ['admin', 'bancos', ':clave'], m: 'admin', roles: ['admin'], k: 'banco' },
  { p: ['admin', 'documentos'], m: 'admin', roles: ['admin'], k: 'documentos' },
  { p: ['admin', 'auditoria'], m: 'admin', roles: ['admin'], k: 'auditoria' },
];
function resolver(seg, rol) {
  for (const r of RUTAS) {
    if (r.p.length !== seg.length) continue;
    const params = {};
    if (!r.p.every((x, i) => (x.startsWith(':') ? ((params[x.slice(1)] = seg[i]), true) : x === seg[i]))) continue;
    if (r.roles && !r.roles.includes(rol)) return null;
    return { ...r, params };
  }
  return null;
}

// ---- Sesión --------------------------------------------------------------------------------------------------------
async function cargarSesion() {
  estado.perfil = null; estado.mfaPendiente = false; estado.mfaObligatorioPendiente = false;
  if (!estado.sesion) return;
  try {
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    estado.mfaPendiente = !!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
    if (estado.mfaPendiente) return;
    estado.perfil = await perfilPropio(estado.sesion.user.id);
    // Personal con acceso a expedientes de otras personas: la verificación en dos pasos es obligatoria.
    if (estado.perfil && estado.perfil.rol !== 'cliente') {
      const { data: fac } = await sb.auth.mfa.listFactors();
      const verificado = (fac && fac.all || []).some((f) => f.factor_type === 'totp' && f.status === 'verified');
      estado.mfaObligatorioPendiente = !verificado;
    }
  } catch (e) { console.error(e); }
}

sb.auth.onAuthStateChange((evento, sesion) => {
  setTimeout(async () => { // (fuera del callback para no bloquear a supabase-js)
    if (evento === 'PASSWORD_RECOVERY') estado.recuperando = true;
    if (!estado.listo || evento === 'INITIAL_SESSION' || evento === 'TOKEN_REFRESHED') { if (evento === 'TOKEN_REFRESHED') estado.sesion = sesion; return; }
    const antes = estado.sesion && estado.sesion.user.id;
    estado.sesion = sesion;
    if (!sesion) { estado.perfil = null; estado.mfaPendiente = false; estado.recuperando = false; location.hash = '#/login'; return render(); }
    if (evento === 'SIGNED_IN' && antes === sesion.user.id && (estado.perfil || estado.mfaPendiente) && !estado.recuperando) return; // reenfoque de pestaña
    await cargarSesion();
    render();
  }, 0);
});

// Cierre por inactividad (datos sensibles): 30 minutos
let idle;
const IDLE_MS = 30 * 60 * 1000;
function armarIdle() {
  clearTimeout(idle);
  if (!estado.sesion) return;
  idle = setTimeout(async () => { await sb.auth.signOut(); toast('Por seguridad cerramos tu sesión por inactividad.', 'info', 8000); }, IDLE_MS);
}
['click', 'keydown', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, armarIdle, { passive: true }));

// ---- Estructura (menú lateral) ----------------------------------------------------------------------------------------
function menuPara(rol) {
  const base = [{ t: rol === 'cliente' ? 'Mis expedientes' : 'Expedientes', h: '#/', i: 'carpeta', k: '' }];
  if (rol === 'broker' || rol === 'admin') base.push({ t: 'Nuevo expediente', h: '#/nuevo', i: 'mas', k: 'nuevo' });
  const adm = rol === 'admin' ? [
    { sec: 'Administración' },
    { t: 'Usuarios y roles', h: '#/admin/usuarios', i: 'usuarios', k: 'admin/usuarios' },
    { t: 'Bancos y tarifas', h: '#/admin/bancos', i: 'banco', k: 'admin/bancos' },
    { t: 'Documentos requeridos', h: '#/admin/documentos', i: 'docs', k: 'admin/documentos' },
    { t: 'Auditoría', h: '#/admin/auditoria', i: 'escudo', k: 'admin/auditoria' },
  ] : [];
  return [...base, ...adm, { sec: 'Cuenta' }, { t: 'Mi perfil y seguridad', h: '#/perfil', i: 'perfil', k: 'perfil' }];
}
function estructura(contenido, seg) {
  const p = estado.perfil;
  const clave = seg.join('/');
  const activo = (k) => (k === '' ? seg.length === 0 || seg[0] === 'expediente' : clave === k || clave.startsWith(k + '/'));
  const lateral = h('aside', { class: 'side', id: 'lateral', 'aria-label': 'Menú principal' },
    h('div', { class: 'side-logo' }, h('img', { src: 'assets/logo-esjoan.jpg', alt: 'ESJOAN Soluciones Inmobiliarias', width: 216, height: 150 })),
    h('nav', null, menuPara(p.rol).map((m) => m.sec
      ? h('div', { class: 'side-title' }, m.sec)
      : h('a', { class: 'nav-link', href: m.h, 'aria-current': activo(m.k) ? 'page' : null, onclick: () => cerrarMenu() }, icono(m.i), m.t))),
    h('div', { class: 'side-user' },
      h('div', { class: 'who' }, p.nombre_completo || p.email),
      h('div', { class: 'rol' }, ROLES[p.rol]),
      h('button', { class: 'btn btn-outline btn-sm', onclick: () => sb.auth.signOut() }, icono('salir'), 'Cerrar sesión')));
  const scrim = h('div', { class: 'scrim', hidden: true, onclick: () => cerrarMenu() });
  function cerrarMenu() { lateral.classList.remove('abierto'); scrim.hidden = true; }
  const barra = h('header', { class: 'topbar-mobile' },
    h('img', { src: 'assets/logo-esjoan.jpg', alt: 'ESJOAN', height: 42 }),
    h('button', { class: 'btn btn-ghost', 'aria-label': 'Abrir menú', 'aria-controls': 'lateral', onclick: () => { lateral.classList.add('abierto'); scrim.hidden = false; } }, icono('menu')));
  return h('div', { class: 'app' }, lateral, scrim, h('div', { class: 'main' }, barra, h('main', { class: 'content', id: 'contenido', tabindex: '-1' }, contenido)));
}

// ---- Render ---------------------------------------------------------------------------------------------------------------------------
async function render() {
  const mio = ++ticket;
  if (!configurado) return montar(raiz, auth.pantallaConfig());
  const seg = partes();

  if (!estado.sesion) {
    const pub = ['login', 'registro', 'recuperar'].includes(seg[0]) ? seg[0] : 'login';
    if (seg[0] !== pub) { history.replaceState(null, '', '#/login'); }
    return montar(raiz, auth[pub]());
  }
  if (estado.recuperando) return montar(raiz, auth.nuevaClave({ alTerminar: () => { estado.recuperando = false; location.hash = '#/'; cargarSesion().then(render); } }));
  if (estado.mfaPendiente) return montar(raiz, auth.retoMFA({ alTerminar: async () => { await cargarSesion(); location.hash = '#/'; render(); } }));
  if (estado.mfaObligatorioPendiente) return montar(raiz, auth.mfaObligatorio({ alTerminar: async () => { await cargarSesion(); render(); } }));
  if (!estado.perfil) {
    return montar(raiz, h('div', { class: 'acceso-form', style: 'min-height:100vh' }, h('div', { class: 'acceso-caja' },
      h('h1', null, 'Cuenta no disponible'), h('span', { class: 'rule' }),
      h('p', { class: 'sub' }, 'Tu cuenta está desactivada o aún no se termina de crear. Si crees que es un error, contacta a ESJOAN.'),
      h('button', { class: 'btn btn-outline', onclick: () => sb.auth.signOut() }, 'Cerrar sesión'))));
  }
  if (seg[0] && ['login', 'registro', 'recuperar'].includes(seg[0])) { history.replaceState(null, '', '#/'); return render(); }

  const ruta = resolver(seg, estado.perfil.rol);
  const ctx = { perfil: estado.perfil, uid: estado.sesion.user.id, ir, consulta: consulta(), refrescar: () => render(), params: ruta ? ruta.params : {}, vista: ruta ? ruta.k : null, seg };
  montar(raiz, estructura(cargando(), seg));
  armarIdle();
  try {
    if (!ruta) throw Object.assign(new Error('No encontramos esta página.'), { noEncontrada: true });
    const mod = await import(`./pages/${ruta.m}.js`);
    const nodo = await mod.default(ctx);
    if (mio !== ticket) return; // el usuario ya navegó a otra parte
    montar(raiz, estructura(nodo, seg));
    document.getElementById('contenido').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (mio !== ticket) return;
    console.error(e);
    montar(raiz, estructura(h('div', { class: 'stack' },
      banner('bad', h('p', null, h('strong', null, e.noEncontrada ? 'Página no encontrada' : 'No pudimos cargar esta página')), h('p', null, mensajeError(e))),
      h('a', { class: 'btn btn-outline', href: '#/' }, 'Ir al inicio')), seg));
  }
}

window.addEventListener('hashchange', () => { if (estado.listo) render(); });

(async function iniciar() {
  if (configurado) {
    const { data } = await sb.auth.getSession();
    estado.sesion = data.session;
    await cargarSesion();
    if (history.replaceState && /[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  }
  estado.listo = true;
  render();
})();