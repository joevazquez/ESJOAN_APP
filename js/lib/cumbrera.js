// La "cumbrera": avance del expediente dibujado como la línea de techo del logo
import { ESTATUS, idxEstatus } from './constantes.js';
import { h, svg } from './ui.js';

function partir(texto) {
  const palabras = texto.split(' ');
  const lineas = [];
  let l = '';
  for (const p of palabras) {
    if ((l + ' ' + p).trim().length > 13 && l) { lineas.push(l); l = p; } else l = (l + ' ' + p).trim();
  }
  if (l) lineas.push(l);
  return lineas;
}

export function cumbrera(estatus) {
  const idx = idxEstatus(estatus);
  const pts = ESTATUS.map((e, i) => ({ x: 62 + i * 127, y: 110 - i * 17, e, i }));
  const trazo = (n) => pts.slice(0, n + 1).map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
  const hijos = [
    svg('path', { class: 'rafter-bg', d: trazo(pts.length - 1) }),
  ];
  if (idx > 0) {
    hijos.push(svg('path', { class: 'rafter-shadow', d: trazo(idx), transform: 'translate(5 6)' }));
    hijos.push(svg('path', { class: 'rafter-done', d: trazo(idx) }));
  }
  for (const p of pts) {
    const cls = p.i < idx ? 'hecho' : p.i === idx ? 'actual' : '';
    if (cls === 'actual' && estatus !== 'firmado') hijos.push(svg('circle', { class: 'halo', cx: p.x, cy: p.y, r: 13 }));
    hijos.push(svg('circle', { class: 'nodo ' + cls, cx: p.x, cy: p.y, r: cls === 'actual' ? 14 : 11 }));
    if (p.i < idx || (cls === 'actual' && estatus === 'firmado')) {
      hijos.push(svg('path', { class: 'tick', d: `M${p.x - 4.5} ${p.y} l3.2 3.4 l6 -6.6` }));
    }
    const lineas = partir(p.e.corto);
    hijos.push(svg('text', { class: cls, x: p.x, y: p.y + 40 }, lineas.map((t, k) => svg('tspan', { x: p.x, dy: k ? 15 : 0 }, t))));
  }
  const raiz = svg('svg', { viewBox: '0 0 780 185', role: 'img', 'aria-label': 'Avance del expediente: ' + ESTATUS[idx].largo }, hijos);
  const lista = h('ol', { class: 'cumbrera-lista', 'aria-label': 'Avance del expediente' },
    ESTATUS.map((e, i) => h('li', { class: i < idx ? 'hecho' : i === idx ? 'actual' : '', 'aria-current': i === idx ? 'step' : null }, (i < idx ? '✓ ' : '') + e.largo)));
  return h('div', { class: 'cumbrera' }, raiz, lista);
}
