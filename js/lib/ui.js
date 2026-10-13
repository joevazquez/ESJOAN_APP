// Utilidades de interfaz. IMPORTANTE (seguridad): nunca se usa innerHTML con datos;
// todo texto entra por textContent, así un dato malicioso jamás se ejecuta como HTML.
const SVGNS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v; // CSSOM: permitido por la CSP (setAttribute('style') no)
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'required' || k === 'multiple') { if (v) el[k] = true; }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  agregar(el, hijos);
  return el;
}
function agregar(el, hijos) {
  for (const c of hijos.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function limpiar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function montar(el, ...hijos) { limpiar(el); agregar(el, hijos); return el; }

// ---- Íconos (trazos sencillos, estilo lineal) --------------------------------
const ICONOS = {
  inicio: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  carpeta: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  usuarios: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.9M15.5 4.2a3.5 3.5 0 010 6.6',
  banco: 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  docs: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  perfil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  salir: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  mas: 'M12 5v14M5 12h14',
  subir: 'M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  descargar: 'M12 4v12m0 0l-4-4m4 4l4-4M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1',
  ojo: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  ojo_cerrado: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  reloj: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  alerta: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 16v-4m0-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  calc: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  nota: 'M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h4',
  basura: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6m4-6v6',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  llave: 'M14 10a4 4 0 11-3.5 6H8v-2H6v-2H4l6.5-6.5A4 4 0 0114 10zM16 8h.01',
  excel: 'M4 4h16v16H4zM4 9h16M4 14h16M10 4v16',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
};
export function icono(nombre, extra) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.9');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic' + (extra ? ' ' + extra : ''));
  const p = document.createElementNS(SVGNS, 'path');
  p.setAttribute('d', ICONOS[nombre] || ICONOS.info);
  s.append(p);
  return s;
}
export function svg(tag, attrs, ...hijos) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// ---- Formatos ------------------------------------------------------------------------
const fMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fMXN2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mxn = (n, dec = false) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : (dec ? fMXN2 : fMXN).format(Number(n)));
export const pct = (n, d = 2) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : (Number(n) * 100).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %');
export const numero = (n, d = 0) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }));
export function fecha(d) {
  if (!d) return '—';
  const x = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d);
  return x.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
}
export function fechaHora(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
}
export const folio = (n) => 'EJ-' + String(n).padStart(5, '0');
export function bytes(n) {
  if (!n) return '';
  return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}
/** Convierte "1,250,000.50" o "$1 250 000" en número */
export function aNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ---- Toasts, modales, confirmaciones -------------------------------------------------------
let contToasts;
export function toast(msg, tipo = 'info', ms = 4500) {
  if (!contToasts || !document.body.contains(contToasts)) {
    contToasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(contToasts);
  }
  while (contToasts.children.length >= 3) contToasts.firstChild.remove();
  const t = h('div', { class: 'toast ' + tipo }, msg);
  contToasts.append(t);
  setTimeout(() => t.remove(), ms);
}

export function modal({ titulo, cuerpo, acciones = [], ancho = false, alCerrar }) {
  const previo = document.activeElement;
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', onKey); if (previo && previo.focus) previo.focus(); if (alCerrar) alCerrar(); };
  const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
  const cab = h('div', { class: 'modal-head' }, h('h3', { id: 'modal-titulo' }, titulo), h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Cerrar', onclick: cerrar }, icono('x')));
  const pie = acciones.length ? h('div', { class: 'modal-foot' }, acciones.map((a) => a.nodo || h('button', { class: 'btn ' + (a.clase || ''), onclick: () => a.onclick(cerrar) }, a.texto))) : null;
  const caja = h('div', { class: 'modal' + (ancho ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-titulo' }, cab, h('div', { class: 'modal-body' }, cuerpo), pie);
  const fondo = h('div', { class: 'modal-fondo', onmousedown: (e) => { if (e.target === fondo) cerrar(); } }, caja);
  document.body.append(fondo);
  document.addEventListener('keydown', onKey);
  const foco = caja.querySelector('input,select,textarea') || caja.querySelector('.modal-foot .btn');
  if (foco) foco.focus();
  return { cerrar, caja };
}

export function confirmar(mensaje, { titulo = 'Confirmar', si = 'Aceptar', peligro = false } = {}) {
  return new Promise((res) => {
    let hecho = false;
    modal({
      titulo, cuerpo: h('p', null, mensaje),
      alCerrar: () => { if (!hecho) res(false); },
      acciones: [
        { texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => { hecho = true; c(); res(false); } },
        { texto: si, clase: peligro ? 'btn-danger' : 'btn-primary', onclick: (c) => { hecho = true; c(); res(true); } },
      ],
    });
  });
}

export function pedirTexto({ titulo, etiqueta, ayuda, requerido = true, multilinea = true, si = 'Guardar', valor = '' }) {
  return new Promise((res) => {
    let hecho = false;
    const campo = multilinea ? h('textarea', { class: 'input', id: 'pt', maxlength: 500 }, valor) : h('input', { class: 'input', id: 'pt', maxlength: 200, value: valor });
    modal({
      titulo,
      cuerpo: h('div', { class: 'field' }, h('label', { for: 'pt' }, etiqueta), campo, ayuda ? h('span', { class: 'hint' }, ayuda) : null),
      alCerrar: () => { if (!hecho) res(null); },
      acciones: [
        { texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => { hecho = true; c(); res(null); } },
        { texto: si, clase: 'btn-primary', onclick: (c) => {
          const v = campo.value.trim();
          if (requerido && !v) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); return; }
          hecho = true; c(); res(v);
        } },
      ],
    });
  });
}

/** Deshabilita un botón mientras corre una acción asíncrona */
export async function conBoton(btn, fn) {
  const texto = btn.cloneNode(true).childNodes;
  btn.disabled = true;
  const sp = h('span', { class: 'spinner', 'aria-hidden': 'true' });
  const previo = [...btn.childNodes];
  btn.prepend(sp);
  try { return await fn(); }
  finally { sp.remove(); btn.disabled = false; void texto; void previo; }
}

export function cargando(texto = 'Cargando…') {
  return h('div', { class: 'cargando' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', null, texto));
}
export function vacio(titulo, texto, accion) {
  return h('div', { class: 'vacio' }, icono('carpeta'), h('h3', null, titulo), h('p', null, texto), accion || null);
}
export function banner(tipo, ...contenido) {
  return h('div', { class: 'banner ' + tipo, role: tipo === 'bad' ? 'alert' : 'note' }, icono(tipo === 'ok' ? 'check' : tipo === 'info' ? 'info' : 'alerta'), h('div', null, contenido));
}
export function descargarBlob(blob, nombre) {
  const a = h('a', { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };