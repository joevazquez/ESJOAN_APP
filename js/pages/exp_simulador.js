import * as api from '../lib/api.js';
import { h, icono, banner, toast, modal, confirmar, mxn, pct, numero, aNumero, fecha, debounce, vacio } from '../lib/ui.js';
import { hoja, campoForm, dinero } from '../lib/comun.js';
import { PROGRAMAS, programaDeTipo, compararBancos, mejorPorBancoPlazo, topN, resumen } from '../lib/simulador.js';
import { GASTOS_NOTARIALES_DEFECTO } from '../config.js';

const PLAZOS = [5, 10, 15, 20, 25, 30];
const colorSeguro = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#292E54');
const franja = (c) => { const s = h('div', { class: 'franja' }); s.style.background = colorSeguro(c); return s; };

// ==================================================================================================
//  Detalle (sirve para el modal del broker y para la vista del cliente)
// ==================================================================================================
function fila(k, v, cls) { return h('tr', { class: cls || '' }, h('td', null, k), h('td', null, v)); }

export function contenidoDetalle(r, { conTabla = false } = {}) {
  const mensual = h('table', { class: 'desglose' }, h('tbody', null,
    fila(r.esquema === 'creciente' ? 'Capital + intereses (mes 1)' : 'Capital + intereses', mxn(r.pagoBase, true)),
    fila('Seguros (vida y daños)', mxn(r.segurosMensuales, true)),
    r.adminMensual ? fila('Comisión de administración', mxn(r.adminMensual, true)) : null,
    fila('Mensualidad inicial', mxn(r.mensualidadInicial, true), 'total'),
    r.esquema === 'creciente' ? fila(`Mensualidad al final del plazo`, mxn(r.mensualidadFinal, true)) : null));
  const inicial = h('table', { class: 'desglose' }, h('tbody', null,
    fila('Enganche', mxn(r.enganche)),
    r.gastosNotariales ? fila('Gastos notariales (est.)', mxn(r.gastosNotariales)) : null,
    r.apertura ? fila(`Comisión por apertura (${pct(r.aperturaPct)})${r.financiaApertura ? ' · financiada' : ''}`, r.financiaApertura ? 'Se suma al crédito' : mxn(r.apertura)) : null,
    fila('Avalúo', mxn(r.avaluo)),
    r.investigacion ? fila('Investigación / estudio', mxn(r.investigacion)) : null,
    r.otrosIniciales ? fila('Otros gastos iniciales', mxn(r.otrosIniciales)) : null,
    fila('Desembolso inicial', mxn(r.desembolsoInicial), 'total')));

  const comis = r.apertura + r.avaluo + r.investigacion + r.otrosIniciales;
  const segs = [
    ['Intereses', r.totalIntereses, '#292E54'], ['Seguros', r.totalSeguros, '#FFD21A'],
    ['Administración', r.totalAdmin, '#6B7099'], ['Comisiones y gastos', comis, '#E40C19'],
  ].filter((s) => s[1] > 0);
  const totalCosto = segs.reduce((a, s) => a + s[1], 0) || 1;
  const barra = h('div', { class: 'barra-costo', role: 'img', 'aria-label': 'Composición del costo del crédito' }, segs.map(([t, v, c]) => { const s = h('span', { title: `${t}: ${mxn(v)}` }); s.style.width = (v / totalCosto) * 100 + '%'; s.style.background = c; return s; }));
  const leyenda = h('div', { class: 'leyenda' }, segs.map(([t, v, c]) => { const i = h('i'); i.style.background = c; return h('span', null, i, `${t}: ${mxn(v)}`); }));

  const pti = r.pti ? (r.cumplePTI === null
    ? banner('info', `Ingreso mínimo requerido por el banco: ${mxn(r.ingresoMinimo)} al mes (${pct(r.pti, 1)} de capacidad de pago). Captura el ingreso del cliente para validar.`)
    : r.cumplePTI ? banner('ok', `El ingreso capturado cumple la capacidad de pago (mín. requerido ${mxn(r.ingresoMinimo)}).`)
      : banner('bad', `El ingreso capturado NO alcanza: se requieren al menos ${mxn(r.ingresoMinimo)} al mes.`)) : null;

  const tablaNodo = conTabla && r.tabla ? tablaAmort(r.tabla) : null;
  return h('div', { class: 'stack' },
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Mensualidad inicial'), h('div', { class: 'v big num' }, mxn(r.mensualidadInicial))),
      h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Tasa anual'), h('div', { class: 'v num' }, pct(r.tasa)), h('div', { class: 's' }, r.esquema === 'creciente' ? `Pagos crecientes ${pct(r.incrementoAnual, 2)} anual` : 'Pago fijo')),
      h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'CAT referencial'), h('div', { class: 'v num' }, r.cat ? pct(r.cat) : '—')),
      h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Plazo'), h('div', { class: 'v num' }, `${r.plazoAnios} años`), h('div', { class: 's' }, `Crédito de ${mxn(r.monto)} · Aforo ${pct(r.aforo, 1)}`))),
    pti,
    h('div', { class: 'cols cols-2' },
      h('div', null, h('h4', { style: 'margin-bottom:6px' }, 'Al firmar'), inicial),
      h('div', null, h('h4', { style: 'margin-bottom:6px' }, 'Cada mes'), mensual)),
    h('div', null, h('h4', null, `Costo total del crédito: ${mxn(r.costoTotalCredito)}`), barra, leyenda,
      h('p', { class: 'small muted', style: 'margin-top:8px' }, `En mensualidades pagarías ${mxn(r.totalPagado)} durante ${r.meses} meses (incluye capital, intereses, seguros y administración).`)),
    !r.verificado ? banner('warn', 'Las condiciones de este banco aún no están marcadas como verificadas por ESJOAN. Confirma tasa y comisiones contra el simulador oficial antes de presentarlas al cliente.') : null,
    h('p', { class: 'small muted' }, 'Cifras informativas y referenciales; el CAT oficial y las condiciones finales las determina cada institución al autorizar el crédito.', r.vigencia ? ` Tarifas vigentes al ${fecha(r.vigencia)}.` : ''),
    tablaNodo);
}
function tablaAmort(tabla) {
  let todas = false;
  const cuerpo = h('tbody'); const btn = h('button', { class: 'btn btn-outline btn-sm', onclick: () => { todas = !todas; pintar(); } });
  const pintar = () => {
    const filas = todas ? tabla : tabla.slice(0, 12);
    cuerpo.replaceChildren(...filas.map((f) => h('tr', null, h('td', null, f.mes), h('td', { class: 'right' }, mxn(f.saldo)), h('td', { class: 'right' }, mxn(f.interes)), h('td', { class: 'right' }, mxn(f.amort)),
      h('td', { class: 'right' }, mxn(f.vida + f.danos + f.otros)), h('td', { class: 'right' }, mxn(f.admin)), h('td', { class: 'right' }, h('strong', null, mxn(f.mensualidad))))));
    btn.textContent = todas ? 'Mostrar solo el primer año' : `Ver los ${tabla.length} meses`;
  };
  pintar();
  return h('div', null, h('div', { class: 'row between', style: 'margin-bottom:8px' }, h('h4', null, 'Tabla de amortización'), btn),
    h('div', { class: 'tabla-amort' }, h('table', { class: 'tabla' }, h('thead', null, h('tr', null, ['Mes', 'Saldo', 'Intereses', 'Capital', 'Seguros', 'Admón.', 'Mensualidad'].map((t, i) => h('th', { class: i ? 'right' : '' }, t)))), cuerpo)));
}

// ==================================================================================================
//  Simulador del broker
// ==================================================================================================
export async function tabSimulador(d) {
  const { exp, ctx } = d;
  const [bancos, guardadasIni, analisis] = await Promise.all([api.bancosConTasas(), api.simulaciones(exp.id), api.obtenerAnalisisFinanciero(exp.id).catch(() => null)]);
  let guardadas = guardadasIni;
  let vista = 'comparar';
  const activos = bancos.filter((b) => b.activo);
  const raiz = h('div');

  // ---- estado de parámetros -----------------------------------------------------------------------------
  const p = {
    plazos: new Set([PLAZOS.reduce((a, x) => (Math.abs(x - (exp.plazo_anios || 20)) < Math.abs(a - (exp.plazo_anios || 20)) ? x : a), 20)]),
    programa: programaDeTipo(exp.tipo), soloMejor: true, orden: 'mensualidad',
  };
  const iValor = dinero('s_valor', exp.valor_inmueble ?? ''); const iMonto = dinero('s_monto', exp.monto_solicitado ?? '');
  const iIngreso = dinero('s_ing', analisis?.ingreso_mensual ?? exp.ingreso_mensual ?? '');
  const iDeuda = dinero('s_deu', analisis?.deuda_mensual ?? '');
  const iAforo = h('input', { class: 'input', type: 'number', min: 0, max: 100, step: 0.5, id: 's_aforo', inputmode: 'decimal' });
  const iNotarial = h('input', { class: 'input', type: 'number', min: 0, max: 15, step: 0.5, value: (GASTOS_NOTARIALES_DEFECTO * 100).toFixed(1), id: 's_not' });
  const iPrograma = h('select', { class: 'input', id: 's_prog' }, Object.entries(PROGRAMAS).map(([k, v]) => h('option', { value: k, selected: k === p.programa }, v)));
  const iBancoManual = h('select', { class: 'input', id: 's_bm', 'aria-label': 'Banco de la tasa negociada' }, h('option', { value: '' }, 'Ninguna'), activos.map((b) => h('option', { value: b.clave }, b.nombre)));
  const iTasaManual = h('input', { class: 'input', type: 'number', min: 1, max: 40, step: 0.05, placeholder: 'Ej. 9.50', id: 's_tm', 'aria-label': 'Tasa negociada (%)' });
  const iSoloMejor = h('input', { type: 'checkbox', checked: true });
  const iTop3 = h('input', { type: 'checkbox', checked: false });
  const iUsarBanda = h('input', { type: 'checkbox', checked: !!analisis?.banda_riesgo });
  const iOrden = h('select', { class: 'input', 'aria-label': 'Ordenar por' },
    [['mensualidad', 'Menor mensualidad'], ['cat', 'Menor CAT'], ['costo', 'Menor costo total'], ['desembolso', 'Menor desembolso inicial'], ['tasa', 'Menor tasa']].map(([k, v]) => h('option', { value: k }, v)));
  const val = (el) => aNumero(el.querySelector('input').value) || 0;
  const syncAforo = () => { const v = val(iValor), m = val(iMonto); iAforo.value = v && m ? ((m / v) * 100).toFixed(1) : ''; };
  syncAforo();
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Plazos a comparar' }, PLAZOS.map((x) => {
    const inp = h('input', { type: 'checkbox', checked: p.plazos.has(x), onchange: (e) => { if (e.target.checked) p.plazos.add(x); else p.plazos.delete(x); recalcular(); } });
    return h('label', { class: 'chip' }, inp, `${x} años`);
  }));

  const resultados = h('div');
  const calcular = () => {
    if (vista !== 'comparar') return;
    if (!p.plazos.size) { resultados.replaceChildren(banner('warn', 'Elige al menos un plazo para comparar.')); return; }
    const entrada = { tipo: exp.tipo, programa: iPrograma.value, valor: val(iValor), monto: val(iMonto), ingreso: val(iIngreso), plazos: [...p.plazos].sort((a, b) => a - b),
      gastosNotarialesPct: (Number(iNotarial.value) || 0) / 100, deudaMensual: val(iDeuda),
      bandaRiesgo: iUsarBanda.checked ? (analisis?.banda_riesgo || null) : null,
      tasaManual: iBancoManual.value && Number(iTasaManual.value) > 0 ? { bancoClave: iBancoManual.value, tasa: Number(iTasaManual.value) / 100 } : null };
    if (!(entrada.valor > 0 && entrada.monto > 0)) { resultados.replaceChildren(banner('info', 'Captura el valor del inmueble y el monto del crédito para comparar bancos.')); return; }
    pintarResultados(compararBancos(activos, entrada), entrada);
  };
  const recalcular = debounce(calcular, 180);

  function pintarResultados(todos, entrada) {
    let ok = todos.filter((r) => r.elegible);
    const noOk = todos.filter((r) => !r.elegible);
    const claves = { mensualidad: (r) => r.mensualidadInicial, cat: (r) => (r.cat ?? 9), costo: (r) => r.costoTotalCredito, desembolso: (r) => r.desembolsoInicial, tasa: (r) => r.tasa };
    if (iTop3.checked) {
      // Top-3: automatiza en segundos la comparación que antes tomaba abrir los 9 simuladores —
      // una sola oferta por banco (la mejor), recortada a las 3 mejores según el criterio elegido.
      ok = topN(ok, 3, claves[iOrden.value]);
    } else {
      if (iSoloMejor.checked) ok = mejorPorBancoPlazo(ok);
      ok.sort((a, b) => claves[iOrden.value](a) - claves[iOrden.value](b));
    }
    const mejor = (fn) => ok.length ? ok.reduce((a, b) => (fn(b) < fn(a) ? b : a)) : null;
    const mMens = mejor((r) => r.mensualidadInicial), mCat = mejor((r) => r.cat ?? 9), mCosto = mejor((r) => r.costoTotalCredito);

    const ofertaNodo = (r) => {
      const ins = [];
      if (r === mMens) ins.push(h('span', { class: 'badge ok' }, 'Menor mensualidad'));
      if (r === mCat) ins.push(h('span', { class: 'badge gold' }, 'Mejor CAT'));
      if (r === mCosto) ins.push(h('span', { class: 'badge navy' }, 'Menor costo total'));
      if (r.cumplePTI === true) ins.push(h('span', { class: 'badge ok plain' }, 'Cumple ingreso'));
      if (r.cumplePTI === false) ins.push(h('span', { class: 'badge bad plain' }, `Requiere ${mxn(r.ingresoMinimo)}`));
      if (!r.verificado) ins.push(h('span', { class: 'badge warn plain' }, 'Sin verificar'));
      return h('div', { class: 'oferta', role: 'button', tabindex: 0, 'aria-label': `${r.bancoNombre}, ${r.plazoAnios} años, mensualidad ${mxn(r.mensualidadInicial)}. Ver detalle`,
        onclick: () => abrirDetalle(r, entrada), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalle(r, entrada); } } },
        franja(r.color),
        h('div', null, h('div', { class: 'banco' }, r.bancoNombre), h('div', { class: 'sub' }, [r.producto, r.perfil].filter(Boolean).join(' · '), ` · ${r.plazoAnios} años`, r.esquema === 'creciente' ? ' · pagos crecientes' : ''), h('div', { class: 'badges' }, ins)),
        h('div', { class: 'cifras' },
          cifra('Mensualidad', mxn(r.mensualidadInicial), true), cifra('Tasa', pct(r.tasa)), cifra('CAT ref.', r.cat ? pct(r.cat) : '—'), cifra('Desembolso inicial', mxn(r.desembolsoInicial))));
    };
    const cifra = (k, v, main) => h('div', { class: 'c' + (main ? ' main' : '') }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));

    const inactivos = bancos.filter((b) => !b.activo).map((b) => b.nombre);
    resultados.replaceChildren(
      ok.length ? h('div', { class: 'kpis' },
        mMens ? h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Menor mensualidad'), h('div', { class: 'v num' }, mxn(mMens.mensualidadInicial)), h('div', { class: 's' }, `${mMens.bancoNombre} · ${mMens.plazoAnios} años`)) : null,
        mCat ? h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Mejor CAT referencial'), h('div', { class: 'v num' }, mCat.cat ? pct(mCat.cat) : '—'), h('div', { class: 's' }, `${mCat.bancoNombre} · ${mCat.plazoAnios} años`)) : null,
        mCosto ? h('div', { class: 'kpi' }, h('div', { class: 'k' }, 'Menor costo total'), h('div', { class: 'v num' }, mxn(mCosto.costoTotalCredito)), h('div', { class: 's' }, `${mCosto.bancoNombre} · ${mCosto.plazoAnios} años`)) : null) : null,
      h('div', { style: 'height:16px' }),
      h('section', { class: 'hoja' },
        h('div', { class: 'hoja-head' }, h('h3', null, iTop3.checked ? `🏆 Top ${ok.length === 1 ? '1' : ok.length} recomendado` : (ok.length ? `${ok.length} opciones elegibles` : 'Sin opciones elegibles')), h('span', { class: 'muted small' }, 'Toca una opción para ver el desglose y guardarla')),
        ok.length ? h('div', null, ok.map(ofertaNodo)) : h('div', { class: 'hoja-body' }, vacio('Ningún banco cumple con estos parámetros', 'Revisa aforo, plazo o programa; abajo puedes ver el motivo por banco.'))),
      noOk.length ? h('details', { class: 'hoja', style: 'margin-top:16px' }, h('summary', { style: 'padding:14px 22px;cursor:pointer;font-weight:700' }, `${noOk.length} variantes no elegibles (ver motivo)`),
        h('div', { class: 'scroll-x' }, h('table', { class: 'tabla' }, h('thead', null, h('tr', null, ['Banco', 'Producto', 'Plazo', 'Motivo'].map((t) => h('th', null, t)))),
          h('tbody', null, dedup(noOk).slice(0, 80).map((r) => h('tr', { class: 'descartado' }, h('td', null, r.bancoNombre), h('td', null, [r.producto, r.perfil].filter(Boolean).join(' · ')), h('td', null, `${r.plazoAnios} años`), h('td', null, r.motivos.join(' ·')))))))) : null,
      inactivos.length ? h('p', { class: 'small muted', style: 'margin-top:12px' }, `Bancos desactivados (no se comparan): ${inactivos.join(', ')}.`) : null);
  }
  const dedup = (arr) => { const v = new Set(); return arr.filter((r) => { const k = `${r.bancoClave}|${r.plazoAnios}|${r.motivos.join()}`; if (v.has(k)) return false; v.add(k); return true; }); };

  // ---- detalle + guardar ------------------------------------------------------------------------------------------------------
  function abrirDetalle(r, entrada) {
    modal({ titulo: `${r.bancoNombre} · ${r.plazoAnios} años`, ancho: true, cuerpo: h('div', { class: 'stack' }, h('p', { class: 'muted', style: 'margin:0' }, [r.producto, r.perfil].filter(Boolean).join(' · ')), contenidoDetalle(r, { conTabla: true })),
      acciones: [{ texto: 'Cerrar', clase: 'btn-outline', onclick: (c) => c() }, { texto: 'Guardar en el expediente', clase: 'btn-primary', onclick: (c) => { c(); guardar(r, entrada); } }] });
  }
  function guardar(r, entrada) {
    const nombre = h('input', { class: 'input', id: 'g_n', maxlength: 120, value: `${r.bancoNombre} · ${r.plazoAnios} años` });
    const nota = h('textarea', { class: 'input', id: 'g_no', maxlength: 2000, placeholder: 'Opcional: por qué conviene, condiciones a considerar…' });
    const comp = h('input', { type: 'checkbox', id: 'g_c' });
    modal({ titulo: 'Guardar simulación', cuerpo: h('div', null, campoForm('g_n', 'Nombre', nombre), campoForm('g_no', 'Nota para el expediente', nota),
      h('label', { class: 'check' }, comp, h('span', null, h('strong', null, 'Compartir con el cliente'), h('br'), h('span', { class: 'muted small' }, 'Podrá ver esta opción en su pestaña "Opciones de crédito".')))),
      acciones: [{ texto: 'Cancelar', clase: 'btn-outline', onclick: (c) => c() }, { texto: 'Guardar', clase: 'btn-primary', onclick: async (c) => {
        if (!nombre.value.trim()) { nombre.setAttribute('aria-invalid', 'true'); return; }
        try {
          const s = await api.guardarSimulacion({ expediente_id: exp.id, creado_por: ctx.uid, nombre: nombre.value.trim(), banco_clave: r.bancoClave, banco_nombre: r.bancoNombre,
            parametros: { valor: entrada.valor, monto: entrada.monto, ingreso: entrada.ingreso, plazoAnios: r.plazoAnios, programa: entrada.programa, gastosNotarialesPct: entrada.gastosNotarialesPct, filaId: r.filaId, tasa: r.tasa, esquema: r.esquema },
            resultado: resumen(r), nota: nota.value.trim() || null, compartida: comp.checked });
          guardadas = [s, ...guardadas]; c(); toast('Simulación guardada.', 'ok'); pintar();
        } catch (e) { toast(api.mensajeError(e), 'error'); }
      } }] });
  }

  // ---- lista de guardadas ----------------------------------------------------------------------------------------------------------------
  function vistaGuardadas() {
    if (!guardadas.length) return hoja('Simulaciones guardadas', vacio('Aún no hay simulaciones guardadas', 'Compara bancos y guarda las opciones que quieras presentar al cliente.', h('button', { class: 'btn btn-outline', onclick: () => { vista = 'comparar'; pintar(); } }, 'Ir al comparador')));
    return h('div', { class: 'stack' }, guardadas.map((s) => {
      const r = s.resultado || {};
      const acciones = h('div', { class: 'row', style: 'padding:0 22px 16px 22px' },
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => modal({ titulo: s.nombre, ancho: true, cuerpo: contenidoDetalle(r), acciones: [{ texto: 'Cerrar', clase: 'btn-outline', onclick: (c) => c() }] }) }, icono('ojo'), 'Ver detalle'),
        h('button', { class: 'btn btn-outline btn-sm', onclick: async () => { try { await api.marcarRecomendada(s.id, !s.recomendada); guardadas = await api.simulaciones(exp.id); pintar(); } catch (e) { toast(api.mensajeError(e), 'error'); } } }, icono('estrella'), s.recomendada ? 'Quitar recomendación' : 'Marcar como recomendada'),
        h('button', { class: 'btn btn-outline btn-sm', onclick: async () => { try { const n = await api.actualizarSimulacion(s.id, { compartida: !s.compartida }); guardadas = guardadas.map((x) => (x.id === s.id ? n : x)); toast(n.compartida ? 'Ahora el cliente la puede ver.' : 'Ya no es visible para el cliente.', 'ok'); pintar(); } catch (e) { toast(api.mensajeError(e), 'error'); } } }, icono('link'), s.compartida ? 'Dejar de compartir' : 'Compartir con el cliente'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Eliminar simulación', onclick: async () => { if (!(await confirmar(`¿Eliminar "${s.nombre}"?`, { si: 'Eliminar', peligro: true }))) return; try { await api.eliminarSimulacion(s.id); guardadas = guardadas.filter((x) => x.id !== s.id); pintar(); } catch (e) { toast(api.mensajeError(e), 'error'); } } }, icono('basura')));
      return h('section', { class: 'hoja' + (s.recomendada ? ' recomendada' : '') },
        h('div', { class: 'oferta', style: 'cursor:default;border-bottom:0' }, franja(r.color),
          h('div', null, h('div', { class: 'banco' }, s.nombre), h('div', { class: 'sub' }, [r.producto, r.perfil].filter(Boolean).join(' · '), ` · ${r.plazoAnios || ''} años · ${fecha(s.created_at)}`),
            h('div', { class: 'badges' }, s.recomendada ? h('span', { class: 'badge gold' }, '★ Recomendada') : null, h('span', { class: 'badge ' + (s.compartida ? 'ok' : '') }, s.compartida ? 'Visible para el cliente' : 'Solo interna'))),
          h('div', { class: 'cifras' }, cifra2('Mensualidad', mxn(r.mensualidadInicial), true), cifra2('Tasa', pct(r.tasa)), cifra2('CAT ref.', r.cat ? pct(r.cat) : '—'))),
        s.nota ? h('p', { class: 'small', style: 'padding:0 22px 12px 30px;white-space:pre-wrap' }, s.nota) : null, acciones);
    }));
  }
  const cifra2 = (k, v, main) => h('div', { class: 'c' + (main ? ' main' : '') }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));

  // ---- armado ------------------------------------------------------------------------------------------------------------------------------------
  const panelParams = hoja('Parámetros', h('div', null,
    campoForm('s_valor', 'Valor del inmueble', iValor), campoForm('s_monto', 'Monto del crédito', iMonto), campoForm('s_aforo', 'Aforo (%)', iAforo, 'Cambia el monto o el aforo; el otro se ajusta.'),
    campoForm('s_ing', 'Ingreso mensual del cliente', iIngreso), campoForm('s_deu', 'Deuda mensual existente', iDeuda, 'Pagos de créditos activos (del Buró); se resta de la capacidad de pago.'),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Plazos a comparar'), chips),
    campoForm('s_prog', 'Programa', iPrograma), campoForm('s_not', 'Gastos notariales (% del valor)', iNotarial, 'Solo afecta el desembolso inicial.'),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Tasa negociada (opcional)'), h('div', { class: 'row', style: 'flex-wrap:nowrap' }, iBancoManual, iTasaManual), h('span', { class: 'hint' }, 'Agrega una fila extra con la tasa que consiguió el broker (aplica los costos del banco elegido).')),
    analisis?.banda_riesgo
      ? h('label', { class: 'check' }, iUsarBanda, h('span', null, `Filtrar por banda de riesgo confirmada: `, h('strong', null, analisis.banda_riesgo)))
      : h('p', { class: 'hint muted small', style: 'margin:-4px 0 14px' }, 'Sin banda de riesgo confirmada — ve a "Análisis financiero" para leer el Buró del cliente y afinar esta comparación.'),
    h('label', { class: 'check' }, iTop3, h('span', null, h('strong', null, '🏆 Mostrar solo el Top 3'), h('br'), h('span', { class: 'muted small' }, 'Una oferta por banco, las 3 mejores según el orden elegido.'))),
    h('label', { class: 'check', style: 'margin-bottom:14px' }, iSoloMejor, h('span', null, 'Solo la mejor variante por banco y plazo')),
    campoForm('s_ord', 'Ordenar por', iOrden)), { });
  panelParams.classList.add('sim-params');

  const entradas = [iValor, iMonto, iIngreso, iDeuda, iNotarial, iPrograma, iBancoManual, iTasaManual, iSoloMejor, iTop3, iUsarBanda, iOrden];
  entradas.forEach((el) => { el.addEventListener('input', recalcular); el.addEventListener('change', recalcular); });
  iValor.addEventListener('input', syncAforo); iMonto.addEventListener('input', syncAforo);
  iAforo.addEventListener('input', () => { const v = val(iValor); const a = Number(iAforo.value); if (v && a >= 0) { iMonto.querySelector('input').value = Math.round((v * a) / 100).toLocaleString('es-MX'); recalcular(); } });

  const nav = h('div', { class: 'row', style: 'margin-bottom:18px' });
  function pintar() {
    nav.replaceChildren(
      h('button', { class: 'btn ' + (vista === 'comparar' ? '' : 'btn-outline'), onclick: () => { vista = 'comparar'; pintar(); } }, icono('calc'), 'Comparar bancos'),
      h('button', { class: 'btn ' + (vista === 'guardadas' ? '' : 'btn-outline'), onclick: () => { vista = 'guardadas'; pintar(); } }, icono('estrella'), `Guardadas (${guardadas.length})`));
    if (vista === 'comparar') { raiz.replaceChildren(nav, h('div', { class: 'sim-layout' }, panelParams, resultados)); calcular(); }
    else raiz.replaceChildren(nav, vistaGuardadas());
  }
  const noVerif = activos.filter((b) => !b.verificado).length;
  pintar();
  return h('div', { class: 'stack' }, noVerif ? banner('warn', h('p', null, h('strong', null, `${noVerif} de ${activos.length} bancos activos aún no están verificados. `), 'Las tarifas se cargaron de sus simuladores Excel; confírmalas en Admin → Bancos y tarifas y marca cada banco como verificado.')) : null, raiz);
}

// ==================================================================================================
//  Vista del cliente: opciones que el broker decidió compartir
// ==================================================================================================
export async function tabOpciones(d) {
  const lista = await api.simulaciones(d.exp.id);
  if (!lista.length) return hoja('Opciones de crédito', vacio('Todavía no hay opciones para mostrar', 'Cuando tu broker compare bancos y comparta las mejores opciones, aparecerán aquí.'));
  const ordenadas = [...lista].sort((a, b) => Number(b.recomendada) - Number(a.recomendada));
  return h('div', { class: 'stack' }, banner('info', 'Estas son las opciones que tu broker preparó para ti. Las cifras son referenciales y están sujetas a la aprobación del banco.'),
    ordenadas.map((s) => h('section', { class: 'hoja' + (s.recomendada ? ' recomendada' : '') },
      h('div', { class: 'hoja-head' }, h('h3', null, s.nombre), s.recomendada ? h('span', { class: 'badge gold' }, '★ Recomendada por tu broker') : null),
      h('div', { class: 'hoja-body' }, s.nota ? h('p', { style: 'white-space:pre-wrap' }, s.nota) : null, contenidoDetalle(s.resultado || {})))));
}
