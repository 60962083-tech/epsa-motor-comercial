// HU-030 · Copia para el navegador del código de la API (Michelle). Mantener igual al original.
import type { ConfiguracionValidacionFactura } from './tipos';

// Identidades y tolerancias aprobadas para la primera integración documental.
export const VALIDACION_FACTURA_CROSLAND: ConfiguracionValidacionFactura = Object.freeze({
  rucEmisoresPermitidos: ['20502913752'],
  rucCompradorEsperado: '20555595469',
  tiposDocumentalesPermitidos: ['01'],
  monedasPermitidas: ['PEN'],
  toleranciaMonetaria: '0.01'
});

export const CODIGOS_PROPIEDAD_CROSLAND = Object.freeze({
  marca: '5012',
  modelo: '5013',
  color: '5014',
  motor: '5015',
  combustible: '5016',
  vin: '5018',
  chasis: '5019',
  anioFabricacion: '5020',
  anioModelo: '5021',
  pedidoLinea: '3'
});

export const CUENTA_OPERATIVA_FACTURAS = 'epsamotor.admin@gmail.com';
