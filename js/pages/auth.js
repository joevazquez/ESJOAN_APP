import { sb, mensajeError } from '../lib/api.js';
import { h, svg, icono, banner, conBoton, modal, toast } from '../lib/ui.js';

const RETORNO = () => location.origin + location.pathname;

function arte() {
  const techo = svg('svg', { class: 'techo', viewBox: '0 0 760 480', 'aria-hidden': 'true' },
    svg('path', { class: 'a', d: 'M68 358 L388 98 L728 358 L728 438 L388 198 L68 438 Z' }),
    svg('path', { class: 'b', d: 'M40 330 L360 70 L700 330 L700 410 L360 170 L40 410 Z' }));
  return h('aside', { class: 'acceso-arte', 'aria-hidden': 'false' },
    techo,
    h('div', { class: 'frase' },
      h('h2', null, 'Tu crédito hipotecario, ', h('em', null, 'paso a paso'), '.'),
      h('p', null, 'Sube tu documentación, sigue el avance de tu expediente y conoce en todo momento en qué etapa va tu trámite. Tus datos solo los ve tu broker asignado.')),
    h('div', { class: 'pie' }, 'ESJOAN · SOLUCIONES INMOBILIARIAS'));
}

function caja(titulo, sub, ...contenido) {
  return h('div', { class: 'acceso' }, arte(),
    h('main', { class: 'acceso-form' },
      h('div', { class: 'acceso-caja' },
        h('img', { class: 'logo', src: 'assets/logo-esjoan.jpg', alt: 'ESJOAN Soluciones Inmobiliarias', width: 210 }),
        h('h1', null, titulo), h('span', { class: 'rule' }),
        h('p', { class: 'sub' }, sub), ...contenido)));
}

function campo(id, etiqueta, attrs = {}, ayuda) {
  return h('div', { class: 'field' }, h('label', { for: id }, etiqueta), h('input', { class: 'input', id, name: id, ...attrs }), ayuda ? h('span', { class: 'hint' }, ayuda) : null);
}

// ---- Contraseña: reglas + medidor -------------------------------------------------------------
export function reglasClave(v) {
  return [
    ['Al menos 10 caracteres', v.length >= 10],
    ['Una letra mayúscula y una minúscula', /[a-z]/.test(v) && /[A-Z]/.test(v)],
    ['Un número', /\d/.test(v)],
    ['Un símbolo (por ejemplo: ! # $ %)', /[^A-Za-z0-9]/.test(v)],
  ];
}
function medidorClave(input) {
  const barra = h('span'); const meter = h('div', { class: 'meter', 'aria-hidden': 'true' }, barra);
  const lis = reglasClave('').map(([t]) => h('li', null, t));
  const lista = h('ul', { class: 'chk-lista' }, lis);
  const act = () => {
    const r = reglasClave(input.value); const n = r.filter((x) => x[1]).length;
    r.forEach(([, okk], i) => lis[i].classList.toggle('ok', okk));
    barra.style.width = (n / 4) * 100 + '%';
    barra.style.background = n < 3 ? 'var(--red)' : n === 3 ? 'var(--gold)' : 'var(--ok)';
  };
  input.addEventListener('input', act); act();
  return h('div', null, meter, lista);
}
export const claveValida = (v) => reglasClave(v).every((x) => x[1]);

// ---- Login ------------------------------------------------------------------------------------------------
export function login() {
  const msg = h('div');
  const email = campo('email', 'Correo electrónico', { type: 'email', autocomplete: 'username', required: true, inputmode: 'email' });
  const clave = campo('clave', 'Contraseña', { type: 'password', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Entrar');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const c = email.querySelector('input').value.trim(); const p = clave.querySelector('input').value;
    if (!c || !p) { msg.append(banner('bad', 'Escribe tu correo y contraseña.')); return; }
    await conBoton(btn, async () => {
      const { error } = await sb.auth.signInWithPassword({ email: c, password: p });
      if (error) msg.append(banner('bad', mensajeError(error)));
    });
  } }, msg, email, clave, btn);
  return caja('Iniciar sesión', 'Accede a tu expediente hipotecario.', form,
    h('div', { class: 'alt' },
      h('a', { href: '#/recuperar' }, '¿Olvidaste tu contraseña?'),
      h('span', null, '¿Aún no tienes cuenta? ', h('a', { href: '#/registro' }, 'Crea tu perfil'))));
}

// ---- Registro de cliente ---------------------------------------------------------------------------------------
function avisoPrivacidad() {
  modal({
    titulo: 'Aviso de privacidad', ancho: false,
    cuerpo: h('div', { class: 'small' },
      h('p', null, 'ESJOAN Soluciones Inmobiliarias recabará tus datos personales, financieros y documentos (identificación, comprobantes de ingresos, estados de cuenta, etc.) con la única finalidad de integrar y dar seguimiento a tu solicitud de crédito hipotecario, y de compartirlos con las instituciones financieras que tú autorices para ese trámite.'),
      h('p', null, 'Tus documentos se almacenan cifrados y solo pueden consultarlos tú, el broker que tenga asignado tu expediente y el personal administrativo autorizado. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (ARCO) escribiendo al correo de contacto de ESJOAN.'),
      h('p', { class: 'muted' }, '[Texto de ejemplo: sustitúyelo por el aviso de privacidad integral que valide tu asesor legal conforme a la LFPDPPP.]')),
    acciones: [{ texto: 'Entendido', clase: 'btn-primary', onclick: (c) => c() }],
  });
}
export function registro() {
  const msg = h('div');
  const nombre = campo('nombre', 'Nombre completo', { autocomplete: 'name', required: true, maxlength: 120 });
  const tel = campo('tel', 'Teléfono (WhatsApp)', { type: 'tel', autocomplete: 'tel', maxlength: 30, inputmode: 'tel' });
  const email = campo('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const clave = campo('clave', 'Contraseña', { type: 'password', autocomplete: 'new-password', required: true });
  const medidor = medidorClave(clave.querySelector('input'));
  clave.append(medidor);
  const acepto = h('input', { type: 'checkbox', id: 'acepto' });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Crear mi perfil');
  const cont = h('div');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const v = { n: nombre.querySelector('input').value.trim(), t: tel.querySelector('input').value.trim(), c: email.querySelector('input').value.trim(), p: clave.querySelector('input').value };
    if (v.n.length < 3) return msg.append(banner('bad', 'Escribe tu nombre completo.'));
    if (!/^\S+@\S+\.\S+$/.test(v.c)) return msg.append(banner('bad', 'Escribe un correo válido.'));
    if (!claveValida(v.p)) return msg.append(banner('bad', 'La contraseña no cumple los requisitos de seguridad.'));
    if (!acepto.checked) return msg.append(banner('bad', 'Debes aceptar el aviso de privacidad para continuar.'));
    await conBoton(btn, async () => {
      const { error } = await sb.auth.signUp({ email: v.c, password: v.p, options: { data: { nombre_completo: v.n, telefono: v.t }, emailRedirectTo: RETORNO() } });
      if (error) return msg.append(banner('bad', mensajeError(error)));
      // Mensaje genérico (no revela si el correo ya existía)
      cont.replaceChildren(banner('ok', h('p', null, h('strong', null, 'Revisa tu correo.')), h('p', null, 'Si el correo es nuevo, te enviamos un enlace para confirmar tu cuenta. Después podrás iniciar sesión.')), h('a', { class: 'btn btn-outline btn-block', href: '#/login' }, 'Ir a iniciar sesión'));
    });
  } }, msg, nombre, tel, email, clave,
    h('label', { class: 'check', for: 'acepto' }, acepto, h('span', null, 'Acepto el ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); avisoPrivacidad(); } }, 'aviso de privacidad'), ' y el tratamiento de mis datos para mi trámite hipotecario.')),
    btn);
  cont.append(form);
  return caja('Crea tu perfil', 'Solo toma un minuto. Después podrás subir tus documentos.', cont,
    h('div', { class: 'alt' }, h('span', null, '¿Ya tienes cuenta? ', h('a', { href: '#/login' }, 'Inicia sesión'))));
}

// ---- Recuperar contraseña ----------------------------------------------------------------------------------------------------
export function recuperar() {
  const msg = h('div');
  const email = campo('email', 'Correo electrónico', { type: 'email', required: true, autocomplete: 'email' });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Enviar enlace');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const c = email.querySelector('input').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(c)) return msg.append(banner('bad', 'Escribe un correo válido.'));
    await conBoton(btn, async () => {
      const { error } = await sb.auth.resetPasswordForEmail(c, { redirectTo: RETORNO() });
      if (error && /rate/i.test(error.message)) return msg.append(banner('bad', mensajeError(error)));
      msg.append(banner('ok', 'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.'));
    });
  } }, msg, email, btn);
  return caja('Recuperar contraseña', 'Te enviaremos un enlace a tu correo.', form, h('div', { class: 'alt' }, h('a', { href: '#/login' }, '← Volver a iniciar sesión')));
}

// ---- Nueva contraseña (después del enlace de recuperación) --------------------------------------------------------------------------
export function nuevaClave({ alTerminar }) {
  const msg = h('div');
  const c1 = campo('c1', 'Nueva contraseña', { type: 'password', autocomplete: 'new-password', required: true });
  c1.append(medidorClave(c1.querySelector('input')));
  const c2 = campo('c2', 'Repite la contraseña', { type: 'password', autocomplete: 'new-password', required: true });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Guardar contraseña');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const a = c1.querySelector('input').value; const b = c2.querySelector('input').value;
    if (!claveValida(a)) return msg.append(banner('bad', 'La contraseña no cumple los requisitos de seguridad.'));
    if (a !== b) return msg.append(banner('bad', 'Las contraseñas no coinciden.'));
    await conBoton(btn, async () => {
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) return msg.append(banner('bad', mensajeError(error)));
      toast('Contraseña actualizada.', 'ok'); alTerminar();
    });
  } }, msg, c1, c2, btn);
  return caja('Crea una nueva contraseña', 'Elige una contraseña segura que no uses en otros sitios.', form);
}

// ---- Segundo factor (TOTP) al iniciar sesión ----------------------------------------------------------------------------------------
export function retoMFA({ alTerminar }) {
  const msg = h('div');
  const codigo = campo('codigo', 'Código de 6 dígitos', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]*', required: true }, 'Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator, Authy…).');
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Verificar');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const cod = codigo.querySelector('input').value.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cod)) return msg.append(banner('bad', 'Escribe los 6 dígitos del código.'));
    await conBoton(btn, async () => {
      const f = await sb.auth.mfa.listFactors();
      const factor = f.data && f.data.totp && f.data.totp[0];
      if (!factor) return msg.append(banner('bad', 'No se encontró tu verificador. Contacta al administrador.'));
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: cod });
      if (error) return msg.append(banner('bad', 'Código incorrecto o vencido. Inténtalo de nuevo.'));
      alTerminar();
    });
  } }, msg, codigo, btn);
  return caja('Verificación en dos pasos', 'Por seguridad, confirma que eres tú.', form,
    h('div', { class: 'alt' }, h('a', { href: '#', onclick: async (e) => { e.preventDefault(); await sb.auth.signOut(); } }, 'Cancelar y salir')));
}

// ---- 2FA obligatorio para personal (broker/admin): se activa antes de dejarlos entrar -----------------------------------------
export function mfaObligatorio({ alTerminar }) {
  const zona = h('div', { class: 'stack' }, h('p', { class: 'sub' }, 'Preparando tu código QR…'));
  (async () => {
    try {
      const { data: fac } = await sb.auth.mfa.listFactors();
      for (const f of (fac && fac.all || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
        await sb.auth.mfa.unenroll({ factorId: f.id }); // limpia intentos previos sin terminar
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ESJOAN ' + new Date().toISOString().slice(0, 10) });
      if (error) throw error;
      const cod = h('input', { class: 'input', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code', 'aria-label': 'Código de 6 dígitos', placeholder: '000000' });
      const btn = h('button', { class: 'btn btn-primary btn-block', onclick: () => conBoton(btn, async () => {
        if (!/^\d{6}$/.test(cod.value.trim())) return toast('Escribe los 6 dígitos.', 'error');
        const r = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: cod.value.trim() });
        if (r.error) return toast('Código incorrecto. Revisa la hora de tu teléfono e inténtalo de nuevo.', 'error');
        toast('Verificación en dos pasos activada.', 'ok'); alTerminar();
      }) }, 'Verificar y activar');
      zona.replaceChildren(
        h('ol', { class: 'stack', style: 'padding-left:18px' },
          h('li', null, 'Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator, Authy…) y agrega una cuenta escaneando este código QR.',
            h('div', { style: 'margin-top:10px' }, h('div', { class: 'qr' }, h('img', { src: data.totp.qr_code, alt: 'Código QR para tu app autenticadora' })))),
          h('li', null, 'Si no puedes escanear, escribe esta clave manualmente: ', h('code', { class: 'mono', style: 'user-select:all;word-break:break-all' }, data.totp.secret)),
          h('li', null, 'Escribe el código de 6 dígitos que muestra la app:', h('div', { class: 'row', style: 'margin-top:8px' }, cod, btn))));
    } catch (e) { zona.replaceChildren(banner('bad', mensajeError(e))); }
  })();
  return caja('Activa tu verificación en dos pasos', 'Por tu rol, necesitas tenerla activa para continuar. Solo toma un minuto.', zona,
    h('div', { class: 'alt' }, h('a', { href: '#', onclick: async (e) => { e.preventDefault(); await sb.auth.signOut(); } }, 'Cerrar sesión')));
}

export function pantallaConfig() {
  return h('div', { class: 'acceso-form', style: 'min-height:100vh' }, h('div', { class: 'acceso-caja' },
    h('h1', null, 'Falta configurar Supabase'), h('span', { class: 'rule' }),
    h('p', { class: 'sub' }, 'Abre el archivo ', h('code', null, 'js/config.js'), ' y pega la URL y la llave pública (anon) de tu proyecto de Supabase. Los pasos exactos están en el README.')));
}