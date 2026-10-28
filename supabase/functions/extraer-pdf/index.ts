// ESJOAN · Extrae los datos de un documento PDF (Buró de Crédito o estado de
// cuenta bancario) usando el modelo Claude (Anthropic), que puede leer PDFs
// de forma nativa.
//
// Esto corre en Supabase (Edge Functions, Deno), NO en el navegador, porque
// necesita la llave de Anthropic (ANTHROPIC_API_KEY) y esa llave nunca debe
// llegar al navegador. La llama directo la pantalla "Análisis financiero"
// (fetch autenticado con el JWT de quien da clic en "Extraer de Buró" /
// "Extraer de estado de cuenta"), igual que eliminar-usuario.
//
// Reemplaza por completo la extracción por regex de js/lib/extraccion.js
// (confirmado con el Business Owner): ya no se usa pdf.js en el navegador
// para esto, Claude lee el PDF directo. La revisión humana del broker antes
// de guardar NO cambia: la UI sigue mostrando "evidencia" y el broker sigue
// corrigiendo a mano antes de confirmar.
//
// Solo un administrador o el broker asignado al expediente del documento
// puede pedir esta extracción (se re-implementa aquí la misma regla que
// es_staff_de_expediente() en SQL, porque service_role no pasa por RLS).
//
// Secretos que necesita además de los que Supabase inyecta solo
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-5-20250929   (opcional, ver nota abajo)
//
// NOTA sobre el modelo: usa el id de modelo de Anthropic vigente al momento
// de desplegar (verifícalo en https://docs.claude.com/en/docs/about-claude/models).
// Por eso es configurable por secreto en vez de quedar fijo en el código.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5-20250929';
const BUCKET = 'expedientes';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// Esquemas de salida (mismas formas que extraerBuro()/extraerEstadoCuenta()
// en js/lib/extraccion.js, para no tener que tocar la UI de exp_analisis.js).
// ---------------------------------------------------------------------------

const TOOL_BURO = {
  name: 'reportar_buro',
  description: 'Reporta los datos extraídos de un reporte de Buró de Crédito.',
  input_schema: {
    type: 'object',
    properties: {
      score: { type: ['integer', 'null'], description: 'Score / calificación crediticia, si aparece.' },
      numCreditosActivos: { type: ['integer', 'null'], description: 'Número de créditos activos/vigentes.' },
      montoCreditosActivos: { type: ['number', 'null'], description: 'Suma del saldo actual de los créditos activos, en pesos.' },
      pagoMensualEstimado: { type: ['number', 'null'], description: 'Suma de los pagos mensuales reportados de los créditos activos, en pesos.' },
      tieneAtrasos: { type: 'boolean', description: 'true si hay algún crédito con atraso o clave de mora relevante (p.ej. 97/98/99 o "atraso").' },
      evidencia: {
        type: 'array', items: { type: 'string' },
        description: 'Lista breve, en español, de frases textuales o citas del documento que justifican cada dato anterior, para que el broker las revise contra el PDF original.',
      },
    },
    required: ['tieneAtrasos', 'evidencia'],
  },
};

const TOOL_ESTADO = {
  name: 'reportar_estado_cuenta',
  description: 'Reporta los datos extraídos de un estado de cuenta bancario.',
  input_schema: {
    type: 'object',
    properties: {
      ingresoMensualEstimado: { type: ['number', 'null'], description: 'Ingreso mensual estimado a partir de depósitos de nómina recurrentes, en pesos.' },
      deudaMensualEstimada: { type: ['number', 'null'], description: 'Suma de domiciliaciones/pagos de deuda mensuales detectados, en pesos.' },
      mesesDetectados: { type: ['integer', 'null'], description: 'Número de meses distintos que cubre el estado de cuenta analizado.' },
      evidencia: {
        type: 'array', items: { type: 'string' },
        description: 'Lista breve, en español, de frases textuales o citas del documento que justifican cada dato anterior, para que el broker las revise contra el PDF original.',
      },
    },
    required: ['evidencia'],
  },
};

const PROMPT_BURO = `Eres un asistente que ayuda a un broker hipotecario mexicano a leer un reporte de Buró de Crédito adjunto en PDF. Extrae: el score/calificación, el número de créditos activos, la suma del saldo de esos créditos activos, la suma de sus pagos mensuales, y si existe algún atraso (incluye claves de mora como 97, 98, 99, o cualquier mención textual de atraso/mora). Usa la herramienta "reportar_buro" para responder. Si un dato no aparece en el documento, repórtalo como null (excepto tieneAtrasos, que siempre debe ser true o false). En "evidencia" cita, en español y de forma breve, las frases o cifras exactas del documento en las que basaste cada dato, para que el broker pueda verificarlas contra el PDF original antes de confirmar nada — esto es solo apoyo, la decisión final siempre la toma una persona.`;

const PROMPT_ESTADO = `Eres un asistente que ayuda a un broker hipotecario mexicano a leer un estado de cuenta bancario adjunto en PDF. Extrae: el ingreso mensual estimado (a partir de depósitos de nómina recurrentes, no depósitos aislados), la deuda mensual estimada (a partir de domiciliaciones o pagos recurrentes de créditos/tarjetas), y cuántos meses distintos cubre el documento. Usa la herramienta "reportar_estado_cuenta" para responder. Si un dato no se puede determinar, repórtalo como null. En "evidencia" cita, en español y de forma breve, las cifras o movimientos exactos del documento en los que basaste cada dato, para que el broker pueda verificarlos contra el PDF original antes de confirmar nada — esto es solo apoyo, la decisión final siempre la toma una persona.`;

async function llamarClaude(pdfBase64: string, tipo: 'buro' | 'estado_cuenta') {
  const tool = tipo === 'buro' ? TOOL_BURO : TOOL_ESTADO;
  const prompt = tipo === 'buro' ? PROMPT_BURO : PROMPT_ESTADO;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1536,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Anthropic respondió ${resp.status}: ${texto.slice(0, 500)}`);
  }
  const data = await resp.json();
  const bloque = (data.content || []).find((c: { type: string }) => c.type === 'tool_use');
  if (!bloque) throw new Error('Claude no devolvió los datos en el formato esperado.');
  return bloque.input;
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    // Quién llama: se identifica con su propio JWT (el que manda el navegador).
    const sbComoLlamante = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user: llamante }, error: errUser } = await sbComoLlamante.auth.getUser();
    if (errUser || !llamante) return json({ error: 'No autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const documentoId = body.documento_id as string | undefined;
    const tipo = body.tipo as 'buro' | 'estado_cuenta' | undefined;
    if (!documentoId) return json({ error: 'Falta documento_id.' }, 400);
    if (tipo !== 'buro' && tipo !== 'estado_cuenta') return json({ error: 'tipo debe ser "buro" o "estado_cuenta".' }, 400);

    // De aquí en adelante, service_role: hace el trabajo real sin pasar por RLS.
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: perfilLlamante } = await sb.from('profiles').select('rol, activo').eq('id', llamante.id).maybeSingle();
    if (!perfilLlamante || !perfilLlamante.activo || (perfilLlamante.rol !== 'admin' && perfilLlamante.rol !== 'broker')) {
      return json({ error: 'No tienes permiso para solicitar esta extracción.' }, 403);
    }

    const { data: doc, error: errDoc } = await sb
      .from('documentos').select('id, storage_path, expediente_id').eq('id', documentoId).maybeSingle();
    if (errDoc) throw errDoc;
    if (!doc) return json({ error: 'Documento no encontrado.' }, 404);

    // Equivalente a es_staff_de_expediente(): admin, o el broker asignado a ESE expediente.
    if (perfilLlamante.rol !== 'admin') {
      const { data: exp, error: errExp } = await sb
        .from('expedientes').select('id, broker_id').eq('id', doc.expediente_id).maybeSingle();
      if (errExp) throw errExp;
      if (!exp || exp.broker_id !== llamante.id) {
        return json({ error: 'No tienes acceso a este expediente.' }, 403);
      }
    }

    const { data: archivo, error: errDescarga } = await sb.storage.from(BUCKET).download(doc.storage_path);
    if (errDescarga) throw errDescarga;
    const bytes = new Uint8Array(await archivo.arrayBuffer());

    // Base64 por bloques, para no reventar la pila con PDFs grandes.
    let binario = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binario += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binario);

    const resultado = await llamarClaude(base64, tipo);
    return json({ resultado });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});