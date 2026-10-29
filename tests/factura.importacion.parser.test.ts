import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VALIDACION_FACTURA_CROSLAND } from '../src/config/factura.importacion.config.js';
import { agruparComprasFactura } from '../src/utils/factura.importacion.agrupacion.js';
import { clasificarLineasFactura } from '../src/utils/factura.importacion.clasificacion.js';
import { validarFacturaImportada } from '../src/utils/factura.importacion.validacion.js';
import { LIMITES_XML_FACTURA, ErrorXmlFactura, parsearFacturaUbl } from '../src/utils/factura.importacion.xml.parser.js';
import type { EquivalenciaProductoExterno, ConfiguracionValidacionFactura } from '../src/types/factura.importacion.types.js';

const fixture = (name: string) => readFileSync(`tests/fixtures/factura-importacion/${name}`);
const validBytes = fixture('factura_valida.xml');
const parse = (name = 'factura_valida.xml') => parsearFacturaUbl(fixture(name));
const testConfig: ConfiguracionValidacionFactura = {
  ...VALIDACION_FACTURA_CROSLAND,
  rucEmisoresPermitidos: ['20123456789'],
  rucCompradorEsperado: '20987654321'
};
const equivalences: EquivalenciaProductoExterno[] = [
  { codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo', codmod: '42', activa: true },
  { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio', codmod: null, activa: true }
];

test('HU-030 parser UBL: extrae campos, conserva datos originales y no inventa información', () => {
  const document = parse();
  assert.equal(document.ublVersion, '2.1');
  assert.equal(document.tipoDocumento, '01');
  assert.equal(document.idDocumento, 'S001-00000001');
  assert.equal(document.serie, 'S001');
  assert.equal(document.numero, '00000001');
  assert.equal(document.rucEmisor, '20123456789');
  assert.equal(document.rucComprador, '20987654321');
  assert.equal(document.fechaEmision, '2026-10-20');
  assert.equal(document.moneda, 'PEN');
  assert.equal(document.cantidadLineasDeclarada, '4');
  assert.equal(document.lineas.length, 4);
  assert.equal(document.lineas.filter((line) => line.codigoExterno === 'SYNTH-MOTO').length, 2);
  assert.equal(document.lineas.filter((line) => line.codigoExterno === 'SYNTH-ACC').length, 2);
  assert.equal(document.lineas[0]?.propiedadesPorCodigo['5015']?.[0], 'ENGINE-SYNTH-001');
  assert.equal(document.lineas[0]?.propiedadesPorCodigo['5019']?.[0], 'CHASSIS-SYNTH-001');
  assert.equal(document.lineas[0]?.propiedadesPorCodigo['5018']?.[0], 'VIN-SYNTH-001');
  assert.notEqual(document.lineas[0]?.propiedadesPorCodigo['5018']?.[0], document.lineas[0]?.propiedadesPorCodigo['5019']?.[0]);
  assert.equal(document.lineas[0]?.pedidoLinea, 'ORDER-SYNTH-0001');
  assert.equal(document.lineas[1]?.pedidoLinea, 'ORDER-SYNTH-0002');
  assert.equal(document.pedidoCabecera, 'HEADER-REF-SYNTHETIC');
  assert.equal(document.firmaPresente, true);
  assert.ok(!('firmaValidada' in document));
  assert.equal(document.lineas[0]?.propiedadesOriginales.find((prop) => prop.codigo === '5014')?.nombre, 'Color de muestra');
  assert.equal(document.lineas[0]?.propiedadesPorCodigo['5014']?.[0], 'Negro');
  assert.deepEqual(document.advertencias, ['ENCODING_DECLARADO_NO_COINCIDE']);
  assert.equal(document.totales.sumaLineas, '2050');
  assert.equal(document.totales.totalLineasDeclarado, '2049.99');
  assert.equal(document.lineas[0]?.codigoExterno, 'SYNTH-MOTO');
  assert.ok(!JSON.stringify(document).includes('20502913752'));
  assert.ok(!JSON.stringify(document).includes('epsamotor.admin@gmail.com'));
});

test('HU-030 parser namespace-aware: tolera prefijos distintos y propiedades reordenadas', () => {
  const changedPrefixes = parse('factura_prefijos_distintos.xml');
  const reordered = parse('factura_propiedades_desordenadas.xml');
  assert.equal(changedPrefixes.rucEmisor, '20123456789');
  assert.equal(changedPrefixes.lineas[0]?.propiedadesPorCodigo['5015']?.[0], 'ENGINE-SYNTH-001');
  assert.equal(reordered.lineas[0]?.propiedadesPorCodigo['5015']?.[0], 'ENGINE-SYNTH-001');
});

test('HU-030 RUC prioriza PartyIdentification con schemeID 6 y usa fallbacks tributarios controlados', () => {
  const xml = fixture('factura_bonificaciones_sintetica.xml').toString('utf8');
  const preferred = parsearFacturaUbl(Buffer.from(xml));
  assert.equal(preferred.rucEmisor, '11111111111');
  assert.equal(preferred.rucComprador, '22222222222');

  const withoutIdentification = xml.replace(/<cac:PartyIdentification>[\s\S]*?<\/cac:PartyIdentification>/g, '');
  const taxSchemeFallback = parsearFacturaUbl(Buffer.from(withoutIdentification));
  assert.equal(taxSchemeFallback.rucEmisor, '33333333333');
  assert.equal(taxSchemeFallback.rucComprador, '44444444444');

  const withoutTaxCompanyIds = withoutIdentification
    .replace('<cac:PartyTaxScheme><cbc:CompanyID>33333333333</cbc:CompanyID></cac:PartyTaxScheme>', '')
    .replace('<cac:PartyTaxScheme><cbc:CompanyID>44444444444</cbc:CompanyID></cac:PartyTaxScheme>', '')
    .replace('<cac:PartyLegalEntity><cbc:RegistrationName>Proveedor Sintético', '<cac:PartyLegalEntity><cbc:CompanyID>55555555555</cbc:CompanyID><cbc:RegistrationName>Proveedor Sintético')
    .replace('<cac:PartyLegalEntity><cbc:RegistrationName>Comprador Sintético', '<cac:PartyLegalEntity><cbc:CompanyID>66666666666</cbc:CompanyID><cbc:RegistrationName>Comprador Sintético');
  const companyIdFallback = parsearFacturaUbl(Buffer.from(withoutTaxCompanyIds));
  assert.equal(companyIdFallback.rucEmisor, '55555555555');
  assert.equal(companyIdFallback.rucComprador, '66666666666');

  const wrongSchemeOnly = xml
    .replace('schemeID="6">11111111111', 'schemeID="1">77777777777')
    .replace('schemeID="6">22222222222', 'schemeID="1">88888888888');
  const ignoresNonRucPartyIdentification = parsearFacturaUbl(Buffer.from(wrongSchemeOnly));
  assert.equal(ignoresNonRucPartyIdentification.rucEmisor, '33333333333');
  assert.equal(ignoresNonRucPartyIdentification.rucComprador, '44444444444');
});

test('HU-030 operaciones gratuitas se separan del valor oneroso y toleran un céntimo', () => {
  const document = parse('factura_bonificaciones_sintetica.xml');
  const bonusEquivalences = [
    ...equivalences,
    { codigoExterno: 'BAJAJVERDE', clasificacion: 'Accesorio' as const, codmod: null, activa: true }
  ];
  const classified = clasificarLineasFactura(document, bonusEquivalences);
  const result = validarFacturaImportada(document, {
    ...testConfig,
    rucEmisoresPermitidos: ['11111111111'],
    rucCompradorEsperado: '22222222222'
  });

  assert.equal(document.ublVersion, '2.1');
  assert.equal(document.pedidoCabecera, 'HEADER-ORDER-SYNTHETIC-01');
  assert.equal(document.firmaPresente, true);
  assert.deepEqual(document.lineas.map((line) => line.clasificacionUnspc), ['25112000', '25112000', '25112000', '25112000']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.operacionGratuita), [true, true]);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.precioUnitario), ['0.00', '0.00']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.precioReferencial), ['120.00', '120.00']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.priceTypeCode), ['02', '02']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.taxExemptionReasonCode), ['31', '31']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.taxScheme), ['9996', '9996']);
  assert.deepEqual(document.lineas.slice(2).map((line) => line.valorOperacionGratuita), ['120', '120']);
  assert.equal(document.totales.sumaLineasOnerosas, '2000.01');
  assert.equal(document.totales.sumaLineasGratuitas, '240');
  assert.equal(document.totales.totalOperacionesGratuitasDeclarado, '239.99');
  assert.equal(document.totales.valorVentaDeclarado, '2000.00');
  assert.equal(document.totales.totalAntesImpuestos, '2000.00');
  assert.equal(document.totales.impuestos, '360');
  assert.equal(document.totales.totalIncluidosImpuestos, '2360.00');
  assert.equal(document.totales.totalPagar, '2360.00');
  assert.equal(result.valido, true, result.errores.join(', '));
  assert.ok(result.advertencias.includes('DIFERENCIA_TOTAL_DENTRO_TOLERANCIA'));
  assert.ok(result.advertencias.includes('DIFERENCIA_OPERACIONES_GRATUITAS_DENTRO_TOLERANCIA'));
  assert.deepEqual(classified.map((line) => line.clasificacion), ['Vehiculo', 'Vehiculo', 'Accesorio', 'Accesorio']);
  assert.equal(agruparComprasFactura(classified)[0]?.cantidad, 2);
});

test('HU-030 parser decodifica ISO-8859-1 cuando UTF-8 fatal falla', () => {
  const xml = validBytes.toString('utf8');
  const latinBytes = Buffer.from(xml, 'latin1');
  const document = parsearFacturaUbl(latinBytes);
  assert.equal(document.razonSocialEmisor, 'Razón Social Sintética');
  assert.deepEqual(document.advertencias, []);
});

test('HU-030 validación documental acepta identidad autorizada y diferencia de redondeo de un céntimo', () => {
  const result = validarFacturaImportada(parse(), testConfig);
  assert.equal(result.valido, true);
  assert.ok(result.advertencias.includes('ENCODING_DECLARADO_NO_COINCIDE'));
  assert.ok(result.advertencias.includes('DIFERENCIA_TOTAL_DENTRO_TOLERANCIA'));
});

test('HU-030 validación documental rechaza RUC comprador y tipo documental incorrectos', () => {
  const wrongBuyer = validarFacturaImportada(parse('factura_ruc_comprador_incorrecto.xml'), testConfig);
  assert.equal(wrongBuyer.valido, false);
  assert.ok(wrongBuyer.errores.includes('RUC_COMPRADOR_NO_CORRESPONDE'));
  const wrongType = validarFacturaImportada(parse('factura_tipo_documento_invalido.xml'), testConfig);
  assert.equal(wrongType.valido, false);
  assert.ok(wrongType.errores.includes('TIPO_DOCUMENTAL_NO_PERMITIDO'));
});

test('HU-030 clasificación usa equivalencias aprobadas y conserva accesorios sin crear vehículos', () => {
  const document = parse();
  const classified = clasificarLineasFactura(document, equivalences);
  assert.deepEqual(classified.map((line) => line.clasificacion), ['Vehiculo', 'Vehiculo', 'Accesorio', 'Accesorio']);
  assert.equal(classified[0]?.vehiculos[0]?.motor, 'ENGINE-SYNTH-001');
  assert.equal(classified[0]?.vehiculos[0]?.vin, 'VIN-SYNTH-001');
  assert.equal(classified[0]?.vehiculos[0]?.chasis, 'CHASSIS-SYNTH-001');
  assert.deepEqual(classified[2]?.vehiculos, []);
  assert.equal(classified[2]?.estado, 'Procesada');
});

test('HU-030 reconoce el SKU provisional B3-4TLPGUG4V y mantiene pendientes sin equivalencia en revisión', () => {
  const document = parse();
  document.lineas[0]!.codigoExterno = 'B3-4TLPGUG4V';
  const mapped = clasificarLineasFactura(document, [
    { codigoExterno: 'B3-4TLPGUG4V', clasificacion: 'Vehiculo', codmod: '7', activa: true }
  ])[0]!;

  assert.equal(mapped.clasificacion, 'Vehiculo');
  assert.equal(mapped.estado, 'Candidato');
  assert.equal(mapped.motivo, null);
  assert.equal(mapped.equivalencia?.codmod, '7');
  assert.equal(mapped.vehiculos[0]?.codmod, '7');

  for (const codigoExterno of ['B2-BM150UG', 'B3-4TLPG250']) {
    const pendingDocument = parse();
    pendingDocument.lineas[0]!.codigoExterno = codigoExterno;
    const pending = clasificarLineasFactura(pendingDocument, [
      { codigoExterno: 'B3-4TLPGUG4V', clasificacion: 'Vehiculo', codmod: '7', activa: true }
    ])[0]!;
    assert.equal(pending.codigoExterno, codigoExterno);
    assert.equal(pending.clasificacion, 'Desconocido');
    assert.equal(pending.estado, 'Revision');
    assert.equal(pending.motivo, 'CODIGO_SIN_EQUIVALENCIA');
  }
});

test('HU-030 clasificación pone en revisión los códigos desconocidos, motor/chasis ausentes y cantidad múltiple', () => {
  const unknown = clasificarLineasFactura(parse('factura_codigo_desconocido.xml'), equivalences);
  assert.equal(unknown[0]?.clasificacion, 'Desconocido');
  assert.equal(unknown[0]?.estado, 'Revision');
  assert.equal(unknown[0]?.motivo, 'CODIGO_SIN_EQUIVALENCIA');
  const noMotor = clasificarLineasFactura(parse('factura_vehiculo_sin_motor.xml'), equivalences);
  assert.equal(noMotor[0]?.estado, 'Revision');
  assert.equal(noMotor[0]?.motivo, 'MOTOR_AUSENTE');
  const noChassis = clasificarLineasFactura(parse('factura_vehiculo_sin_chasis.xml'), equivalences);
  assert.equal(noChassis[0]?.estado, 'Revision');
  assert.equal(noChassis[0]?.motivo, 'CHASIS_AUSENTE');
  const multiple = clasificarLineasFactura(parse('factura_vehiculo_cantidad_multiple.xml'), equivalences);
  assert.equal(multiple[0]?.estado, 'Revision');
  assert.equal(multiple[0]?.motivo, 'CANTIDAD_VEHICULO_NO_UNO');
  assert.equal(multiple[0]?.vehiculos.length, 0);
});

test('HU-030 clasificación pone en revisión todos los candidatos con motor o chasis repetidos', () => {
  const duplicateMotor = parse();
  duplicateMotor.lineas[1]!.propiedadesPorCodigo['5015'] = ['ENGINE-SYNTH-001'];
  const repeatedMotors = clasificarLineasFactura(duplicateMotor, equivalences);
  assert.equal(repeatedMotors[0]?.estado, 'Revision');
  assert.equal(repeatedMotors[0]?.motivo, 'MOTOR_DUPLICADO_EN_DOCUMENTO');
  assert.ok(repeatedMotors[0]?.motivos.includes('MOTOR_DUPLICADO_EN_DOCUMENTO'));
  assert.equal(repeatedMotors[1]?.estado, 'Revision');
  assert.equal(repeatedMotors[1]?.motivo, 'MOTOR_DUPLICADO_EN_DOCUMENTO');
  assert.equal(agruparComprasFactura(repeatedMotors).length, 0);

  const duplicateChassis = parse();
  duplicateChassis.lineas[1]!.propiedadesPorCodigo['5019'] = ['CHASSIS-SYNTH-001'];
  const repeatedChassis = clasificarLineasFactura(duplicateChassis, equivalences);
  assert.equal(repeatedChassis[0]?.estado, 'Revision');
  assert.equal(repeatedChassis[0]?.motivo, 'CHASIS_DUPLICADO_EN_DOCUMENTO');
  assert.ok(repeatedChassis[0]?.motivos.includes('CHASIS_DUPLICADO_EN_DOCUMENTO'));
  assert.equal(repeatedChassis[1]?.estado, 'Revision');
  assert.equal(repeatedChassis[1]?.motivo, 'CHASIS_DUPLICADO_EN_DOCUMENTO');
  assert.equal(agruparComprasFactura(repeatedChassis).length, 0);
});

test('HU-030 agrupa por modelo/color, conserva pedidos únicos y excluye accesorios o revisión', () => {
  const classified = clasificarLineasFactura(parse(), equivalences);
  const groups = agruparComprasFactura(classified);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.codmod, '42');
  assert.equal(groups[0]?.color, 'Negro');
  assert.equal(groups[0]?.cantidad, 2);
  assert.deepEqual(groups[0]?.pedidos, ['ORDER-SYNTH-0001', 'ORDER-SYNTH-0002']);
  assert.equal(groups[0]?.vehiculos.length, 2);
  const withUnknown = clasificarLineasFactura(parse('factura_codigo_desconocido.xml'), equivalences);
  assert.equal(agruparComprasFactura(withUnknown).length, 0);
});

test('HU-030 parser rechaza XML vacío, corrupto, DTD, ENTITY y XInclude', () => {
  assert.throws(() => parsearFacturaUbl(Buffer.alloc(0)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_VACIO');
  assert.throws(() => parsearFacturaUbl(fixture('factura_xml_corrupto.xml')), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_MALFORMADO');
  assert.throws(() => parsearFacturaUbl(fixture('factura_doctype.xml')), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_DTD_NO_PERMITIDO');
  const entity = Buffer.from('<?xml version="1.0"?><!ENTITY x "bad"><Invoice/>');
  assert.throws(() => parsearFacturaUbl(entity), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_DTD_NO_PERMITIDO');
  const xinclude = Buffer.from('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///private"/></Invoice>');
  assert.throws(() => parsearFacturaUbl(xinclude), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_XINCLUDE_NO_PERMITIDO');
});

test('HU-030 parser enforce límites de bytes, nodos, líneas, propiedades, profundidad y eventos', () => {
  assert.throws(() => parsearFacturaUbl(Buffer.alloc(LIMITES_XML_FACTURA.bytes + 1, 32)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_DEMASIADO_GRANDE');
  const base = validBytes.toString('utf8');
  const firstLine = base.match(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/)?.[0];
  assert.ok(firstLine);
  const tooManyLines = base.replace('</Invoice>', `${firstLine.repeat(LIMITES_XML_FACTURA.invoiceLines + 1)}</Invoice>`);
  assert.throws(() => parsearFacturaUbl(Buffer.from(tooManyLines)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_LIMITE_SUPERADO');
  const tooManyProperties = base.replace('</cac:Item>', `${'<cac:AdditionalItemProperty><cbc:NameCode>9000</cbc:NameCode></cac:AdditionalItemProperty>'.repeat(LIMITES_XML_FACTURA.propertiesPerLine + 1)}</cac:Item>`);
  assert.throws(() => parsearFacturaUbl(Buffer.from(tooManyProperties)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_LIMITE_SUPERADO');
  const tooManyNodes = base.replace('</Invoice>', `${'<cbc:Note>x</cbc:Note>'.repeat(LIMITES_XML_FACTURA.nodes + 1)}</Invoice>`);
  assert.throws(() => parsearFacturaUbl(Buffer.from(tooManyNodes)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_LIMITE_SUPERADO');
  const nested = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">${'<x>'.repeat(LIMITES_XML_FACTURA.depth)}${'</x>'.repeat(LIMITES_XML_FACTURA.depth)}</Invoice>`;
  assert.throws(() => parsearFacturaUbl(Buffer.from(nested)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_LIMITE_SUPERADO');
  const tooManyEvents = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">${'<!--x-->'.repeat(LIMITES_XML_FACTURA.events + 1)}</Invoice>`;
  assert.throws(() => parsearFacturaUbl(Buffer.from(tooManyEvents)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_LIMITE_SUPERADO');
});

test('HU-030 parser rechaza codificación desconocida y bytes NUL', () => {
  const unsupported = validBytes.toString('utf8').replace('encoding="ISO-8859-1"', 'encoding="UTF-16"');
  assert.throws(() => parsearFacturaUbl(Buffer.from(unsupported)), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_CODIFICACION_NO_SOPORTADA');
  const nul = Buffer.concat([validBytes, Buffer.from([0])]);
  assert.throws(() => parsearFacturaUbl(nul), (error: unknown) => error instanceof ErrorXmlFactura && error.code === 'XML_BYTE_NUL');
});
