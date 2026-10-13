// Ejecutar:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, compararBancos, pagoFijo, tasaMensual, costoAvaluo, pagoInicialCreciente, mejorPorBancoPlazo, topN } from '../js/lib/simulador.js';

const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

const bx = {
  clave: 'bx', nombre: 'BX+', verificado: false,
  parametros: { iva: 0.16, destructible_pct: 0.7, danos_base: 'destructible', base_dias: '30/360', apertura_pct: 0.01,
    apertura_financiable: false, admin_mensual: 299, admin_iva: true, vida_pct: 0.00065, danos_pct: 0.000349,
    avaluo: { tipo: 'fijo', monto: 6960 }, pti: 0.495, pti_base: 'total', aforo_max: { default: 0.9 }, plazo_min: 5, plazo_max: 20 },
};
const filaBx = { tasa: 0.102, esquema: 'fijo', plazo_min: 5, plazo_max: 20, aforo_min: 0, aforo_max: 0.7, destino: 'adquisicion', programa: '*' };

test('BX+ reproduce el Excel (pago, seguros, admin, mensualidad del mes 1)', () => {
  // valor tal que el seguro de daños del Excel = 1,075.4128
  const valor = 1075.4128 / 0.000349 / 0.7;
  const r = evaluar(bx, filaBx, { valor, monto: 850000, plazoAnios: 20, programa: 'tradicional', ingreso: 0 });
  cerca(r.pagoBase, 8315.6331966896, 0.001);
  cerca(r.tabla[0].vida, 552.5, 0.001);
  cerca(r.tabla[0].danos, 1075.4128, 0.001);
  cerca(r.tabla[0].admin, 346.84, 0.001);
  cerca(r.mensualidadInicial, 10290.3859966896, 0.001);
  cerca(r.tabla[1].saldo, 848909.3668033103, 0.001);
  // Al final el saldo queda en cero
  cerca(r.tabla[239].saldo - r.tabla[239].amort, 0, 0.01);
  assert.ok(r.cat > 0.13 && r.cat < 0.15, 'CAT referencial cercano al del Excel (14.2 %)');
});

test('aforo y plazo fuera de rango se marcan como no elegibles', () => {
  const r = evaluar(bx, filaBx, { valor: 1000000, monto: 900000, plazoAnios: 30, programa: 'tradicional' });
  assert.equal(r.elegible, false);
  assert.ok(r.motivos.some((m) => m.includes('Aforo')));
  assert.ok(r.motivos.some((m) => m.includes('Plazo')));
});

test('base de días 30.4/360 (Banorte)', () => {
  cerca(tasaMensual(0.108, '30.4/360'), 0.108 * 30.4 / 360, 1e-12);
  cerca(tasaMensual(0.108, '30/360'), 0.009, 1e-12);
});

test('avalúo: fijo, porcentaje y tabla por tramos', () => {
  assert.equal(costoAvaluo({ tipo: 'fijo', monto: 5000 }, 3e6), 5000);
  cerca(costoAvaluo({ tipo: 'pct', pct: 0.0025 }, 4e6), 10000, 1e-9);
  const tabla = { tipo: 'tabla', tramos: [{ hasta: 1e6, monto: 2900 }, { hasta: 2e6, monto: 5556 }] };
  assert.equal(costoAvaluo(tabla, 900000), 2900);
  assert.equal(costoAvaluo(tabla, 1500000), 5556);
  assert.equal(costoAvaluo(tabla, 9e6), 5556); // por encima del último tramo usa el último
});

test('apertura financiable aumenta el monto financiado y no sale de bolsa', () => {
  const b = { ...bx, parametros: { ...bx.parametros, apertura_pct: 0.01, apertura_financiable: true } };
  const r = evaluar(b, filaBx, { valor: 1200000, monto: 800000, plazoAnios: 15, programa: 'tradicional' });
  cerca(r.montoFinanciado, 808000, 1e-6);
  const r2 = evaluar(bx, filaBx, { valor: 1200000, monto: 800000, plazoAnios: 15, programa: 'tradicional' });
  assert.ok(r2.desembolsoInicial > r.desembolsoInicial);
});

test('pagos crecientes: el primer pago es menor que el fijo y el saldo cierra en cero', () => {
  const fila = { tasa: 0.1075, esquema: 'creciente', incremento_anual: 0.024, incremento_anios: 5, plazo_min: 5, plazo_max: 20, aforo_max: 0.95 };
  const b = { ...bx, parametros: { ...bx.parametros, admin_mensual: 0, aforo_max: { default: 0.95 } } };
  const r = evaluar(b, fila, { valor: 2e6, monto: 1.5e6, plazoAnios: 20, programa: 'tradicional' });
  assert.ok(r.pagoBase < pagoFijo(1.5e6, 0.1075 / 12, 240));
  assert.ok(r.mensualidadFinal > r.mensualidadInicial);
  const u = r.tabla[239];
  cerca(u.saldo - u.amort, 0, 0.01);
});

test('compararBancos filtra por programa/destino y respeta filas de plazo único', () => {
  const hsbc = { clave: 'hsbc', nombre: 'HSBC', activo: true, parametros: { ...bx.parametros, aforo_max: { default: 0.95 }, plazo_min: 5, plazo_max: 25 },
    tasas: [
      { tasa: 0.101, esquema: 'fijo', destino: 'adquisicion', programa: 'cofinavit', plazo_min: 20, plazo_max: 20, aforo_max: 0.95 },
      { tasa: 0.101, esquema: 'fijo', destino: 'adquisicion', programa: 'cofinavit', plazo_min: 10, plazo_max: 10, aforo_max: 0.95 },
      { tasa: 0.104, esquema: 'fijo', destino: 'adquisicion', programa: 'apoyo_infonavit', plazo_min: 20, plazo_max: 20, aforo_max: 0.95 },
    ] };
  const res = compararBancos([hsbc], { tipo: 'cofinavit', valor: 2e6, monto: 1.5e6, plazos: [20], ingreso: 60000 });
  assert.equal(res.length, 1);
  assert.equal(res[0].plazoAnios, 20);
  const mejores = mejorPorBancoPlazo(compararBancos([hsbc], { tipo: 'cofinavit', valor: 2e6, monto: 1.5e6, plazos: [10, 20], ingreso: 0 }));
  assert.equal(mejores.length, 2);
});

test('tasa manual se agrega como fila extra del banco indicado', () => {
  const b = { ...bx, activo: true, tasas: [] };
  const res = compararBancos([b], { tipo: 'adquisicion', valor: 2e6, monto: 1.4e6, plazos: [20], tasaManual: { bancoClave: 'bx', tasa: 0.095 } });
  assert.equal(res.length, 1);
  assert.equal(res[0].perfil, 'Manual');
  assert.equal(res[0].tasa, 0.095);
});

test('PTI: ingreso mínimo y cumplimiento', () => {
  const r = evaluar(bx, { ...filaBx, aforo_max: 0.9 }, { valor: 1500000, monto: 1000000, plazoAnios: 20, programa: 'tradicional', ingreso: 15000 });
  assert.ok(r.ingresoMinimo > 0);
  assert.equal(r.cumplePTI, r.mensualidadMaxima / 15000 <= 0.495);
});

test('PTI: la deuda mensual existente (del Buró) sube el ingreso mínimo requerido', () => {
  const base = { valor: 1500000, monto: 1000000, plazoAnios: 20, programa: 'tradicional', ingreso: 20000 };
  const sinDeuda = evaluar(bx, { ...filaBx, aforo_max: 0.9 }, base);
  const conDeuda = evaluar(bx, { ...filaBx, aforo_max: 0.9 }, { ...base, deudaMensual: 5000 });
  assert.ok(conDeuda.ingresoMinimo > sinDeuda.ingresoMinimo);
  cerca(conDeuda.ingresoMinimo - sinDeuda.ingresoMinimo, 5000 / sinDeuda.pti, 1);
  // con la deuda, el mismo ingreso puede dejar de alcanzar
  if (sinDeuda.cumplePTI) assert.equal(conDeuda.cumplePTI, (sinDeuda.mensualidadMaxima + 5000) / 20000 <= sinDeuda.pti + 1e-9);
});

test('banda de riesgo: una fila específica de banda no aplica a un cliente de otra banda', () => {
  const filaNR1 = { ...filaBx, banda_riesgo: 'NR 1 y 2 +' };
  const filaGeneral = { ...filaBx, banda_riesgo: '*' };
  const entradaOtraBanda = { valor: 1500000, monto: 1000000, plazoAnios: 20, programa: 'tradicional', ingreso: 30000, bandaRiesgo: 'NR 3' };
  const rEspecifica = evaluar(bx, filaNR1, entradaOtraBanda);
  const rGeneral = evaluar(bx, filaGeneral, entradaOtraBanda);
  assert.equal(rEspecifica.elegible, false);
  assert.ok(rEspecifica.motivos.some((m) => m.includes('banda de riesgo')));
  assert.equal(rGeneral.elegible, true); // las filas sin banda ('*') siguen aplicando a todos
  // si la banda SÍ coincide, vuelve a ser elegible
  const rCoincide = evaluar(bx, filaNR1, { ...entradaOtraBanda, bandaRiesgo: 'NR 1 y 2 +' });
  assert.equal(rCoincide.elegible, true);
});

test('topN: una sola oferta por banco (la mejor), ordenadas y recortadas a N', () => {
  const r = [
    { bancoClave: 'a', plazoAnios: 20, mensualidadInicial: 12000 },
    { bancoClave: 'a', plazoAnios: 15, mensualidadInicial: 9000 },   // la mejor de "a"
    { bancoClave: 'b', plazoAnios: 20, mensualidadInicial: 11000 },
    { bancoClave: 'c', plazoAnios: 20, mensualidadInicial: 8000 },   // la mejor de todas
    { bancoClave: 'd', plazoAnios: 20, mensualidadInicial: 15000 },
  ];
  const top3 = topN(r, 3);
  assert.equal(top3.length, 3);
  assert.deepEqual(top3.map((x) => x.bancoClave), ['c', 'a', 'b']); // 8000, 9000, 11000
  assert.equal(top3[0].mensualidadInicial, 8000);
  assert.equal(top3[1].mensualidadInicial, 9000); // y no 12000: se queda con la mejor variante de "a"
  // nunca dos filas del mismo banco
  assert.equal(new Set(top3.map((x) => x.bancoClave)).size, 3);
  // con menos bancos distintos que N, regresa los que haya sin reventar
  assert.equal(topN([r[0], r[2]], 3).length, 2); // bancos "a" y "b": 2 bancos distintos, N=3
});

test('topN con otro criterio (menor tasa) ordena distinto', () => {
  const r = [
    { bancoClave: 'a', mensualidadInicial: 9000, tasa: 0.12 },
    { bancoClave: 'b', mensualidadInicial: 8000, tasa: 0.15 },
  ];
  const porTasa = topN(r, 2, (x) => x.tasa);
  assert.deepEqual(porTasa.map((x) => x.bancoClave), ['a', 'b']); // 0.12 < 0.15, aunque "b" tenga menor mensualidad
});
