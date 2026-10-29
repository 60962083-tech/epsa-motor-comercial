// HU-030 · Facturas de Crosland: lectura del XML y registro en la base central
// Las facturas llegan solas por correo (Apps Script → API de Michelle). Desde el panel también se puede subir una:
// el XML se lee aquí con el mismo código de la API (src/hu030), se valida (RUC de Crosland y de EPSA, tipo, moneda,
// totales), se clasifica cada línea con los códigos de Crosland de la base y se registra con la misma función de la
// base que usa el correo (importar_documento_compra): compra, una ficha por moto en Ancón, sin duplicados.
// El XML y el PDF quedan guardados en el almacenamiento privado (bucket facturas-compra).
import { parsearFacturaUbl } from "../hu030/parser";
import { validarFacturaImportada } from "../hu030/validacion";
import { clasificarLineasFactura } from "../hu030/clasificacion";
import { agruparComprasFactura } from "../hu030/agrupacion";
import { VALIDACION_FACTURA_CROSLAND } from "../hu030/config";
import {
  BUCKET_FACTURAS, descargarStorage, importarDocumentoCompraApi, listarEquivalenciasImportacionApi, registrarSubidaPanelApi, subirArchivoStorage,
} from "../lib/api";
import { ApiError } from "../lib/errores";

// ---------------------------------------------------------------------------------------------
// Textos para las personas (los códigos vienen de la API y de la base)
// ---------------------------------------------------------------------------------------------
const TEXTOS = {
  // Lectura del XML
  XML_VACIO: "El archivo está vacío.", XML_DEMASIADO_GRANDE: "El XML pesa más de 5 MB.", XML_BYTE_NUL: "El archivo no es un XML de texto.",
  XML_DTD_NO_PERMITIDO: "El XML trae instrucciones no permitidas.", XML_XINCLUDE_NO_PERMITIDO: "El XML trae instrucciones no permitidas.",
  XML_CODIFICACION_NO_SOPORTADA: "La codificación del XML no está soportada.", XML_CODIFICACION_INVALIDA: "El XML tiene caracteres dañados.",
  XML_MALFORMADO: "El XML está dañado o incompleto.", XML_LIMITE_SUPERADO: "El XML es demasiado grande o complejo.",
  XML_FACTURA_UBL_REQUERIDA: "Ese XML no es una factura electrónica (UBL).", XML_INVALIDO: "El XML no se pudo leer.",
  // Validación del documento
  RUC_EMISOR_NO_AUTORIZADO: "La factura no es de Crosland (RUC 20502913752).", RUC_COMPRADOR_NO_CORRESPONDE: "La factura no está a nombre de EPSA Motor (RUC 20555595469).",
  TIPO_DOCUMENTAL_NO_PERMITIDO: "Solo se aceptan facturas (tipo 01).", MONEDA_NO_PERMITIDA: "La factura no está en soles.",
  IDENTIDAD_DOCUMENTAL_INVALIDA: "No se pudo leer la serie y el número de la factura.", FECHA_EMISION_INVALIDA: "La fecha de emisión no es válida.",
  FECHA_VENCIMIENTO_INVALIDA: "La fecha de vencimiento no es válida.", CANTIDAD_LINEAS_NO_COINCIDE: "La cantidad de líneas no coincide con la declarada.",
  TOTALES_NO_VALIDABLES: "No se pudieron comprobar los totales.", TOTAL_LINEAS_NO_COINCIDE: "La suma de las líneas no coincide con el total.",
  TOTAL_OPERACIONES_GRATUITAS_NO_COINCIDE: "El total de bonificaciones no coincide.", TOTAL_OPERACIONES_GRATUITAS_NO_VALIDABLE: "No se pudo comprobar el total de bonificaciones.",
  PROVEEDOR_NO_AUTORIZADO: "Crosland no está registrado como proveedor en la base.",
  // Avisos
  ENCODING_DECLARADO_NO_COINCIDE: "El XML se leyó con una codificación distinta a la declarada.",
  DIFERENCIA_TOTAL_DENTRO_TOLERANCIA: "El total tiene una diferencia de céntimos (dentro de lo permitido).",
  DIFERENCIA_OPERACIONES_GRATUITAS_DENTRO_TOLERANCIA: "Las bonificaciones tienen una diferencia de céntimos (dentro de lo permitido).",
  // Revisión de líneas
  CODIGO_SIN_EQUIVALENCIA: "Código de Crosland sin modelo asignado: asígnalo en «Códigos de Crosland» y vuelve a procesar.",
  EQUIVALENCIA_AMBIGUA: "El código tiene más de un modelo asignado.", EQUIVALENCIA_MODELO_AUSENTE: "El código no tiene modelo de moto.",
  EQUIVALENCIA_ACCESORIO_INVALIDA: "El código está marcado como accesorio pero trae datos de moto.",
  MODELO_DOCUMENTAL_AUSENTE: "La línea no trae el modelo.", CANTIDAD_VEHICULO_NO_UNO: "Cada línea de moto debe ser de una unidad.",
  MOTOR_AUSENTE: "Falta el número de motor.", CHASIS_AUSENTE: "Falta el número de chasis.", COLOR_AUSENTE: "Falta el color.",
  MOTOR_DUPLICADO_EN_DOCUMENTO: "El motor se repite en la factura.", CHASIS_DUPLICADO_EN_DOCUMENTO: "El chasis se repite en la factura.",
  MOTOR_YA_REGISTRADO: "Ese motor ya está registrado en otra moto.", CHASIS_YA_REGISTRADO: "Ese chasis ya está registrado en otra moto.",
  CANDIDATO_VEHICULO_AUSENTE: "Faltan datos de la moto.", CANDIDATO_INVALIDO: "Los datos de la moto no son válidos.",
  CONCILIACION_AMBIGUA: "Hay más de una compra registrada a mano que podría ser esta: revísala.",
  CONCILIACION_INCOMPATIBLE: "La compra registrada a mano no coincide con la factura (modelo, color o cantidad).",
  DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO: "Ya existe una factura con esa serie y número pero con otro contenido.",
  ERROR_TECNICO_IMPORTACION: "La importación falló y no se guardó ningún cambio. Vuelve a intentarlo.",
  REVISION_REQUERIDA: "Hay líneas por revisar.",
  // Recepción por correo
  MULTIPART_INVALIDO: "El correo no traía los archivos esperados.", PDF_REQUERIDO: "El correo no traía el PDF.", PDF_INVALIDO: "El PDF del correo está dañado.",
  MIME_INVALIDO: "Los adjuntos no son XML y PDF.", MIME_XML_INVALIDO: "El adjunto no es un XML.", MIME_PDF_INVALIDO: "El adjunto no es un PDF.",
  ARCHIVO_DEMASIADO_GRANDE: "Un adjunto pesa demasiado.", LIMIT_FILE_SIZE: "Un adjunto pesa demasiado.",
  AUTENTICACION_INVALIDA: "El envío del proceso automático no se pudo autenticar.", FIRMA_INVALIDA: "El envío del proceso automático no se pudo autenticar.",
  TIMESTAMP_FUERA_DE_RANGO: "El envío llegó fuera de tiempo.", NONCE_REPETIDO: "Envío repetido: ya se había recibido.",
  INTEGRACION_NO_CONFIGURADA: "La recepción por correo no está configurada en el servidor.", INTEGRACION_NO_DISPONIBLE: "El servidor no estaba disponible.",
  XML_STORAGE_ERROR: "No se pudo guardar el XML.", PDF_STORAGE_ERROR: "No se pudo guardar el PDF.", STORAGE_UNAVAILABLE: "El almacenamiento no estaba disponible.",
  VALIDACION_DOCUMENTAL_FALLIDA: "La factura no pasó la validación.", DOCUMENTO_RECHAZADO: "La base rechazó la factura.",
};
export const textoCodigo = (c) => (c ? TEXTOS[c] || c.toLowerCase().replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) : "");
export const ESTADO_DOCUMENTO = { "Pendiente de revision": "Pendiente de revisión", "Importado parcialmente": "Importado en parte", Importado: "Importado", Error: "Error", Procesando: "Procesando", Recibido: "Recibido" };
export const TONO_DOCUMENTO = { Importado: "verde", "Importado parcialmente": "ambar", "Pendiente de revision": "naranja", Error: "rojo", Procesando: "celeste", Recibido: "gris" };

// ---------------------------------------------------------------------------------------------
// Leer y revisar un XML antes de registrarlo
// ---------------------------------------------------------------------------------------------
async function sha256(bytes) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// XML (File o Blob) → documento leído, validación y huella. No escribe nada.
export async function leerFactura(archivo) {
  if (!archivo) throw new ApiError(400, "Elige el archivo XML de la factura.");
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let documento;
  try { documento = parsearFacturaUbl(bytes); }
  catch (e) { throw new ApiError(400, textoCodigo(e?.code || "XML_INVALIDO")); }
  const validacion = validarFacturaImportada(documento, VALIDACION_FACTURA_CROSLAND);
  return { bytes, documento, validacion, sha256: await sha256(bytes) };
}

// Clasifica cada línea con los códigos de Crosland de la base (motos, accesorios, códigos desconocidos)
export async function prepararFactura(lectura) {
  const filas = await listarEquivalenciasImportacionApi(lectura.documento.rucEmisor).catch((e) => {
    if (e.status === 404 || /proveedor/i.test(e.message)) throw new ApiError(404, textoCodigo("PROVEEDOR_NO_AUTORIZADO"));
    throw e;
  });
  // Mismo formato que la API (src/services/factura.importacion.service.ts)
  const equivalencias = (Array.isArray(filas) ? filas : []).map((row) => ({
    codigoExterno: typeof row.codigoExterno === "string" ? row.codigoExterno : "",
    clasificacion: row.clasificacion === "Vehiculo" ? "Vehiculo" : "Accesorio",
    codmod: typeof row.codmod === "string" ? row.codmod : row.codmod != null ? String(row.codmod) : null,
    activa: row.activa === true,
  }));
  const clasificacion = clasificarLineasFactura(lectura.documento, equivalencias);
  const grupos = agruparComprasFactura(clasificacion);
  const payload = {
    documento: lectura.documento,
    lineas: lectura.documento.lineas.map((linea, i) => ({ ...linea, ...clasificacion[i] })),
    advertencias: [...new Set([...lectura.validacion.advertencias, ...lectura.documento.advertencias])],
    checksumXml: lectura.sha256,
    origen: "XML_Interno",
    gruposCalculados: grupos,
  };
  return { clasificacion, grupos, payload };
}

// ---------------------------------------------------------------------------------------------
// Registrar: importación en la base + XML y PDF guardados + quién la subió
// ---------------------------------------------------------------------------------------------
async function guardarPrivado(ruta, blob) {
  try { await subirArchivoStorage(BUCKET_FACTURAS, ruta, blob); return ruta; }
  catch (e) { if (e?.status === 409) return ruta; throw e; }   // ya estaba guardado
}

export async function registrarFactura(lectura, preparada, pdf = null, { guardarXml = true } = {}) {
  if (!lectura.validacion.valido) throw new ApiError(400, lectura.validacion.errores.map(textoCodigo).join(" "));
  let resultado;
  try { resultado = await importarDocumentoCompraApi(preparada.payload); }
  catch (e) {
    if (e.status === 403) throw new ApiError(403, "Solo gerencia o administración pueden registrar facturas.");
    if (e.detalle?.faltaSql) throw e;
    throw new ApiError(e.status || 500, /inválid|discrepante/i.test(e.message) ? `La base rechazó la factura: ${e.message}.` : e.message);
  }
  // El XML y el PDF quedan en el almacenamiento privado; si fallan, la factura igual quedó registrada
  const avisos = [];
  const base = `panel/${lectura.sha256}`;
  let rutaxml = null; let rutapdf = null; let sha256pdf = null;
  if (guardarXml) {
    try { rutaxml = await guardarPrivado(`${base}/factura.xml`, new Blob([lectura.bytes], { type: "text/xml" })); }
    catch { avisos.push("No se pudo guardar una copia del XML."); }
  }
  if (pdf) {
    try {
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      sha256pdf = await sha256(bytes);
      rutapdf = await guardarPrivado(`${base}/factura.pdf`, new Blob([bytes], { type: "application/pdf" }));
    } catch { avisos.push("No se pudo guardar el PDF."); rutapdf = null; }
  }
  try { await registrarSubidaPanelApi({ coddoc: resultado.coddoc, rutaxml, sha256xml: lectura.sha256, rutapdf, sha256pdf }); }
  catch (e) { if (!e.detalle?.faltaSql) avisos.push("No se pudo anotar quién subió la factura."); }
  return { ...resultado, avisos };
}

// Volver a procesar una factura guardada (por ejemplo, después de asignar un código de Crosland)
export async function reprocesarFactura(rutaXml) {
  const blob = await descargarStorage(BUCKET_FACTURAS, rutaXml);
  const lectura = await leerFactura(blob);
  const preparada = await prepararFactura(lectura);
  return registrarFactura(lectura, preparada, null, { guardarXml: false });
}
