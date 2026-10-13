# ESJOAN · CRM hipotecario

Sistema web para llevar expedientes de crédito hipotecario: los clientes suben sus documentos en PDF y ven solo su expediente, los brokers ven solo lo que se les asigna, el administrador ve todo, y dentro de cada expediente hay un **simulador que compara 8 bancos** con tarifas editables sin tocar código.

- **Frontend:** HTML + CSS + JavaScript puro (sin instalar nada, sin compilar) → se publica en **GitHub Pages**.
- **Backend:** **Supabase** (Postgres + Auth + Storage). Toda la seguridad vive en la base de datos (RLS), no en el navegador.

**Flujo obligatorio del expediente** (se calcula solo con los documentos y con las acciones del broker):
`Creado → En revisión de documentación → Documentación completa → En avalúo → En proceso de firma → Firmado`

---

## Estructura de la carpeta

```
esjoan-crm/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js          ← AQUÍ pegas tu URL y llave de Supabase (Paso 4)
│   ├── app.js, lib/, pages/, vendor/
├── assets/                (logo, favicon, tipografías)
├── supabase/
│   ├── 01_esquema.sql     ← se ejecuta primero
│   ├── 02_seguridad.sql   ← segundo
│   ├── 03_datos_iniciales.sql  ← tercero (documentos requeridos + 9 bancos con tarifas)
│   ├── 04_primer_admin.sql     ← cuarto, después de registrarte (Paso 6)
│   ├── 05_busqueda_expedientes.sql  ← quinto: búsqueda y paginación a escala (miles de expedientes, varios brokers a la vez)
│   └── 06_analisis_financiero.sql   ← sexto: análisis de capacidad de pago (estado de cuenta + Buró)
├── tests/                 (pruebas; no se publican)
└── .github/workflows/pages.yml  ← publica el sitio automáticamente
```

---

## Instalación paso a paso

### Paso 1 · Crear el proyecto en Supabase
1. Entra a <https://supabase.com> → **Start your project** → inicia sesión (con GitHub es lo más fácil).
2. **New project** → nombre `esjoan-crm`, elige una contraseña de base de datos (guárdala en tu gestor de contraseñas) y una región cercana a México (por ejemplo *East US*).
3. Espera 1–2 minutos a que termine de crearse.

### Paso 2 · Crear las tablas, la seguridad y los datos
En Supabase, menú izquierdo → **SQL Editor** → **New query**. Para **cada** archivo, en este orden exacto: abre el archivo, copia **todo** su contenido, pégalo en el editor y pulsa **Run**. Debe decir *Success*.

1. `supabase/01_esquema.sql`
2. `supabase/02_seguridad.sql`
3. `supabase/03_datos_iniciales.sql`
4. `supabase/05_busqueda_expedientes.sql`
5. `supabase/06_analisis_financiero.sql`

> Si algo falla, no sigas: copia el mensaje de error y revísalo antes de continuar. `01` y `02` se pueden volver a ejecutar sin problema. `03` ejecútalo **una sola vez**: no pisa bancos ni tarifas existentes, pero sí restablece el catálogo de documentos requeridos a los valores iniciales.

### Paso 3 · Configurar el acceso (Authentication)
En Supabase → **Authentication** (los nombres exactos de los menús pueden variar un poco según la versión del panel):

- **URL Configuration**
  - *Site URL*: la dirección final de tu sitio, por ejemplo `https://TU-USUARIO.github.io/esjoan-crm/`
  - *Redirect URLs*: agrega esa misma dirección (con la diagonal final).
- **Sign In / Providers → Email**: deja activado **Confirm email**. En *Minimum password length* pon **10**.
- **Multi-Factor**: verifica que **TOTP** esté habilitado (lo está por defecto). Cada usuario lo activa en *Mi perfil y seguridad*.
- **SMTP (importante):** el correo integrado de Supabase solo envía unos pocos mensajes por hora, y tus clientes recibirán ahí el enlace de confirmación. Antes de usarlo con clientes reales configura tu propio proveedor en **Authentication → Emails → SMTP Settings** (Resend, Brevo o el de tu dominio tienen planes gratuitos).

### Paso 4 · Pegar tus datos en `js/config.js`
En Supabase → **Project Settings → API** copia:
- **Project URL**
- **anon public** (llave pública)

Abre `js/config.js` y reemplaza las dos líneas:

```js
export const SUPABASE_URL = 'https://abcdxyz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> La llave *anon* es pública por diseño. **Nunca** pegues la llave `service_role`.

### Paso 5 · Publicar en GitHub Pages
1. Crea un repositorio en GitHub llamado `esjoan-crm` (público; las páginas gratuitas de GitHub requieren repositorio público. El repositorio no contiene ningún secreto).
2. Sube la carpeta. Desde una terminal dentro de `esjoan-crm/`:
   ```bash
   git init
   git add .
   git commit -m "CRM ESJOAN"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/esjoan-crm.git
   git push -u origin main
   ```
3. En GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Ve a la pestaña **Actions**: el flujo *Publicar en GitHub Pages* corre solo (prueba el motor del simulador y publica). Al terminar te muestra la URL. Cada `git push` posterior republica.

Si tu sitio queda en una dirección distinta a la del Paso 3, corrige *Site URL* y *Redirect URLs* en Supabase.

### Paso 6 · Crear tu usuario administrador
1. Abre tu sitio → **Crea tu perfil** con tu correo → confirma el correo que te llega.
2. En Supabase → **SQL Editor**, abre `supabase/04_primer_admin.sql`, cambia `TU-CORREO@dominio.com` por tu correo y pulsa **Run**. Debe regresar 1 fila con `rol = admin`.
3. Cierra sesión y vuelve a entrar. Ya ves el menú de administración.
4. Ve a **Mi perfil y seguridad** y activa la **verificación en dos pasos**.

### Paso 7 · Dar de alta a los brokers
1. El broker crea su perfil desde la página (queda como *Cliente*).
2. Tú entras a **Usuarios y roles** y le cambias el rol a *Broker hipotecario*.
3. En el detalle de cada expediente, **Broker asignado** → eliges quién lo atiende. El broker solo verá los expedientes que le asignes.

### Paso 8 · Verificar los bancos (muy importante)
Las tarifas se cargaron de los simuladores Excel que compartiste. Antes de mostrar cifras a clientes:
1. **Bancos y tarifas** → abre cada banco → compara 2 o 3 casos contra su simulador oficial.
2. Si todo cuadra, marca **Verificado** y guarda. (Mientras no lo marques, el simulador muestra el aviso *Sin verificar*.)
3. **Banamex** llegó sin datos capturados en su Excel: está **desactivado**. Cuando tengas su tasa, cárgala en el editor y actívalo.

---

## Uso diario

**Actualizar tasas de un banco** (Administración → Bancos y tarifas → el banco):
- Edita las celdas directamente, **o**
- *Descargar Excel* → cambia las tasas → *Importar Excel / CSV*, **o**
- *Pegar desde Excel* (copias las filas con encabezados y pegas).

Después pulsa **Guardar tarifas**. Todo el bloque se reemplaza en una sola operación y queda en **Auditoría**. Las tasas y aforos van en *puntos porcentuales* (10.25 = 10.25 %). El sistema bloquea escalas absurdas (por ejemplo 1050).

**Parámetros de cálculo** (seguros, comisión de apertura, avalúo, PTI, aforos, plazos) están en la misma pantalla, sección *Parámetros de cálculo*.

**Documentos requeridos:** Administración → Documentos requeridos. Puedes agregar, ordenar y definir a qué tipo de crédito aplica cada uno. El estatus de los expedientes se recalcula solo con estas reglas.

**Simulador (broker/admin):** dentro del expediente → *Simulador de crédito*. Compara plazos, captura una tasa negociada, abre el desglose, guarda opciones y decide cuáles **compartir** con el cliente (el cliente solo ve las compartidas, en *Opciones de crédito*).

---

## Seguridad: qué está resuelto y qué te toca a ti

Resuelto en el sistema (probado con 94 pruebas automáticas contra la base):
- Cada cliente solo ve su expediente; el broker solo los asignados; nadie puede darse a sí mismo un rol mayor.
- Los PDF se guardan en un bucket privado con rutas por expediente y se abren con enlaces firmados que expiran en 90 segundos.
- Solo se aceptan PDF (extensión, tipo y firma interna) de hasta 10 MB.
- Las notas internas jamás son visibles para el cliente.
- Verificación en dos pasos (TOTP) disponible; sesión se cierra tras 30 min de inactividad.
- Bitácora de auditoría de bancos, tarifas, documentos requeridos y usuarios.

Te toca a ti:
- **Aviso de privacidad:** el texto en la pantalla de registro es de ejemplo. Sustitúyelo por el aviso integral validado por tu asesor legal (LFPDPPP).
- **Respaldos:** el plan gratuito de Supabase no incluye respaldos descargables automáticos. Programa un respaldo periódico (Supabase → Database → Backups en planes de pago, o exportaciones manuales) antes de operar con volumen.
- **Pausa por inactividad:** los proyectos gratuitos se pausan tras aproximadamente una semana sin actividad; se reactivan con un clic desde el panel de Supabase. Con uso normal no ocurre. Revisa también los límites vigentes de almacenamiento en <https://supabase.com/pricing>: para operar con muchos expedientes con PDF, un plan de pago es la opción robusta.
- Activa 2FA en todas las cuentas de brokers y administradores.

---

## Limitaciones conocidas (dilas al equipo)

- **CAT referencial:** se calcula con la mejor aproximación del flujo de cada banco, pero no siempre coincide al decimal con el CAT publicado por el banco (en BX+ la diferencia fue de ~0.05–0.2 puntos). En pantalla se etiqueta como *referencial*.
- **Pagos crecientes (Scotiabank, Santander):** se modelan con un incremento anual aproximado; la mensualidad inicial puede diferir unos puntos porcentuales del Excel oficial. Verifícalo antes de presentar esas opciones.
- **Banamex:** sin datos (desactivado).
- Todas las cifras del simulador son informativas; las condiciones finales las fija cada banco al autorizar.

## Análisis de capacidad de pago (recomendación asistida de banco)

Dentro de cada expediente, la pestaña **Análisis financiero** (solo broker/admin) lee el estado de cuenta y el reporte de Buró de Crédito que subió el cliente y **propone automáticamente** ingreso mensual, deuda existente, score y banda de riesgo — usando reglas de texto (sin machine learning), nunca una decisión automática: el broker siempre revisa y corrige antes de confirmar, y el cliente nunca ve esta pantalla ni sus datos crudos.

Al confirmar, esos valores prellenan el comparador de bancos (pestaña Simulador) y, cuando hay banda de riesgo confirmada, **filtran las tarifas de HSBC a las que realmente aplican a ese cliente** (ver el hallazgo del EDA: dentro de HSBC la banda de riesgo es el factor que más mueve la tasa). Ejecuta `supabase/06_analisis_financiero.sql` una vez, después de los scripts anteriores, para habilitarlo.

**Limitación honesta:** la extracción de PDF usa expresiones de texto sobre formatos típicos de Buró de Crédito y estados de cuenta mexicanos; no hay dos bancos con el mismo formato exacto, así que trátala como un punto de partida rápido, no como un dato verificado — por eso el diseño obliga a revisar antes de confirmar.

## Análisis de datos (Maestría en Ciencia de Datos)

La carpeta `analisis/` contiene el análisis estadístico exploratorio (EDA) de las tarifas de los 9 bancos — estadística descriptiva, correlaciones y pruebas de hipótesis (ANOVA, Kruskal-Wallis), sin machine learning. Es un insumo real: documenta qué variables realmente mueven la tasa (el aforo sí, el plazo no) y detecta una limitación importante de los datos (HSBC concentra 96% de las tarifas capturadas; el resto de los bancos solo aportan tasas de referencia puntuales). Ábrelo en `analisis/EDA_tasas_hipotecarias.ipynb`.

## Pruebas (opcional, para quien mantenga el código)

```bash
node --test tests/simulador.test.mjs   # motor del simulador (reproduce cifras exactas del Excel de BX+)
```

`tests/mock-supabase.js` y `tests/fixtures.json` son un sustituto de Supabase para probar la interfaz con Playwright sin base de datos real; no se publican.
