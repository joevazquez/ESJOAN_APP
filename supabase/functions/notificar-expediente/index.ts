// ESJOAN · Notifica por correo al cliente cuando pasa algo importante con su
// expediente: se crea (INSERT) o se cancela (UPDATE a estatus "cancelado").
//
// Esta función corre en Supabase (Edge Functions, Deno), NO en el navegador.
// La disparan dos Database Webhooks sobre la tabla "expedientes":
//   - uno de INSERT
//   - uno de UPDATE (solo dispara correo si el estatus nuevo es "cancelado")
// Por eso la API Key de Resend puede vivir aquí como secreto del proyecto,
// nunca en el código del repositorio ni en js/config.js.
//
// Variables de entorno que necesita (se configuran con `supabase secrets set`):
//   RESEND_API_KEY   — la API key de Resend (dominio esjoansoluciones.com)
//   WEBHOOK_SECRET    — cadena inventada por ti, para que solo el webhook de
//                       Supabase pueda llamar a esta función
//   SITIO_URL         — opcional; por defecto usa la URL de GitHub Pages
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase solo,
// no hace falta configurarlos a mano.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITIO_URL = Deno.env.get('SITIO_URL') ?? 'https://joevazquez.github.io/ESJOAN_APP/';
const LOGO_URL = `${SITIO_URL}assets/logo-esjoan.jpg`;

// ---- Colores de marca ESJOAN (mismos que css/styles.css) --------------------------------------
const NAVY = '#171B38';
const RED = '#E40C19';
const RED_DARK = '#B90813';
const GRIS_TEXTO = '#3A4174';
const GRIS_CLARO = '#F4F5FA';
const BORDE = '#E4E6F1';

/**
 * Plantilla HTML base de los correos de ESJOAN. Usa tablas y estilos inline
 * (no <style> en <head>) porque es lo único que se ve bien en todos los
 * clientes de correo (Gmail, Outlook, Apple Mail, etc.).
 */
function plantillaCorreo({ preheader, kicker, titulo, cuerpoHtml, cta, colorBoton = RED }: {
  preheader: string;
  kicker: string;
  titulo: string;
  cuerpoHtml: string;
  cta: { texto: string; url: string } | null;
  colorBoton?: string;
}) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo}</title>
  </head>
  <body style="margin:0;padding:0;background:${GRIS_CLARO};font-family:Georgia,'Times New Roman',serif;">
    <!-- Preheader: texto corto que algunos clientes muestran junto al asunto, invisible en el cuerpo -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GRIS_CLARO};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDE};">

            <!-- Cabecera con logo -->
            <tr>
              <td style="background:${NAVY};padding:28px 32px;text-align:center;">
                <img src="${LOGO_URL}" alt="ESJOAN Soluciones Inmobiliarias" width="160" style="display:inline-block;max-width:160px;height:auto;border-radius:6px;" />
              </td>
            </tr>

            <!-- Barra de acento -->
            <tr><td style="height:4px;background:${RED};line-height:4px;font-size:0;">&nbsp;</td></tr>

            <!-- Contenido -->
            <tr>
              <td style="padding:36px 32px 8px;">
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${RED};font-weight:bold;">${kicker}</p>
                <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${NAVY};">${titulo}</h1>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${GRIS_TEXTO};">
                  ${cuerpoHtml}
                </div>
              </td>
            </tr>

            ${cta ? `
            <!-- Botón -->
            <tr>
              <td style="padding:8px 32px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:${colorBoton};">
                      <a href="${cta.url}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${cta.texto}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}

            <!-- Pie -->
            <tr>
              <td style="padding:20px 32px;background:${GRIS_CLARO};border-top:1px solid ${BORDE};">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${GRIS_TEXTO};">
                  Si no esperabas este correo, contáctanos respondiendo a este mensaje.<br />
                  — <strong>ESJOAN Soluciones Inmobiliarias</strong>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function enviarCorreo(to: string, subject: string, html: string) {
  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ESJOAN Soluciones Inmobiliarias <notificaciones@esjoansoluciones.com>',
      to,
      subject,
      html,
    }),
  });
  if (!envio.ok) throw new Error(`Resend respondió ${envio.status}: ${await envio.text()}`);
}

Deno.serve(async (req) => {
  try {
    // Solo el webhook de Supabase (que manda este header secreto) puede llamar aquí.
    if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
      return new Response('No autorizado', { status: 401 });
    }

    const payload = await req.json();
    // Payload típico de un Database Webhook: { type, table, record, old_record }
    if (payload.table !== 'expedientes') {
      return new Response('Ignorado (no es la tabla expedientes)', { status: 200 });
    }

    const esCreacion = payload.type === 'INSERT';
    const esCancelacion = payload.type === 'UPDATE'
      && payload.record?.estatus === 'cancelado'
      && payload.old_record?.estatus !== 'cancelado';

    if (!esCreacion && !esCancelacion) {
      return new Response('Ignorado (no aplica para notificar)', { status: 200 });
    }
    const exp = payload.record;

    // Service role: lee el perfil del cliente sin pasar por RLS (esta función
    // corre fuera del navegador, nunca expone esta clave al cliente).
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: cliente, error } = await sb
      .from('profiles')
      .select('nombre_completo, email')
      .eq('id', exp.cliente_id)
      .maybeSingle();
    if (error) throw error;
    if (!cliente) return new Response('Cliente no encontrado, no se envía correo', { status: 200 });

    const nombre = (cliente.nombre_completo || '').split(' ')[0] || 'Hola';
    const link = `${SITIO_URL}#/expediente/${exp.id}`;

    if (esCreacion) {
      const html = plantillaCorreo({
        preheader: 'Tu broker en ESJOAN abrió tu expediente de crédito hipotecario.',
        kicker: 'Expediente creado',
        titulo: `¡Hola, ${nombre}! Tu expediente ya está abierto`,
        cuerpoHtml: `
          <p style="margin:0 0 14px;">Tu broker en ESJOAN acaba de abrir tu expediente de crédito hipotecario.</p>
          <p style="margin:0;">Ya puedes entrar a la plataforma para dar seguimiento a tu trámite y subir tu documentación.</p>
        `,
        cta: { texto: 'Ver mi expediente', url: link },
      });
      await enviarCorreo(cliente.email, 'Se abrió tu expediente de crédito hipotecario', html);
      return new Response('Correo de creación enviado', { status: 200 });
    }

    // esCancelacion
    const html = plantillaCorreo({
      preheader: 'Tu expediente de crédito hipotecario fue cancelado.',
      kicker: 'Expediente cancelado',
      titulo: `Hola, ${nombre}: tu expediente fue cancelado`,
      cuerpoHtml: `
        <p style="margin:0 0 14px;">Tu expediente de crédito hipotecario fue cancelado por tu broker o por ESJOAN.</p>
        <p style="margin:0;">No se perdió ninguna información: tus documentos, tu historial y tu análisis siguen disponibles si necesitas retomarlo.</p>
      `,
      cta: { texto: 'Ver mi expediente', url: link },
      colorBoton: NAVY,
    });
    await enviarCorreo(cliente.email, 'Tu expediente de crédito hipotecario fue cancelado', html);
    return new Response('Correo de cancelación enviado', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }
});