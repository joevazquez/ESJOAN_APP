import * as api from '../lib/api.js';
import { h, mxn, fecha, fechaHora, folio, aNumero, banner, conBoton, toast, confirmar, pedirTexto, modal, icono, vacio, cargando, numero, pct } from '../lib/ui.js';
import { TIPOS, ESTATUS, EVENTOS, ESTADOS_MX, etiquetaEstatus, idxEstatus } from '../lib/constantes.js';
import { badgeEstatus, cabecera, hoja, campoForm, dinero, avanceDocs, progreso } from '../lib/comun.js';
import { cumbrera } from '../lib/cumbrera.js';

export default async function expediente(ctx) {
  const id = ctx.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error('Expediente no encontrado.'), { noEncontrada: true });
  const exp = await api.obtenerExpediente(id);
  if (!exp) throw Object.assign(new Error('Este expediente no existe o no tienes permiso para verlo.'), { noEncontrada: true });

  const esStaff = ctx.perfil.rol !== 'cliente';
  const esAdmin = ctx.perfil.rol === 'admin';
  const tab = ctx.params.tab || 'resumen';
  const [tipos, docs, perfiles] = await Promise.all([
    api.tiposDocumento(), api.documentos(id),
    // El cliente también puede ver el perfil de SU broker asignado (nombre, correo, teléfono):
    // la política profiles_select de la base ya lo permite para ese caso.
    api.perfilesPorId(esStaff ? [exp.cliente_id, exp.broker_id] : [exp.broker_id]),
  ]);
  const cliente = perfiles[exp.cliente_id] || (esStaff ? null : ctx.perfil);
  const broker = perfiles[exp.broker_id] || null;
  const av = avanceDocs(tipos, docs, exp.tipo);
  const porRevisar = docs.filter((d) => d.estado === 'pendiente').length;
  const recargar = () => ctx.refrescar();
  const dat = { ctx, exp, tipos, docs, cliente, broker, esStaff, esAdmin, av, recargar };

  const tabs = [
    { k: 'resumen', t: 'Resumen' },
    { k: 'documentos', t: 'Documentos', n: esStaff ? porRevisar : av.faltan.length },
    ...(esStaff ? [{ k: 'analisis', t: 'Análisis financiero' }] : []),
    { k: 'simulador', t: esStaff ? 'Simulador de crédito' : 'Opciones de crédito' },
    { k: 'historial', t: 'Historial' },
    ...(esStaff ? [{ k: 'notas', t: 'Notas internas' }] : []),
  ];

  let contenido;
  if (tab === 'resumen') contenido = tabResumen(dat);
  else if (tab === 'documentos') contenido = (await import('./exp_documentos.js')).tabDocumentos(dat);
  else if (tab === 'analisis' && esStaff) contenido = await (await import('./exp_analisis.js')).tabAnalisis(dat);
  else if (tab === 'simulador') contenido = await (await import('./exp_simulador.js'))[esStaff ? 'tabSimulador' : 'tabOpciones'](dat);
  else if (tab === 'historial') contenido = await tabHistorial(dat);
  else if (tab === 'notas' && esStaff) contenido = await tabNotas(dat);
  else throw Object.assign(new Error('Sección no encontrada.'), { noEncontrada: true });

  return h('div', null,
    h('div', { class: 'crumbs' }, h('a', { href: '#/' }, '← ', esStaff ? 'Expedientes' : 'Mis expedientes')),
    cabecera({
      kicker: `Expediente ${folio(exp.folio)}`,
      titulo: TIPOS[exp.tipo] || exp.tipo,
      sub: esStaff ? `${cliente ? (cliente.nombre_completo || cliente.email) : 'Cliente'} · ${broker ? 'Broker: ' + (broker.nombre_completo || broker.email) : 'Sin broker asignado'}` : null,
      acciones: [badgeEstatus(exp.estatus)],
    }),
    h('section', { class: 'hoja', 'aria-label': 'Avance del expediente' },
      h('div', { class: 'hoja-body' }, cumbrera(exp.estatus)),
      h('div', { class: 'estado-actual' }, h('span', { class: 'lead' }, etiquetaEstatus(exp.estatus)), h('span', { class: 'muted' }, ESTATUS[idxEstatus(exp.estatus)].desc), h('span', { class: 'grow' }), h('span', { class: 'small muted' }, 'Actualizado ', fechaHora(exp.estatus_actualizado_en)))),
    h('div', { style: 'height:24px' }),
    h('nav', { class: 'tabs', 'aria-label': 'Secciones del expediente' }, tabs.map((t) =>
      h('a', { class: 'tab', href: `#/expediente/${id}/${t.k}`, 'aria-current': t.k === tab ? 'page' : null }, t.t, t.n ? h('span', { class: 'count', 'aria-label': `${t.n} pendientes` }, String(t.n)) : null))),
    contenido);
}

// ==================================================================================================
//  RESUMEN
// ==================================================================================================
function tabResumen(d) {
  const { exp, esStaff, esAdmin, ctx } = d;
  const aforo = exp.valor_inmueble && exp.monto_solicitado ? exp.monto_solicitado / exp.valor_inmueble : null;
  const puedeEditar = esStaff || ['creado', 'en_revision_documentacion'].includes(exp.estatus);

  const datos = hoja('Datos del crédito', h('div', { class: 'stack' },
    h('div', { class: 'kpis' },
      kpi('Valor del inmueble', mxn(exp.valor_inmueble)), kpi('Monto solicitado', mxn(exp.monto_solicitado), aforo ? `Aforo ${pct(aforo, 1)}` : null),
      kpi('Plazo', exp.plazo_anios ? `${exp.plazo_anios} años` : '—'), kpi('Ingreso mensual', mxn(exp.ingreso_mensual))),
    h('dl', { class: 'dl' },
      h('dt', null, 'Tipo de crédito'), h('dd', null, TIPOS[exp.tipo] || exp.tipo),
      h('dt', null, 'Ubicación'), h('dd', null, exp.estado_inmueble || '—'),
      h('dt', null, 'Enganche estimado'), h('dd', null, exp.valor_inmueble && exp.monto_solicitado ? mxn(Math.max(exp.valor_inmueble - exp.monto_solicitado, 0)) : '—'),
      h('dt', null, 'Creado'), h('dd', null, fechaHora(exp.created_at)))),
  { acciones: puedeEditar ? [h('button', { class: 'btn btn-outline btn-sm', onclick: () => editarDatos(d) }, icono('editar'), 'Editar')] : null });

  const hitos = hoja('Avalúo y firma', h('dl', { class: 'dl' },
    h('dt', null, 'Avalúo'), h('dd', null, exp.avaluo_valuador ? `${exp.avaluo_valuador} · ${fecha(exp.avaluo_fecha)}` : h('span', { class: 'muted' }, 'Pendiente')),
    h('dt', null, 'Firma'), h('dd', null, exp.firma_fecha ? `${fechaHora(exp.firma_fecha)}${exp.firma_notaria ? ' · ' + exp.firma_notaria : ''}` : h('span', { class: 'muted' }, 'Pendiente')),
    h('dt', null, 'Firmado el'), h('dd', null, exp.firma_confirmada_en ? fechaHora(exp.firma_confirmada_en) : h('span', { class: 'muted' }, '—'))));

  const lateral = esStaff ? panelAcciones(d) : panelCliente(d);
  return h('div', { class: 'cols cols-21' }, h('div', { class: 'stack' }, datos, hitos), lateral);
}
const kpi = (k, v, s) => h('div', { class: 'kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), s ? h('div', { class: 's' }, s) : null);

function panelCliente(d) {
  const { exp, av, broker } = d;
  const tarjetaBroker = broker
    ? hoja('Tu broker asignado', h('dl', { class: 'dl' },
        h('dt', null, 'Nombre'), h('dd', null, broker.nombre_completo || broker.email),
        h('dt', null, 'Correo'), h('dd', null, h('a', { href: `mailto:${broker.email}` }, broker.email)),
        h('dt', null, 'Teléfono'), h('dd', null, broker.telefono ? h('a', { href: `tel:${broker.telefono}` }, broker.telefono) : h('span', { class: 'muted' }, 'No registrado'))))
    : hoja('Tu broker asignado', h('p', { class: 'small muted' }, 'Todavía no se te ha asignado un broker. En cuanto lo tengas, aquí verás su contacto.'));
  let titulo = '¿Qué sigue?'; let texto; let cta = null;
  switch (exp.estatus) {
    case 'creado':
      texto = av.faltan.length ? `Te faltan ${av.faltan.length} de ${av.obligatorios} documentos obligatorios. Cuando subas todos, tu broker comenzará la revisión.` : 'Ya subiste todos los documentos. Tu broker los revisará en breve.';
      cta = h('a', { class: 'btn btn-primary', href: `#/expediente/${exp.id}/documentos` }, icono('subir'), 'Subir documentos'); break;
    case 'en_revision_documentacion': texto = 'Tu documentación completa está en revisión. Si algún documento requiere corrección te lo indicaremos aquí.'; cta = h('a', { class: 'btn btn-outline', href: `#/expediente/${exp.id}/documentos` }, 'Ver mis documentos'); break;
    case 'documentacion_completa': texto = 'Aprobamos toda tu documentación. El siguiente paso es el avalúo del inmueble, que tu broker asignará.'; break;
    case 'en_avaluo': texto = `El avalúo está asignado${exp.avaluo_valuador ? ' con ' + exp.avaluo_valuador : ''}${exp.avaluo_fecha ? ' para el ' + fecha(exp.avaluo_fecha) : ''}.`; break;
    case 'en_proceso_firma': texto = `Tu firma está programada para el ${fechaHora(exp.firma_fecha)}${exp.firma_notaria ? ' en ' + exp.firma_notaria : ''}. Lleva identificación oficial vigente.`; break;
    default: titulo = '¡Felicidades!'; texto = 'Tu crédito hipotecario quedó firmado. Gracias por confiar en ESJOAN.';
  }
  return h('aside', { class: 'stack first-mobile' }, hoja(titulo, h('div', { class: 'stack' }, h('p', null, texto), cta)),
    d.av.obligatorios ? hoja('Documentación', h('div', { class: 'stack' }, h('div', { class: 'row between' }, h('strong', null, `${d.av.entregados} de ${d.av.obligatorios}`), h('span', { class: 'muted small' }, 'obligatorios entregados')),
      progreso2(d.av.entregados, d.av.obligatorios))) : null,
    tarjetaBroker);
}
function progreso2(n, total) {
  const barra = h('span'); barra.style.width = (total ? (n / total) * 100 : 0) + '%';
  return h('div', { class: 'progress-line' }, barra);
}

// ---- Acciones del broker / administrador ----------------------------------------------------------------------------
function panelAcciones(d) {
  const { exp, esAdmin } = d;
  const bloques = [];

  if (esAdmin) {
    const sel = h('select', { class: 'input', 'aria-label': 'Broker asignado' }, h('option', { value: '' }, 'Sin asignar'));
    api.listarBrokers().then((bs) => { bs.forEach((b) => sel.append(h('option', { value: b.id, selected: b.id === exp.broker_id }, b.nombre_completo || b.email))); sel.value = exp.broker_id || ''; });
    const btn = h('button', { class: 'btn btn-primary btn-sm', onclick: () => conBoton(btn, async () => {
      try { await api.asignarBroker(exp.id, sel.value || null); toast('Broker actualizado.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
    }) }, 'Guardar');
    bloques.push(hoja('Broker asignado', h('div', { class: 'stack' }, sel, h('div', { class: 'row' }, btn))));
  }

  // Avalúo
  const enDocCompleta = exp.estatus === 'documentacion_completa';
  const valuador = h('input', { class: 'input', maxlength: 160, placeholder: 'Nombre de la valuadora', value: exp.avaluo_valuador || '' });
  const fAv = h('input', { class: 'input', type: 'date', value: exp.avaluo_fecha || '' });
  const bAv = h('button', { class: 'btn btn-primary btn-sm', disabled: !enDocCompleta, onclick: () => conBoton(bAv, async () => {
    if (!valuador.value.trim() || !fAv.value) return toast('Indica valuadora y fecha del avalúo.', 'error');
    try { await api.asignarAvaluo(exp.id, valuador.value.trim(), fAv.value); toast('Avalúo asignado.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
  }) }, 'Asignar avalúo');
  bloques.push(hoja('1 · Avalúo', h('div', { class: 'stack' },
    campoForm('av_v', 'Valuadora', valuador), campoForm('av_f', 'Fecha del avalúo', fAv), h('div', null, bAv),
    !enDocCompleta && exp.estatus !== 'en_avaluo' && idxEstatus(exp.estatus) < 2 ? h('p', { class: 'hint muted small' }, 'Se habilita cuando toda la documentación esté aprobada.') : null)));

  // Firma
  const enAvaluo = exp.estatus === 'en_avaluo';
  const fFirma = h('input', { class: 'input', type: 'datetime-local' });
  const notaria = h('input', { class: 'input', maxlength: 200, placeholder: 'Notaría / lugar de firma', value: exp.firma_notaria || '' });
  const bFirma = h('button', { class: 'btn btn-primary btn-sm', disabled: !enAvaluo, onclick: () => conBoton(bFirma, async () => {
    if (!fFirma.value) return toast('Indica el día y hora de la firma.', 'error');
    try { await api.asignarFirma(exp.id, new Date(fFirma.value + ':00-06:00').toISOString(), notaria.value.trim()); toast('Fecha de firma asignada.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
  }) }, 'Asignar firma');
  bloques.push(hoja('2 · Día de firma', h('div', { class: 'stack' },
    campoForm('fi_f', 'Fecha y hora (hora de CDMX)', fFirma), campoForm('fi_n', 'Notaría', notaria), h('div', null, bFirma),
    idxEstatus(exp.estatus) < 3 ? h('p', { class: 'hint muted small' }, 'Se habilita cuando el avalúo esté asignado.') : null)));

  // Confirmar
  const enFirma = exp.estatus === 'en_proceso_firma';
  const bConf = h('button', { class: 'btn btn-primary btn-sm', disabled: !enFirma, onclick: async () => {
    if (!(await confirmar('¿Confirmas que el cliente ya firmó su crédito? El expediente pasará a "Firmado".', { titulo: 'Confirmar firma', si: 'Sí, ya firmó' }))) return;
    try { await api.confirmarFirma(exp.id); toast('¡Expediente firmado!', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
  } }, icono('check'), 'Confirmar que se firmó');
  bloques.push(hoja('3 · Firma realizada', h('div', { class: 'stack' }, bConf, !enFirma && exp.estatus !== 'firmado' ? h('p', { class: 'hint muted small' }, 'Se habilita cuando haya fecha de firma asignada.') : null)));

  // Corrección manual (solo admin)
  if (esAdmin) {
    const sel = h('select', { class: 'input' }, ESTATUS.map((s) => h('option', { value: s.clave, selected: s.clave === exp.estatus }, s.largo)));
    const bC = h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
      if (sel.value === exp.estatus) return toast('Ese ya es el estatus actual.', 'error');
      const motivo = await pedirTexto({ titulo: 'Corregir estatus', etiqueta: 'Motivo de la corrección', ayuda: 'Queda registrado en el historial y la auditoría.', si: 'Aplicar' });
      if (!motivo) return;
      try { await api.cambiarEstatusAdmin(exp.id, sel.value, motivo); toast('Estatus corregido.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
    } }, 'Aplicar corrección');
    bloques.push(hoja('Corrección manual', h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Solo para casos excepcionales; el flujo normal es automático.'), sel, h('div', null, bC))));
  }
  return h('aside', { class: 'stack' }, ...bloques);
}

// ---- Edición de datos del crédito ------------------------------------------------------------------------------------------------
function editarDatos(d) {
  const { exp } = d;
  const msg = h('div');
  const tipo = h('select', { class: 'input' }, Object.entries(TIPOS).map(([k, v]) => h('option', { value: k, selected: k === exp.tipo }, v)));
  const valor = dinero('e_valor', exp.valor_inmueble ?? ''); const monto = dinero('e_monto', exp.monto_solicitado ?? ''); const ingreso = dinero('e_ing', exp.ingreso_mensual ?? '');
  const plazo = h('input', { class: 'input', type: 'number', min: 1, max: 30, value: exp.plazo_anios ?? 20 });
  const estado = h('select', { class: 'input' }, h('option', { value: '' }, '—'), ESTADOS_MX.map((e) => h('option', { value: e, selected: e === exp.estado_inmueble }, e)));
  const cuerpo = h('form', { novalidate: true }, msg, h('div', { class: 'form-grid' },
    campoForm('e_tipo', 'Tipo de crédito', tipo, null, 'full'), campoForm('e_valor', 'Valor del inmueble', valor), campoForm('e_monto', 'Monto solicitado', monto),
    campoForm('e_plazo', 'Plazo (años)', plazo), campoForm('e_ing', 'Ingreso mensual', ingreso), campoForm('e_est', 'Estado del inmueble', estado, null, 'full')));
  modal({ titulo: 'Editar datos del crédito', cuerpo, acciones: [
    { texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() },
    { texto: 'Guardar cambios', clase: 'btn-primary', onclick: async (c) => {
      msg.replaceChildren();
      const v = aNumero(valor.querySelector('input').value); const m = aNumero(monto.querySelector('input').value); const p = Number(plazo.value);
      if (v && m && m > v) return msg.append(banner('bad', 'El monto no puede ser mayor al valor del inmueble.'));
      if (!Number.isInteger(p) || p < 1 || p > 30) return msg.append(banner('bad', 'El plazo debe ser de 1 a 30 años.'));
      try {
        await api.actualizarExpediente(exp.id, { tipo: tipo.value, valor_inmueble: v, monto_solicitado: m, plazo_anios: p, ingreso_mensual: aNumero(ingreso.querySelector('input').value), estado_inmueble: estado.value || null });
        c(); toast('Datos actualizados.', 'ok'); d.recargar();
      } catch (e) { msg.append(banner('bad', api.mensajeError(e))); }
    } }] });
}

// ==================================================================================================
//  HISTORIAL
// ==================================================================================================
async function tabHistorial(d) {
  const { exp, esStaff } = d;
  const ev = await api.historial(exp.id);
  const actores = esStaff ? await api.perfilesPorId(ev.map((e) => e.actor_id)) : {};
  if (!ev.length) return hoja('Historial', vacio('Sin movimientos', 'Aquí aparecerán los cambios de tu expediente.'));
  return hoja('Historial del expediente', h('ol', { class: 'timeline' }, ev.map((e) => {
    const quien = e.actor_id ? (esStaff ? (actores[e.actor_id]?.nombre_completo || actores[e.actor_id]?.email || 'Usuario') : (e.actor_id === d.ctx.uid ? 'Tú' : 'Equipo ESJOAN')) : 'Sistema';
    const titulo = e.evento === 'cambio_estatus' && e.estatus_nuevo ? `Estatus: ${etiquetaEstatus(e.estatus_nuevo)}` : (EVENTOS[e.evento] || e.evento);
    return h('li', { class: e.evento === 'cambio_estatus' || e.evento === 'creado' ? 'cambio' : '' },
      h('div', { class: 'ev' }, titulo), h('div', { class: 'meta' }, fechaHora(e.created_at), ' · ', quien), e.detalle ? h('div', { class: 'det' }, e.detalle) : null);
  })));
}

// ==================================================================================================
//  NOTAS INTERNAS (solo personal)
// ==================================================================================================
async function tabNotas(d) {
  const { exp, ctx } = d;
  const lista = await api.notas(exp.id);
  const autores = await api.perfilesPorId(lista.map((n) => n.autor_id));
  const txt = h('textarea', { class: 'input', maxlength: 4000, placeholder: 'Escribe una nota interna…', 'aria-label': 'Nueva nota' });
  const btn = h('button', { class: 'btn btn-primary btn-sm', onclick: () => conBoton(btn, async () => {
    const v = txt.value.trim(); if (!v) return;
    try { await api.agregarNota(exp.id, ctx.uid, v); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
  }) }, icono('nota'), 'Agregar nota');
  return h('div', { class: 'stack' },
    banner('warn', h('p', null, h('strong', null, 'Solo personal de ESJOAN. '), 'El cliente nunca ve estas notas.')),
    hoja('Nueva nota', h('div', { class: 'stack' }, txt, h('div', null, btn))),
    hoja('Notas', lista.length ? h('ol', { class: 'timeline' }, lista.map((n) => h('li', null, h('div', { class: 'meta' }, autores[n.autor_id]?.nombre_completo || autores[n.autor_id]?.email || 'Usuario', ' · ', fechaHora(n.created_at)), h('div', { class: 'det', style: 'white-space:pre-wrap' }, n.nota)))) : vacio('Sin notas', 'Registra aquí acuerdos, pendientes o información relevante.')));
}