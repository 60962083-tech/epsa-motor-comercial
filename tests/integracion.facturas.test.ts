import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app.js';
import { construirCanonicalFactura, validarHeadersIntegracionFactura } from '../src/middleware/integracion.hmac.js';

const SECRET = 'test-only-hmac-secret-value-32-bytes-min';
const XML = Buffer.from(readFileSync('tests/fixtures/factura-importacion/factura_valida.xml', 'utf8')
  .replace('20123456789', '20502913752').replace('20987654321', '20555595469'));
const PDF = Buffer.from('%PDF-1.7\nsynthetic evidence\n%%EOF');
const hex = (value: Buffer) => createHash('sha256').update(value).digest('hex');

function configurarEnv() {
  const old = { key: process.env.HU030_HMAC_CURRENT_KEY_ID, secret: process.env.HU030_HMAC_CURRENT_SECRET,
    prevKey: process.env.HU030_HMAC_PREVIOUS_KEY_ID, prevSecret: process.env.HU030_HMAC_PREVIOUS_SECRET,
    tolerance: process.env.HU030_HMAC_TOLERANCIA_SEGUNDOS };
  process.env.HU030_HMAC_CURRENT_KEY_ID = 'test-current';
  process.env.HU030_HMAC_CURRENT_SECRET = SECRET;
  delete process.env.HU030_HMAC_PREVIOUS_KEY_ID;
  delete process.env.HU030_HMAC_PREVIOUS_SECRET;
  process.env.HU030_HMAC_TOLERANCIA_SEGUNDOS = '300';
  return () => {
    for (const [key, value] of Object.entries({
      HU030_HMAC_CURRENT_KEY_ID: old.key, HU030_HMAC_CURRENT_SECRET: old.secret,
      HU030_HMAC_PREVIOUS_KEY_ID: old.prevKey, HU030_HMAC_PREVIOUS_SECRET: old.prevSecret,
      HU030_HMAC_TOLERANCIA_SEGUNDOS: old.tolerance
    })) value === undefined ? delete process.env[key] : process.env[key] = value;
  };
}

function headersFor(options: { xml?: Buffer; pdf?: Buffer; shaXml?: string; shaPdf?: string | null; nonce?: string; keyId?: string; secret?: string; timestamp?: string } = {}) {
  const xml = options.xml ?? XML;
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const keyId = options.keyId ?? 'test-current';
  const sha256Xml = options.shaXml ?? hex(xml);
  const sha256Pdf = options.shaPdf === undefined ? (options.pdf ? hex(options.pdf) : null) : options.shaPdf;
  const nonce = options.nonce ?? cryptoRandomUuid();
  const canonical = construirCanonicalFactura({ keyId, timestamp: Number(timestamp), timestampTexto: timestamp,
    nonce, gmailMessageId: 'gmail-message-0123', sha256Xml, sha256Pdf });
  const signature = `v1=${createHmac('sha256', options.secret ?? SECRET).update(canonical, 'utf8').digest('hex')}`;
  return {
    'X-EPSA-Key-Id': keyId, 'X-EPSA-Timestamp': timestamp, 'X-EPSA-Nonce': nonce,
    'X-EPSA-Message-Id': 'gmail-message-0123', 'X-EPSA-XML-SHA256': sha256Xml,
    'X-EPSA-PDF-SHA256': sha256Pdf ?? '-', 'X-EPSA-Signature': signature
  };
}

function cryptoRandomUuid() {
  return globalThis.crypto.randomUUID();
}

const savedSummary = { codrec: '90000000-0000-4000-8000-000000000001', coddoc: '81',
  estadoDocumento: 'Importado', reintento: false, pdfPendiente: true,
  conteos: { lineas: 4, vehiculos: 2, importados: 2, revision: 0 }, advertencias: [] };

function crearClienteMock() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const files = new Map<string, Buffer>();
  const outcomes: unknown[] = [];
  const finalizationOutcomes: unknown[] = [];
  let generatedReceipt = 1;
  let uploadCount = 0;
  let falloSubida: 'xml' | 'pdf' | null = null;
  let response = {
    coddoc: '81', estadoDocumento: 'Importado', reintento: false, error: null,
    compras: [], unidades: [{ motorEnmascarado: 'ENG***001', chasisEnmascarado: 'CHS***001' }], lineasRevision: [],
    conteos: { lineas: 4, vehiculos: 2, importados: 2, revision: 0 }, advertencias: []
  };
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'hu030_integracion_reservar_tecnico') {
        const next = outcomes.shift();
        generatedReceipt += 1;
        const codrec = `90000000-0000-4000-8000-${String(generatedReceipt).padStart(12, '0')}`;
        return { data: next ?? { resultado: 'Nueva', codrec, estado: 'Procesando',
          coddoc: null, pdfPendiente: true, rutaXml: null, rutaPdf: null, resumen: null }, error: null };
      }
      if (name === 'hu030_listar_equivalencias_tecnicas') return { data: [
        { codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo', codmod: '42', activa: true },
        { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio', codmod: null, activa: true }
      ], error: null };
      if (name === 'hu030_importar_documento_tecnico') return { data: response, error: null };
      if (name === 'hu030_integracion_finalizar_tecnico')
        return { data: finalizationOutcomes.shift() ?? { ...savedSummary }, error: null };
      return { data: null, error: { message: 'private details' } };
    },
    storage: { from: (bucket: string) => ({
      list: async (folder: string, opts: { search?: string }) => {
        const path = `${folder}/${opts.search}`;
        return { data: files.has(path) ? [{ name: opts.search }] : [], error: null };
      },
      download: async (path: string) => files.has(path)
        ? { data: new Blob([files.get(path)!]), error: null }
        : { data: null, error: { statusCode: 'NotFound' } },
      upload: async (path: string, content: Buffer) => {
        uploadCount += 1;
        if (falloSubida && path.endsWith(`original.${falloSubida}`)) return { data: null, error: { message: 'private storage details' } };
        files.set(path, Buffer.from(content));
        return { data: { path }, error: null };
      }
    }) }
  } as unknown as SupabaseClient;
  return {
    db, calls, files, outcomes, finalizationOutcomes,
    get uploadCount() { return uploadCount; },
    setUploadFailure(value: 'xml' | 'pdf' | null) { falloSubida = value; },
    setResponse(value: typeof response) { response = value; }
  };
}

async function abrirApi(db: SupabaseClient) {
  const server = createServer(crearApp(undefined, undefined, () => db));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${address.port}/api/integraciones/facturas`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

async function post(url: string, options: { xml?: Buffer; pdf?: Buffer; includeXml?: boolean; fields?: boolean; headers?: Record<string, string>; bearer?: boolean } = {}) {
  const xml = options.xml ?? XML;
  const form = new FormData();
  if (options.includeXml !== false) form.append('xml', new Blob([xml], { type: 'application/xml' }), 'invoice.xml');
  if (options.pdf) form.append('pdf', new Blob([options.pdf], { type: 'application/pdf' }), 'evidence.pdf');
  if (options.fields) form.append('extra', 'not allowed');
  const headers = { ...headersFor({ xml, pdf: options.pdf }), ...options.headers };
  if (options.bearer) headers.Authorization = 'Bearer never-used';
  return fetch(url, { method: 'POST', headers, body: form });
}

test('HU-030 HMAC valida canonical, firma, timestamp, headers canónicos y rotación', () => {
  const restore = configurarEnv();
  try {
    const timestamp = '1792886400';
    const input = { keyId: 'test-current', timestamp: Number(timestamp), timestampTexto: timestamp,
      nonce: 'a0000000-b000-4c00-8000-000000000001', gmailMessageId: 'gmail-1',
      sha256Xml: 'a'.repeat(64), sha256Pdf: null };
    assert.equal(construirCanonicalFactura(input), [
      'EPSA-HU030-HMAC-V1','POST','/api/integraciones/facturas','test-current',timestamp,
      'a0000000-b000-4c00-8000-000000000001','gmail-1','a'.repeat(64),'-'
    ].join('\n'));
    const signature = `v1=${createHmac('sha256',SECRET).update(construirCanonicalFactura(input)).digest('hex')}`;
    const valid = { 'x-epsa-key-id': input.keyId, 'x-epsa-timestamp': timestamp, 'x-epsa-nonce': input.nonce,
      'x-epsa-message-id': input.gmailMessageId, 'x-epsa-xml-sha256': input.sha256Xml,
      'x-epsa-pdf-sha256': '-', 'x-epsa-signature': signature };
    assert.equal(validarHeadersIntegracionFactura(valid, Number(timestamp)).keyId, 'test-current');
    assert.throws(() => validarHeadersIntegracionFactura({ ...valid, 'x-epsa-signature': `v1=${'0'.repeat(64)}` }, Number(timestamp)), /FIRMA_INVALIDA/);
    const cases = [
      { ...valid, 'x-epsa-key-id': 'bad id' },
      { ...valid, 'x-epsa-timestamp': String(Number(timestamp) - 301) },
      { ...valid, 'x-epsa-timestamp': String(Number(timestamp) + 301) },
      { ...valid, 'x-epsa-nonce': input.nonce.toUpperCase() },
      { ...valid, 'x-epsa-message-id': 'gmail\r\nInjected: x' },
      { ...valid, 'x-epsa-xml-sha256': 'A'.repeat(64) },
      { ...valid, 'x-epsa-xml-sha256': 'a'.repeat(63) },
      { ...valid, 'x-epsa-signature': 'v1=short' }
    ];
    for (const [index, invalid] of cases.entries())
      assert.throws(() => validarHeadersIntegracionFactura(invalid, Number(timestamp)), `invalid header case ${index}`);

    process.env.HU030_HMAC_PREVIOUS_KEY_ID = 'test-previous';
    process.env.HU030_HMAC_PREVIOUS_SECRET = 'previous-only-test-secret-value-32-bytes';
    const previousSignature = `v1=${createHmac('sha256',process.env.HU030_HMAC_PREVIOUS_SECRET).update(
      construirCanonicalFactura({ ...input, keyId: 'test-previous' })).digest('hex')}`;
    assert.equal(validarHeadersIntegracionFactura({ ...valid, 'x-epsa-key-id': 'test-previous',
      'x-epsa-signature': previousSignature }, Number(timestamp)).keyId, 'test-previous');
  } finally { restore(); }
});

test('HU-030 HTTP: endpoint HMAC público recibe XML, no filtra seriales y permite PDF opcional', async (t) => {
  const restore = configurarEnv();
  const mock = crearClienteMock();
  const api = await abrirApi(mock.db);
  try {
    await t.test('201 sin Authorization y resumen sanitizado', async () => {
      const response = await post(api.url);
      assert.equal(response.status, 201);
      const body = await response.json() as any;
      assert.equal(body.ok, true);
      assert.equal(body.data.coddoc, '81');
      assert.equal(body.data.pdfPendiente, true);
      const serialized = JSON.stringify(body);
      assert.doesNotMatch(serialized, /ENGINE-SYNTH-001|CHASSIS-SYNTH-001|private details|secret-value/);
      assert.equal(mock.calls.some((call) => call.name === 'hu030_listar_equivalencias_tecnicas'), true);
      assert.equal(mock.calls.some((call) => call.name === 'hu030_importar_documento_tecnico'), true);
    });

    await t.test('PDF presente validado se guarda, incluido por mock privado', async () => {
      const response = await post(api.url, { pdf: PDF, bearer: true });
      assert.equal(response.status, 201);
      const body = await response.json() as any;
      assert.equal(body.data.pdfPendiente, false);
      assert.ok([...mock.files.keys()].some((path) => path.endsWith('/original.pdf')));
      const finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, hex(PDF));
    });

    await t.test('PDF declarado ausente o con bytes distintos nunca se confirma', async () => {
      const missingPdf = await post(api.url, { headers: headersFor({ xml: XML, shaPdf: hex(PDF) }) });
      assert.equal(missingPdf.status, 400);
      let finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, null);

      const mismatched = await post(api.url, { pdf: PDF, headers: headersFor({ pdf: PDF, shaPdf: 'a'.repeat(64) }) });
      assert.equal(mismatched.status, 400);
      finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, null);
    });

    await t.test('sin XML, campos extra, MIME incorrecto y archivo adicional se rechazan', async () => {
      const missing = await post(api.url, { includeXml: false });
      assert.equal(missing.status, 400);
      const fields = await post(api.url, { fields: true });
      assert.equal(fields.status, 400);
      const wrongMimeForm = new FormData();
      wrongMimeForm.append('xml', new Blob([XML], { type: 'text/plain' }), 'x.txt');
      const wrongMime = await fetch(api.url, { method: 'POST', headers: headersFor(), body: wrongMimeForm });
      assert.equal(wrongMime.status, 400);
      const wrongPdfForm = new FormData();
      wrongPdfForm.append('xml', new Blob([XML], { type: 'application/xml' }), 'x.xml');
      wrongPdfForm.append('pdf', new Blob([PDF], { type: 'text/plain' }), 'x.pdf');
      const wrongPdfMime = await fetch(api.url, { method: 'POST', headers: headersFor({ pdf: PDF }), body: wrongPdfForm });
      assert.equal(wrongPdfMime.status, 400);
      const extraFileForm = new FormData();
      extraFileForm.append('xml', new Blob([XML], { type: 'application/xml' }), 'x.xml');
      extraFileForm.append('other', new Blob([PDF], { type: 'application/pdf' }), 'x.pdf');
      const extra = await fetch(api.url, { method: 'POST', headers: headersFor(), body: extraFileForm });
      assert.equal(extra.status, 400);
    });

    await t.test('límites de tamaño, magic bytes y hashes se comprueban con bytes reales', async () => {
      const largeXml = await post(api.url, { xml: Buffer.alloc(5 * 1024 * 1024 + 1, 65) });
      assert.equal(largeXml.status, 413);
      const largePdf = await post(api.url, { pdf: Buffer.alloc(10 * 1024 * 1024 + 1, 65) });
      assert.equal(largePdf.status, 413);
      const badPdf = await post(api.url, { pdf: Buffer.from('not a pdf') });
      assert.equal(badPdf.status, 400);
      const alter = Buffer.from(XML); alter[alter.length - 10] ^= 1;
      const badHashXml = await fetch(api.url, { method: 'POST', headers: headersFor({ xml: XML }),
        body: (() => { const form = new FormData(); form.append('xml', new Blob([alter], { type: 'application/xml' }), 'x.xml'); return form; })() });
      assert.equal(badHashXml.status, 400);
      const badHashPdf = await fetch(api.url, { method: 'POST', headers: headersFor({ pdf: PDF, shaPdf: 'a'.repeat(64) }),
        body: (() => { const form = new FormData(); form.append('xml', new Blob([XML], { type: 'application/xml' }), 'x.xml'); form.append('pdf', new Blob([PDF], { type: 'application/pdf' }), 'x.pdf'); return form; })() });
      assert.equal(badHashPdf.status, 400);
    });

    await t.test('rechazo fiscal del XML responde 422 con código controlado', async () => {
      const invalidFiscalXml = Buffer.from(XML.toString('utf8').replace('20502913752', '20111111111'));
      const response = await post(api.url, { xml: invalidFiscalXml });
      assert.equal(response.status, 422);
      const body = await response.json() as any;
      assert.equal(body.code, 'RUC_EMISOR_NO_AUTORIZADO');
      assert.doesNotMatch(JSON.stringify(body), /Proveedor de Prueba|private details|ENGINE-SYNTH/);
    });

    await t.test('auth HMAC ausente, nonce replay, processing y retry completo', async () => {
      const noHmac = await fetch(api.url, { method: 'POST', body: new FormData() });
      assert.equal(noHmac.status, 401);
      mock.outcomes.push({ resultado: 'NONCE_REPETIDO' });
      const replay = await post(api.url);
      assert.equal(replay.status, 409);
      mock.outcomes.push({ resultado: 'Procesando', codrec: savedSummary.codrec });
      const processing = await post(api.url);
      assert.equal(processing.status, 202);
      assert.equal(processing.headers.get('retry-after'), '2');
      const finalizersBeforePdfWaiter = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').length;
      mock.outcomes.push({ resultado: 'PdfProcesando', codrec: savedSummary.codrec, pdfPendiente: true,
        sha256Xml: hex(XML), sha256Pdf: null, rutaXml: `documentos/${savedSummary.codrec}/original.xml` });
      const pdfWaiter = await post(api.url, { pdf: PDF });
      assert.equal(pdfWaiter.status, 202);
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').length, finalizersBeforePdfWaiter);
      mock.files.set(`documentos/${savedSummary.codrec}/original.xml`, XML);
      mock.files.set(`documentos/${savedSummary.codrec}/original.pdf`, PDF);
      mock.outcomes.push({ resultado: 'Completada', codrec: savedSummary.codrec, coddoc: '81', pdfPendiente: false,
        sha256Xml: hex(XML), sha256Pdf: hex(PDF), rutaXml: `documentos/${savedSummary.codrec}/original.xml`,
        rutaPdf: `documentos/${savedSummary.codrec}/original.pdf`, resumen: savedSummary });
      const completed = await post(api.url);
      assert.equal(completed.status, 200);
    });

    await t.test('fallo XML Storage bloquea importación y fallo PDF permite importación pendiente', async () => {
      mock.setUploadFailure('xml');
      const before = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
      const xmlFailure = await post(api.url);
      assert.equal(xmlFailure.status, 503);
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length, before);
      mock.setUploadFailure('pdf');
      const pdfFailure = await post(api.url, { pdf: PDF });
      assert.equal(pdfFailure.status, 201);
      assert.equal((await pdfFailure.json() as any).data.pdfPendiente, true);
      const finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, hex(PDF));
      assert.equal(finalizer?.args.p_pdfpendiente, true);
      assert.equal(finalizer?.args.p_rutapdf, null);
      assert.equal(finalizer?.args.p_error, 'PDF_STORAGE_PENDING');
      mock.setUploadFailure(null);
    });

    await t.test('completar PDF posterior no vuelve a llamar la RPC de importación', async () => {
      const receipt = '93000000-0000-4000-8000-000000000001';
      mock.files.set(`documentos/${receipt}/original.xml`, XML);
      mock.outcomes.push({ resultado: 'CompletarPdf', codrec: receipt, coddoc: '81', pdfPendiente: true,
        sha256Xml: hex(XML), sha256Pdf: null, rutaXml: `documentos/${receipt}/original.xml`, rutaPdf: null, resumen: savedSummary });
      const before = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
      const response = await post(api.url, { pdf: PDF });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as any).data.pdfPendiente, false);
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length, before);
      const finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, hex(PDF));
    });

    await t.test('fallo de Storage tras validar PDF registra hash pendiente sin reimportar', async () => {
      const receipt = '93000000-0000-4000-8000-000000000008';
      mock.files.set(`documentos/${receipt}/original.xml`, XML);
      mock.outcomes.push({ resultado: 'CompletarPdf', codrec: receipt, coddoc: '81', pdfPendiente: true,
        sha256Xml: hex(XML), sha256Pdf: null, rutaXml: `documentos/${receipt}/original.xml`, rutaPdf: null, resumen: savedSummary });
      mock.setUploadFailure('pdf');
      const before = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
      const response = await post(api.url, { pdf: PDF });
      assert.equal(response.status, 503);
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length, before);
      const finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_operacion, 'CompletarPdf');
      assert.equal(finalizer?.args.p_estado, 'Error');
      assert.equal(finalizer?.args.p_sha256_pdf_verificado, hex(PDF));
      assert.equal(finalizer?.args.p_error, 'PDF_STORAGE_PENDING');
      assert.equal(finalizer?.args.p_pdfpendiente, true);
      assert.equal(finalizer?.args.p_rutapdf, null);
      mock.setUploadFailure(null);
    });

    await t.test('retry inválido de recepción completada cierra solo el intento HTTP', async () => {
      const receipt = '93000000-0000-4000-8000-000000000007';
      mock.files.set(`documentos/${receipt}/original.xml`, XML);
      mock.outcomes.push({ resultado: 'Completada', codrec: receipt, coddoc: '81', pdfPendiente: true,
        sha256Xml: hex(XML), rutaXml: `documentos/${receipt}/original.xml`, rutaPdf: null, resumen: savedSummary });
      const response = await post(api.url, { includeXml: false });
      assert.equal(response.status, 400);
      const call = mock.calls.filter((item) => item.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(call?.args.p_operacion, 'SoloIntento');
      assert.equal(call?.args.p_error, 'MULTIPART_INVALIDO');
    });

    await t.test('lease perdido se devuelve como 409 controlado', async () => {
      mock.finalizationOutcomes.push({ resultado: 'LEASE_PERDIDO' }, { resultado: 'INTENTO_CERRADO' });
      const response = await post(api.url);
      assert.equal(response.status, 409);
      assert.equal((await response.json() as any).code, 'LEASE_PERDIDO');
    });

    await t.test('recepción completada verifica XML y PDF existentes antes de responder', async () => {
      const receipt = '93000000-0000-4000-8000-000000000002';
      mock.files.set(`documentos/${receipt}/original.xml`, XML);
      mock.files.set(`documentos/${receipt}/original.pdf`, PDF);
      mock.outcomes.push({ resultado: 'Completada', codrec: receipt, coddoc: '81', pdfPendiente: false,
        sha256Xml: hex(XML), sha256Pdf: hex(PDF), rutaXml: `documentos/${receipt}/original.xml`,
        rutaPdf: `documentos/${receipt}/original.pdf`, resumen: savedSummary });
      const complete = await post(api.url);
      assert.equal(complete.status, 200);

      const missingXml = '93000000-0000-4000-8000-000000000003';
      mock.outcomes.push({ resultado: 'Completada', codrec: missingXml, coddoc: '81', pdfPendiente: false,
        sha256Xml: hex(XML), sha256Pdf: hex(PDF), rutaXml: `documentos/${missingXml}/original.xml`,
        rutaPdf: `documentos/${missingXml}/original.pdf`, resumen: savedSummary });
      const missing = await post(api.url);
      assert.equal(missing.status, 503);
      assert.equal((await missing.json() as any).code, 'EVIDENCIA_XML_NO_DISPONIBLE');

      const corruptXml = '93000000-0000-4000-8000-000000000006';
      mock.files.set(`documentos/${corruptXml}/original.xml`, Buffer.from('corrupt xml'));
      mock.outcomes.push({ resultado: 'Completada', codrec: corruptXml, coddoc: '81', pdfPendiente: true,
        sha256Xml: hex(XML), rutaXml: `documentos/${corruptXml}/original.xml`, rutaPdf: null, resumen: savedSummary });
      const corruptXmlResponse = await post(api.url);
      assert.equal(corruptXmlResponse.status, 409);
      assert.equal((await corruptXmlResponse.json() as any).code, 'EVIDENCIA_CONFLICTO');
      assert.equal(mock.files.get(`documentos/${corruptXml}/original.xml`)?.toString(), 'corrupt xml');

      const corrupt = '93000000-0000-4000-8000-000000000004';
      mock.files.set(`documentos/${corrupt}/original.xml`, XML);
      mock.files.set(`documentos/${corrupt}/original.pdf`, Buffer.from('corrupt pdf'));
      mock.outcomes.push({ resultado: 'Completada', codrec: corrupt, coddoc: '81', pdfPendiente: false,
        sha256Xml: hex(XML), sha256Pdf: hex(PDF), rutaXml: `documentos/${corrupt}/original.xml`,
        rutaPdf: `documentos/${corrupt}/original.pdf`, resumen: savedSummary });
      const corruptPdf = await post(api.url);
      assert.equal(corruptPdf.status, 409);
      assert.equal((await corruptPdf.json() as any).code, 'PDF_EVIDENCIA_CONFLICTO');
      assert.equal(mock.files.get(`documentos/${corrupt}/original.pdf`)?.toString(), 'corrupt pdf');
    });

    await t.test('conflicto documental conserva HTTP 409 en reintento sin reimportar', async () => {
      const receipt = '93000000-0000-4000-8000-000000000005';
      const conflictSummary = { ...savedSummary, codrec: receipt, estadoDocumento: 'Pendiente de revision' };
      mock.files.set(`documentos/${receipt}/original.xml`, XML);
      mock.outcomes.push({ resultado: 'ConflictoDocumental', codrec: receipt, coddoc: '81', coderror: 'CONFLICTO_DOCUMENTAL',
        pdfPendiente: true, sha256Xml: hex(XML), rutaXml: `documentos/${receipt}/original.xml`,
        rutaPdf: null, resumen: conflictSummary });
      const before = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
      const response = await post(api.url);
      assert.equal(response.status, 409);
      const body = await response.json() as any;
      assert.equal(body.code, 'CONFLICTO_DOCUMENTAL');
      assert.equal(body.coddoc, '81');
      assert.equal(body.estadoDocumento, 'Pendiente de revision');
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length, before);
      const finalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
      assert.equal(finalizer?.args.p_operacion, 'SoloIntento');
    });

    await t.test('Storage reutiliza solo evidencia con hash coincidente y nunca sobrescribe', async () => {
      const reusable = '92000000-0000-4000-8000-000000000001';
      mock.files.set(`documentos/${reusable}/original.xml`, Buffer.from(XML));
      mock.outcomes.push({ resultado: 'Reintentar', codrec: reusable, estado: 'Procesando', coddoc: null,
        pdfPendiente: true, rutaXml: null, rutaPdf: null, resumen: null });
      const uploadsBefore = mock.uploadCount;
      const reused = await post(api.url);
      assert.equal(reused.status, 201);
      assert.equal(mock.uploadCount, uploadsBefore);

      const conflict = '92000000-0000-4000-8000-000000000002';
      mock.files.set(`documentos/${conflict}/original.xml`, Buffer.from('different evidence'));
      mock.outcomes.push({ resultado: 'Reintentar', codrec: conflict, estado: 'Procesando', coddoc: null,
        pdfPendiente: true, rutaXml: null, rutaPdf: null, resumen: null });
      const importCallsBefore = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
      const rejected = await post(api.url);
      assert.equal(rejected.status, 409);
      assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length, importCallsBefore);
      assert.equal(mock.files.get(`documentos/${conflict}/original.xml`)?.toString(), 'different evidence');
    });
  } finally {
    await api.close();
    restore();
  }
});

test('HU-030 HTTP: conflicto documental y PDF verificado pendiente conserva 409 al completar retry', async () => {
  const restore = configurarEnv();
  const mock = crearClienteMock();
  const api = await abrirApi(mock.db);
  const receiptSummary = { ...savedSummary, estadoDocumento:'Pendiente de revision', pdfPendiente:true };
  try {
    mock.setResponse({ coddoc:'81',estadoDocumento:'Pendiente de revision',reintento:false,
      error:'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO',compras:[],unidades:[],lineasRevision:[],
      conteos:{ lineas:4,vehiculos:2,importados:0,revision:2 },advertencias:[] } as any);
    mock.setUploadFailure('pdf');
    const initial = await post(api.url,{ pdf:PDF });
    assert.equal(initial.status,409);
    const initialBody = await initial.json() as any;
    assert.equal(initialBody.code,'CONFLICTO_DOCUMENTAL');
    assert.equal(initialBody.estadoDocumento,'Pendiente de revision');
    assert.equal(initialBody.pdfPendiente,true);
    const codrec = initialBody.codrec as string;
    const firstFinalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
    assert.equal(firstFinalizer?.args.p_operacion,'Procesar');
    assert.equal(firstFinalizer?.args.p_estado,'Completada');
    assert.equal(firstFinalizer?.args.p_http_status,409);
    assert.equal(firstFinalizer?.args.p_error,'CONFLICTO_DOCUMENTAL');
    assert.equal(firstFinalizer?.args.p_sha256_pdf_verificado,hex(PDF));
    assert.equal(firstFinalizer?.args.p_pdfpendiente,true);
    assert.equal(firstFinalizer?.args.p_rutapdf,null);
    assert.equal((firstFinalizer?.args.p_resumen as any).estadoDocumento,'Pendiente de revision');
    assert.equal((firstFinalizer?.args.p_resumen as any).pdfPendiente,true);

    const importCountBeforeRetry = mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length;
    mock.setUploadFailure(null);
    mock.outcomes.push({ resultado:'CompletarPdf',codrec,estado:'Completada',coddoc:'81',coderror:'CONFLICTO_DOCUMENTAL',
      pdfPendiente:true,sha256Xml:hex(XML),sha256Pdf:hex(PDF),rutaXml:`documentos/${codrec}/original.xml`,rutaPdf:null,
      resumen:receiptSummary });
    const retried = await post(api.url,{ pdf:PDF });
    assert.equal(retried.status,409);
    const retryBody = await retried.json() as any;
    assert.equal(retryBody.code,'CONFLICTO_DOCUMENTAL');
    assert.equal(retryBody.estadoDocumento,'Pendiente de revision');
    assert.equal(retryBody.pdfPendiente,false);
    assert.equal(mock.calls.filter((call) => call.name === 'hu030_importar_documento_tecnico').length,importCountBeforeRetry);
    assert.equal(mock.files.has(`documentos/${codrec}/original.pdf`),true);
    const retryFinalizer = mock.calls.filter((call) => call.name === 'hu030_integracion_finalizar_tecnico').at(-1);
    assert.equal(retryFinalizer?.args.p_operacion,'CompletarPdf');
    assert.equal(retryFinalizer?.args.p_estado,'Completada');
    assert.equal(retryFinalizer?.args.p_http_status,409);
    assert.equal(retryFinalizer?.args.p_error,'CONFLICTO_DOCUMENTAL');
    assert.equal(retryFinalizer?.args.p_sha256_pdf_verificado,hex(PDF));
    assert.equal(retryFinalizer?.args.p_rutapdf,`documentos/${codrec}/original.pdf`);
    assert.equal(retryFinalizer?.args.p_pdfpendiente,false);
  } finally {
    await api.close();
    restore();
  }
});
