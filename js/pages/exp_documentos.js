import * as api from '../lib/api.js';
import { h, icono, banner, toast, confirmar, pedirTexto, bytes, fechaHora } from '../lib/ui.js';
import { ESTADO_DOC } from '../lib/constantes.js';
import { hoja, requeridos, progreso } from '../lib/comun.js';

async function abrirPDF(path) {
  const w = window.open('about:blank', '_blank');
  try {
    const url = await api.urlDocumento(path);
    if (w) { w.opener = null; w.location.href = url; } else location.href = url;
  } catch (e) { if (w) w.close(); toast(api.mensajeError(e), 'error'); }
}

export function tabDocumentos(d) {
  const { exp, tipos, docs, esStaff, esAdmin, ctx, av } = d;
  const abierto = esStaff || ['creado', 'en_revision_documentacion'].includes(exp.estatus);
  const req = requeridos(tipos, exp.tipo);
  const clavesReq = new Set(req.map((t) => t.clave));
  const otros = docs.filter((x) => !clavesReq.has(x.tipo_clave));
  const nombreTipo = Object.fromEntries(tipos.map((t) => [t.clave, t.nombre]));

  const subir = async (tipo, archivos, zona) => {
    zona.classList.add('over');
    let n = 0;
    for (const f of archivos) {
      try { await api.subirDocumento(exp.id, tipo.clave, f, ctx.uid); n++; } catch (e) { toast(`${f.name}: ${api.mensajeError(e)}`, 'error', 7000); }
    }
    zona.classList.remove('over');
    if (n) { toast(n === 1 ? 'Documento subido.' : `${n} documentos subidos.`, 'ok'); d.recargar(); }
  };

  const filaArchivo = (x) => {
    const puedeBorrar = esAdmin || (!esStaff && x.estado !== 'aprobado' && abierto);
    return h('div', { class: 'doc-file' },
      icono('docs'), h('span', { class: 'nombre' }, x.nombre_archivo), h('span', { class: 'muted small' }, bytes(x.tamano_bytes), ' · ', fechaHora(x.created_at)),
      h('span', { class: 'badge ' + (x.estado === 'aprobado' ? 'ok' : x.estado === 'rechazado' ? 'bad' : 'warn') }, ESTADO_DOC[x.estado]),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => abrirPDF(x.storage_path), 'aria-label': `Ver ${x.nombre_archivo}` }, icono('ojo'), 'Ver'),
      esStaff && x.estado !== 'aprobado' ? h('button', { class: 'btn btn-outline btn-sm', onclick: () => revisar(x, 'aprobado') }, icono('check'), 'Aprobar') : null,
      esStaff && x.estado !== 'rechazado' ? h('button', { class: 'btn btn-danger btn-sm', onclick: () => rechazar(x) }, icono('x'), 'Rechazar') : null,
      esStaff && x.estado !== 'pendiente' ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => revisar(x, 'pendiente') }, 'Regresar a revisión') : null,
      puedeBorrar ? h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': `Eliminar ${x.nombre_archivo}`, onclick: () => borrar(x) }, icono('basura')) : null,
      x.estado === 'rechazado' && x.motivo_rechazo ? h('div', { class: 'motivo', style: 'flex-basis:100%' }, h('strong', null, 'Motivo del rechazo: '), x.motivo_rechazo) : null);
  };
  async function revisar(x, estado) { try { await api.revisarDocumento(x.id, estado); toast('Documento actualizado.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); } }
  async function rechazar(x) {
    const motivo = await pedirTexto({ titulo: 'Rechazar documento', etiqueta: 'Motivo (lo verá el cliente)', ayuda: 'Sé específico: por ejemplo "Ilegible", "Vencido", "Falta la cara posterior".', si: 'Rechazar' });
    if (motivo) revisar2(x, motivo);
  }
  async function revisar2(x, motivo) { try { await api.revisarDocumento(x.id, 'rechazado', motivo); toast('Documento rechazado.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); } }
  async function borrar(x) {
    if (!(await confirmar(`¿Eliminar "${x.nombre_archivo}"?`, { titulo: 'Eliminar documento', si: 'Eliminar', peligro: true }))) return;
    try { await api.eliminarDocumento(x); toast('Documento eliminado.', 'ok'); d.recargar(); } catch (e) { toast(api.mensajeError(e), 'error'); }
  }

  const bloque = (t) => {
    const mios = docs.filter((x) => x.tipo_clave === t.clave);
    const vigentes = mios.filter((x) => x.estado !== 'rechazado');
    const estado = vigentes.some((x) => x.estado === 'aprobado') && vigentes.every((x) => x.estado === 'aprobado') ? 'ok' : vigentes.length ? 'wait' : mios.length ? 'bad' : '';
    const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, class: 'sr-only', id: 'f_' + t.clave, onchange: (e) => { subir(t, [...e.target.files], zona); e.target.value = ''; } });
    const zona = h('label', { class: 'dropzone', for: 'f_' + t.clave,
      ondragover: (e) => { e.preventDefault(); zona.classList.add('over'); }, ondragleave: () => zona.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); subir(t, [...e.dataTransfer.files], zona); } },
      icono('subir'), ' Arrastra un PDF aquí o ', h('u', null, 'elige un archivo'), h('span', { class: 'small' }, ' (máx. 10 MB)'));
    return h('div', { class: 'doc-req ' + estado },
      h('div', { class: 'ico' }, icono(estado === 'ok' ? 'check' : estado === 'bad' ? 'x' : estado === 'wait' ? 'reloj' : 'docs')),
      h('div', null, h('h4', null, t.nombre, ' ', h('span', { class: 'badge plain ' + (t.obligatorio ? 'navy' : '') }, t.obligatorio ? 'Obligatorio' : 'Opcional')),
        t.descripcion ? h('div', { class: 'desc' }, t.descripcion) : null,
        mios.map(filaArchivo),
        abierto ? h('div', null, input, zona) : null),
      h('div'));
  };

  const obligatorios = req.filter((t) => t.obligatorio); const opcionales = req.filter((t) => !t.obligatorio);
  const resumen = h('div', { class: 'stack' },
    h('div', { class: 'row between' }, h('strong', null, `${av.entregados} de ${av.obligatorios} documentos obligatorios entregados`),
      esStaff ? h('span', { class: 'muted small' }, `${docs.filter((x) => x.estado === 'pendiente').length} por revisar`) : null),
    progreso2(av.entregados, av.obligatorios));
  const aviso = !abierto && !esStaff ? banner('info', 'Tu expediente ya avanzó de etapa, por lo que no se pueden subir más documentos. Si necesitas cambiar algo, contacta a tu broker.')
    : (!esStaff && d.exp.estatus === 'creado' && docs.some((x) => x.estado === 'rechazado')) ? banner('warn', 'Hay documentos rechazados. Revisa el motivo y vuelve a subirlos.') : null;

  return h('div', { class: 'stack' }, aviso, hoja(null, resumen),
    hoja('Documentos obligatorios', obligatorios.length ? obligatorios.map(bloque) : h('p', { class: 'muted' }, 'No hay documentos obligatorios configurados.'), { plana: true }),
    opcionales.length ? hoja('Documentos opcionales', opcionales.map(bloque), { plana: true }) : null,
    otros.length ? hoja('Otros documentos', otros.map((x) => h('div', { class: 'doc-req' }, h('div', { class: 'ico' }, icono('docs')), h('div', null, h('h4', null, nombreTipo[x.tipo_clave] || x.tipo_clave), filaArchivo(x)), h('div'))), { plana: true }) : null);
}
function progreso2(n, total) {
  const barra = h('span'); barra.style.width = (total ? (n / total) * 100 : 0) + '%';
  return h('div', { class: 'progress-line' }, barra);
}
