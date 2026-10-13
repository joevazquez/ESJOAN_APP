import { crearExpediente, buscarClientesParaExpediente, mensajeError } from '../lib/api.js';
import { h, aNumero, banner, conBoton, toast, mxn } from '../lib/ui.js';
import { TIPOS, ESTADOS_MX } from '../lib/constantes.js';
import { cabecera, hoja, campoForm, dinero } from '../lib/comun.js';

// Esta pantalla es solo para broker/admin (ver RUTAS en app.js): el cliente
// nunca "crea" su propio expediente, lo abre su broker al dar de alta el trámite.
export default async function nuevo(ctx) {
  const esBroker = ctx.perfil.rol === 'broker';
  let clienteSel = null; // { id, nombre_completo, email } elegido en la búsqueda
  const msg = h('div');

  // ---- buscador de cliente (por nombre o correo) ---------------------------------------------
  const resultados = h('div', { class: 'stack', style: 'margin-top:8px' });
  const elegido = h('div', { class: 'small', style: 'margin-top:6px' });
  const buscador = h('input', { class: 'input', placeholder: 'Escribe 3+ letras del nombre o correo del cliente…', autocomplete: 'off' });
  let temporizador;
  buscador.addEventListener('input', () => {
    clearTimeout(temporizador);
    const termino = buscador.value.trim();
    clienteSel = null; elegido.replaceChildren();
    if (termino.length < 3) { resultados.replaceChildren(); return; }
    temporizador = setTimeout(async () => {
      let filas = [];
      try { filas = await buscarClientesParaExpediente(termino); } catch (e) { resultados.replaceChildren(banner('bad', mensajeError(e))); return; }
      resultados.replaceChildren(filas.length
        ? h('div', { class: 'stack', role: 'listbox', 'aria-label': 'Clientes encontrados' }, filas.map((c) => h('button', {
            type: 'button', class: 'btn btn-outline btn-sm', style: 'justify-content:flex-start;text-align:left', onclick: () => elegirCliente(c),
          }, `${c.nombre_completo || 'Sin nombre'} · ${c.email}`)))
        : h('p', { class: 'small muted' }, 'Sin resultados. Verifica el nombre o correo, o pide al cliente que termine de registrarse.'));
    }, 300);
  });
  function elegirCliente(c) {
    clienteSel = c; resultados.replaceChildren(); buscador.value = '';
    elegido.replaceChildren(h('span', { class: 'badge ok plain' }, `Cliente: ${c.nombre_completo || 'Sin nombre'} · ${c.email}`),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'margin-left:8px', onclick: () => { clienteSel = null; elegido.replaceChildren(); } }, 'Quitar'));
  }

  const tipo = h('select', { class: 'input' }, Object.entries(TIPOS).map(([k, v]) => h('option', { value: k }, v)));
  const valor = dinero('valor'); const monto = dinero('monto'); const ingreso = dinero('ingreso');
  const plazo = h('input', { class: 'input', type: 'number', min: 1, max: 30, step: 1, value: 20, inputmode: 'numeric' });
  const estado = h('select', { class: 'input' }, h('option', { value: '' }, 'Selecciona…'), ESTADOS_MX.map((e) => h('option', { value: e }, e)));
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Crear expediente');

  const resumen = h('p', { class: 'small muted' });
  const act = () => {
    const v = aNumero(valor.querySelector('input').value); const m = aNumero(monto.querySelector('input').value);
    resumen.textContent = v && m ? `Enganche estimado: ${mxn(Math.max(v - m, 0))} · Aforo: ${((m / v) * 100).toFixed(1)} %` : '';
  };
  valor.addEventListener('input', act); monto.addEventListener('input', act);

  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const v = aNumero(valor.querySelector('input').value); const m = aNumero(monto.querySelector('input').value);
    const i = aNumero(ingreso.querySelector('input').value); const p = Number(plazo.value);
    const err = [];
    if (!clienteSel) err.push('Busca y selecciona al cliente.');
    if (v !== null && v <= 0) err.push('El valor del inmueble debe ser mayor a cero.');
    if (v && m && m > v) err.push('El monto solicitado no puede ser mayor al valor del inmueble.');
    if (!Number.isInteger(p) || p < 1 || p > 30) err.push('El plazo debe ser de 1 a 30 años.');
    if (err.length) return msg.append(banner('bad', err.map((t) => h('p', null, t))));
    await conBoton(btn, async () => {
      try {
        const nuevoExp = await crearExpediente({
          cliente_id: clienteSel.id, broker_id: esBroker ? ctx.uid : null, tipo: tipo.value,
          valor_inmueble: v, monto_solicitado: m, plazo_anios: p, ingreso_mensual: i, estado_inmueble: estado.value || null,
        });
        toast('Expediente creado.', 'ok');
        ctx.ir(`#/expediente/${nuevoExp.id}/documentos`);
      } catch (ex) { msg.append(banner('bad', mensajeError(ex))); }
    });
  } }, msg,
    campoForm('cli', 'Buscar cliente', buscador, 'Busca por nombre o correo; aparece tras escribir 3 o más caracteres.', 'full'),
    resultados, elegido,
    h('div', { class: 'form-grid' },
      campoForm('tipo', 'Tipo de crédito', tipo, 'Define qué documentos se le pedirán.', 'full'),
      campoForm('valor', 'Valor del inmueble', valor, 'Precio de compra o valor estimado.'),
      campoForm('monto', 'Monto de crédito que busca', monto, 'Se puede ajustar después.'),
      campoForm('plazo', 'Plazo deseado (años)', plazo),
      campoForm('ingreso', 'Ingreso mensual comprobable', ingreso, 'Suma de todos los que participan en el crédito.'),
      campoForm('estado', 'Estado donde se ubica el inmueble', estado, 'Afecta el costo del seguro de daños.', 'full')),
    resumen, h('div', { class: 'row' }, btn, h('a', { class: 'btn btn-ghost', href: '#/' }, 'Cancelar')));

  return h('div', null,
    cabecera({ kicker: 'Nuevo trámite', titulo: 'Crear expediente', sub: 'Busca al cliente y captura los datos del crédito. Todo se puede corregir después, mientras el expediente siga en revisión de documentación.' }),
    h('div', { class: 'cols cols-21' }, hoja('Datos del crédito', form),
      h('aside', { class: 'stack' }, banner('info', h('p', null, h('strong', null, 'La información del cliente está protegida.')), h('p', null, 'Solo el cliente, su broker asignado y el personal autorizado de ESJOAN pueden ver su expediente.')))));
}