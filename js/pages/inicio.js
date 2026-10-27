import { listarExpedientes, buscarExpedientes, contarExpedientesPorEstatus, listarBrokers } from '../lib/api.js';
import { h, mxn, fecha, folio, vacio, icono, debounce } from '../lib/ui.js';
import { ESTATUS, TIPOS, CANCELADO } from '../lib/constantes.js';
import { badgeEstatus, cabecera, progreso } from '../lib/comun.js';

export default async function inicio(ctx) {
  if (ctx.perfil.rol === 'cliente') return vistaCliente(ctx, await listarExpedientes());
  return vistaStaff(ctx);
}

function vistaCliente(ctx, exps) {
  const nombre = (ctx.perfil.nombre_completo || '').split(' ')[0];
  const cab = cabecera({ kicker: 'Tu trámite', titulo: nombre ? `Hola, ${nombre}` : 'Mis expedientes',
    sub: 'Aquí ves el avance de tu crédito hipotecario y los documentos que necesitamos.',
    acciones: exps.length ? [h('a', { class: 'btn btn-primary', href: '#/nuevo' }, icono('mas'), 'Nuevo expediente')] : null });
  if (!exps.length) {
    return h('div', null, cab, h('div', { class: 'hoja' }, vacio('Aún no tienes ningún expediente', 'Crea tu expediente para subir tu documentación y comenzar tu trámite.',
      h('a', { class: 'btn btn-primary', href: '#/nuevo' }, icono('mas'), 'Crear mi expediente'))));
  }
  return h('div', null, cab, h('div', { class: 'exp-lista' }, exps.map((e) =>
    h('a', { class: 'exp-card', href: `#/expediente/${e.id}` },
      h('div', { class: 'folio' }, h('small', null, 'FOLIO'), folio(e.folio).replace('EJ-', '')),
      h('div', null,
        h('div', { class: 'titulo' }, TIPOS[e.tipo] || e.tipo, e.valor_inmueble ? ` · ${mxn(e.valor_inmueble)}` : ''),
        h('div', { class: 'sub' }, 'Creado el ', fecha(e.created_at), ' · Actualizado el ', fecha(e.estatus_actualizado_en)),
        h('div', { style: 'margin-top:10px;max-width:360px' }, progreso(e.estatus))),
      badgeEstatus(e.estatus)))));
}

// Vista de broker/admin: con miles de expedientes y varios brokers trabajando
// a la vez, esta pantalla ya NO trae todo a memoria — el filtro, la búsqueda
// y la paginación corren dentro de Postgres (buscar_expedientes), y cada quien
// recibe solo lo que le corresponde según RLS, sin importar cuántos existan
// en total.
const PAGINA = 50;

async function vistaStaff(ctx) {
  const esAdmin = ctx.perfil.rol === 'admin';
  const brokers = esAdmin ? await listarBrokers() : [];

  const f = { q: '', estatus: '', broker: '', pagina: 0 };
  const cuerpo = h('tbody');
  const contador = h('span', { class: 'muted small' });
  const kpis = h('div', { class: 'kpis kpis-6' });
  const nav = h('div', { class: 'row', style: 'justify-content:flex-end' });
  let total = 0;

  async function cargarKpis() {
    try {
      const conteo = await contarExpedientesPorEstatus();
      const mapa = Object.fromEntries(conteo.map((c) => [c.estatus, Number(c.total)]));
      kpis.replaceChildren(...ESTATUS.map((s) => {
        const n = mapa[s.clave] || 0;
        return h('button', { class: 'kpi', style: 'border:0;text-align:left;cursor:pointer;font:inherit', 'aria-pressed': f.estatus === s.clave,
          onclick: () => { f.estatus = f.estatus === s.clave ? '' : s.clave; selEstatus.value = f.estatus; f.pagina = 0; pintar(); } },
          h('div', { class: 'k' }, s.corto), h('div', { class: 'v' }, String(n)));
      }));
    } catch (e) { console.error(e); }
  }

  function pintarNav() {
    const totalPaginas = Math.max(1, Math.ceil(total / PAGINA));
    nav.replaceChildren(
      h('button', { class: 'btn btn-outline btn-sm', disabled: f.pagina === 0, onclick: () => { f.pagina--; pintar(); } }, '← Anterior'),
      h('span', { class: 'muted small', style: 'padding:0 6px' }, `Página ${f.pagina + 1} de ${totalPaginas}`),
      h('button', { class: 'btn btn-outline btn-sm', disabled: f.pagina + 1 >= totalPaginas, onclick: () => { f.pagina++; pintar(); } }, 'Siguiente →'));
  }

  async function pintar() {
    const ticket = (pintar._t = (pintar._t || 0) + 1);
    cuerpo.replaceChildren(h('tr', null, h('td', { colspan: 7 }, h('div', { class: 'muted small', style: 'padding:24px;text-align:center' }, 'Cargando…'))));
    let filas = [];
    try {
      filas = await buscarExpedientes({
        q: f.q || null, estatus: f.estatus || null,
        broker: f.broker && f.broker !== '_sin' ? f.broker : null, sinBroker: f.broker === '_sin',
        limite: PAGINA, offset: f.pagina * PAGINA,
      });
    } catch (e) { console.error(e); cuerpo.replaceChildren(h('tr', null, h('td', { colspan: 7 }, vacio('No se pudo cargar', 'Intenta de nuevo en unos segundos.')))); return; }
    if (ticket !== pintar._t) return; // el usuario ya cambió el filtro; descarta esta respuesta tardía

    total = filas[0] ? Number(filas[0].total_filas) : 0;
    contador.textContent = total ? `${f.pagina * PAGINA + 1}–${f.pagina * PAGINA + filas.length} de ${total} expedientes` : 'Sin resultados';
    cuerpo.replaceChildren(...filas.map((e) => h('tr', null,
      h('td', null, h('a', { class: 'fila-link', href: `#/expediente/${e.id}` }, folio(e.folio))),
      h('td', null, h('div', { style: 'font-weight:600' }, e.cliente_nombre || '—'), h('div', { class: 'small muted' }, e.cliente_email || '')),
      h('td', null, TIPOS[e.tipo] || e.tipo),
      h('td', null, badgeEstatus(e.estatus), e.documentos_pendientes > 0 ? h('span', { class: 'badge warn plain', style: 'margin-left:6px' }, `${e.documentos_pendientes} por revisar`) : null),
      h('td', null, e.broker_id ? (e.broker_nombre || e.broker_email) : h('span', { class: 'badge bad plain' }, 'Sin asignar')),
      h('td', { class: 'right num' }, mxn(e.monto_solicitado)),
      h('td', { class: 'nowrap small muted' }, fecha(e.estatus_actualizado_en)))));
    if (!filas.length) cuerpo.append(h('tr', null, h('td', { colspan: 7 }, vacio('Sin resultados', 'Ajusta los filtros o la búsqueda.'))));
    pintarNav();
  }

  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por folio, nombre o correo…', 'aria-label': 'Buscar',
    oninput: debounce((e) => { f.q = e.target.value.trim(); f.pagina = 0; pintar(); }) });
  const selEstatus = h('select', { class: 'input', 'aria-label': 'Filtrar por estatus', onchange: (e) => { f.estatus = e.target.value; f.pagina = 0; pintar(); } },
    h('option', { value: '' }, 'Todos los estatus'), ESTATUS.map((s) => h('option', { value: s.clave }, s.largo)),
    h('option', { value: 'cancelado' }, CANCELADO.largo));
  const selBroker = esAdmin ? h('select', { class: 'input', 'aria-label': 'Filtrar por broker', onchange: (e) => { f.broker = e.target.value; f.pagina = 0; pintar(); } },
    h('option', { value: '' }, 'Todos los brokers'), h('option', { value: '_sin' }, 'Sin broker asignado'),
    brokers.map((b) => h('option', { value: b.id }, b.nombre_completo || b.email))) : null;

  cargarKpis(); // no bloquea el primer render
  await pintar();

  return h('div', null,
    cabecera({ kicker: esAdmin ? 'Panel de administración' : 'Mi cartera', titulo: esAdmin ? 'Expedientes' : 'Expedientes asignados',
      sub: esAdmin ? 'Todos los expedientes de ESJOAN.' : 'Solo ves los expedientes que el administrador te asignó.',
      acciones: esAdmin ? [h('a', { class: 'btn btn-primary', href: '#/nuevo' }, icono('mas'), 'Nuevo expediente')] : null }),
    kpis,
    h('div', { style: 'height:20px' }),
    h('div', { class: 'filtros' }, busca, selEstatus, selBroker, h('span', { class: 'grow' }), contador),
    h('div', { class: 'hoja' }, h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' },
      h('thead', null, h('tr', null, ['Folio', 'Cliente', 'Tipo', 'Estatus', 'Broker', 'Monto solicitado', 'Actualizado'].map((t, i) => h('th', { class: i === 5 ? 'right' : '' }, t)))), cuerpo))),
    h('div', { style: 'height:14px' }), nav);
}