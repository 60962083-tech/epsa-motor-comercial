import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { VALIDACION_FACTURA_CROSLAND } from '../config/factura.importacion.config.js';
import type {
  ConfiguracionValidacionFactura,
  EquivalenciaProductoExterno,
  PayloadImportacionDocumento,
  ResultadoImportacionDocumento
} from '../types/factura.importacion.types.js';
import { agruparComprasFactura } from '../utils/factura.importacion.agrupacion.js';
import { clasificarLineasFactura } from '../utils/factura.importacion.clasificacion.js';
import { parsearFacturaUbl } from '../utils/factura.importacion.xml.parser.js';
import { validarFacturaImportada } from '../utils/factura.importacion.validacion.js';

export class ErrorServicioImportacionFactura extends Error {
  constructor(
    public readonly codigo: string,
    public readonly erroresValidacion: readonly string[] = []
  ) {
    super(codigo);
    this.name = 'ErrorServicioImportacionFactura';
  }
}

export interface RpcsImportacionFactura {
  equivalencias: string;
  importar: string;
}

/**
 * Servicio interno de Fase 2. Usa el cliente Supabase de la sesión autenticada;
 * nunca requiere ni lee una clave service_role. No registra XML ni errores del proveedor.
 */
export async function importarFacturaXml(
  db: SupabaseClient,
  xml: Buffer,
  config: ConfiguracionValidacionFactura = VALIDACION_FACTURA_CROSLAND,
  rpcs: RpcsImportacionFactura = {
    equivalencias: 'listar_equivalencias_importacion',
    importar: 'importar_documento_compra'
  }
): Promise<ResultadoImportacionDocumento> {
  if (!Buffer.isBuffer(xml) || xml.length === 0) {
    throw new ErrorServicioImportacionFactura('XML_INVALIDO');
  }

  let documento;
  try {
    documento = parsearFacturaUbl(xml);
  } catch {
    throw new ErrorServicioImportacionFactura('XML_INVALIDO');
  }

  const validacion = validarFacturaImportada(documento, config);
  if (!validacion.valido) {
    throw new ErrorServicioImportacionFactura('VALIDACION_DOCUMENTAL_FALLIDA', validacion.errores);
  }

  const { data: equivalenciasData, error: equivalenciasError } = await db.rpc(
    rpcs.equivalencias,
    { p_ruc_emisor: documento.rucEmisor }
  );
  if (equivalenciasError) {
    const code = (equivalenciasError as { code?: string }).code;
    throw new ErrorServicioImportacionFactura(code === 'PT404' ? 'PROVEEDOR_NO_AUTORIZADO' : 'ERROR_EQUIVALENCIAS');
  }
  if (!Array.isArray(equivalenciasData)) {
    throw new ErrorServicioImportacionFactura('ERROR_EQUIVALENCIAS');
  }

  const equivalencias: EquivalenciaProductoExterno[] = equivalenciasData.map((row: Record<string, unknown>) => ({
    codigoExterno: typeof row.codigoExterno === 'string' ? row.codigoExterno : '',
    clasificacion: row.clasificacion === 'Vehiculo' ? 'Vehiculo' : 'Accesorio',
    codmod: typeof row.codmod === 'string' ? row.codmod : null,
    activa: row.activa === true
  }));
  const clasificacion = clasificarLineasFactura(documento, equivalencias);
  const gruposCalculados = agruparComprasFactura(clasificacion);
  const payload: PayloadImportacionDocumento = {
    documento,
    lineas: documento.lineas.map((linea, index) => ({ ...linea, ...clasificacion[index]! })),
    advertencias: [...new Set([...validacion.advertencias, ...documento.advertencias])],
    checksumXml: createHash('sha256').update(xml).digest('hex'),
    origen: 'XML_Interno',
    gruposCalculados
  };

  const { data, error } = await db.rpc(rpcs.importar, { p_payload: payload });
  if (error) {
    const code = (error as { code?: string }).code;
    throw new ErrorServicioImportacionFactura(code === 'PT400' ? 'DOCUMENTO_RECHAZADO' : 'ERROR_IMPORTACION_TRANSACCIONAL');
  }
  if (!data || typeof data !== 'object' || typeof (data as { coddoc?: unknown }).coddoc !== 'string') {
    throw new ErrorServicioImportacionFactura('ERROR_IMPORTACION_TRANSACCIONAL');
  }
  return data as ResultadoImportacionDocumento;
}
