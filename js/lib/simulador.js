// =====================================================================
//  ESJOAN · Motor del simulador hipotecario
//  Puro (sin DOM ni red): recibe los datos del banco (tabla `bancos` +
//  `bancos_tasas`) y devuelve mensualidad, costos, CAT y amortización.
//  Para cambiar una tasa NO se toca este archivo: se edita en
//  Admin → Bancos y tarifas.
// =====================================================================

const EPS = 1e-6;

export const PROGRAMAS = {
  tradicional: 'Tradicional',
  cofinavit: 'Cofinavit',
  apoyo_infonavit: 'Apoyo Infonavit',
};

/** Programa y destino que se derivan del tipo de expediente */
export function programaDeTipo(tipo) {
  if (tipo === 'cofinavit') return 'cofinavit';
  if (tipo === 'apoyo_infonavit') return 'apoyo_infonavit';
  return 'tradicional';
}
export function destinoDeTipo(tipo) {
  return tipo === 'cofinavit' || tipo === 'apoyo_infonavit' ? 'adquisicion' : tipo;
}

const num = (x, d = 0) => (x === null || x === undefined || x === '' || Number.isNaN(Number(x)) ? d : Number(x));

/** Tasa mensual según la base de días del banco ("30/360", "30.4/360"…) */
export function tasaMensual(tasaAnual, baseDias = '30/360') {
  const m = String(baseDias).match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (!m) return tasaAnual / 12;
  return (tasaAnual * Number(m[1])) / Number(m[2]);
}

/** Pago fijo (amortización francesa) */
export function pagoFijo(monto, i, n) {
  if (n <= 0) return 0;
  if (Math.abs(i) < 1e-12) return monto / n;
  return (monto * i) / (1 - Math.pow(1 + i, -n));
}

/** Primer pago cuando la mensualidad crece g cada año durante `anios` años */
export function pagoInicialCreciente(monto, i, n, g, anios) {
  let suma = 0;
  for (let k = 1; k <= n; k++) {
    const escalon = Math.min(Math.floor((k - 1) / 12), anios);
    suma += Math.pow(1 + g, escalon) / Math.pow(1 + i, k);
  }
  return monto / suma;
}

/** Costo del avalúo según la fórmula del banco: fijo, % del valor o tabla por tramos */
export function costoAvaluo(avaluo, valor) {
  if (!avaluo) return 0;
  if (avaluo.tipo === 'pct') return valor * num(avaluo.pct);
  if (avaluo.tipo === 'tabla') {
    const tramos = [...(avaluo.tramos || [])].sort((a, b) => a.hasta - b.hasta);
    if (!tramos.length) return 0;
    const t = tramos.find((x) => valor <= x.hasta) || tramos[tramos.length - 1];
    return num(t.monto);
  }
  return num(avaluo.monto);
}

/** TIR mensual por bisección (robusta) → CAT anualizado */
export function calcularCAT(flujoInicial, pagos) {
  const vp = (r) => {
    let s = -flujoInicial;
    for (let k = 0; k < pagos.length; k++) s += pagos[k] / Math.pow(1 + r, k + 1);
    return s;
  };
  let lo = 1e-9, hi = 0.5;
  if (vp(lo) < 0) return null;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (vp(mid) > 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-13) break;
  }
  const r = (lo + hi) / 2;
  return Math.pow(1 + r, 12) - 1;
}

/**
 * Evalúa UNA combinación banco + fila de tasa + plazo.
 * entrada = { valor, monto, plazoAnios, ingreso, programa, gastosNotarialesPct,
 *             bandaRiesgo?, deudaMensual? }  (bandaRiesgo y deudaMensual vienen del
 *             análisis de capacidad de pago, cuando existe)
 * Devuelve siempre un objeto; `elegible=false` trae los motivos en `motivos`.
 */
export function evaluar(banco, fila, entrada) {
  const P = banco.parametros || {};
  const iva = num(P.iva, 0.16);
  const valor = num(entrada.valor);
  const monto = num(entrada.monto);
  const n = Math.round(num(entrada.plazoAnios) * 12);
  const programa = entrada.programa || 'tradicional';
  const aforo = valor > 0 ? monto / valor : 0;
  const motivos = [];

  // ---- Elegibilidad ---------------------------------------------------
  const plazoMin = Math.max(num(fila.plazo_min, 1), num(P.plazo_min, 1));
  const plazoMax = Math.min(num(fila.plazo_max, 40), num(P.plazo_max, 40));
  if (entrada.plazoAnios < plazoMin || entrada.plazoAnios > plazoMax) {
    motivos.push(`Plazo ${entrada.plazoAnios} años fuera de rango (${plazoMin}–${plazoMax})`);
  }
  const aforoBanco = num((P.aforo_max || {})[programa], num((P.aforo_max || {}).default, 1));
  const aforoTope = Math.min(num(fila.aforo_max, 1), aforoBanco);
  if (aforo > aforoTope + EPS) motivos.push(`Aforo ${(aforo * 100).toFixed(1)} % excede el máximo de ${(aforoTope * 100).toFixed(0)} %`);
  if (aforo < num(fila.aforo_min, 0) - EPS) motivos.push(`Aforo ${(aforo * 100).toFixed(1)} % menor al mínimo de ${(num(fila.aforo_min) * 100).toFixed(0)} %`);
  const mMin = fila.monto_min ?? P.monto_min;
  const mMax = fila.monto_max ?? P.monto_max;
  if (mMin != null && monto < Number(mMin)) motivos.push('Monto menor al mínimo del banco');
  if (mMax != null && monto > Number(mMax)) motivos.push('Monto mayor al máximo del banco');
  if (!(monto > 0) || !(valor > 0)) motivos.push('Captura valor del inmueble y monto');
  // Banda de riesgo (Buró de crédito): si esta fila es específica de una banda y se conoce
  // la banda del cliente, solo aplica cuando coinciden. Filas sin banda ('*' o vacío) son para todos.
  if (entrada.bandaRiesgo && fila.banda_riesgo && fila.banda_riesgo !== '*' && fila.banda_riesgo !== entrada.bandaRiesgo) {
    motivos.push(`No aplica a tu banda de riesgo (tu banda: ${entrada.bandaRiesgo}; esta tarifa es para ${fila.banda_riesgo})`);
  }

  // ---- Costos iniciales ----------------------------------------------
  const aperturaPct = fila.comision_apertura != null ? num(fila.comision_apertura) : num(P.apertura_pct);
  const apertura = monto * aperturaPct;
  const financiaApertura = !!P.apertura_financiable && apertura > 0;
  const montoFinanciado = monto + (financiaApertura ? apertura : 0);
  const avaluo = costoAvaluo(P.avaluo, valor);
  const investigacion = num(P.investigacion);
  const otrosIniciales = num(P.otros_gastos_iniciales);
  const gastosNotariales = valor * num(entrada.gastosNotarialesPct);
  const enganche = Math.max(valor - monto, 0);

  // ---- Mensualidad -----------------------------------------------------
  const tasaAnual = num(fila.tasa);
  const i = tasaMensual(tasaAnual, P.base_dias);
  const creciente = fila.esquema === 'creciente';
  const g = creciente ? num(fila.incremento_anual) : 0;
  // Si el banco no indica cuántos años crece la mensualidad, se asume 5 (como Scotiabank)
  const anios = creciente ? (num(fila.incremento_anios) > 0 ? num(fila.incremento_anios) : 5) : 0;
  const p1 = n > 0 ? (creciente ? pagoInicialCreciente(montoFinanciado, i, n, g, anios) : pagoFijo(montoFinanciado, i, n)) : 0;

  const baseDanos = P.danos_base === 'valor' ? valor : valor * num(P.destructible_pct, 0.7);
  const danos = baseDanos * num(P.danos_pct);
  const admin = num(P.admin_mensual) * (P.admin_iva ? 1 + iva : 1);

  const tabla = [];
  let saldo = montoFinanciado;
  let totInteres = 0, totVida = 0, totDanos = 0, totOtros = 0, totAdmin = 0, totPagado = 0;
  const pagosTotales = [];
  for (let k = 1; k <= n; k++) {
    const escalon = creciente ? Math.min(Math.floor((k - 1) / 12), anios) : 0;
    const pago = p1 * Math.pow(1 + g, escalon);
    const interes = saldo * i;
    let amort = pago - interes;
    if (k === n || amort > saldo) amort = saldo; // último pago liquida
    const vida = saldo * num(P.vida_pct);
    const otros = saldo * num(P.seguro_otros_pct);
    const pagoK = k === n ? interes + amort : pago;
    const mensualidad = pagoK + vida + danos + otros + admin;
    tabla.push({ mes: k, saldo, interes, amort, pago: pagoK, vida, danos, otros, admin, mensualidad });
    totInteres += interes; totVida += vida; totDanos += danos; totOtros += otros; totAdmin += admin;
    totPagado += mensualidad;
    pagosTotales.push(mensualidad);
    saldo -= amort;
  }
  const primera = tabla[0] || { mensualidad: 0, pago: 0 };
  const ultima = tabla[tabla.length - 1] || { mensualidad: 0 };
  const maxMensualidad = tabla.reduce((m, r) => Math.max(m, r.mensualidad), 0);

  // ---- CAT referencial: entra `monto` menos comisiones cobradas por el banco ----
  const entrada0 = monto - (financiaApertura ? 0 : apertura) - investigacion;
  const cat = n > 0 && p1 > 0 ? calcularCAT(entrada0, pagosTotales) : null;

  // ---- Capacidad de pago (PTI) — neta de deudas existentes (Buró de crédito) ----
  const pti = fila.pti != null ? num(fila.pti) : P.pti != null ? num(P.pti) : null;
  const basePTI = P.pti_base === 'pago' ? primera.pago : maxMensualidad; // conservador: mayor mensualidad
  const deudaMensual = num(entrada.deudaMensual); // pagos mensuales de créditos activos, del Buró
  const cargaTotal = basePTI + deudaMensual;
  const ingresoMinimo = pti ? cargaTotal / pti : null;
  const ingreso = num(entrada.ingreso);
  const cumplePTI = pti && ingreso > 0 ? cargaTotal / ingreso <= pti + EPS : null;

  const desembolsoInicial = enganche + gastosNotariales + (financiaApertura ? 0 : apertura) + avaluo + investigacion + otrosIniciales;
  const costoTotalCredito = totInteres + totVida + totDanos + totOtros + totAdmin + apertura + avaluo + investigacion + otrosIniciales;

  return {
    elegible: motivos.length === 0,
    motivos,
    bancoClave: banco.clave,
    bancoNombre: banco.nombre,
    color: banco.color || '#292E54',
    filaId: fila.id ?? null,
    producto: fila.producto || null,
    perfil: fila.perfil || null,
    esquema: fila.esquema || 'fijo',
    tasa: tasaAnual,
    incrementoAnual: g,
    incrementoAnios: anios,
    plazoAnios: entrada.plazoAnios,
    meses: n,
    valor, monto, enganche, aforo,
    apertura, aperturaPct, financiaApertura, montoFinanciado,
    avaluo, investigacion, otrosIniciales, gastosNotariales,
    desembolsoInicial,
    pagoBase: primera.pago,
    mensualidadInicial: primera.mensualidad,
    mensualidadFinal: ultima.mensualidad,
    mensualidadMaxima: maxMensualidad,
    segurosMensuales: primera.vida + primera.danos + primera.otros,
    adminMensual: admin,
    totalIntereses: totInteres,
    totalSeguros: totVida + totDanos + totOtros,
    totalAdmin: totAdmin,
    totalPagado: totPagado,
    costoTotalCredito,
    cat,
    pti, ptiBase: P.pti_base || 'total', ingresoMinimo, cumplePTI, deudaMensual,
    verificado: !!banco.verificado,
    vigencia: banco.vigencia || null,
    tabla,
  };
}

/** ¿Esta fila de tasas aplica al tipo de expediente / programa? */
export function filaAplica(fila, destino, programa) {
  if (fila.activo === false) return false;
  const d = fila.destino || '*';
  const p = fila.programa || '*';
  return (d === '*' || d === destino) && (p === '*' || p === programa);
}

/**
 * Compara todos los bancos activos × plazos elegidos.
 * bancos: [{...banco, tasas:[...]}]
 * opciones: { valor, monto, plazos:[años], ingreso, tipo, gastosNotarialesPct, tasaManual:{bancoClave,tasa,esquema?} }
 */
export function compararBancos(bancos, opciones) {
  const programa = opciones.programa || programaDeTipo(opciones.tipo);
  const destino = destinoDeTipo(opciones.tipo);
  const filas = [];
  for (const b of bancos) {
    if (b.activo === false) continue;
    let tasas = (b.tasas || []).filter((f) => filaAplica(f, destino, programa));
    if (opciones.tasaManual && opciones.tasaManual.bancoClave === b.clave && opciones.tasaManual.tasa > 0) {
      tasas = [...tasas, {
        id: null, producto: 'Tasa negociada', perfil: 'Manual', esquema: opciones.tasaManual.esquema || 'fijo',
        tasa: opciones.tasaManual.tasa, plazo_min: 1, plazo_max: 40, aforo_min: 0, aforo_max: 1,
        incremento_anual: 0, incremento_anios: 0, activo: true,
      }];
    }
    for (const f of tasas) {
      for (const plazo of opciones.plazos) {
        // Filas de un solo plazo (p. ej. HSBC): si el plazo no cuadra, esa variante no existe → se omite
        if (num(f.plazo_min) === num(f.plazo_max) && plazo !== num(f.plazo_min)) continue;
        filas.push(evaluar(b, f, { ...opciones, plazoAnios: plazo, programa }));
      }
    }
  }
  return filas;
}

/** Deja solo la mejor variante (menor tasa, luego menor mensualidad) por banco y plazo */
export function mejorPorBancoPlazo(resultados) {
  const mapa = new Map();
  for (const r of resultados) {
    const k = `${r.bancoClave}|${r.plazoAnios}`;
    const a = mapa.get(k);
    if (!a || r.tasa < a.tasa - 1e-9 || (Math.abs(r.tasa - a.tasa) < 1e-9 && r.mensualidadInicial < a.mensualidadInicial)) mapa.set(k, r);
  }
  return [...mapa.values()];
}

/** Una oferta por banco (la mejor según `clave`, sin importar el plazo) — insumo del Top-N */
export function mejorPorBanco(resultados, clave = (r) => r.mensualidadInicial) {
  const mapa = new Map();
  for (const r of resultados) {
    const a = mapa.get(r.bancoClave);
    if (!a || clave(r) < clave(a)) mapa.set(r.bancoClave, r);
  }
  return [...mapa.values()];
}

/**
 * Las N mejores ofertas, una por banco (nunca dos filas del mismo banco),
 * ordenadas por `clave` (por defecto menor mensualidad inicial). Es la base
 * del recomendador "Top-3": automatiza en segundos la comparación que antes
 * tomaba abrir los 9 simuladores de Excel uno por uno.
 */
export function topN(resultados, n = 3, clave = (r) => r.mensualidadInicial) {
  return mejorPorBanco(resultados, clave).sort((a, b) => clave(a) - clave(b)).slice(0, n);
}

/** Resumen ligero (sin tabla) para guardar en la base de datos y compartir */
export function resumen(r) {
  const { tabla, ...resto } = r;
  return resto;
}
