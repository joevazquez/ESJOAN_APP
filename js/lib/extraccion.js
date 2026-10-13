// Extracción automática de datos desde PDF (estado de cuenta + Buró de Crédito).
// Heurísticas de texto, sin machine learning: busca patrones conocidos y regresa
// valores CANDIDATOS que el broker siempre revisa y puede corregir antes de
// confirmarlos (ver exp_analisis.js). Nunca se usan directo sin pasar por ahí.

const cargarScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[data-lib="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.dataset.lib = src;
  s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de PDF.'));
  document.head.append(s);
});

let listo = null;
async function pdfjs() {
  if (!listo) {
    listo = cargarScript('js/vendor/pdf.min.js').then(() => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
    });
  }
  await listo;
  return window.pdfjsLib;
}

/** Texto plano de todas las páginas de un PDF (Blob/ArrayBuffer). */
export async function textoDePDF(bytes) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: bytes }).promise;
  let texto = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const contenido = await pagina.getTextContent();
    texto += contenido.items.map((it) => it.str).join(' ') + '\n';
  }
  return texto;
}

const aNum = (s) => { const n = Number(String(s).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };

/**
 * Extrae del texto de un Reporte de Crédito Especial (Buró de Crédito):
 * score, número de créditos activos, su saldo total, pago mensual estimado
 * y si hay historial de atrasos. Formato estándar mexicano (Buró de Crédito /
 * Círculo de Crédito): busca las etiquetas que ambos usan casi siempre.
 */
export function extraerBuro(texto) {
  const t = texto.replace(/\s+/g, ' ');
  const resultado = { score: null, numCreditosActivos: null, montoCreditosActivos: null, pagoMensualEstimado: null, tieneAtrasos: null, evidencia: [] };

  // Score: 3 dígitos (300-850) cerca de la palabra "SCORE" o "PUNTAJE"
  const mScore = t.match(/(?:SCORE|PUNTAJE)[^0-9]{0,25}(\d{3})/i);
  if (mScore) {
    const v = Number(mScore[1]);
    if (v >= 300 && v <= 850) { resultado.score = v; resultado.evidencia.push(`Score detectado: "${mScore[0].trim()}"`); }
  }

  // Créditos activos: cuenta ocurrencias de "Cuenta" seguidas de "Vigente"/"Al corriente"
  const cuentas = [...t.matchAll(/Cuenta[s]?\s*(?:No\.?|Número)?\s*\d*.{0,60}?(Vigente|Al corriente|Activa)/gi)];
  if (cuentas.length) { resultado.numCreditosActivos = cuentas.length; resultado.evidencia.push(`${cuentas.length} cuenta(s) vigente(s) detectadas`); }

  // Saldo total de esas cuentas: suma de montos que siguen a "Saldo Actual"
  const saldos = [...t.matchAll(/Saldo\s*Actual[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/gi)].map((m) => aNum(m[1])).filter((n) => n != null);
  if (saldos.length) { resultado.montoCreditosActivos = saldos.reduce((a, b) => a + b, 0); resultado.evidencia.push(`${saldos.length} "Saldo Actual" sumados`); }

  // Pago mensual: suma de montos que siguen a "Pago" / "Mensualidad" / "Importe a pagar"
  const pagos = [...t.matchAll(/(?:Pago(?:\s+Mensual)?|Importe a pagar|Mensualidad)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/gi)].map((m) => aNum(m[1])).filter((n) => n != null);
  if (pagos.length) { resultado.pagoMensualEstimado = pagos.reduce((a, b) => a + b, 0); resultado.evidencia.push(`${pagos.length} pago(s) mensuales sumados`); }

  // Atrasos: claves de mora reales del Buró (97/98/99) son la señal más confiable;
  // las palabras libres ("atraso", "moroso") solo cuentan si NO están negadas
  // ("sin atrasos", "no se detectaron atrasos" no deben marcar positivo).
  const claveMora = /clave\s*9[789]|cartera\s+vencida/i.test(t);
  const mencionLibre = /atras[oó]s?|moros[oa]/i.test(t);
  const negada = /(sin|no\s+(?:se\s+han?|presenta|registra)|ning[uú]n)\s+(?:\w+\s+){0,3}(atras[oó]s?|moros[oa])/i.test(t);
  resultado.tieneAtrasos = claveMora || (mencionLibre && !negada);
  if (claveMora) resultado.evidencia.push('Se detectó una clave de mora (97/98/99) o "cartera vencida"');
  else if (mencionLibre && !negada) resultado.evidencia.push('Se detectaron palabras asociadas a atrasos (revisar con cuidado)');
  else if (mencionLibre && negada) resultado.evidencia.push('El reporte menciona "atrasos" pero en forma negada (ej. "sin atrasos") — no se marcó');

  return resultado;
}

/**
 * Extrae de un estado de cuenta bancario (varios meses concatenados o uno
 * solo): depósitos recurrentes (candidato a ingreso mensual) y retiros
 * recurrentes por domiciliación (candidato a deuda mensual existente).
 * Es un estimado — bancos mexicanos no comparten un formato único, por eso
 * el broker siempre revisa el monto antes de confirmarlo.
 */
export function extraerEstadoCuenta(texto) {
  const t = texto.replace(/\s+/g, ' ');
  const resultado = { ingresoMensualEstimado: null, deudaMensualEstimada: null, mesesDetectados: 0, evidencia: [] };

  // Depósitos de nómina: línea con "DEPOSITO"/"SPEI RECIBIDO"/"NOMINA" seguida de un monto
  const depositos = [...t.matchAll(/(?:DEP[OÓ]SITO|SPEI\s*RECIBIDO|N[OÓ]MINA)[^.$\d]{0,40}\$?\s*([\d,]+(?:\.\d{2})?)/gi)]
    .map((m) => aNum(m[1])).filter((n) => n != null && n > 1000); // descarta montos irrisorios (comisiones, etc.)
  // Domiciliaciones / pagos recurrentes de deuda
  const domiciliaciones = [...t.matchAll(/(?:DOMICILIACI[OÓ]N|PAGO\s+TARJETA|PAGO\s+DE\s+CR[EÉ]DITO)[^.$\d]{0,40}\$?\s*([\d,]+(?:\.\d{2})?)/gi)]
    .map((m) => aNum(m[1])).filter((n) => n != null);

  // Meses detectados (para promediar, no sumar de golpe): busca encabezados "Periodo"/fechas de corte
  const meses = new Set([...t.matchAll(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+20\d{2}/gi)].map((m) => m[0].toUpperCase()));
  resultado.mesesDetectados = meses.size || 1;

  if (depositos.length) {
    resultado.ingresoMensualEstimado = depositos.reduce((a, b) => a + b, 0) / resultado.mesesDetectados;
    resultado.evidencia.push(`${depositos.length} depósito(s) de nómina detectados en ${resultado.mesesDetectados} mes(es)`);
  }
  if (domiciliaciones.length) {
    resultado.deudaMensualEstimada = domiciliaciones.reduce((a, b) => a + b, 0) / resultado.mesesDetectados;
    resultado.evidencia.push(`${domiciliaciones.length} pago(s) recurrente(s) de deuda detectados`);
  }
  return resultado;
}
