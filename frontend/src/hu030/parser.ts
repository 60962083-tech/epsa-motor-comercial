// HU-030 · Copia para el navegador del lector de facturas UBL de la API (src/utils/factura.importacion.xml.parser.ts).
// Único cambio: recibe Uint8Array en lugar de Buffer. Mantener igual al original para que la base reciba lo mismo.
import { SaxesParser, type SaxesTagNS } from 'saxes';
import type {
  InformacionAdicionalFactura,
  FacturaUblParseada,
  LineaFacturaUbl,
  PropiedadFacturaOriginal
} from './tipos';
import { CODIGOS_PROPIEDAD_CROSLAND } from './config';

const UBL_INVOICE = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';
const XINCLUDE = 'http://www.w3.org/2001/XInclude';

export const LIMITES_XML_FACTURA = Object.freeze({
  bytes: 5 * 1024 * 1024,
  nodes: 50_000,
  events: 120_000,
  depth: 64,
  invoiceLines: 1_000,
  propertiesPerLine: 100
});

export type CodigoErrorXmlFactura =
  | 'XML_VACIO'
  | 'XML_DEMASIADO_GRANDE'
  | 'XML_BYTE_NUL'
  | 'XML_DTD_NO_PERMITIDO'
  | 'XML_XINCLUDE_NO_PERMITIDO'
  | 'XML_CODIFICACION_NO_SOPORTADA'
  | 'XML_CODIFICACION_INVALIDA'
  | 'XML_MALFORMADO'
  | 'XML_LIMITE_SUPERADO'
  | 'XML_FACTURA_UBL_REQUERIDA';

export class ErrorXmlFactura extends Error {
  constructor(readonly code: CodigoErrorXmlFactura, message: string) {
    super(message);
    this.name = 'ErrorXmlFactura';
  }
}

interface XmlAttribute {
  local: string;
  uri: string;
  value: string;
}

interface XmlNode {
  local: string;
  uri: string;
  text: string;
  children: XmlNode[];
  attributes: XmlAttribute[];
}

interface DecodedXml {
  text: string;
  advertencias: string[];
}

function fail(code: CodigoErrorXmlFactura, message: string): never {
  throw new ErrorXmlFactura(code, message);
}

function decodeXml(bytes: Uint8Array): DecodedXml {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 512));
  const declared = header.match(/<\?xml\s+[^?]*encoding\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.trim().toLowerCase() ?? null;
  const utf8Declaration = declared === null || ['utf-8', 'utf8'].includes(declared);
  const latinDeclaration = ['iso-8859-1', 'iso8859-1', 'latin1', 'latin-1', 'windows-1252', 'cp1252'].includes(declared ?? '');
  if (declared && !utf8Declaration && !latinDeclaration) {
    fail('XML_CODIFICACION_NO_SOPORTADA', 'La codificación XML declarada no está soportada.');
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return {
      text,
      advertencias: utf8Declaration ? [] : ['ENCODING_DECLARADO_NO_COINCIDE']
    };
  } catch {
    if (!latinDeclaration) {
      fail('XML_CODIFICACION_INVALIDA', 'El XML no contiene UTF-8 válido para la codificación declarada.');
    }
    try {
      return { text: new TextDecoder('iso-8859-1', { fatal: true }).decode(bytes), advertencias: [] };
    } catch {
      fail('XML_CODIFICACION_INVALIDA', 'No se pudo decodificar el XML.');
    }
  }
}

function localName(tag: SaxesTagNS): string {
  return tag.local ?? tag.name;
}

function parseTree(xml: string): XmlNode {
  const parser = new SaxesParser({ xmlns: true, position: true });
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;
  let nodes = 0;
  let events = 0;
  const tick = () => {
    events += 1;
    if (events > LIMITES_XML_FACTURA.events) fail('XML_LIMITE_SUPERADO', 'El XML supera el límite de eventos permitido.');
  };

  parser.on('opentag', (tag) => {
    tick();
    nodes += 1;
    if (nodes > LIMITES_XML_FACTURA.nodes || stack.length + 1 > LIMITES_XML_FACTURA.depth) {
      fail('XML_LIMITE_SUPERADO', 'El XML supera el límite estructural permitido.');
    }
    const uri = tag.uri ?? '';
    const name = localName(tag);
    if (uri === XINCLUDE && name.toLowerCase() === 'include') {
      fail('XML_XINCLUDE_NO_PERMITIDO', 'XInclude no está permitido.');
    }
    const attributes = Object.values(tag.attributes).map((attribute) => ({
      local: attribute.local,
      uri: attribute.uri,
      value: attribute.value
    }));
    const node: XmlNode = { local: name, uri, text: '', children: [], attributes };
    if (stack.length) stack[stack.length - 1]!.children.push(node);
    else if (root) fail('XML_MALFORMADO', 'El XML contiene más de un elemento raíz.');
    else root = node;
    stack.push(node);
  });
  parser.on('text', (chunk) => {
    tick();
    if (stack.length) stack[stack.length - 1]!.text += chunk;
  });
  parser.on('cdata', (chunk) => {
    tick();
    if (stack.length) stack[stack.length - 1]!.text += chunk;
  });
  parser.on('closetag', () => {
    tick();
    stack.pop();
  });
  parser.on('processinginstruction', () => tick());
  parser.on('comment', () => tick());
  parser.on('doctype', () => fail('XML_DTD_NO_PERMITIDO', 'DOCTYPE y DTD no están permitidos.'));
  parser.on('error', () => fail('XML_MALFORMADO', 'El XML está malformado.'));

  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof ErrorXmlFactura) throw error;
    fail('XML_MALFORMADO', 'El XML está malformado.');
  }
  if (!root || stack.length !== 0) fail('XML_MALFORMADO', 'El XML no tiene una estructura completa.');
  return root;
}

function children(node: XmlNode | null | undefined, uri: string, local: string): XmlNode[] {
  return node?.children.filter((child) => child.uri === uri && child.local === local) ?? [];
}

function child(node: XmlNode | null | undefined, uri: string, local: string): XmlNode | null {
  return children(node, uri, local)[0] ?? null;
}

function value(node: XmlNode | null | undefined): string | null {
  const result = node?.text.trim();
  return result ? result : null;
}

function field(node: XmlNode | null | undefined, uri: string, local: string): string | null {
  return value(child(node, uri, local));
}

function descendants(node: XmlNode | null | undefined, uri: string, local: string): XmlNode[] {
  const found: XmlNode[] = [];
  if (!node) return found;
  for (const nested of node.children) {
    if (nested.uri === uri && nested.local === local) found.push(nested);
    found.push(...descendants(nested, uri, local));
  }
  return found;
}

function firstDescendantValue(node: XmlNode | null, uri: string, local: string): string | null {
  return value(descendants(node, uri, local)[0]);
}

function partyFields(root: XmlNode, partyName: string): { ruc: string | null; razonSocial: string | null } {
  const aggregate = child(root, CAC, partyName);
  const party = child(aggregate, CAC, 'Party');
  const partyIdentificationRuc = descendants(party, CAC, 'PartyIdentification')
    .map((identification) => children(identification, CBC, 'ID').find((id) => attribute(id, 'schemeID') === '6') ?? null)
    .map(value)
    .find((entry): entry is string => entry !== null) ?? null;
  const taxSchemeCompanyId = descendants(party, CAC, 'PartyTaxScheme')
    .map((scheme) => field(scheme, CBC, 'CompanyID'))
    .find((entry): entry is string => entry !== null) ?? null;
  const legalEntities = descendants(party, CAC, 'PartyLegalEntity');
  const controlledCompanyId = legalEntities
    .map((entity) => field(entity, CBC, 'CompanyID'))
    .find((entry): entry is string => entry !== null) ?? null;
  const ruc = partyIdentificationRuc ?? taxSchemeCompanyId ?? controlledCompanyId;
  const legalEntity = legalEntities[0] ?? null;
  const razonSocial = field(legalEntity, CBC, 'RegistrationName')
    ?? firstDescendantValue(party, CBC, 'RegistrationName')
    ?? firstDescendantValue(party, CBC, 'Name');
  return { ruc, razonSocial };
}

function attribute(node: XmlNode | null, name: string): string | null {
  const found = node?.attributes.find((item) => item.local === name && item.uri === '');
  return found?.value ?? null;
}

function parseAdditionalInformation(line: XmlNode): InformacionAdicionalFactura[] {
  return descendants(line, CBC, 'AdditionalInformation').map((node) => {
    const code = field(node, CBC, 'NameCode') ?? field(node, CBC, 'Code');
    const valueNode = child(node, CBC, 'Value') ?? child(node, CBC, 'Text');
    const original = value(node) ?? '';
    if (code !== null) {
      return { codigo: code, valor: value(valueNode) ?? original, original };
    }
    const parsed = original.match(/^\s*(\d+)\s+(.+?)\s*$/);
    return parsed
      ? { codigo: parsed[1]!, valor: parsed[2]!, original }
      : { codigo: null, valor: original, original };
  });
}

interface TaxSubtotalInfo {
  valor: string | null;
  exoneracion: string | null;
  esquema: string | null;
}

function taxSubtotalInfo(subtotal: XmlNode): TaxSubtotalInfo {
  const category = child(subtotal, CAC, 'TaxCategory');
  const scheme = child(category, CAC, 'TaxScheme');
  return {
    valor: field(subtotal, CBC, 'TaxableAmount'),
    exoneracion: field(category, CBC, 'TaxExemptionReasonCode'),
    esquema: field(scheme, CBC, 'ID')
  };
}

function subtotalRepresentsFreeOperation(info: TaxSubtotalInfo): boolean {
  return info.exoneracion === '31' || info.esquema === '9996';
}

function parseLine(line: XmlNode): LineaFacturaUbl {
  const item = child(line, CAC, 'Item');
  const salesId = child(child(item, CAC, 'SellersItemIdentification'), CBC, 'ID');
  const properties = descendants(item, CAC, 'AdditionalItemProperty');
  if (properties.length > LIMITES_XML_FACTURA.propertiesPerLine) {
    fail('XML_LIMITE_SUPERADO', 'Una línea supera el límite de propiedades complementarias.');
  }
  const propiedadesOriginales: PropiedadFacturaOriginal[] = properties.map((property) => ({
    codigo: field(property, CBC, 'NameCode'),
    nombre: field(property, CBC, 'Name'),
    valor: field(property, CBC, 'Value') ?? ''
  }));
  const propiedadesPorCodigo: Record<string, string[]> = {};
  for (const property of propiedadesOriginales) {
    if (property.codigo) (propiedadesPorCodigo[property.codigo] ??= []).push(property.valor);
  }

  const quantity = child(line, CBC, 'InvoicedQuantity');
  const classification = child(item, CAC, 'CommodityClassification');
  const price = child(line, CAC, 'Price');
  const unitPrice = child(price, CBC, 'PriceAmount');
  const alternativePrices = descendants(child(line, CAC, 'PricingReference'), CAC, 'AlternativeConditionPrice');
  const alternativePrice02 = alternativePrices.find((candidate) => field(candidate, CBC, 'PriceTypeCode') === '02') ?? null;
  const alternativePrice = alternativePrice02 ?? alternativePrices[0] ?? null;
  const priceTypeCode = field(alternativePrice02, CBC, 'PriceTypeCode')
    ?? firstDescendantValue(price, CBC, 'PriceTypeCode')
    ?? field(alternativePrice, CBC, 'PriceTypeCode');
  const taxSubtotals = descendants(line, CAC, 'TaxSubtotal').map(taxSubtotalInfo);
  const freeTaxSubtotals = taxSubtotals.filter(subtotalRepresentsFreeOperation);
  const taxMetadata = freeTaxSubtotals[0] ?? taxSubtotals[0] ?? null;
  const precioReferencial = field(alternativePrice, CBC, 'PriceAmount');
  const operationIsFree = priceTypeCode === '02' || taxSubtotals.some(subtotalRepresentsFreeOperation);
  const freeLineTaxBase = freeTaxSubtotals.length > 0
    ? addDecimals(freeTaxSubtotals.map((subtotal) => subtotal.valor ?? ''))
    : null;
  const referenceValue = precioReferencial && quantity
    ? multiplyDecimals(precioReferencial, value(quantity) ?? '')
    : null;
  const additionalInformation = parseAdditionalInformation(line);
  const pedidoLinea = additionalInformation.find((entry) => entry.codigo === CODIGOS_PROPIEDAD_CROSLAND.pedidoLinea)?.valor ?? null;

  return {
    numeroLinea: field(line, CBC, 'ID'),
    codigoExterno: value(salesId),
    descripcion: firstDescendantValue(item, CBC, 'Description'),
    cantidad: value(quantity),
    unidadMedida: attribute(quantity, 'unitCode'),
    pedidoLinea,
    valorLinea: field(line, CBC, 'LineExtensionAmount'),
    precioUnitario: value(unitPrice),
    precioReferencial,
    clasificacionUnspc: field(classification, CBC, 'ItemClassificationCode'),
    operacionGratuita: operationIsFree,
    valorOperacionGratuita: operationIsFree ? freeLineTaxBase ?? referenceValue : null,
    priceTypeCode,
    taxExemptionReasonCode: taxMetadata?.exoneracion ?? null,
    taxScheme: taxMetadata?.esquema ?? null,
    propiedadesPorCodigo,
    propiedadesOriginales,
    additionalInformation
  };
}

function addDecimals(values: string[]): string | null {
  const parsed = values.map((item) => {
    const match = item.trim().match(/^(-?)(\d{1,18})(?:\.(\d{1,6}))?$/);
    if (!match) return null;
    const fraction = (match[3] ?? '').padEnd(6, '0');
    const amount = BigInt(match[2]! + fraction) * (match[1] ? -1n : 1n);
    return amount;
  });
  if (!parsed.length || parsed.some((item) => item === null)) return null;
  const total = (parsed as bigint[]).reduce((sum, item) => sum + item, 0n);
  const negative = total < 0n;
  const absolute = negative ? -total : total;
  const integer = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

function decimalToMicros(raw: string): bigint | null {
  const match = raw.trim().match(/^(-?)(\d{1,18})(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const value = BigInt(match[2]! + (match[3] ?? '').padEnd(6, '0'));
  return match[1] ? -value : value;
}

function formatMicros(total: bigint): string {
  const negative = total < 0n;
  const absolute = negative ? -total : total;
  const integer = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

function multiplyDecimals(left: string, right: string): string | null {
  const leftMicros = decimalToMicros(left);
  const rightMicros = decimalToMicros(right);
  if (leftMicros === null || rightMicros === null) return null;
  return formatMicros(leftMicros * rightMicros / 1_000_000n);
}

function extractDocument(root: XmlNode, warnings: string[]): FacturaUblParseada {
  const [issuer, buyer] = [partyFields(root, 'AccountingSupplierParty'), partyFields(root, 'AccountingCustomerParty')];
  const lines = children(root, CAC, 'InvoiceLine');
  if (lines.length > LIMITES_XML_FACTURA.invoiceLines) {
    fail('XML_LIMITE_SUPERADO', 'El documento supera el máximo de líneas permitido.');
  }
  const parsedLines = lines.map(parseLine);
  const idDocumento = field(root, CBC, 'ID');
  const identity = idDocumento?.match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/);
  const legalMonetaryTotal = child(root, CAC, 'LegalMonetaryTotal');
  const taxTotals = children(root, CAC, 'TaxTotal');
  const totalLineasDeclarado = field(root, CBC, 'LineCountNumeric');
  const lineAmounts = parsedLines.map((line) => line.valorLinea);
  const sumaLineas = lineAmounts.every((amount): amount is string => amount !== null) ? addDecimals(lineAmounts) : null;
  const onerousLineAmounts = parsedLines.filter((line) => !line.operacionGratuita).map((line) => line.valorLinea);
  const sumaLineasOnerosas = onerousLineAmounts.length > 0
    && onerousLineAmounts.every((amount): amount is string => amount !== null)
    ? addDecimals(onerousLineAmounts)
    : null;
  const freeLines = parsedLines.filter((line) => line.operacionGratuita);
  const freeLineAmounts = freeLines.map((line) => line.valorOperacionGratuita);
  const sumaLineasGratuitas = freeLines.length > 0
    && freeLineAmounts.every((amount): amount is string => amount !== null)
    ? addDecimals(freeLineAmounts)
    : null;
  const freeSubtotals = taxTotals.flatMap((total) => children(total, CAC, 'TaxSubtotal'))
    .map(taxSubtotalInfo)
    .filter(subtotalRepresentsFreeOperation)
    .map((subtotal) => subtotal.valor);
  const totalOperacionesGratuitasDeclarado = freeSubtotals.length > 0
    && freeSubtotals.every((amount): amount is string => amount !== null)
    ? addDecimals(freeSubtotals)
    : null;
  const taxAmounts = taxTotals.map((total) => field(total, CBC, 'TaxAmount'));
  const impuestos = taxAmounts.length > 0 && taxAmounts.every((amount): amount is string => amount !== null)
    ? addDecimals(taxAmounts)
    : null;
  const rootSignature = descendants(root, XMLDSIG, 'Signature').length > 0;
  const libreta = child(child(root, CAC, 'OrderReference'), CBC, 'ID');

  return {
    ublVersion: field(root, CBC, 'UBLVersionID'),
    tipoDocumento: field(root, CBC, 'InvoiceTypeCode'),
    idDocumento,
    serie: identity?.[1] ?? null,
    numero: identity?.[2] ?? null,
    fechaEmision: field(root, CBC, 'IssueDate'),
    fechaVencimiento: field(root, CBC, 'DueDate'),
    moneda: field(root, CBC, 'DocumentCurrencyCode'),
    rucEmisor: issuer.ruc,
    razonSocialEmisor: issuer.razonSocial,
    rucComprador: buyer.ruc,
    razonSocialComprador: buyer.razonSocial,
    pedidoCabecera: value(libreta),
    cantidadLineasDeclarada: totalLineasDeclarado,
    firmaPresente: rootSignature,
    totales: {
      sumaLineas,
      sumaLineasOnerosas,
      sumaLineasGratuitas,
      totalLineasDeclarado: field(legalMonetaryTotal, CBC, 'LineExtensionAmount'),
      totalOperacionesGratuitasDeclarado,
      valorVentaDeclarado: field(legalMonetaryTotal, CBC, 'LineExtensionAmount'),
      totalAntesImpuestos: field(legalMonetaryTotal, CBC, 'TaxExclusiveAmount'),
      totalIncluidosImpuestos: field(legalMonetaryTotal, CBC, 'TaxInclusiveAmount'),
      totalPagar: field(legalMonetaryTotal, CBC, 'PayableAmount'),
      impuestos
    },
    advertencias: warnings,
    lineas: parsedLines
  };
}

/** Analiza XML UBL desde los bytes originales. No consulta servicios ni escribe datos. */
export function parsearFacturaUbl(bytes: Uint8Array): FacturaUblParseada {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) fail('XML_VACIO', 'El XML está vacío.');
  if (bytes.length > LIMITES_XML_FACTURA.bytes) fail('XML_DEMASIADO_GRANDE', 'El XML supera el máximo de 5 MiB.');
  if (bytes.includes(0)) fail('XML_BYTE_NUL', 'El XML contiene bytes NUL.');
  const decoded = decodeXml(bytes);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(decoded.text)) {
    fail('XML_DTD_NO_PERMITIDO', 'DOCTYPE y ENTITY no están permitidos.');
  }
  const root = parseTree(decoded.text);
  if (root.uri !== UBL_INVOICE || root.local !== 'Invoice') {
    fail('XML_FACTURA_UBL_REQUERIDA', 'Se requiere una factura UBL Invoice.');
  }
  return extractDocument(root, decoded.advertencias);
}
