// ESJOAN · Notifica por correo al cliente cuando pasa algo importante con su
// expediente: se crea (INSERT) o se cancela (UPDATE a estatus "cancelado").
//
// Esta función corre en Supabase (Edge Functions, Deno), NO en el navegador.
// La disparan dos Database Webhooks sobre la tabla "expedientes":
//   - uno de INSERT (ya existía)
//   - uno de UPDATE (nuevo, ver instrucciones de despliegue más abajo)
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

    const nombre = cliente.nombre_completo || 'Hola';
    const link = `${SITIO_URL}#/expediente/${exp.id}`;

    if (esCreacion) {
      await enviarCorreo(
        cliente.email,
        'Se abrió tu expediente de crédito hipotecario',
        `
          <p>Hola ${nombre},</p>
          <p>Tu broker en ESJOAN acaba de abrir tu expediente de crédito hipotecario.
          Ya puedes entrar a la plataforma para dar seguimiento a tu trámite y subir
          tu documentación.</p>
          <p><a href="${link}">Ver mi expediente</a></p>
          <p>Si no esperabas este correo, contáctanos respondiendo a este mensaje.</p>
          <p>— ESJOAN Soluciones Inmobiliarias</p>
        `,
      );
      return new Response('Correo de creación enviado', { status: 200 });
    }

    // esCancelacion
    await enviarCorreo(
      cliente.email,
      'Tu expediente de crédito hipotecario fue cancelado',
      `
        <p>Hola ${nombre},</p>
        <p>Tu expediente de crédito hipotecario fue cancelado por tu broker o por ESJOAN.
        No se perdió ninguna información: tus documentos, tu historial y tu análisis
        siguen disponibles si necesitas retomarlo.</p>
        <p><a href="${link}">Ver mi expediente</a></p>
        <p>Si no esperabas este correo o tienes dudas, contáctanos respondiendo a este mensaje.</p>
        <p>— ESJOAN Soluciones Inmobiliarias</p>
      `,
    );
    return new Response('Correo de cancelación enviado', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }
});