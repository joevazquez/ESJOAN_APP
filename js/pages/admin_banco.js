// Editor de banco: datos generales, parámetros de cálculo y grid de tasas (con importar/exportar Excel)
import * as api from '../lib/api.js';
import { h, icono, banner, toast, modal, confirmar, aNumero, debounce, descargarBlob, conBoton } from '../lib/ui.js';
import { TIPOS } from '../lib/constantes.js';
import { PROGRAMAS } from '../lib/simulador.js';
import { cabecera, hoja, campoForm, dinero } from '../lib/comun.js';

const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const aPct = (v) => (v === null || v === undefined || v === '' ? '' : String(Number((Number(v) * 100).toPrecision(8))));
const dePct = (s) => { const n = aNumero(s); return n === null ? null : n / 100; };

// ---- columnas del grid de tasas (tipo → cómo se muestra, redondeo en BD) ----------------------------------------
const DESTINOS = ['*', ...Object.keys(TIPOS)];
const PROGS = ['*', ...Object.keys(PROGRAMAS)];
const COLS = [
  { k: 'activo', l: 'Activa', t: 'bool' },
  { k: 'producto', l: 'Producto', t: 'text', w: 150 },
  { k: 'destino', l: 'Destino', t: 'sel', o: DESTINOS },
  { k: 'programa', l: 'Programa', t: 'sel', o: PROGS },
  { k: 'esquema', l: 'Esquema', t: 'sel', o: ['fijo', 'creciente'] },
  { k: 'perfil', l: 'Perfil / condición', t: 'text', w: 190 },
  { k: 'tasa', l: 'Tasa %', t: 'pct', d: 5, req: true },
  { k: 'plazo_min', l: 'Plazo mín.', t: 'int' }, { k: 'plazo_max', l: 'Plazo máx.', t: 'int' },
  { k: 'aforo_min', l: 'Aforo mín. %', t: 'pct', d: 4 }, { k: 'aforo_max', l: 'Aforo máx. %', t: 'pct', d: 4 },
  { k: 'comision_apertura', l: 'Apertura %', t: 'pct', d: 5, nul: true }, { k: 'pti', l: 'PTI %', t: 'pct', d: 3, nul: true },
  { k: 'incremento_anual', l: 'Incr. anual %', t: 'pct', d: 5 }, { k: 'incremento_anios', l: 'Años incr.', t: 'int' },
  { k: 'monto_min', l: 'Monto mín.', t: 'num', nul: true }, { k: 'monto_max', l: 'Monto máx.', t: 'num', nul: true },
  { k: 'notas', l: 'Notas', t: 'text', w: 180 },
];
const VACIA = () => ({ activo: true, producto: '', destino: '*', programa: '*', esquema: 'fijo', perfil: '', tasa: null, plazo_min: 5, plazo_max: 20, aforo_min: 0, aforo_max: 0.9, comision_apertura: null, pti: null, incremento_anual: 0, incremento_anios: 0, monto_min: null, monto_max: null, notas: '' });

function validar(filas) {
  const e = [];
  filas.forEach((f, i) => {
    const n = `Fila ${i + 1}`;
    if (!(f.tasa > 0 && f.tasa < 1)) e.push(`${n}: la tasa debe estar entre 0 % y 100 %.`);
    else if (f.tasa < 0.03 || f.tasa > 0.3) e.push(`${n}: la tasa ${(f.tasa * 100).toFixed(2)} % es inusual; revisa que no esté en la escala equivocada.`);
    if (!Number.isInteger(f.plazo_min) || !Number.isInteger(f.plazo_max) || f.plazo_min < 1 || f.plazo_max > 40 || f.plazo_min > f.plazo_max) e.push(`${n}: plazos inválidos (1–40 años, mínimo ≤ máximo).`);
    if (f.aforo_min < 0 || f.aforo_max > 1 || f.aforo_min > f.aforo_max) e.push(`${n}: aforo inválido (0–100 %, mínimo ≤ máximo).`);
    if (f.comision_apertura != null && (f.comision_apertura < 0 || f.comision_apertura > 0.2)) e.push(`${n}: la comisión por apertura debe estar entre 0 % y 20 %.`);
    if (f.pti != null && (f.pti < 0.05 || f.pti > 1)) e.push(`${n}: el PTI debe estar entre 5 % y 100 %.`);
    if (f.incremento_anual < 0 || f.incremento_anual > 0.2) e.push(`${n}: el incremento anual debe estar entre 0 % y 20 %.`);
    if (f.esquema === 'creciente' && !(f.incremento_anual > 0)) e.push(`${n}: un esquema creciente necesita incremento anual mayor a 0.`);
  });
  return e;
}
const aBD = (f) => ({ producto: f.producto?.trim() || null, destino: f.destino || '*', programa: f.programa || '*', esquema: f.esquema || 'fijo', perfil: f.perfil?.trim() || null,
  tasa: r(f.tasa, 5), plazo_min: f.plazo_min, plazo_max: f.plazo_max, aforo_min: r(f.aforo_min ?? 0, 4), aforo_max: r(f.aforo_max ?? 1, 4),
  monto_min: f.monto_min ?? null, monto_max: f.monto_max ?? null, comision_apertura: f.comision_apertura == null ? null : r(f.comision_apertura, 5), pti: f.pti == null ? null : r(f.pti, 3),
  incremento_anual: r(f.incremento_anual || 0, 5), incremento_anios: f.incremento_anios || 0, activo: f.activo !== false, notas: f.notas?.trim() || null });

// ---- importar / exportar --------------------------------------------------------------------------------------------------------------------
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const ALIAS = { producto: 'producto', destino: 'destino', programa: 'programa', esquema: 'esquema', perfil: 'perfil', perfilcondicion: 'perfil', tasa: 'tasa', tasaanual: 'tasa',
  plazomin: 'plazo_min', plazominimo: 'plazo_min', plazomax: 'plazo_max', plazomaximo: 'plazo_max', aforomin: 'aforo_min', aforominimo: 'aforo_min', aforomax: 'aforo_max', aforomaximo: 'aforo_max', aforo: 'aforo_max',
  comisionapertura: 'comision_apertura', apertura: 'comision_apertura', pti: 'pti', capacidaddepago: 'pti', incrementoanual: 'incremento_anual', incremento: 'incremento_anual',
  incrementoanios: 'incremento_anios', aniosincremento: 'incremento_anios', incranual: 'incremento_anual', aniosincr: 'incremento_anios', incrementoanualpct: 'incremento_anual', montomin: 'monto_min', montominimo: 'monto_min', montomax: 'monto_max', montomaximo: 'monto_max', activo: 'activo', activa: 'activo', notas: 'notas' };
const LIMPIAR = { tasa: 1, aforo_min: 1, aforo_max: 1, pti: 1 }; // > 1 → viene en puntos porcentuales
const PEQ = { comision_apertura: 1, incremento_anual: 1 };      // ≥ 0.2 → viene en puntos porcentuales

function filasDesdeMatriz(m) {
  const cab = (m[0] || []).map((c) => ALIAS[norm(c)] || null);
  if (!cab.includes('tasa')) throw new Error('No encontré la columna "tasa" en la primera fila. Usa la plantilla (Descargar Excel).');
  const out = [];
  for (const fila of m.slice(1)) {
    if (!fila || fila.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const f = VACIA();
    cab.forEach((k, i) => {
      if (!k) return;
      const col = COLS.find((c) => c.k === k); const v = fila[i];
      if (v === null || v === undefined || String(v).trim() === '') { if (col.nul) f[k] = null; return; }
      if (col.t === 'bool') f[k] = !/^(no|false|0|n|inactiv)/i.test(String(v).trim());
      else if (col.t === 'text') f[k] = String(v).trim();
      else if (col.t === 'sel') f[k] = col.o.find((o) => norm(o) === norm(v)) || String(v).trim().toLowerCase().replace(/\s+/g, '_');
      else {
        let n = typeof v === 'number' ? v : aNumero(String(v).replace('%', ''));
        if (n === null) return;
        if (k in LIMPIAR && n > 1) n /= 100;
        if (k in PEQ && n >= 0.2) n /= 100;
        f[k] = col.t === 'int' ? Math.round(n) : n;
      }
    });
    out.push(f);
  }
  return out;
}
/**
 * Convierte lo que devuelve la Edge Function `importar-tasas-banco` (Claude
 * leyendo el Excel propio del banco) al mismo shape de fila que usa la
 * cuadrícula de edición, por si algún tipo vino como texto o algún valor no
 * encaja en las listas conocidas.
 */
function filasDesdeIA(brutas) {
  return (brutas || []).map((r) => {
    const f = { ...VACIA(), ...r };
    for (const c of COLS) if ((c.t === 'pct' || c.t === 'num') && f[c.k] != null) f[c.k] = Number(f[c.k]);
    if (f.plazo_min != null) f.plazo_min = Math.round(Number(f.plazo_min));
    if (f.plazo_max != null) f.plazo_max = Math.round(Number(f.plazo_max));
    if (f.incremento_anios != null) f.incremento_anios = Math.round(Number(f.incremento_anios)) || 0;
    if (!DESTINOS.includes(f.destino)) f.destino = '*';
    if (!PROGS.includes(f.programa)) f.programa = '*';
    if (f.esquema !== 'fijo' && f.esquema !== 'creciente') f.esquema = 'fijo';
    f.incremento_anual = f.incremento_anual || 0;
    f.activo = f.activo !== false;
    return f;
  });
}
function parseDelim(texto) {
  const primera = texto.split(/\r?\n/, 1)[0];
  const sep = [['\t', primera.split('\t').length], [';', primera.split(';').length], [',', primera.split(',').length]].sort((a, b) => b[1] - a[1])[0][0];
  const filas = []; let fila = []; let cel = ''; let q = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (q) { if (c === '"' && texto[i + 1] === '"') { cel += '"'; i++; } else if (c === '"') q = false; else cel += c; }
    else if (c === '"') q = true;
    else if (c === sep) { fila.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; fila.push(cel); filas.push(fila); fila = []; cel = ''; }
    else cel += c;
  }
  if (cel !== '' || fila.length) { fila.push(cel); filas.push(fila); }
  return filas;
}
const cargarScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[data-lib="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.dataset.lib = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar la librería de Excel.')); document.head.append(s);
});
async function leerArchivo(file) {
  if (/\.xlsx$/i.test(file.name)) {
    await cargarScript('js/vendor/read-excel-file.min.js');
    let res = await window.readXlsxFile(file);
    if (res && !Array.isArray(res) && res.rows) res = res.rows;
    if (Array.isArray(res) && res[0] && !Array.isArray(res[0]) && res[0].data) res = res[0].data;
    return res;
  }
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return parseDelim(await file.text());
  throw new Error('Formato no soportado. Usa .xlsx o .csv.');
}
function matrizExport(filas) {
  const cab = COLS.map((c) => c.k);
  const cuerpo = filas.map((f) => COLS.map((c) => {
    const v = f[c.k]; if (v === null || v === undefined) return null;
    if (c.t === 'pct') return Number((v * 100).toPrecision(8)); if (c.t === 'bool') return v ? 'sí' : 'no'; return v;
  }));
  return [cab, ...cuerpo];
}
async function descargarExcel(filas, nombre) {
  const m = matrizExport(filas);
  try {
    await cargarScript('js/vendor/write-excel-file.min.js');
    const datos = m.map((fila, i) => fila.map((v) => (i === 0 ? { value: String(v), fontWeight: 'bold' } : { value: v === null ? '' : v, type: typeof v === 'number' ? Number : String })));
    const blob = await window.writeXlsxFile(datos).toBlob(); // API 3.x: devuelve { toBlob(), toFile() }
    descargarBlob(blob, `${nombre}.xlsx`);
  } catch (e) { // respaldo: CSV
    console.warn(e);
    const csv = m.map((f) => f.map((v) => { const s = v === null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
    descargarBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`);
  }
}

// ==================================================================================================
export default async function bancoEditor(ctx) {
  const bancos = await api.bancosConTasas();
  const b = bancos.find((x) => x.clave === ctx.params.clave);
  if (!b) throw Object.assign(new Error('Banco no encontrado.'), { noEncontrada: true });
  const P = b.parametros || {};

  // ---------------- 1) datos generales ----------------------------------------------------------------------------------------------------
  const nombre = h('input', { class: 'input', value: b.nombre, maxlength: 60 });
  const color = h('input', { class: 'input', type: 'color', value: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#292E54', style: 'padding:3px;height:42px' });
  const activo = h('input', { type: 'checkbox', checked: b.activo }); const verificado = h('input', { type: 'checkbox', checked: b.verificado });
  const vigencia = h('input', { class: 'input', type: 'date', value: b.vigencia || '' });
  const fuente = h('input', { class: 'input', value: b.fuente || '', maxlength: 200 });
  const notas = h('textarea', { class: 'input', maxlength: 1500 }, b.notas || '');
  const bGen = h('button', { class: 'btn btn-primary', onclick: () => conBoton(bGen, async () => {
    if (!nombre.value.trim()) return toast('El nombre es obligatorio.', 'error');
    try { await api.actualizarBanco(b.id, { nombre: nombre.value.trim(), color: color.value, activo: activo.checked, verificado: verificado.checked, vigencia: vigencia.value || null, fuente: fuente.value.trim() || null, notas: notas.value.trim() || null }); toast('Datos del banco guardados.', 'ok'); }
    catch (e) { toast(api.mensajeError(e), 'error'); }
  }) }, 'Guardar datos');
  const general = hoja('Datos generales', h('div', null, h('div', { class: 'form-grid' },
    campoForm('b_n', 'Nombre', nombre), campoForm('b_c', 'Color de marca', color),
    campoForm('b_v', 'Tarifas vigentes al', vigencia), campoForm('b_f', 'Fuente', fuente, 'Archivo o documento de donde salieron las tarifas.'),
    campoForm('b_no', 'Notas internas', notas, 'Supuestos y limitaciones de la calibración.', 'full')),
    h('div', { class: 'row', style: 'margin-bottom:16px' },
      h('label', { class: 'check' }, activo, h('span', null, h('strong', null, 'Activo'), ' (entra a los comparativos)')),
      h('label', { class: 'check' }, verificado, h('span', null, h('strong', null, 'Verificado'), ' (ya lo contrasté con el simulador oficial)'))), bGen));

  // ---------------- 2) parámetros de cálculo ---------------------------------------------------------------------------------------------------
  const campos = {}; // k → { get(), set() }
  const num = (k, l, ayuda, opts = {}) => { const el = opts.dinero ? dinero('p_' + k, P[k] ?? '') : h('input', { class: 'input', id: 'p_' + k, inputmode: 'decimal', value: opts.pct ? aPct(P[k]) : (P[k] ?? '') });
    campos[k] = { el: opts.dinero ? el.querySelector('input') : el, pct: !!opts.pct, nul: !!opts.nul }; return campoForm('p_' + k, l, el, ayuda); };
  const sel = (k, l, opciones, ayuda) => { const el = h('select', { class: 'input' }, opciones.map(([v, t]) => h('option', { value: v, selected: String(P[k]) === v }, t))); campos[k] = { el, texto: true }; return campoForm('p_' + k, l, el, ayuda); };
  const bool = (k, t) => { const el = h('input', { type: 'checkbox', checked: !!P[k] }); campos[k] = { el, bool: true }; return h('label', { class: 'check', style: 'margin-bottom:16px' }, el, h('span', null, t)); };
  const AF = P.aforo_max || {};
  const afo = {};
  const aforoCampo = (k, l) => { const el = h('input', { class: 'input', id: 'af_' + k, inputmode: 'decimal', value: aPct(AF[k] ?? AF.default ?? 0.9) }); afo[k] = el; return campoForm('af_' + k, l, el); };
  const AV = P.avaluo || { tipo: 'fijo', monto: 0 };
  const avTipo = h('select', { class: 'input' }, [['fijo', 'Monto fijo'], ['pct', '% del valor del inmueble'], ['tabla', 'Tabla por tramos de valor']].map(([v, t]) => h('option', { value: v, selected: AV.tipo === v }, t)));
  const avMonto = dinero('av_monto', AV.monto ?? ''); const avPct = h('input', { class: 'input', id: 'av_pct', inputmode: 'decimal', value: aPct(AV.pct ?? 0) });
  let tramos = (AV.tramos || []).map((t) => ({ ...t }));
  const tramosNodo = h('div');
  const pintarTramos = () => tramosNodo.replaceChildren(h('table', { class: 'tabla' }, h('thead', null, h('tr', null, h('th', null, 'Valor hasta ($)'), h('th', null, 'Costo del avalúo ($)'), h('th', null))),
    h('tbody', null, tramos.map((t, i) => h('tr', null,
      h('td', null, h('input', { class: 'input', inputmode: 'decimal', value: t.hasta ?? '', 'aria-label': `Tramo ${i + 1} hasta`, oninput: (e) => { t.hasta = aNumero(e.target.value); } })),
      h('td', null, h('input', { class: 'input', inputmode: 'decimal', value: t.monto ?? '', 'aria-label': `Tramo ${i + 1} costo`, oninput: (e) => { t.monto = aNumero(e.target.value); } })),
      h('td', null, h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Quitar tramo', onclick: () => { tramos.splice(i, 1); pintarTramos(); } }, icono('basura')))))),
    ), h('button', { class: 'btn btn-outline btn-sm', style: 'margin-top:10px', onclick: () => { tramos.push({ hasta: null, monto: null }); pintarTramos(); } }, icono('mas'), 'Agregar tramo'));
  pintarTramos();
  const zonaAv = h('div', { class: 'stack' });
  const actAv = () => zonaAv.replaceChildren(avTipo.value === 'fijo' ? campoForm('av_monto', 'Costo del avalúo ($)', avMonto) : avTipo.value === 'pct' ? campoForm('av_pct', 'Porcentaje del valor (%)', avPct) : tramosNodo);
  avTipo.addEventListener('change', actAv); actAv();

  const bPar = h('button', { class: 'btn btn-primary', onclick: () => conBoton(bPar, async () => {
    const nuevo = { ...P }; const err = [];
    for (const [k, c] of Object.entries(campos)) {
      if (c.bool) nuevo[k] = c.el.checked;
      else if (c.texto) nuevo[k] = c.el.value;
      else { const v = c.pct ? dePct(c.el.value) : aNumero(c.el.value); if (v === null && !c.nul) { nuevo[k] = 0; } else nuevo[k] = v; }
    }
    nuevo.aforo_max = { ...(P.aforo_max || {}) };
    for (const [k, el] of Object.entries(afo)) { const v = dePct(el.value); if (v === null || v <= 0 || v > 1) err.push(`Aforo máximo "${k}" inválido (1–100 %).`); else nuevo.aforo_max[k] = v; }
    if (nuevo.iva < 0 || nuevo.iva > 0.3) err.push('El IVA debe estar entre 0 % y 30 %.');
    if (nuevo.vida_pct > 0.01 || nuevo.danos_pct > 0.01 || nuevo.seguro_otros_pct > 0.01) err.push('Los seguros son % MENSUALES (p. ej. 0.06 %); un valor mayor a 1 % parece un error de escala.');
    if (nuevo.apertura_pct < 0 || nuevo.apertura_pct > 0.2) err.push('La comisión por apertura debe estar entre 0 % y 20 %.');
    if (nuevo.pti != null && (nuevo.pti < 0.05 || nuevo.pti > 1)) err.push('El PTI debe estar entre 5 % y 100 %.');
    if (!(nuevo.plazo_min >= 1 && nuevo.plazo_max <= 40 && nuevo.plazo_min <= nuevo.plazo_max)) err.push('Plazos inválidos (1–40, mínimo ≤ máximo).');
    if (avTipo.value === 'fijo') nuevo.avaluo = { tipo: 'fijo', monto: aNumero(avMonto.querySelector('input').value) || 0 };
    else if (avTipo.value === 'pct') nuevo.avaluo = { tipo: 'pct', pct: dePct(avPct.value) || 0 };
    else { const t = tramos.filter((x) => x.hasta > 0 && x.monto >= 0).sort((a, c) => a.hasta - c.hasta); if (!t.length) err.push('Agrega al menos un tramo de avalúo.'); nuevo.avaluo = { tipo: 'tabla', tramos: t }; }
    if (err.length) return toast(err[0], 'error', 7000);
    try { await api.actualizarBanco(b.id, { parametros: nuevo }); Object.assign(P, nuevo); toast('Parámetros guardados.', 'ok'); } catch (e) { toast(api.mensajeError(e), 'error'); }
  }) }, 'Guardar parámetros');
  const parametros = hoja('Parámetros de cálculo', h('div', null,
    banner('info', 'Los porcentajes se capturan como los ves en el Excel del banco (por ejemplo 0.06 para 0.06 %). Los seguros son porcentajes MENSUALES.'),
    h('div', { class: 'cols cols-3' },
      h('div', null, h('h4', { style: 'margin-bottom:12px' }, 'Comisiones y gastos'), num('apertura_pct', 'Comisión por apertura (%)', 'Se puede sobrescribir por fila de tarifa.', { pct: true }), bool('apertura_financiable', 'La apertura se financia (se suma al crédito)'),
        num('admin_mensual', 'Administración mensual ($)', null, { dinero: true }), bool('admin_iva', 'La administración causa IVA'), num('investigacion', 'Investigación / estudio ($)', null, { dinero: true }), num('otros_gastos_iniciales', 'Otros gastos iniciales ($)', 'Por ejemplo trámite CUV.', { dinero: true }), num('iva', 'IVA (%)', null, { pct: true })),
      h('div', null, h('h4', { style: 'margin-bottom:12px' }, 'Seguros y cálculo'), num('vida_pct', 'Seguro de vida (% mensual sobre saldo)', null, { pct: true }), num('danos_pct', 'Seguro de daños (% mensual)', null, { pct: true }),
        sel('danos_base', 'Base del seguro de daños', [['destructible', 'Parte destructible del valor'], ['valor', 'Valor total del inmueble']]), num('destructible_pct', '% destructible del valor', null, { pct: true }),
        num('seguro_otros_pct', 'Otros seguros (% mensual sobre saldo)', 'Desempleo, contenidos, etc.', { pct: true }), sel('base_dias', 'Base de días para intereses', [['30/360', '30/360 (tasa ÷ 12)'], ['30.4/360', '30.4/360 (Banorte)']])),
      h('div', null, h('h4', { style: 'margin-bottom:12px' }, 'Límites'), num('pti', 'Capacidad de pago (PTI %)', 'Vacío = sin validación de ingreso.', { pct: true, nul: true }), sel('pti_base', 'El PTI se mide sobre', [['total', 'Mensualidad total'], ['pago', 'Solo capital + intereses']]),
        num('plazo_min', 'Plazo mínimo (años)'), num('plazo_max', 'Plazo máximo (años)'), num('monto_min', 'Monto mínimo ($)', null, { dinero: true, nul: true }), num('monto_max', 'Monto máximo ($)', null, { dinero: true, nul: true }))),
    h('h4', { style: 'margin:6px 0 12px' }, 'Aforo máximo por programa (%)'),
    h('div', { class: 'form-grid' }, aforoCampo('tradicional', 'Tradicional'), aforoCampo('cofinavit', 'Cofinavit'), aforoCampo('apoyo_infonavit', 'Apoyo Infonavit'), aforoCampo('default', 'Otros (por defecto)')),
    h('h4', { style: 'margin:6px 0 12px' }, 'Avalúo'), campoForm('av_tipo', 'Cómo cobra el avalúo', avTipo), zonaAv, h('div', { style: 'height:8px' }), bPar));

  // ---------------- 3) tarifas ------------------------------------------------------------------------------------------------------------------------------------
  let filas = b.tasas.map((t) => ({ ...VACIA(), ...Object.fromEntries(COLS.map((c) => [c.k, t[c.k] ?? (c.t === 'text' ? '' : null)])) }));
  for (const f of filas) for (const c of COLS) if (c.t === 'pct' || c.t === 'num') f[c.k] = f[c.k] === null ? null : Number(f[c.k]);
  let filtro = ''; let limite = 40; let sucio = false;
  const cuerpo = h('tbody'); const info = h('span', { class: 'muted small' }); const masBtn = h('button', { class: 'btn btn-outline btn-sm', onclick: () => { limite += 60; pintar(); } }, 'Mostrar más filas');
  const avisos = h('div');
  const marcar = () => { sucio = true; bGuardar.textContent = `Guardar tarifas (${filas.length} filas) · cambios sin guardar`; };
  const celda = (f, c) => {
    if (c.t === 'bool') return h('input', { type: 'checkbox', checked: f[c.k] !== false, 'aria-label': c.l, onchange: (e) => { f[c.k] = e.target.checked; marcar(); } });
    if (c.t === 'sel') { const ops = c.o.includes(f[c.k]) ? c.o : [f[c.k], ...c.o]; return h('select', { class: 'input', 'aria-label': c.l, onchange: (e) => { f[c.k] = e.target.value; marcar(); } }, ops.map((o) => h('option', { value: o, selected: o === f[c.k] }, o === '*' ? '* (todos)' : o))); }
    const val = c.t === 'pct' ? aPct(f[c.k]) : (f[c.k] ?? '');
    return h('input', { class: 'input', style: `min-width:${c.w || 78}px`, inputmode: c.t === 'text' ? 'text' : 'decimal', value: val, 'aria-label': c.l,
      oninput: (e) => { const s = e.target.value; if (c.t === 'text') f[c.k] = s; else if (c.t === 'pct') f[c.k] = s.trim() === '' ? null : dePct(s); else if (c.t === 'int') f[c.k] = s.trim() === '' ? null : Math.round(aNumero(s)); else f[c.k] = s.trim() === '' ? null : aNumero(s); marcar(); } });
  };
  function pintar() {
    const q = filtro.toLowerCase();
    const vis = filas.map((f, i) => ({ f, i })).filter(({ f }) => !q || [f.producto, f.perfil, f.programa, f.destino, f.esquema, f.plazo_min, f.plazo_max].join(' ').toLowerCase().includes(q));
    cuerpo.replaceChildren(...vis.slice(0, limite).map(({ f, i }) => h('tr', null, h('td', { class: 'num muted' }, String(i + 1)), COLS.map((c) => h('td', null, celda(f, c))),
      h('td', { class: 'nowrap' }, h('button', { class: 'btn btn-ghost btn-sm', title: 'Duplicar fila', 'aria-label': 'Duplicar fila', onclick: () => { filas.splice(i + 1, 0, { ...f }); marcar(); pintar(); } }, icono('mas')),
        h('button', { class: 'btn btn-ghost btn-sm', title: 'Eliminar fila', 'aria-label': 'Eliminar fila', onclick: () => { filas.splice(i, 1); marcar(); pintar(); } }, icono('basura'))))));
    if (!vis.length) cuerpo.append(h('tr', null, h('td', { colspan: COLS.length + 2, class: 'muted', style: 'padding:24px;text-align:center' }, filas.length ? 'Ninguna fila coincide con el filtro.' : 'Este banco aún no tiene tarifas. Agrega una fila o importa un archivo.')));
    masBtn.hidden = vis.length <= limite;
    info.textContent = `${vis.length} de ${filas.length} filas${vis.length > limite ? ` · mostrando ${limite}` : ''}`;
  }
  const buscar = h('input', { class: 'input', type: 'search', placeholder: 'Filtrar filas (perfil, programa, plazo…)', 'aria-label': 'Filtrar tarifas', style: 'max-width:320px', oninput: debounce((e) => { filtro = e.target.value.trim(); limite = 40; pintar(); }) });

  async function aplicarImportadas(nuevas, origen) {
    if (!nuevas.length) return toast('El archivo no tiene filas de tarifas.', 'error');
    if (filas.length && !(await confirmar(`Se cargarán ${nuevas.length} filas de ${origen} y reemplazarán las ${filas.length} que ves en pantalla. Nada se guarda en la base hasta que pulses "Guardar tarifas". ¿Continuar?`, { titulo: 'Importar tarifas', si: 'Cargar en pantalla' }))) return;
    filas = nuevas; limite = 40; marcar(); pintar(); toast(`${nuevas.length} filas cargadas. Revísalas y pulsa "Guardar tarifas".`, 'ok', 7000);
  }
  const archivo = h('input', { type: 'file', accept: '.xlsx,.csv,.tsv,.txt', class: 'sr-only', id: 'imp_arch', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await aplicarImportadas(filasDesdeMatriz(await leerArchivo(f)), f.name); } catch (er) { toast(er.message || 'No se pudo leer el archivo.', 'error', 8000); }
  } });
  const archivoIA = h('input', { type: 'file', accept: '.xlsx,.xlsm,.xls', class: 'sr-only', id: 'imp_arch_ia', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    avisos.replaceChildren();
    const quitar = toast('Leyendo el archivo del banco con IA… puede tardar hasta medio minuto.', 'info', 30000);
    try {
      const res = await api.importarTasasBancoIA(f);
      quitar?.();
      const nuevas = filasDesdeIA(res.filas);
      if (res.avisos?.length) avisos.replaceChildren(banner('warn', h('p', null, h('strong', null, 'Notas de la IA sobre esta lectura: ')), res.avisos.map((a) => h('div', { class: 'small', style: 'color:var(--muted)' }, '• ', a))));
      await aplicarImportadas(nuevas, `${f.name} (leído con IA)`);
    } catch (er) { quitar?.(); toast(er.message || 'No se pudo leer el archivo con IA.', 'error', 9000); }
  } });
  const pegar = () => {
    const ta = h('textarea', { class: 'input', style: 'min-height:220px;font-family:ui-monospace,monospace;font-size:.82rem', placeholder: 'Copia desde Excel (incluye la fila de encabezados) y pega aquí…', 'aria-label': 'Datos pegados' });
    modal({ titulo: 'Pegar tarifas desde Excel', ancho: true, cuerpo: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'La primera fila debe tener los encabezados de la plantilla (producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max…). Tasas y aforos van en puntos porcentuales: 10.25 significa 10.25 %.'), ta),
      acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() }, { texto: 'Cargar en pantalla', clase: 'btn-primary', onclick: async (c) => { try { const f = filasDesdeMatriz(parseDelim(ta.value)); c(); await aplicarImportadas(f, 'los datos pegados'); } catch (er) { toast(er.message, 'error', 8000); } } }] });
  };

  const bGuardar = h('button', { class: 'btn btn-primary', onclick: () => conBoton(bGuardar, async () => {
    avisos.replaceChildren();
    const err = validar(filas);
    const graves = err.filter((x) => !/inusual/.test(x));
    if (graves.length) { avisos.replaceChildren(banner('bad', graves.slice(0, 8).map((x) => h('p', null, x)), graves.length > 8 ? h('p', null, `…y ${graves.length - 8} más.`) : null)); return; }
    if (err.length && !(await confirmar(`Hay ${err.length} advertencia(s), por ejemplo: ${err[0]} ¿Guardar de todos modos?`, { titulo: 'Revisar tarifas', si: 'Guardar de todos modos' }))) return;
    try { const n = await api.reemplazarTasas(b.id, filas.map(aBD)); sucio = false; bGuardar.textContent = `Guardar tarifas (${filas.length} filas)`; toast(`${n} tarifas guardadas.`, 'ok'); }
    catch (e) { avisos.replaceChildren(banner('bad', api.mensajeError(e))); }
  }) }, `Guardar tarifas (${filas.length} filas)`);

  const tarifas = hoja('Tarifas (tasas por producto y perfil)', h('div', { class: 'stack' },
    banner('info', h('p', null, h('strong', null, 'Actualizar tasas es así de fácil: '), 'edita una celda, o baja la plantilla en Excel, cambia las tasas y súbela. Se reemplaza todo el bloque en una sola operación y queda en la auditoría.')),
    avisos,
    h('div', { class: 'row' }, buscar, h('span', { class: 'grow' }), info),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-outline btn-sm', onclick: () => { filas.push(VACIA()); limite = filas.length; filtro = ''; buscar.value = ''; marcar(); pintar(); } }, icono('mas'), 'Agregar fila'),
      h('label', { class: 'btn btn-outline btn-sm', for: 'imp_arch', tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter') archivo.click(); } }, icono('subir'), 'Importar Excel / CSV'), archivo,
      h('label', { class: 'btn btn-primary btn-sm', for: 'imp_arch_ia', tabindex: 0, title: 'Sube el simulador del banco tal cual te lo mandaron (xlsx/xlsm); la IA busca y extrae la tabla de tasas.', onkeydown: (e) => { if (e.key === 'Enter') archivoIA.click(); } }, icono('subir'), 'Importar con IA (archivo del banco)'), archivoIA,
      h('button', { class: 'btn btn-outline btn-sm', onclick: pegar }, icono('excel'), 'Pegar desde Excel'),
      h('button', { class: 'btn btn-outline btn-sm', onclick: () => descargarExcel(filas.length ? filas : [VACIA()], `tarifas_${b.clave}`) }, icono('descargar'), 'Descargar Excel'),
      h('span', { class: 'grow' }), bGuardar),
    h('div', { class: 'hoja', style: 'box-shadow:none' }, h('div', { class: 'scroll-x', style: 'max-height:560px;overflow:auto' }, h('table', { class: 'tabla' },
      h('thead', null, h('tr', null, h('th', null, '#'), COLS.map((c) => h('th', null, c.l)), h('th', null))), cuerpo))),
    h('div', null, masBtn)));
  pintar();

  return h('div', null,
    h('div', { class: 'crumbs' }, h('a', { href: '#/admin/bancos' }, '← Bancos y tarifas')),
    cabecera({ kicker: 'Administración', titulo: b.nombre, sub: b.notas ? b.notas : null, acciones: [h('span', { class: 'badge ' + (b.verificado ? 'ok' : 'warn') }, b.verificado ? 'Verificado' : 'Sin verificar'), h('span', { class: 'badge ' + (b.activo ? 'ok' : '') }, b.activo ? 'Activo' : 'Desactivado')] }),
    h('div', { class: 'stack' }, general, tarifas, parametros));
}