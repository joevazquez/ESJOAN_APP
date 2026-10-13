// Análisis de capacidad de pago: el sistema PROPONE ingreso, deuda existente y
// banda de riesgo crediticio a partir del estado de cuenta y el Buró de Crédito
// del cliente (extracción automática, heurísticas de texto — sin machine
// learning). El broker siempre revisa y puede corregir todo antes de confirmar;
// nada de esto lo ve el cliente hasta que el broker comparta una simulación.
import * as api from '../lib/api.js';
import { h, icono, banner, toast, conBoton, fechaHora, aNumero } from '../lib/ui.js';
import { hoja, campoForm, dinero } from '../lib/comun.js';
import { textoDePDF, extraerBuro, extraerEstadoCuenta } from '../lib/extraccion.js';

const BANDAS = ['NR 1 y 2 +', 'NR 3 +', 'NR 1 y 2', 'NR 3'];

export async function tabAnalisis(d) {
  const { exp, docs, ctx } = d;
  const docsEstado = docs.filter((x) => x.tipo_clave === 'estados_cuenta' && x.estado !== 'rechazado');
  const docsBuro = docs.filter((x) => x.tipo_clave === 'reporte_buro' && x.estado !== 'rechazado');
  const previo = await api.obtenerAnalisisFinanciero(exp.id).catch(() => null);

  if (!docsEstado.length && !docsBuro.length) {
    return hoja('Análisis de capacidad de pago', banner('info', h('p', null, h('strong', null, 'Aún no hay documentos para analizar. '), 'Sube el estado de cuenta y el reporte de Buró de Crédito del cliente en la pestaña "Documentos"; en cuanto estén, aquí podrás extraer los datos automáticamente.')));
  }

  const msg = h('div');
  const evidenciaBuro = h('div', { class: 'stack' });
  const evidenciaEstado = h('div', { class: 'stack' });

  const ingreso = dinero('af_ing', previo?.ingreso_mensual ?? '');
  const deuda = dinero('af_deu', previo?.deuda_mensual ?? '');
  const score = h('input', { class: 'input', type: 'number', min: 300, max: 850, value: previo?.score_buro ?? '' });
  const numCred = h('input', { class: 'input', type: 'number', min: 0, value: previo?.num_creditos_activos ?? '' });
  const montoCred = dinero('af_mc', previo?.monto_creditos_activos ?? '');
  const atrasos = h('input', { type: 'checkbox', checked: !!previo?.tiene_atrasos });
  const banda = h('select', { class: 'input' }, h('option', { value: '' }, '— Selecciona —'), BANDAS.map((b) => h('option', { value: b, selected: b === previo?.banda_riesgo }, b)));
  let extraido = previo?.extraido || {};

  const selEstado = docsEstado.length > 1 ? h('select', { class: 'input' }, docsEstado.map((x) => h('option', { value: x.id }, x.nombre_archivo))) : null;
  const selBuro = docsBuro.length > 1 ? h('select', { class: 'input' }, docsBuro.map((x) => h('option', { value: x.id }, x.nombre_archivo))) : null;

  async function extraerDe(lista, sel, campo) {
    const docId = sel ? sel.value : lista[0]?.id;
    const doc = lista.find((x) => x.id === docId) || lista[0];
    if (!doc) return null;
    const url = await api.urlDocumento(doc.storage_path);
    const buf = await (await fetch(url)).arrayBuffer();
    const texto = await textoDePDF(new Uint8Array(buf));
    return { doc, resultado: campo === 'buro' ? extraerBuro(texto) : extraerEstadoCuenta(texto) };
  }

  const bBuro = h('button', { class: 'btn btn-outline btn-sm', disabled: !docsBuro.length }, icono('search'), 'Extraer del Buró');
  bBuro.onclick = () => conBoton(bBuro, async () => {
    msg.replaceChildren();
    try {
      const { doc, resultado: r } = await extraerDe(docsBuro, selBuro, 'buro');
      if (r.score != null) score.value = r.score;
      if (r.montoCreditosActivos != null) montoCred.querySelector('input').value = Math.round(r.montoCreditosActivos).toLocaleString('es-MX');
      if (r.numCreditosActivos != null) numCred.value = r.numCreditosActivos;
      atrasos.checked = !!r.tieneAtrasos;
      if (r.score != null) { const sugerida = await api.mapearScoreABanda(r.score); if (sugerida) banda.value = sugerida; }
      extraido = { ...extraido, buro: { ...r, docId: doc.id, extraidoEn: new Date().toISOString() } };
      evidenciaBuro.replaceChildren(h('p', { class: 'small muted', style: 'margin:6px 0 2px' }, `De: ${doc.nombre_archivo}`), ...r.evidencia.map((ev) => h('div', { class: 'small', style: 'color:var(--muted)' }, '• ', ev)));
      toast('Datos del Buró extraídos. Revísalos antes de confirmar.', 'ok');
    } catch (e) { msg.replaceChildren(banner('bad', 'No se pudo leer el Buró de Crédito: ' + api.mensajeError(e))); }
  });

  const bEstado = h('button', { class: 'btn btn-outline btn-sm', disabled: !docsEstado.length }, icono('search'), 'Extraer del estado de cuenta');
  bEstado.onclick = () => conBoton(bEstado, async () => {
    msg.replaceChildren();
    try {
      const { doc, resultado: r } = await extraerDe(docsEstado, selEstado, 'estado');
      if (r.ingresoMensualEstimado != null) ingreso.querySelector('input').value = Math.round(r.ingresoMensualEstimado).toLocaleString('es-MX');
      if (r.deudaMensualEstimada != null) deuda.querySelector('input').value = Math.round(r.deudaMensualEstimada).toLocaleString('es-MX');
      extraido = { ...extraido, estadoCuenta: { ...r, docId: doc.id, extraidoEn: new Date().toISOString() } };
      evidenciaEstado.replaceChildren(h('p', { class: 'small muted', style: 'margin:6px 0 2px' }, `De: ${doc.nombre_archivo} (${r.mesesDetectados} mes(es) detectados)`), ...r.evidencia.map((ev) => h('div', { class: 'small', style: 'color:var(--muted)' }, '• ', ev)));
      toast('Datos del estado de cuenta extraídos. Revísalos antes de confirmar.', 'ok');
    } catch (e) { msg.replaceChildren(banner('bad', 'No se pudo leer el estado de cuenta: ' + api.mensajeError(e))); }
  });

  const bGuardar = h('button', { class: 'btn btn-primary', type: 'submit' }, icono('check'), 'Confirmar análisis');
  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); conBoton(bGuardar, async () => {
    msg.replaceChildren();
    try {
      await api.guardarAnalisisFinanciero({
        expedienteId: exp.id, extraido,
        ingresoMensual: aNumero(ingreso.querySelector('input').value),
        deudaMensual: aNumero(deuda.querySelector('input').value) || 0,
        scoreBuro: score.value ? Number(score.value) : null,
        bandaRiesgo: banda.value || null,
        numCreditosActivos: numCred.value ? Number(numCred.value) : null,
        montoCreditosActivos: aNumero(montoCred.querySelector('input').value),
        tieneAtrasos: atrasos.checked,
      });
      toast('Análisis confirmado. Ya puedes compararlo contra los bancos.', 'ok');
      d.recargar();
    } catch (er) { msg.replaceChildren(banner('bad', api.mensajeError(er))); }
  }); } },
    msg,
    h('div', { class: 'cols cols-2' },
      hoja('1 · Reporte de Buró de Crédito', h('div', { class: 'stack' },
        selBuro ? campoForm('af_selburo', 'Documento a leer', selBuro) : null,
        h('div', null, bBuro), evidenciaBuro,
        campoForm('af_score', 'Score de Buró', score, '300–850'),
        campoForm('af_banda', 'Banda de riesgo (sugerida, editable)', banda, 'Es una heurística de negocio, no una calificación oficial del banco — confírmala o cámbiala.'),
        campoForm('af_nc', 'Créditos activos detectados', numCred),
        campoForm('af_mc', 'Saldo total de esos créditos', montoCred),
        h('label', { class: 'check' }, atrasos, h('span', null, 'Historial con atrasos / cartera vencida')))),
      hoja('2 · Estado de cuenta bancario', h('div', { class: 'stack' },
        selEstado ? campoForm('af_selestado', 'Documento a leer', selEstado) : null,
        h('div', null, bEstado), evidenciaEstado,
        campoForm('af_ing', 'Ingreso mensual estimado', ingreso, 'Promedio de depósitos de nómina detectados.'),
        campoForm('af_deu', 'Pago mensual de deudas existentes', deuda, 'Domiciliaciones y pagos recurrentes detectados.')))),
    h('div', { style: 'height:6px' }),
    previo?.confirmado_en ? h('p', { class: 'small muted' }, `Última confirmación: ${fechaHora(previo.confirmado_en)}`) : null,
    h('div', { class: 'row' }, bGuardar, previo ? h('a', { class: 'btn btn-outline', href: `#/expediente/${exp.id}/simulador` }, icono('calc'), 'Ir al comparador con estos datos') : null));

  return h('div', { class: 'stack' },
    banner('warn', h('p', null, h('strong', null, 'Extracción automática, no una decisión automática. '), 'Los valores de arriba son un punto de partida leído de los PDF con reglas de texto; siempre revísalos contra el documento original antes de confirmar. El cliente nunca ve esta pantalla ni sus datos crudos.')),
    hoja(null, form, { plana: true }));
}
