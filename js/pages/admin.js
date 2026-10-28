import * as api from '../lib/api.js';
import { h, icono, banner, toast, modal, confirmar, fecha, fechaHora, vacio, debounce, conBoton } from '../lib/ui.js';
import { ROLES, TIPOS } from '../lib/constantes.js';
import { cabecera, hoja, campoForm } from '../lib/comun.js';

export default async function admin(ctx) {
  switch (ctx.vista) {
    case 'usuarios': return usuarios(ctx);
    case 'bancos': return bancosLista(ctx);
    case 'banco': return (await import('./admin_banco.js')).default(ctx);
    case 'documentos': return documentos(ctx);
    case 'auditoria': return auditoria(ctx);
    default: throw Object.assign(new Error('Sección no encontrada.'), { noEncontrada: true });
  }
}

// ==================================================================================================
//  USUARIOS Y ROLES
// ==================================================================================================
async function usuarios(ctx) {
  const lista = await api.listarPerfiles();
  const cuerpo = h('tbody');
  let q = '';
  const pintar = () => {
    const filas = lista.filter((u) => !q || `${u.nombre_completo || ''} ${u.email}`.toLowerCase().includes(q));
    cuerpo.replaceChildren(...filas.map((u) => {
      const yo = u.id === ctx.uid;
      const rol = h('select', { class: 'input', 'aria-label': `Rol de ${u.email}`, disabled: yo }, Object.entries(ROLES).map(([k, v]) => h('option', { value: k, selected: k === u.rol }, v)));
      const activo = h('input', { type: 'checkbox', checked: u.activo, disabled: yo, 'aria-label': `Cuenta activa de ${u.email}` });
      const btn = h('button', { class: 'btn btn-outline btn-sm', disabled: yo, onclick: () => conBoton(btn, async () => {
        if (rol.value === u.rol && activo.checked === u.activo) return toast('No hay cambios.', 'info');
        if (rol.value !== u.rol && !(await confirmar(`¿Cambiar el rol de ${u.email} a "${ROLES[rol.value]}"?${rol.value === 'admin' ? ' Tendrá acceso a TODOS los expedientes.' : ''}`, { titulo: 'Cambiar rol', si: 'Cambiar' }))) return;
        try { await api.adminActualizarUsuario(u.id, rol.value, activo.checked); u.rol = rol.value; u.activo = activo.checked; toast('Usuario actualizado.', 'ok'); } catch (e) { toast(api.mensajeError(e), 'error'); }
      }) }, 'Guardar');
      const puedeEliminar = !yo && u.rol !== 'admin';
      const btnEliminar = h('button', { class: 'btn btn-ghost btn-sm', disabled: !puedeEliminar, 'aria-label': `Eliminar ${u.email}`, title: puedeEliminar ? 'Eliminar cuenta' : (yo ? 'No puedes eliminar tu propia cuenta' : 'No se pueden eliminar cuentas de administrador aquí'),
        onclick: () => eliminarUsuarioFlow(u, { lista, pintar }) }, icono('basura'));
      return h('tr', null, h('td', null, h('div', { style: 'font-weight:600' }, u.nombre_completo || '—', yo ? h('span', { class: 'badge gold plain', style: 'margin-left:8px' }, 'Tú') : null), h('div', { class: 'small muted' }, u.email)),
        h('td', null, u.telefono || '—'), h('td', { style: 'min-width:190px' }, rol), h('td', null, h('label', { class: 'check' }, activo, h('span', null, 'Activa'))), h('td', { class: 'small muted nowrap' }, fecha(u.created_at)),
        h('td', { class: 'nowrap' }, btn, ' ', btnEliminar));
    }));
  };
  pintar();
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o correo…', 'aria-label': 'Buscar usuario', oninput: debounce((e) => { q = e.target.value.trim().toLowerCase(); pintar(); }) });
  return h('div', null,
    cabecera({ kicker: 'Administración', titulo: 'Usuarios y roles', sub: 'Quien se registra entra siempre como Cliente. Aquí promueves a brokers y administradores.' }),
    banner('info', h('p', null, h('strong', null, 'Para dar de alta a un broker: '), 'pídele que cree su perfil en la página (Registro), y luego cámbiale el rol a "Broker hipotecario" aquí. Después asígnale expedientes desde el detalle de cada expediente.')),
    h('div', { class: 'filtros' }, busca, h('span', { class: 'grow' }), h('span', { class: 'muted small' }, `${lista.length} usuarios`)),
    h('div', { class: 'hoja' }, h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' }, h('thead', null, h('tr', null, ['Usuario', 'Teléfono', 'Rol', 'Estado', 'Registro', ''].map((t) => h('th', null, t)))), cuerpo))));
}

/**
 * Flujo para eliminar POR COMPLETO la cuenta de un cliente o broker (borra
 * Authentication; no se puede deshacer, hay que registrarse de nuevo).
 * Reglas de negocio:
 *  - Cliente con expedientes: bloqueado (se conservan 5 años por ley).
 *  - Broker: sus expedientes YA FIRMADOS se reasignan solos al administrador
 *    que elimina; los expedientes activos (no firmados, no cancelados) hay
 *    que reasignarlos a otro broker antes de poder eliminar.
 */
async function eliminarUsuarioFlow(u, { lista, pintar }) {
  let ligados;
  try { ligados = await api.expedientesLigados(u.id); } catch (e) { return toast(api.mensajeError(e), 'error'); }

  if (u.rol === 'cliente') {
    if (ligados.length) {
      return modal({ titulo: 'No se puede eliminar', cuerpo: h('div', null,
        banner('warn', h('p', null, h('strong', null, `${u.nombre_completo || u.email} `), `tiene ${ligados.length} expediente(s) registrado(s). Por disposición legal se conservan al menos 5 años: no se puede eliminar la cuenta mientras existan.`))),
        acciones: [{ texto: 'Entendido', clase: 'btn-primary', onclick: (c) => c() }] });
    }
    const si = await confirmar(`¿Eliminar por completo la cuenta de ${u.nombre_completo || u.email}? No se puede deshacer; tendría que registrarse de nuevo.`, { titulo: 'Eliminar cuenta', si: 'Eliminar cuenta', peligro: true });
    if (si) ejecutarEliminar(u, {}, { lista, pintar });
    return;
  }

  if (u.rol === 'broker') {
    const firmados = ligados.filter((e) => e.broker_id === u.id && e.estatus === 'firmado');
    const activos = ligados.filter((e) => e.broker_id === u.id && e.estatus !== 'firmado' && e.estatus !== 'cancelado');

    if (!activos.length) {
      const nota = firmados.length ? h('p', { class: 'small muted' }, `Sus ${firmados.length} expediente(s) ya firmado(s) se reasignarán automáticamente a tu cuenta (se conservan por disposición legal).`) : null;
      return modal({ titulo: 'Eliminar cuenta', cuerpo: h('div', null,
        banner('bad', h('p', null, `¿Eliminar por completo la cuenta de `, h('strong', null, u.nombre_completo || u.email), `? No se puede deshacer; tendría que registrarse de nuevo.`)), nota),
        acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() },
          { texto: 'Eliminar cuenta', clase: 'btn-danger', onclick: (c) => { c(); ejecutarEliminar(u, {}, { lista, pintar }); } }] });
    }

    // Hay expedientes activos: hay que reasignarlos a otro broker antes de eliminar.
    let brokers = [];
    try { brokers = (await api.listarBrokers()).filter((b) => b.id !== u.id); } catch (e) { return toast(api.mensajeError(e), 'error'); }
    const msg = h('div');
    const selects = activos.map((e) => ({
      exp: e,
      sel: h('select', { class: 'input' }, h('option', { value: '' }, 'Elige un broker…'), brokers.map((b) => h('option', { value: b.id }, b.nombre_completo || b.email))),
    }));
    modal({ titulo: 'Reasigna sus expedientes activos', ancho: true, cuerpo: h('div', { class: 'stack' }, msg,
      banner('warn', h('p', null, `${u.nombre_completo || u.email} tiene ${activos.length} expediente(s) activo(s). Elige a qué broker se pasa cada uno antes de eliminar su cuenta.`)),
      firmados.length ? h('p', { class: 'small muted' }, `Sus ${firmados.length} expediente(s) ya firmado(s) se reasignarán automáticamente a tu cuenta.`) : null,
      ...selects.map(({ exp, sel }) => campoForm(`r_${exp.id}`, `Expediente ${exp.folio} · ${exp.estatus}`, sel))),
      acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() },
        { texto: 'Reasignar y eliminar', clase: 'btn-danger', onclick: async (c) => {
          msg.replaceChildren();
          if (selects.some(({ sel }) => !sel.value)) return msg.append(banner('bad', 'Elige un broker para cada expediente.'));
          const reasignaciones = Object.fromEntries(selects.map(({ exp, sel }) => [exp.id, sel.value]));
          try { await api.eliminarUsuario(u.id, reasignaciones); c(); quitarDeLista(u, { lista, pintar }); toast('Cuenta eliminada.', 'ok'); } catch (e) { msg.append(banner('bad', api.mensajeError(e))); }
        } }] });
  }
}

/** Ejecuta el borrado ya confirmado (por confirmar() o por un modal propio): no vuelve a preguntar. */
async function ejecutarEliminar(u, reasignaciones, { lista, pintar }) {
  try { await api.eliminarUsuario(u.id, reasignaciones); quitarDeLista(u, { lista, pintar }); toast('Cuenta eliminada.', 'ok'); } catch (e) { toast(api.mensajeError(e), 'error', 7000); }
}

function quitarDeLista(u, { lista, pintar }) {
  const i = lista.findIndex((x) => x.id === u.id);
  if (i >= 0) lista.splice(i, 1);
  pintar();
}

// ==================================================================================================
//  BANCOS (lista)
// ==================================================================================================
async function bancosLista() {
  const bancos = await api.bancosConTasas();
  const nuevo = () => {
    const clave = h('input', { class: 'input', maxlength: 30, placeholder: 'ej. inbursa' }); const nombre = h('input', { class: 'input', maxlength: 60 });
    const msg = h('div');
    modal({ titulo: 'Nuevo banco', cuerpo: h('div', null, msg, campoForm('nb_c', 'Clave interna', clave, 'Solo minúsculas, números y guion bajo.'), campoForm('nb_n', 'Nombre', nombre)),
      acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() }, { texto: 'Crear', clase: 'btn-primary', onclick: async (c) => {
        msg.replaceChildren();
        if (!/^[a-z0-9_]{2,30}$/.test(clave.value)) return msg.append(banner('bad', 'La clave debe tener 2–30 caracteres: minúsculas, números o guion bajo.'));
        if (!nombre.value.trim()) return msg.append(banner('bad', 'Escribe el nombre del banco.'));
        try {
          await api.crearBanco({ clave: clave.value, nombre: nombre.value.trim(), activo: false, verificado: false, color: '#292E54', parametros: {
            iva: 0.16, destructible_pct: 0.7, danos_base: 'destructible', base_dias: '30/360', apertura_pct: 0, apertura_financiable: false, admin_mensual: 0, admin_iva: false,
            vida_pct: 0, danos_pct: 0, seguro_otros_pct: 0, otros_gastos_iniciales: 0, investigacion: 0, avaluo: { tipo: 'fijo', monto: 0 }, pti: null, pti_base: 'total',
            aforo_max: { tradicional: 0.9, cofinavit: 0.95, apoyo_infonavit: 0.95, default: 0.9 }, plazo_min: 5, plazo_max: 20, monto_min: null, monto_max: null } });
          c(); location.hash = `#/admin/bancos/${clave.value}`;
        } catch (e) { msg.append(banner('bad', api.mensajeError(e))); }
      } }] });
  };
  return h('div', null,
    cabecera({ kicker: 'Administración', titulo: 'Bancos y tarifas', sub: 'Actualiza tasas y condiciones sin tocar código. Los simuladores de todos los expedientes usan estos datos al instante.',
      acciones: [h('button', { class: 'btn btn-primary', onclick: nuevo }, icono('mas'), 'Nuevo banco')] }),
    h('div', { class: 'hoja' }, h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' },
      h('thead', null, h('tr', null, ['Banco', 'Estado', 'Verificado', 'Vigencia', 'Tasas', 'Fuente', ''].map((t) => h('th', null, t)))),
      h('tbody', null, bancos.map((b) => {
        const chip = h('span', { class: 'badge plain' }, ''); chip.style.background = /^#[0-9a-f]{3,8}$/i.test(b.color || '') ? b.color : '#292E54'; chip.style.width = '14px'; chip.style.height = '14px'; chip.style.padding = '0'; chip.style.marginRight = '10px'; chip.style.verticalAlign = '-2px';
        return h('tr', null,
          h('td', null, chip, h('a', { class: 'fila-link', href: `#/admin/bancos/${b.clave}` }, b.nombre)),
          h('td', null, h('span', { class: 'badge ' + (b.activo ? 'ok' : '') }, b.activo ? 'Activo' : 'Desactivado')),
          h('td', null, h('span', { class: 'badge ' + (b.verificado ? 'ok' : 'warn') }, b.verificado ? 'Verificado' : 'Sin verificar')),
          h('td', { class: 'nowrap' }, b.vigencia ? fecha(b.vigencia) : '—'), h('td', { class: 'num' }, String(b.tasas.length)), h('td', { class: 'small muted' }, b.fuente || '—'),
          h('td', null, h('a', { class: 'btn btn-outline btn-sm', href: `#/admin/bancos/${b.clave}` }, icono('editar'), 'Editar')));
      }))))));
}

// ==================================================================================================
//  CATÁLOGO DE DOCUMENTOS REQUERIDOS
// ==================================================================================================
async function documentos() {
  const tipos = await api.tiposDocumento();
  const editar = (t) => {
    const nuevo = !t;
    const d = t || { clave: '', nombre: '', descripcion: '', obligatorio: true, aplica_tipos: null, orden: (tipos.at(-1)?.orden || 0) + 10, activo: true };
    const clave = h('input', { class: 'input', value: d.clave, maxlength: 60, disabled: !nuevo, placeholder: 'ej. carta_empleo' });
    const nombre = h('input', { class: 'input', value: d.nombre, maxlength: 120 }); const desc = h('input', { class: 'input', value: d.descripcion || '', maxlength: 300 });
    const orden = h('input', { class: 'input', type: 'number', value: d.orden, step: 10 });
    const obl = h('input', { type: 'checkbox', checked: d.obligatorio }); const act = h('input', { type: 'checkbox', checked: d.activo });
    const todos = h('input', { type: 'checkbox', checked: !d.aplica_tipos });
    const chips = Object.entries(TIPOS).map(([k, v]) => { const i = h('input', { type: 'checkbox', checked: (d.aplica_tipos || []).includes(k), disabled: !d.aplica_tipos }); return { k, i, nodo: h('label', { class: 'chip' }, i, v) }; });
    todos.addEventListener('change', () => chips.forEach((c) => { c.i.disabled = todos.checked; if (todos.checked) c.i.checked = false; }));
    const msg = h('div');
    modal({ titulo: nuevo ? 'Nuevo documento requerido' : 'Editar documento', ancho: true, cuerpo: h('div', null, msg, h('div', { class: 'form-grid' },
      campoForm('d_c', 'Clave interna', clave, 'Minúsculas, números y guion bajo. No se puede cambiar después.'), campoForm('d_o', 'Orden de aparición', orden),
      campoForm('d_n', 'Nombre que ve el cliente', nombre, null, 'full'), campoForm('d_d', 'Descripción / instrucciones', desc, null, 'full')),
      h('div', { class: 'row', style: 'margin-bottom:14px' }, h('label', { class: 'check' }, obl, h('span', null, 'Obligatorio')), h('label', { class: 'check' }, act, h('span', null, 'Activo'))),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Aplica a'), h('label', { class: 'check' }, todos, h('span', null, 'Todos los tipos de crédito')), h('div', { class: 'chips' }, chips.map((c) => c.nodo)))),
      acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() }, { texto: 'Guardar', clase: 'btn-primary', onclick: async (c) => {
        msg.replaceChildren();
        if (!/^[a-z0-9_]{2,60}$/.test(clave.value)) return msg.append(banner('bad', 'Clave inválida (minúsculas, números y guion bajo).'));
        if (!nombre.value.trim()) return msg.append(banner('bad', 'Escribe el nombre del documento.'));
        const sel = chips.filter((x) => x.i.checked).map((x) => x.k);
        if (!todos.checked && !sel.length) return msg.append(banner('bad', 'Elige al menos un tipo de crédito, o marca "Todos".'));
        try { await api.guardarTipoDocumento({ clave: clave.value, nombre: nombre.value.trim(), descripcion: desc.value.trim() || null, obligatorio: obl.checked, activo: act.checked, orden: Number(orden.value) || 100, aplica_tipos: todos.checked ? null : sel }); c(); toast('Guardado.', 'ok'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { msg.append(banner('bad', api.mensajeError(e))); }
      } }] });
  };
  const borrar = async (t) => {
    if (!(await confirmar(`¿Eliminar "${t.nombre}"? Si ya hay documentos de este tipo no se podrá; en ese caso desactívalo.`, { titulo: 'Eliminar', si: 'Eliminar', peligro: true }))) return;
    try { await api.eliminarTipoDocumento(t.clave); toast('Eliminado.', 'ok'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { toast(/foreign key|violates/i.test(e.message || '') ? 'Ya hay documentos de este tipo: desactívalo en lugar de eliminarlo.' : api.mensajeError(e), 'error', 7000); }
  };
  return h('div', null,
    cabecera({ kicker: 'Administración', titulo: 'Documentos requeridos', sub: 'Define qué documentos se piden y para qué tipo de crédito. El estatus de cada expediente se recalcula solo con estas reglas.',
      acciones: [h('button', { class: 'btn btn-primary', onclick: () => editar(null) }, icono('mas'), 'Nuevo documento')] }),
    h('div', { class: 'hoja' }, h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' },
      h('thead', null, h('tr', null, ['#', 'Documento', 'Requisito', 'Aplica a', 'Estado', ''].map((t) => h('th', null, t)))),
      h('tbody', null, tipos.map((t) => h('tr', { class: t.activo ? '' : 'descartado' },
        h('td', { class: 'num muted' }, String(t.orden)), h('td', null, h('div', { style: 'font-weight:600' }, t.nombre), h('div', { class: 'small muted' }, t.descripcion || '')),
        h('td', null, h('span', { class: 'badge plain ' + (t.obligatorio ? 'navy' : '') }, t.obligatorio ? 'Obligatorio' : 'Opcional')),
        h('td', { class: 'small' }, t.aplica_tipos ? t.aplica_tipos.map((k) => TIPOS[k] || k).join(', ') : 'Todos'),
        h('td', null, h('span', { class: 'badge ' + (t.activo ? 'ok' : '') }, t.activo ? 'Activo' : 'Inactivo')),
        h('td', { class: 'nowrap' }, h('button', { class: 'btn btn-outline btn-sm', onclick: () => editar(t) }, icono('editar'), 'Editar'), ' ', h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': `Eliminar ${t.nombre}`, onclick: () => borrar(t) }, icono('basura'))))))))));
}

// ==================================================================================================
//  AUDITORÍA
// ==================================================================================================
async function auditoria() {
  const filas = await api.auditoria();
  const actores = await api.perfilesPorId(filas.map((f) => f.actor_id));
  const ver = (f) => modal({ titulo: `${f.accion} · ${f.tabla}`, ancho: true, cuerpo: h('div', { class: 'cols cols-2' },
    h('div', null, h('h4', null, 'Antes'), h('pre', { class: 'mono', style: 'white-space:pre-wrap;word-break:break-word;background:var(--navy-50);padding:12px;max-height:50vh;overflow:auto' }, JSON.stringify(f.antes, null, 2) ?? '—')),
    h('div', null, h('h4', null, 'Después'), h('pre', { class: 'mono', style: 'white-space:pre-wrap;word-break:break-word;background:var(--navy-50);padding:12px;max-height:50vh;overflow:auto' }, JSON.stringify(f.despues, null, 2) ?? '—'))),
    acciones: [{ texto: 'Cerrar', clase: 'btn-outline', onclick: (c) => c() }] });
  return h('div', null,
    cabecera({ kicker: 'Administración', titulo: 'Auditoría', sub: 'Registro de cambios a bancos, tarifas, documentos requeridos y usuarios (últimos 200 movimientos).' }),
    filas.length ? h('div', { class: 'hoja' }, h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' },
      h('thead', null, h('tr', null, ['Fecha', 'Quién', 'Acción', 'Tabla', 'Registro', ''].map((t) => h('th', null, t)))),
      h('tbody', null, filas.map((f) => h('tr', null, h('td', { class: 'nowrap' }, fechaHora(f.created_at)), h('td', null, actores[f.actor_id]?.nombre_completo || actores[f.actor_id]?.email || '—'),
        h('td', null, h('span', { class: 'badge plain' }, f.accion)), h('td', null, f.tabla), h('td', { class: 'mono small' }, (f.registro_id || '').slice(0, 13)),
        h('td', null, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => ver(f) }, 'Ver cambios'))))))))
      : h('div', { class: 'hoja' }, vacio('Sin movimientos todavía', 'Aquí quedarán registrados los cambios de tarifas y catálogos.')));
}