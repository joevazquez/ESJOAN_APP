export const ESTATUS = [
  { clave: 'creado', corto: 'Creado', largo: 'Expediente creado', desc: 'Sube tu documentación para que tu broker pueda revisarla.' },
  { clave: 'en_revision_documentacion', corto: 'En revisión', largo: 'En revisión de documentación', desc: 'Tu documentación completa está siendo revisada por tu broker.' },
  { clave: 'documentacion_completa', corto: 'Documentación completa', largo: 'Documentación completa', desc: 'Todos los documentos fueron aprobados.' },
  { clave: 'en_avaluo', corto: 'En avalúo', largo: 'En avalúo', desc: 'El avalúo del inmueble ya fue asignado.' },
  { clave: 'en_proceso_firma', corto: 'Proceso de firma', largo: 'En proceso de firma', desc: 'Ya tienes fecha de firma asignada.' },
  { clave: 'firmado', corto: 'Firmado', largo: 'Firmado', desc: '¡Felicidades! Tu crédito hipotecario quedó firmado.' },
];
export const idxEstatus = (clave) => Math.max(0, ESTATUS.findIndex((e) => e.clave === clave));
export const etiquetaEstatus = (clave) => (ESTATUS.find((e) => e.clave === clave) || { largo: clave }).largo;

export const TIPOS = {
  adquisicion: 'Adquisición de vivienda',
  cofinavit: 'Cofinavit',
  apoyo_infonavit: 'Apoyo Infonavit',
  sustitucion: 'Sustitución de hipoteca',
  liquidez: 'Liquidez (crédito con garantía)',
  mejora: 'Mejora de vivienda',
  construccion: 'Construcción',
};
export const ROLES = { cliente: 'Cliente', broker: 'Broker hipotecario', admin: 'Administrador' };
export const ESTADO_DOC = { pendiente: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' };
export const EVENTOS = {
  creado: 'Expediente creado',
  cambio_estatus: 'Cambio de estatus',
  documento_subido: 'Documento subido',
  documento_eliminado: 'Documento eliminado',
  documento_aprobado: 'Documento aprobado',
  documento_rechazado: 'Documento rechazado',
  documento_pendiente: 'Documento regresado a revisión',
  broker_asignado: 'Broker asignado',
  broker_retirado: 'Broker retirado',
  avaluo_asignado: 'Avalúo asignado',
  firma_asignada: 'Fecha de firma asignada',
  firma_confirmada: 'Firma confirmada',
  analisis_financiero_confirmado: 'Análisis de capacidad de pago confirmado',
};

export const ESTADOS_MX = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'];
