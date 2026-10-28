import type {
  FacturaUblParseada,
  ResultadoValidacionFactura,
  ConfiguracionValidacionFactura
} from '../types/factura.importacion.types.js';

function decimalEnMicrounidades(raw: string): bigint | null {
  const match = raw.trim().match(/^(-?)(\d{1,18})(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const value = BigInt(match[2]! + (match[3] ?? '').padEnd(6, '0'));
  return match[1] ? -value : value;
}

function esFechaIsoValida(date: string | null): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

/** Validación pura de identidad fiscal, estructura básica y consistencia de importes del XML. */
export function validarFacturaImportada(
  document: FacturaUblParseada,
  config: ConfiguracionValidacionFactura
): ResultadoValidacionFactura {
  const errores: string[] = [];
  const advertencias = [...document.advertencias];

  if (!document.tipoDocumento || !config.tiposDocumentalesPermitidos.includes(document.tipoDocumento)) {
    errores.push('TIPO_DOCUMENTAL_NO_PERMITIDO');
  }
  if (!document.rucEmisor || !/^\d{11}$/.test(document.rucEmisor)
    || !config.rucEmisoresPermitidos.includes(document.rucEmisor)) {
    errores.push('RUC_EMISOR_NO_AUTORIZADO');
  }
  if (!document.rucComprador || document.rucComprador !== config.rucCompradorEsperado) {
    errores.push('RUC_COMPRADOR_NO_CORRESPONDE');
  }
  if (!document.idDocumento || !document.serie || !document.numero) errores.push('IDENTIDAD_DOCUMENTAL_INVALIDA');
  if (!esFechaIsoValida(document.fechaEmision)) errores.push('FECHA_EMISION_INVALIDA');
  if (document.fechaVencimiento && !esFechaIsoValida(document.fechaVencimiento)) errores.push('FECHA_VENCIMIENTO_INVALIDA');
  if (!document.moneda || !config.monedasPermitidas.includes(document.moneda)) errores.push('MONEDA_NO_PERMITIDA');

  const lineCount = document.cantidadLineasDeclarada;
  if (!lineCount || !/^\d+$/.test(lineCount) || Number(lineCount) !== document.lineas.length) {
    errores.push('CANTIDAD_LINEAS_NO_COINCIDE');
  }

  const sum = document.totales.sumaLineasOnerosas === null
    ? null
    : decimalEnMicrounidades(document.totales.sumaLineasOnerosas);
  const declaredSales = document.totales.valorVentaDeclarado ?? document.totales.totalLineasDeclarado;
  const header = declaredSales === null ? null : decimalEnMicrounidades(declaredSales);
  const tolerance = decimalEnMicrounidades(config.toleranciaMonetaria);
  if (sum === null || header === null || tolerance === null || tolerance < 0n) {
    errores.push('TOTALES_NO_VALIDABLES');
  } else {
    const difference = sum >= header ? sum - header : header - sum;
    if (difference > tolerance) errores.push('TOTAL_LINEAS_NO_COINCIDE');
    else if (difference > 0n) advertencias.push('DIFERENCIA_TOTAL_DENTRO_TOLERANCIA');
  }

  const hasFreeOperations = document.lineas.some((line) => line.operacionGratuita)
    || document.totales.totalOperacionesGratuitasDeclarado !== null;
  if (hasFreeOperations) {
    const freeLines = document.totales.sumaLineasGratuitas === null
      ? null
      : decimalEnMicrounidades(document.totales.sumaLineasGratuitas);
    const freeDeclared = document.totales.totalOperacionesGratuitasDeclarado === null
      ? null
      : decimalEnMicrounidades(document.totales.totalOperacionesGratuitasDeclarado);
    if (freeLines === null || freeDeclared === null || tolerance === null || tolerance < 0n) {
      errores.push('TOTAL_OPERACIONES_GRATUITAS_NO_VALIDABLE');
    } else {
      const difference = freeLines >= freeDeclared ? freeLines - freeDeclared : freeDeclared - freeLines;
      if (difference > tolerance) errores.push('TOTAL_OPERACIONES_GRATUITAS_NO_COINCIDE');
      else if (difference > 0n) advertencias.push('DIFERENCIA_OPERACIONES_GRATUITAS_DENTRO_TOLERANCIA');
    }
  }

  return { valido: errores.length === 0, errores, advertencias: [...new Set(advertencias)] };
}
