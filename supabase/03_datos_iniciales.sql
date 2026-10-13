-- =====================================================================
--  ESJOAN · Expedientes hipotecarios
--  03 · DATOS INICIALES: catálogo de documentos y bancos/tarifas
--
--  Los bancos se cargan con la "foto" de cada Excel que subiste (tasas vigentes
--  y factores). Están marcados como NO verificados: revisa cada uno en la app
--  (Administración → Bancos) y márcalo como verificado. Idempotente.
-- =====================================================================

insert into public.tipos_documento (clave, nombre, descripcion, obligatorio, aplica_tipos, orden) values
 ('identificacion','Identificación oficial vigente','INE por ambos lados o pasaporte',true,null,10),
 ('curp','CURP','Formato actualizado',true,null,20),
 ('constancia_fiscal','Constancia de situación fiscal (RFC)','Emitida por el SAT, con antigüedad máxima de 3 meses',true,null,30),
 ('acta_nacimiento','Acta de nacimiento','Copia certificada reciente',true,null,40),
 ('comprobante_domicilio','Comprobante de domicilio','Máximo 3 meses de antigüedad',true,null,50),
 ('comprobantes_ingresos','Comprobantes de ingresos','Recibos de nómina de los últimos 3 meses',true,null,60),
 ('estados_cuenta','Estados de cuenta bancarios','Últimos 3 meses donde se deposita tu nómina',true,null,70),
 ('acta_matrimonio','Acta de matrimonio','Solo si estás casado(a) y se incluirá al cónyuge',false,null,80),
 ('constancia_infonavit','Constancia de crédito Infonavit','Precalificación o constancia de saldo de subcuenta',true,'{cofinavit,apoyo_infonavit}',90),
 ('promesa_compraventa','Promesa de compraventa o carta oferta','Firmada por comprador y vendedor',true,'{adquisicion,cofinavit,apoyo_infonavit}',100),
 ('escrituras','Escrituras del inmueble','Del inmueble que se compra o que se deja en garantía',true,null,110),
 ('predial','Boleta predial al corriente','Del año en curso',true,null,120),
 ('recibo_agua','Recibo de agua al corriente','Últimos 2 meses',false,null,130),
 ('estado_cuenta_hipoteca','Estado de cuenta de la hipoteca actual','Del banco que hoy tiene tu crédito',true,'{sustitucion,liquidez,mejora}',140)
on conflict (clave) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, obligatorio = excluded.obligatorio,
  aplica_tipos = excluded.aplica_tipos, orden = excluded.orden;

-- ---------- Bancos ----------

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('banorte', 'Banorte', '#EB0029', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30.4/360", "apertura_pct": 0.01, "apertura_financiable": true, "admin_mensual": 299, "admin_iva": false, "vida_pct": 0.0006, "danos_pct": 0.00028, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "fijo", "monto": 9280}, "pti": 0.5, "pti_base": "pago", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.95, "apoyo_infonavit": 0.95, "default": 0.9}, "plazo_min": 10, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, '16062026_Simulador_Hipotecario.xlsm', '2026-07-13', false, 'Avalúo fijo tomado de un caso de $3.8 M (en Banorte varía por valor). Pago calculado con días 30.4/360, igual que su Excel.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('afirme', 'Afirme', '#00843D', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0.01, "apertura_financiable": false, "admin_mensual": 399, "admin_iva": true, "vida_pct": 0.0008, "danos_pct": 9.9018e-05, "seguro_otros_pct": 0.00013926, "otros_gastos_iniciales": 301.6, "investigacion": 0, "avaluo": {"tipo": "pct", "pct": 0.0025}, "pti": null, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.9, "apoyo_infonavit": 0.9, "default": 0.9}, "plazo_min": 5, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, 'NUEVAS_TASAS.xlsm', '2026-08-10', false, 'Incluye seguro de desempleo y contenidos (≈0.014 % mensual del monto) y trámite CUV ($301.60). Su Excel no publica el ingreso mínimo: captúralo en "pti" cuando lo tengas.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('bx', 'BX+ (Ve por Más)', '#0B4EA2', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0.01, "apertura_financiable": false, "admin_mensual": 299, "admin_iva": true, "vida_pct": 0.00065, "danos_pct": 0.000349, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "fijo", "monto": 6960}, "pti": 0.495, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.9, "apoyo_infonavit": 0.9, "default": 0.9}, "plazo_min": 5, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, 'SIMULADOR_BX_.xlsx', '2026-08-01', false, 'La tasa de su Excel depende del enganche: 10.20 % aplica con 30 % de enganche (aforo 70 %). Agrega filas para otros aforos.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('mifel', 'Mifel', '#1B3A6B', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "valor", "base_dias": "30/360", "apertura_pct": 0.005, "apertura_financiable": false, "admin_mensual": 0, "admin_iva": false, "vida_pct": 0.00049, "danos_pct": 5.389e-05, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "tabla", "tramos": [{"hasta": 1000000, "monto": 2900.0}, {"hasta": 1500000, "monto": 4715.4}, {"hasta": 2000000, "monto": 5556.4}, {"hasta": 2500000, "monto": 6803.4}, {"hasta": 3000000, "monto": 8079.4}, {"hasta": 3500000, "monto": 8427.4}, {"hasta": 4000000, "monto": 9616.4}, {"hasta": 4500000, "monto": 10805.4}, {"hasta": 5000000, "monto": 11994.4}, {"hasta": 5500000, "monto": 13137.0}, {"hasta": 6000000, "monto": 14355.0}, {"hasta": 6500000, "monto": 15660.0}, {"hasta": 7000000, "monto": 16936.0}, {"hasta": 7500000, "monto": 18212.0}, {"hasta": 8000000, "monto": 18954.4}, {"hasta": 8500000, "monto": 19720.0}, {"hasta": 9000000, "monto": 20590.0}, {"hasta": 9500000, "monto": 21460.0}, {"hasta": 10000000, "monto": 22156.0}, {"hasta": 12000000, "monto": 24940.0}, {"hasta": 14000000, "monto": 26564.0}, {"hasta": 16000000, "monto": 30276.0}, {"hasta": 18000000, "monto": 33988.0}, {"hasta": 20000000, "monto": 36540.0}], "resto_pct": 0.00174}, "pti": 0.65, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.97, "apoyo_infonavit": 0.97, "default": 0.9}, "plazo_min": 5, "plazo_max": 25, "monto_min": null, "monto_max": null}'::jsonb, 'SIMULADOR_HIPOTECARIO_MIFEL_v_06_2026.xlsm', '2026-08-05', false, 'Avalúo con la tabla de tarifas de su Excel (con IVA). Su hoja DATOS muestra 9.60 % para algunos perfiles: valida cuál aplica.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('hsbc', 'HSBC', '#DB0011', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0, "apertura_financiable": false, "admin_mensual": 0, "admin_iva": false, "vida_pct": 0.00044, "danos_pct": 0.0003174, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "tabla", "tramos": [{"hasta": 500000, "monto": 2146}, {"hasta": 1000000, "monto": 3422}, {"hasta": 2000000, "monto": 5916}, {"hasta": 3000000, "monto": 9222}, {"hasta": 4000000, "monto": 12470}, {"hasta": 5000000, "monto": 15370}, {"hasta": 7000000, "monto": 19952}, {"hasta": 10000000, "monto": 23200}], "resto_monto": 24360}, "pti": 0.65, "pti_base": "pago", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.95, "apoyo_infonavit": 0.95, "default": 0.9}, "plazo_min": 5, "plazo_max": 25, "monto_min": null, "monto_max": null}'::jsonb, 'Simulador_Comercial_Hip_Full_HSBC_ABRIL26_111_V3.xlsm', '2026-08-31', false, 'Tasas tomadas del catálogo de su Excel (Adquisición · Persona física · Pago fijo puntual). NR = nivel de riesgo. Falta cargar Sustitución, Liquidez y esquema Pago bajo puntual.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('banamex', 'Banamex', '#E2001A', false, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0, "apertura_financiable": false, "admin_mensual": 0, "admin_iva": false, "vida_pct": 0.000474, "danos_pct": 0.0003, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "fijo", "monto": 0}, "pti": null, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.9, "apoyo_infonavit": 0.9, "default": 0.9}, "plazo_min": 5, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, 'Simulador_HipoAGOSTO_20260824v3.xlsm', '2026-08-24', false, 'DESACTIVADO por defecto: el Excel llegó sin datos capturados (fórmulas con #VALUE!). Se rescató la tasa 9.05 % y el factor de vida; el factor de daños (0.03 %) y el avalúo son supuestos. Complétalos y activa el banco.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('bbva', 'BBVA', '#004481', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "valor", "base_dias": "30/360", "apertura_pct": 0, "apertura_financiable": false, "admin_mensual": 0, "admin_iva": false, "vida_pct": 0.00060003, "danos_pct": 0.00019965, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 780, "avaluo": {"tipo": "fijo", "monto": 8500}, "pti": 0.4, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.9, "apoyo_infonavit": 0.9, "default": 0.9}, "plazo_min": 5, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, 'Simulador_Único_v2_40_L_F__1_AGOST_23.xlsx', '2026-08-22', false, 'Tasa 10.80 % corresponde a puntaje de score menor a 820. Su Excel tiene otras tasas por score y programa que aún no están cargadas.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('santander', 'Santander', '#EC0000', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0, "apertura_financiable": false, "admin_mensual": 350, "admin_iva": true, "vida_pct": 0.0005154, "danos_pct": 0.0003, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "fijo", "monto": 9000}, "pti": 0.6, "pti_base": "total", "aforo_max": {"tradicional": 0.9, "cofinavit": 0.9, "apoyo_infonavit": 0.9, "default": 0.9}, "plazo_min": 5, "plazo_max": 20, "monto_min": null, "monto_max": null}'::jsonb, 'bhf-034_FEBR_2026.xlsm', '2026-08-22', false, 'Pagos crecientes con incremento anual de 1.45 % (su Excel). El modelo del incremento es una aproximación: contrasta la mensualidad inicial con su simulador.')
on conflict (clave) do nothing;

insert into public.bancos (clave, nombre, color, activo, parametros, fuente, vigencia, verificado, notas)
values ('scotiabank', 'Scotiabank', '#EC111A', true, '{"iva": 0.16, "destructible_pct": 0.7, "danos_base": "destructible", "base_dias": "30/360", "apertura_pct": 0, "apertura_financiable": false, "admin_mensual": 0, "admin_iva": false, "vida_pct": 0.0006, "danos_pct": 0.00031, "seguro_otros_pct": 0, "otros_gastos_iniciales": 0, "investigacion": 0, "avaluo": {"tipo": "fijo", "monto": 11000}, "pti": 0.55, "pti_base": "total", "aforo_max": {"tradicional": 0.95, "cofinavit": 0.9, "apoyo_infonavit": 0.95, "default": 0.95}, "plazo_min": 5, "plazo_max": 20, "monto_min": 250000, "monto_max": 15000000}'::jsonb, 'simulador-residencial-multiproducto_082026.xlsm', '2026-08-27', false, 'Pricing "Nuevo": 10.75 % con incremento anual 2.4 % (pagos crecientes). Aproximación del modelo de incremento (5 años). Comisión de apertura: 1.25 % tradicional, 0.75 % con Infonavit.')
on conflict (clave) do nothing;

-- ---------- Tasas (solo se cargan si el banco aún no tiene tasas) ----------

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca Fuerte', 'adquisicion', '*', 'fijo', 'Perfil 1 (Premium)', 0.088, 10, 20, 0, 1, null, null, null, null, 0, 0, true, null),
  ('Hipoteca Fuerte', 'adquisicion', '*', 'fijo', 'Perfil 2', 0.0975, 10, 20, 0, 1, null, null, null, null, 0, 0, true, null),
  ('Hipoteca Fuerte', 'adquisicion', '*', 'fijo', 'Perfil 3', 0.108, 10, 20, 0, 1, null, null, null, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'banorte'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca fija', 'adquisicion', '*', 'fijo', 'Tasa base', 0.104, 5, 20, 0, 1, null, null, null, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'afirme'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Esquema tradicional', 'adquisicion', '*', 'fijo', 'Enganche 30 %', 0.102, 5, 20, 0, 0.7, null, null, null, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'bx'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca Mifel', 'adquisicion', '*', 'fijo', 'Tasa cotizada', 0.103, 5, 25, 0, 1, null, null, null, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'mifel'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 20, 20, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 20, 20, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 15, 15, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 15, 15, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 10, 10, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 10, 10, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 5, 5, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 5, 5, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 20, 20, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 20, 20, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 15, 15, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 15, 15, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 10, 10, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 10, 10, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 5, 5, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3', 0.104, 5, 5, 0, 0.95, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 20, 20, 0, 0.9, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3', 0.104, 20, 20, 0, 0.85, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 15, 15, 0, 0.9, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3', 0.104, 15, 15, 0, 0.85, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 10, 10, 0, 0.9, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3', 0.104, 10, 10, 0, 0.85, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2', 0.101, 5, 5, 0, 0.9, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3', 0.104, 5, 5, 0, 0.85, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 20, 20, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 20, 20, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.104, 15, 15, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.101, 15, 15, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.104, 10, 10, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 10, 10, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2', 0.101, 5, 5, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3', 0.104, 5, 5, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3', 0.106, 25, 25, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3', 0.106, 20, 20, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3', 0.106, 15, 15, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3', 0.106, 10, 10, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3', 0.106, 5, 5, 0, 0.95, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · GSC · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.0, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 1 y 2 +', 0.0945, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Nómina Especial · NR 3 +', 0.101, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 20, 20, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3', 0.106, 20, 20, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 15, 15, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3', 0.106, 15, 15, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 10, 10, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3', 0.106, 10, 10, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2', 0.103, 5, 5, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3', 0.106, 5, 5, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2', 0.103, 20, 20, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3', 0.106, 20, 20, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2', 0.103, 15, 15, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3', 0.106, 15, 15, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2', 0.103, 10, 10, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3', 0.106, 10, 10, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2', 0.103, 5, 5, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3', 0.106, 5, 5, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Poder Judicial · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'apoyo_infonavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'cofinavit', 'fijo', 'Premier · nan · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 25, 25, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3', 0.106, 25, 25, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 20, 20, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3', 0.106, 20, 20, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 15, 15, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3', 0.106, 15, 15, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 10, 10, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3', 0.106, 10, 10, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2', 0.103, 5, 5, 0, 0.9, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3', 0.106, 5, 5, 0, 0.85, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 20, 20, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 20, 20, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 15, 15, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 15, 15, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 10, 10, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 10, 10, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2', 0.103, 5, 5, 0, 0.9, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3', 0.106, 5, 5, 0, 0.85, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Nómina · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.005, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'No Premier · Normal · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 25, 25, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3 +', 0.103, 25, 25, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 20, 20, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3 +', 0.103, 20, 20, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 15, 15, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3 +', 0.103, 15, 15, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 10, 10, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3 +', 0.103, 10, 10, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 1 y 2 +', 0.0965, 5, 5, 0, 0.7, null, null, 0.01, null, 0, 0, true, null),
  ('Hipoteca HSBC', 'adquisicion', 'tradicional', 'fijo', 'Premier · nan · NR 3 +', 0.103, 5, 5, 0, 0.7, null, null, 0.01, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'hsbc'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca Perfiles Banamex', 'adquisicion', '*', 'fijo', 'Tasa de referencia', 0.0905, 5, 20, 0, 1, null, null, null, null, 0, 0, true, 'Tomada de la hoja TablaPerfiles; confirmar contra el simulador vigente')
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'banamex'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Hipoteca Fija BBVA', 'adquisicion', '*', 'fijo', 'Score < 820 pts', 0.108, 5, 20, 0, 1, null, null, null, null, 0, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'bbva'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Pagos crecientes', 'adquisicion', '*', 'creciente', 'Perfil 5', 0.1025, 5, 20, 0, 1, null, null, null, null, 0.0145, 0, true, null),
  ('Pagos crecientes', 'adquisicion', '*', 'creciente', 'Perfil 3', 0.1095, 5, 20, 0, 1, null, null, null, null, 0.0145, 0, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'santander'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);

insert into public.bancos_tasas (banco_id, producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
select b.id, x.producto::text, x.destino::text, x.programa::text, x.esquema::text, x.perfil::text, x.tasa::numeric,
       x.plazo_min::int, x.plazo_max::int, x.aforo_min::numeric, x.aforo_max::numeric, x.monto_min::numeric, x.monto_max::numeric,
       x.comision_apertura::numeric, x.pti::numeric, x.incremento_anual::numeric, x.incremento_anios::int, x.activo::boolean, x.notas::text
from public.bancos b
cross join (values
  ('Adquisición tradicional', 'adquisicion', 'tradicional', 'creciente', 'Pricing nuevo', 0.1075, 5, 20, 0, 0.95, null, null, 0.0125, 0.55, 0.024, 5, true, null),
  ('Adquisición con apoyo Infonavit', 'adquisicion', 'apoyo_infonavit', 'creciente', 'Pricing nuevo', 0.1075, 5, 20, 0, 0.95, null, null, 0.0075, 0.65, 0.024, 5, true, null),
  ('Adquisición Cofinavit', 'adquisicion', 'cofinavit', 'creciente', 'Pricing nuevo', 0.1075, 5, 20, 0, 0.9, null, null, 0.0075, 0.65, 0.024, 5, true, null)
) as x(producto, destino, programa, esquema, perfil, tasa, plazo_min, plazo_max, aforo_min, aforo_max, monto_min, monto_max, comision_apertura, pti, incremento_anual, incremento_anios, activo, notas)
where b.clave = 'scotiabank'
  and not exists (select 1 from public.bancos_tasas t where t.banco_id = b.id);
