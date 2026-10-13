import { h } from './ui.js';
import { etiquetaEstatus, idxEstatus } from './constantes.js';

const CLASE_ESTATUS = { creado: '', en_revision_documentacion: 'warn', documentacion_completa: 'gold', en_avaluo: 'navy', en_proceso_firma: 'navy', firmado: 'ok' };
export const badgeEstatus = (clave) => h('span', { class: 'badge ' + (CLASE_ESTATUS[clave] || '') }, etiquetaEstatus(clave));

export function cabecera({ kicker, titulo, sub, acciones }) {
  return h('header', { class: 'page-head' },
    h('div', null, kicker ? h('div', { class: 'kicker' }, kicker) : null, h('h1', null, titulo), h('span', { class: 'rule' }), sub ? h('p', { class: 'muted', style: 'margin:12px 0 0' }, sub) : null),
    acciones ? h('div', { class: 'row' }, acciones) : null);
}
export function hoja(titulo, cuerpo, { acciones, plana = false, id } = {}) {
  return h('section', { class: 'hoja', id },
    titulo ? h('div', { class: 'hoja-head' }, h('h3', null, titulo), acciones ? h('div', { class: 'row' }, acciones) : null) : null,
    h('div', { class: 'hoja-body' + (plana ? ' flush' : '') }, cuerpo));
}
export function campoForm(id, etiqueta, control, ayuda, claseExtra = '') {
  const interno = control.classList && control.classList.contains('input-money') ? control.querySelector('input') : control;
  interno.id = id; if (!interno.name) interno.name = id;
  return h('div', { class: 'field ' + claseExtra }, h('label', { for: id }, etiqueta), control, ayuda ? h('span', { class: 'hint' }, ayuda) : null);
}
/** Campo de dinero: se ve como 3,800,000 al salir del campo; aNumero() lo interpreta sin importar las comas */
export const dinero = (id, valor = '', attrs = {}) => {
  const fmt = (v) => { const n = Number(String(v).replace(/[^0-9.\-]/g, '')); return v === '' || v === null || v === undefined || Number.isNaN(n) ? '' : n.toLocaleString('es-MX', { maximumFractionDigits: 2 }); };
  const inp = h('input', { class: 'input', id, name: id, inputmode: 'decimal', autocomplete: 'off', value: fmt(valor), ...attrs });
  inp.addEventListener('blur', () => { inp.value = fmt(inp.value); });
  return h('div', { class: 'input-money' }, inp);
};
export const progreso = (clave) => {
  const pctv = (idxEstatus(clave) / 5) * 100;
  const barra = h('span'); barra.style.width = pctv + '%';
  return h('div', { class: 'progress-line', role: 'progressbar', 'aria-valuenow': Math.round(pctv), 'aria-valuemin': 0, 'aria-valuemax': 100 }, barra);
};

/** Documentos exigibles para un tipo de expediente */
export function requeridos(tipos, tipoExp) {
  return tipos.filter((t) => t.activo && (!t.aplica_tipos || t.aplica_tipos.includes(tipoExp))).sort((a, b) => a.orden - b.orden);
}
/** {obligatorios, entregados, faltan:[tipos]} */
export function avanceDocs(tipos, docs, tipoExp) {
  const req = requeridos(tipos, tipoExp).filter((t) => t.obligatorio);
  const faltan = req.filter((t) => !docs.some((d) => d.tipo_clave === t.clave && d.estado !== 'rechazado'));
  return { obligatorios: req.length, entregados: req.length - faltan.length, faltan };
}
