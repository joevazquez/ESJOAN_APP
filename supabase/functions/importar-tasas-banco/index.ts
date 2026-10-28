// ESJOAN · Lee el archivo Excel/xlsm propio de un banco (su simulador interno,
// con decenas de hojas, fórmulas y formatos distintos en cada banco) y usa
// Claude (Anthropic) para encontrar la tabla de tasas vigente y devolverla ya
// en el formato plano que usa el editor de "Bancos y tarifas"
// (js/pages/admin_banco.js), con las mismas columnas que VACIA()/COLS ahí.
//
// Antes, un administrador tenía que abrir el Excel del banco a mano, localizar
// las tasas y volver a teclearlas en la plantilla del CRM. Esta función hace
// esa parte: el admin solo sube el archivo del banco tal cual se lo mandaron,
// revisa el resultado en pantalla (igual que con "Importar Excel/CSV" hoy) y
// confirma con "Guardar tarifas" — la revisión humana antes de guardar NO
// cambia.
//
// Corre en Supabase (Edge Functions, Deno) porque necesita ANTHROPIC_API_KEY,
// que nunca debe llegar al navegador. La llama directo la pantalla de cada
// banco (fetch autenticado con el JWT del administrador), igual que
// eliminar-usuario y extraer-pdf. Solo un administrador puede usarla (dar de
// alta/editar tasas de bancos es una pantalla exclusiva de admin).
//
// Secretos que necesita (además de los que Supabase inyecta solo):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (ya debería estar puesto)
//   supabase secrets set ANTHROPIC_MODEL=...             (opcional, ver extraer-pdf)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5-20250929';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-filename',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Mismas listas que js/lib/constantes.js (TIPOS) y js/lib/simulador.js (PROGRAMAS).
const DESTINOS = ['*', 'adquisicion', 'cofinavit', 'apoyo_infonavit', 'sustitucion', 'liquidez', 'mejora', 'construccion'];
const PROGRAMAS = ['*', 'tradicional', 'cofinavit', 'apoyo_infonavit'];
const ESQUEMAS = ['fijo', 'creciente'];

// ---------------------------------------------------------------------------
// 1) Excel del banco → texto (CSV por hoja), con un presupuesto de caracteres
//    para no mandarle a Claude archivos gigantes de 29 hojas sin necesidad.
// ---------------------------------------------------------------------------
const PRESUPUESTO_TEXTO = 180_000;

function excelATexto(bytes: Uint8Array): { texto: string; hojas: string[]; truncado: boolean } {
  const wb = XLSX.read(bytes, { type: 'array', cellNF: false, cellHTML: false });
  const nombres = wb.SheetNames.filter((nombre, i) => {
    const info = wb.Workbook?.Sheets?.[i];
    return !info || !info.Hidden; // se saltan hojas ocultas: casi siempre catálogos/auxiliares, no la tabla final
  });
  let texto = '';
  let truncado = false;
  const usadas: string[] = [];
  for (const nombre of nombres) {
    const ws = wb.Sheets[nombre];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (!csv.trim()) continue;
    const bloque = `\n## Hoja: ${nombre}\n${csv}\n`;
    if (texto.length + bloque.length > PRESUPUESTO_TEXTO) { truncado = true; break; }
    texto += bloque;
    usadas.push(nombre);
  }
  return { texto, hojas: usadas, truncado };
}

// ---------------------------------------------------------------------------
// 2) Esquema de salida: igual a VACIA()/COLS de admin_banco.js, para que el
//    navegador pueda meter el resultado directo a la cuadrícula de edición.
// ---------------------------------------------------------------------------
const FILA_PROPS = {
  producto: { type: ['string', 'null'], description: 'Nombre comercial del producto/programa, tal como lo llama el banco (p. ej. "Hipotecario Plus", "Residencial"). Null si no aplica.' },
  destino: { type: 'string', enum: DESTINOS, description: 'A qué tipo de crédito aplica esta tasa. "*" si el banco no distingue (aplica a todos).' },
  programa: { type: 'string', enum: PROGRAMAS, description: '"*" salvo que la fila sea específicamente para Cofinavit o Apoyo Infonavit.' },
  esquema: { type: 'string', enum: ESQUEMAS, description: '"creciente" solo si la tasa sube con los años (debe venir con incremento_anual > 0); si no, "fijo".' },
  perfil: { type: ['string', 'null'], description: 'Condición o perfil que distingue esta fila de otras del mismo producto (p. ej. "Nómina", "PYME", "Aforo 80-90%"). Null si no hay distinción.' },
  tasa: { type: 'number', description: 'Tasa anual como FRACCIÓN, no porcentaje: 10.25% se reporta como 0.1025.' },
  plazo_min: { type: ['integer', 'null'], description: 'Plazo mínimo en AÑOS (si el Excel lo da en meses, conviértelo).' },
  plazo_max: { type: ['integer', 'null'], description: 'Plazo máximo en AÑOS.' },
  aforo_min: { type: ['number', 'null'], description: 'Aforo (loan-to-value) mínimo, como fracción (90% = 0.9).' },
  aforo_max: { type: ['number', 'null'], description: 'Aforo máximo, como fracción.' },
  comision_apertura: { type: ['number', 'null'], description: 'Comisión por apertura, como fracción (1.5% = 0.015). Null si el Excel no la da para esta fila.' },
  pti: { type: ['number', 'null'], description: 'Capacidad de pago / PTI máximo exigido, como fracción. Null si no aplica.' },
  incremento_anual: { type: ['number', 'null'], description: 'Solo para esquema creciente: cuánto sube la tasa cada año, como fracción. 0 si es fijo.' },
  incremento_anios: { type: ['integer', 'null'], description: 'Solo para esquema creciente: durante cuántos años sube. 0 si es fijo.' },
  monto_min: { type: ['number', 'null'], description: 'Monto mínimo de crédito en pesos, si el Excel lo especifica.' },
  monto_max: { type: ['number', 'null'], description: 'Monto máximo de crédito en pesos, si el Excel lo especifica.' },
  notas: { type: ['string', 'null'], description: 'Cualquier condición relevante que no entre en los demás campos (p. ej. "solo clientes con nómina en el banco").' },
};

const TOOL = {
  name: 'reportar_tarifas',
  description: 'Reporta la tabla de tasas hipotecarias vigente que encontraste en el archivo del banco, ya lista para cargar en el sistema.',
  input_schema: {
    type: 'object',
    properties: {
      filas: {
        type: 'array',
        description: 'Una fila por cada combinación de producto/plazo/aforo/perfil con tasa propia. Si el banco solo tiene una tasa fija sin importar plazo o aforo, basta una fila.',
        items: { type: 'object', properties: FILA_PROPS, required: ['destino', 'programa', 'esquema', 'tasa'] },
      },
      avisos: {
        type: 'array', items: { type: 'string' },
        description: 'En español: qué tan confiable es la lectura, qué hojas usaste, y cualquier dato ambiguo, desactualizado o que no pudiste determinar con certeza — para que el administrador lo revise antes de guardar.',
      },
    },
    required: ['filas', 'avisos'],
  },
};

const PROMPT = `Eres un asistente que ayuda a un administrador de un broker hipotecario mexicano a dar de alta en su sistema las tasas vigentes de un banco. Te doy el contenido (como texto, hoja por hoja) del archivo Excel que el banco le mandó al broker — normalmente es el simulador interno del banco, con muchas hojas: catálogos, fórmulas de cálculo, tablas de amortización, formularios de captura, control de cambios, etc.

Tu trabajo es encontrar, dentro de todo eso, la TABLA DE TASAS VIGENTE (la lista oficial de tasas por producto/plazo/aforo/perfil que el banco ofrece hoy) e ignorar lo demás: no reportes tablas de amortización mes a mes, formularios de captura de datos de un cliente en particular, catálogos de personal, ni hojas de "control de cambios" — esas no son tasas.

Repórtalo con la herramienta "reportar_tarifas": una fila por cada combinación de producto/plazo/aforo/perfil que tenga su propia tasa. Si el banco ofrece la misma tasa sin importar plazo o aforo, una sola fila basta. Si hay varias tasas según el plazo (p. ej. 10.25% a 15 años, 10.75% a 20 años) o según el aforo (loan-to-value), repórtalas como filas separadas.

En "avisos" dime, en español y de forma breve: qué hoja(s) usaste como fuente, qué tan seguro estás de la lectura, y cualquier cosa ambigua, contradictoria o que no pudiste determinar (por ejemplo si el archivo parece tener tasas de más de una fecha, o si una hoja tenía fórmulas que no pudiste seguir). Esto es apoyo para un administrador que SIEMPRE revisa el resultado contra el archivo original antes de guardar nada — nunca se guarda automáticamente.`;

async function llamarClaude(texto: string, truncado: boolean) {
  const notaTruncado = truncado ? '\n\n(Nota: el archivo tenía más hojas de las que te puedo mandar aquí; estas son las primeras que cupieron. Si la tabla de tasas no aparece, dilo en los avisos.)' : '';
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: PROMPT + notaTruncado + '\n\n--- CONTENIDO DEL ARCHIVO ---\n' + texto }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Anthropic respondió ${resp.status}: ${t.slice(0, 500)}`);
  }
  const data = await resp.json();
  const bloque = (data.content || []).find((c: { type: string }) => c.type === 'tool_use');
  if (!bloque) throw new Error('Claude no devolvió los datos en el formato esperado.');
  return bloque.input as { filas: unknown[]; avisos: string[] };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const sbComoLlamante = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user: llamante }, error: errUser } = await sbComoLlamante.auth.getUser();
    if (errUser || !llamante) return json({ error: 'No autenticado' }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: perfil } = await sb.from('profiles').select('rol, activo').eq('id', llamante.id).maybeSingle();
    if (!perfil || !perfil.activo || perfil.rol !== 'admin') {
      return json({ error: 'Solo un administrador activo puede importar tarifas con IA.' }, 403);
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length) return json({ error: 'No llegó ningún archivo.' }, 400);
    if (bytes.length > 15 * 1024 * 1024) return json({ error: 'El archivo es demasiado grande (máximo 15 MB).' }, 400);

    let texto: string, hojas: string[], truncado: boolean;
    try {
      ({ texto, hojas, truncado } = excelATexto(bytes));
    } catch (e) {
      return json({ error: 'No pude abrir el archivo como Excel. ¿Es un .xlsx o .xlsm válido? Detalle: ' + (e instanceof Error ? e.message : String(e)) }, 400);
    }
    if (!texto.trim()) return json({ error: 'El archivo no tiene hojas con datos legibles (o todas están ocultas).' }, 400);

    const resultado = await llamarClaude(texto, truncado);
    return json({ filas: resultado.filas, avisos: resultado.avisos, hojasLeidas: hojas });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});