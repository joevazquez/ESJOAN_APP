import { sb, actualizarMiPerfil, mensajeError } from '../lib/api.js';
import { h, banner, conBoton, toast, confirmar, icono } from '../lib/ui.js';
import { ROLES } from '../lib/constantes.js';
import { cabecera, hoja, campoForm, campoOcultable } from '../lib/comun.js';
import { reglasClave, claveValida } from './auth.js';

export default async function perfil(ctx) {
  const p = ctx.perfil;
  const fac = await sb.auth.mfa.listFactors();
  const totp = (fac.data && fac.data.all || []).filter((f) => f.factor_type === 'totp');
  const verificado = totp.find((f) => f.status === 'verified');

  // ---- datos ----------------------------------------------------------------------------------------------
  const nombre = h('input', { class: 'input', value: p.nombre_completo || '', maxlength: 120, autocomplete: 'name' });
  const tel = h('input', { class: 'input', value: p.telefono || '', maxlength: 30, type: 'tel', autocomplete: 'tel' });
  const bDatos = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar cambios');
  const formDatos = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); conBoton(bDatos, async () => {
    if (nombre.value.trim().length < 3) return toast('Escribe tu nombre completo.', 'error');
    try { await actualizarMiPerfil(ctx.uid, { nombre_completo: nombre.value.trim(), telefono: tel.value.trim() || null }); toast('Datos guardados.', 'ok'); ctx.refrescar(); } catch (er) { toast(mensajeError(er), 'error'); }
  }); } },
    h('div', { class: 'form-grid' }, campoForm('pf_n', 'Nombre completo', nombre),
      campoOcultable('pf_t', 'Teléfono', tel),
      campoOcultable('pf_e', 'Correo electrónico', h('input', { class: 'input', value: p.email, readonly: true, disabled: true }), 'Para cambiar tu correo contacta al administrador.'),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Tipo de cuenta'), h('div', null, h('span', { class: 'badge navy plain' }, ROLES[p.rol])))), bDatos);

  // ---- contraseña -----------------------------------------------------------------------------------------------
  const c1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' }); const c2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const bClave = h('button', { class: 'btn btn-outline', type: 'submit' }, 'Cambiar contraseña');
  const formClave = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); conBoton(bClave, async () => {
    if (!claveValida(c1.value)) return toast('La contraseña debe tener 10+ caracteres, mayúscula, minúscula, número y símbolo.', 'error', 7000);
    if (c1.value !== c2.value) return toast('Las contraseñas no coinciden.', 'error');
    const { error } = await sb.auth.updateUser({ password: c1.value });
    if (error) return toast(mensajeError(error), 'error');
    c1.value = c2.value = ''; toast('Contraseña actualizada.', 'ok');
  }); } }, h('div', { class: 'form-grid' }, campoForm('pc_1', 'Nueva contraseña', c1), campoForm('pc_2', 'Repite la contraseña', c2)), bClave);

  // ---- 2FA --------------------------------------------------------------------------------------------------------------------
  const zonaMFA = h('div', { class: 'stack' });
  if (verificado) {
    zonaMFA.append(banner('ok', h('p', null, h('strong', null, 'Verificación en dos pasos activada.'), ' Al iniciar sesión te pediremos el código de tu app autenticadora.')));
    if (p.rol === 'cliente') {
      zonaMFA.append(h('div', null, h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
        if (!(await confirmar('Tu cuenta quedará protegida solo con contraseña. ¿Desactivar la verificación en dos pasos?', { titulo: 'Desactivar 2FA', si: 'Desactivar', peligro: true }))) return;
        const { error } = await sb.auth.mfa.unenroll({ factorId: verificado.id });
        if (error) return toast(mensajeError(error), 'error'); toast('Verificación desactivada.', 'ok'); ctx.refrescar();
      } }, 'Desactivar')));
    } else {
      zonaMFA.append(banner('info', 'La verificación en dos pasos es obligatoria para tu rol y no se puede desactivar desde aquí. Si cambiaste de teléfono y perdiste el acceso a tu app autenticadora, quien administre el proyecto de Supabase puede quitarte el factor desde Authentication → Users → (tu usuario) → Multi-Factor Authentication, para que puedas volver a activarla.'));
    }
  } else {
    if (p.rol !== 'cliente') zonaMFA.append(banner('warn', 'Como personal con acceso a expedientes de otras personas, te recomendamos fuertemente activar la verificación en dos pasos.'));
    zonaMFA.append(h('p', null, 'Agrega una capa extra de seguridad: además de tu contraseña, necesitarás un código temporal de una app como Google Authenticator, Microsoft Authenticator o Authy.'),
      h('div', null, h('button', { class: 'btn btn-primary', onclick: (e) => iniciarMFA(e.currentTarget) }, icono('llave'), 'Activar verificación en dos pasos')));
  }
  async function iniciarMFA(btn) {
    btn.disabled = true;
    try {
      for (const f of totp.filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id }); // limpia intentos previos
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ESJOAN ' + new Date().toISOString().slice(0, 10) });
      if (error) throw error;
      const cod = h('input', { class: 'input', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code', 'aria-label': 'Código de 6 dígitos', placeholder: '000000' });
      const bV = h('button', { class: 'btn btn-primary', onclick: () => conBoton(bV, async () => {
        if (!/^\d{6}$/.test(cod.value.trim())) return toast('Escribe los 6 dígitos.', 'error');
        const r = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: cod.value.trim() });
        if (r.error) return toast('Código incorrecto. Revisa la hora de tu teléfono e inténtalo de nuevo.', 'error');
        toast('Verificación en dos pasos activada.', 'ok'); ctx.refrescar();
      }) }, 'Verificar y activar');
      zonaMFA.replaceChildren(
        h('ol', { class: 'stack', style: 'padding-left:18px' },
          h('li', null, 'Abre tu app autenticadora y agrega una cuenta escaneando este código QR.', h('div', { style: 'margin-top:10px' }, h('div', { class: 'qr' }, h('img', { src: data.totp.qr_code, alt: 'Código QR para tu app autenticadora' })))),
          h('li', null, 'Si no puedes escanear, escribe esta clave manualmente: ', h('code', { class: 'mono', style: 'user-select:all;word-break:break-all' }, data.totp.secret)),
          h('li', null, 'Escribe el código de 6 dígitos que muestra la app:', h('div', { class: 'row', style: 'margin-top:8px' }, cod, bV))));
    } catch (e) { btn.disabled = false; toast(mensajeError(e), 'error'); }
  }

  return h('div', null,
    cabecera({ kicker: 'Cuenta', titulo: 'Mi perfil y seguridad' }),
    h('div', { class: 'cols cols-2' }, h('div', { class: 'stack' }, hoja('Mis datos', formDatos), hoja('Contraseña', formClave)), hoja('Verificación en dos pasos', zonaMFA)));
}