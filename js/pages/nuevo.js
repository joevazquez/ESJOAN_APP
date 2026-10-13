import { crearExpediente, listarClientes, mensajeError } from '../lib/api.js';
import { h, aNumero, banner, conBoton, toast, mxn } from '../lib/ui.js';
import { TIPOS, ESTADOS_MX } from '../lib/constantes.js';
import { cabecera, hoja, campoForm, dinero } from '../lib/comun.js';

export default async function nuevo(ctx) {
  const esAdmin = ctx.perfil.rol === 'admin';
  const clientes = esAdmin ? await listarClientes() : [];
  const msg = h('div');

  const selCliente = esAdmin ? h('select', { class: 'input', required: true }, h('option', { value: '' }, 'Selecciona un cliente…'), clientes.map((c) => h('option', { value: c.id }, `${c.nombre_completo || 'Sin nombre'} · ${c.email}`))) : null;
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
    if (esAdmin && !selCliente.value) err.push('Selecciona el cliente.');
    if (v !== null && v <= 0) err.push('El valor del inmueble debe ser mayor a cero.');
    if (v && m && m > v) err.push('El monto solicitado no puede ser mayor al valor del inmueble.');
    if (!Number.isInteger(p) || p < 1 || p > 30) err.push('El plazo debe ser de 1 a 30 años.');
    if (err.length) return msg.append(banner('bad', err.map((t) => h('p', null, t))));
    await conBoton(btn, async () => {
      try {
        const nuevoExp = await crearExpediente({
          cliente_id: esAdmin ? selCliente.value : ctx.uid, tipo: tipo.value,
          valor_inmueble: v, monto_solicitado: m, plazo_anios: p, ingreso_mensual: i, estado_inmueble: estado.value || null,
        });
        toast('Expediente creado. Ahora sube tu documentación.', 'ok');
        ctx.ir(`#/expediente/${nuevoExp.id}/documentos`);
      } catch (ex) { msg.append(banner('bad', mensajeError(ex))); }
    });
  } }, msg,
    esAdmin ? campoForm('cli', 'Cliente', selCliente, null, 'full') : null,
    h('div', { class: 'form-grid' },
      campoForm('tipo', 'Tipo de crédito', tipo, 'Define qué documentos te pediremos.', 'full'),
      campoForm('valor', 'Valor del inmueble', valor, 'Precio de compra o valor estimado.'),
      campoForm('monto', 'Monto de crédito que buscas', monto, 'Puedes ajustarlo después con tu broker.'),
      campoForm('plazo', 'Plazo deseado (años)', plazo),
      campoForm('ingreso', 'Ingreso mensual comprobable', ingreso, 'Suma de todos los que participan en el crédito.'),
      campoForm('estado', 'Estado donde se ubica el inmueble', estado, 'Afecta el costo del seguro de daños.', 'full')),
    resumen, h('div', { class: 'row' }, btn, h('a', { class: 'btn btn-ghost', href: '#/' }, 'Cancelar')));

  return h('div', null,
    cabecera({ kicker: 'Nuevo trámite', titulo: 'Crear expediente', sub: 'Con estos datos preparamos tu lista de documentos. Todo se puede corregir mientras tu expediente siga en revisión de documentación.' }),
    h('div', { class: 'cols cols-21' }, hoja('Datos del crédito', form),
      h('aside', { class: 'stack' }, banner('info', h('p', null, h('strong', null, 'Tu información está protegida.')), h('p', null, 'Solo tú, tu broker asignado y el personal autorizado de ESJOAN pueden ver tu expediente.')))));
}
