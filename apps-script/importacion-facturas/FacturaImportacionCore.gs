var FACTURA_IMPORTACION_RUTA_CANONICA = '/api/integraciones/facturas';
var FACTURA_IMPORTACION_PREFIJO_CANONICO = 'EPSA-HU030-HMAC-V1';
var FACTURA_IMPORTACION_PROPIEDAD_COLA = 'HU030_RETRY_QUEUE_JSON';
var FACTURA_IMPORTACION_MAX_REINTENTOS = 4;
var FACTURA_IMPORTACION_ESPERAS_REINTENTO_MS = [15, 30, 60, 120].map(function (minutes) { return minutes * 60 * 1000; });
var FACTURA_IMPORTACION_SOLAPAMIENTO_MS = 15 * 60 * 1000;
var FACTURA_IMPORTACION_MAX_COLA = 20;
var FACTURA_IMPORTACION_MAX_JSON_COLA = 8000;
var FACTURA_IMPORTACION_MAX_XML_BYTES = 5 * 1024 * 1024;
var FACTURA_IMPORTACION_MAX_PDF_BYTES = 10 * 1024 * 1024;
var FACTURA_IMPORTACION_MAX_LOTE = 100;
var FACTURA_IMPORTACION_LABELS_DEFAULT = {
  Procesado: 'EPSA/HU030/Procesado',
  Pendiente: 'EPSA/HU030/Pendiente',
  Revision: 'EPSA/HU030/Revision',
  Error: 'EPSA/HU030/Error'
};

function errorFacturaImportacion(codigo) {
  var error = new Error(codigo);
  error.facturaImportacionCode = codigo;
  return error;
}

function bytesFirmadosAHex(bytes) {
  if (!bytes || typeof bytes.length !== 'number') throw errorFacturaImportacion('BYTES_INVALIDOS');
  var hex = [];
  for (var index = 0; index < bytes.length; index += 1) {
    var value = (Number(bytes[index]) + 256) % 256;
    if (!isFinite(value)) throw errorFacturaImportacion('BYTES_INVALIDOS');
    hex.push(('0' + value.toString(16)).slice(-2));
  }
  return hex.join('');
}

function sha256Hex(bytes) {
  return bytesFirmadosAHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}

function construirCanonicalFacturaImportacion(input) {
  if (!input || !/^[A-Za-z0-9._-]{1,64}$/.test(input.keyId || '')
    || !/^(0|[1-9]\d{0,11})$/.test(input.timestampTexto || '')
    || !validarNonceFacturaImportacion(input.nonce)
    || typeof input.gmailMessageId !== 'string' || !/^[\x21-\x7e]{1,250}$/.test(input.gmailMessageId)
    || !/^[0-9a-f]{64}$/.test(input.sha256Xml || '')
    || (input.sha256Pdf && !/^[0-9a-f]{64}$/.test(input.sha256Pdf))) {
    throw errorFacturaImportacion('CANONICAL_INVALIDA');
  }
  return [
    FACTURA_IMPORTACION_PREFIJO_CANONICO,
    'POST',
    FACTURA_IMPORTACION_RUTA_CANONICA,
    input.keyId,
    input.timestampTexto,
    input.nonce,
    input.gmailMessageId,
    input.sha256Xml,
    input.sha256Pdf || '-'
  ].join('\n');
}

function firmaHmacFacturaImportacion(canonical, secret) {
  return 'v1=' + bytesFirmadosAHex(Utilities.computeHmacSha256Signature(canonical, secret));
}

function validarNonceFacturaImportacion(nonce) {
  return typeof nonce === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonce);
}

function nuevoNonceFacturaImportacion() {
  var nonce = String(Utilities.getUuid()).toLowerCase();
  if (!validarNonceFacturaImportacion(nonce)) throw errorFacturaImportacion('NONCE_FORMATO_INVALIDO');
  return nonce;
}

function timestampUnixFacturaImportacion(nowMs) {
  var milliseconds = nowMs === undefined ? Date.now() : Number(nowMs);
  if (!isFinite(milliseconds) || milliseconds < 0) throw errorFacturaImportacion('TIMESTAMP_INVALIDO');
  var timestamp = String(Math.floor(milliseconds / 1000));
  if (!/^(0|[1-9]\d{0,11})$/.test(timestamp)) throw errorFacturaImportacion('TIMESTAMP_INVALIDO');
  return timestamp;
}

function parsearIsoFacturaImportacion(value) {
  if (typeof value !== 'string') return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var hour = Number(match[4]);
  var minute = Number(match[5]);
  var second = Number(match[6]);
  var millisecond = Number((match[7] || '').padEnd(3, '0') || '0');
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  var localAsUtc = new Date(0);
  localAsUtc.setUTCFullYear(year, month - 1, day);
  localAsUtc.setUTCHours(hour, minute, second, millisecond);
  if (localAsUtc.getUTCFullYear() !== year || localAsUtc.getUTCMonth() !== month - 1
    || localAsUtc.getUTCDate() !== day || localAsUtc.getUTCHours() !== hour
    || localAsUtc.getUTCMinutes() !== minute || localAsUtc.getUTCSeconds() !== second) return null;
  var offsetMinutes = 0;
  if (match[8] !== 'Z') {
    var offsetHour = Number(match[10]);
    var offsetMinute = Number(match[11]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (match[9] === '+' ? 1 : -1);
  }
  return localAsUtc.getTime() - offsetMinutes * 60 * 1000;
}

function validarEndpointFacturaImportacion(endpoint) {
  if (typeof endpoint !== 'string') return null;
  var normalized = endpoint.trim().replace(/\/$/, '');
  if (!/^https:\/\/[^\/?#@]+\/api\/integraciones\/facturas$/i.test(normalized)) return null;
  return normalized;
}

function facturaImportacionLeerConfiguracion() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var endpoint = validarEndpointFacturaImportacion(scriptProperties.getProperty('HU030_ENDPOINT_URL'));
  var keyId = scriptProperties.getProperty('HU030_HMAC_KEY_ID');
  var secret = scriptProperties.getProperty('HU030_HMAC_SECRET');
  var cutoffIso = scriptProperties.getProperty('HU030_FECHA_CORTE_ISO');
  var cutoffMs = parsearIsoFacturaImportacion(cutoffIso);
  if (!endpoint || !keyId || !/^[A-Za-z0-9._-]{1,64}$/.test(keyId)
    || typeof secret !== 'string' || secret.length === 0
    || /[\r\n\u0000-\u001f\u007f]/.test(secret)
    || unescape(encodeURIComponent(secret)).length < 32
    || cutoffMs === null) throw errorFacturaImportacion('CONFIGURACION_INCOMPLETA');

  var lastSweepIso = scriptProperties.getProperty('HU030_ULTIMO_BARRIDO_ISO');
  var lastSweepMs = lastSweepIso ? parsearIsoFacturaImportacion(lastSweepIso) : null;
  if (lastSweepIso && lastSweepMs === null) throw errorFacturaImportacion('CONFIGURACION_ULTIMO_BARRIDO_INVALIDA');

  var rawBatch = scriptProperties.getProperty('HU030_LOTE_MAX');
  var batchMax = rawBatch === null || rawBatch === '' ? 25 : Number(rawBatch);
  if (!Number.isInteger(batchMax) || batchMax < 1 || batchMax > FACTURA_IMPORTACION_MAX_LOTE) {
    throw errorFacturaImportacion('CONFIGURACION_LOTE_INVALIDA');
  }

  var labels = {};
  Object.keys(FACTURA_IMPORTACION_LABELS_DEFAULT).forEach(function (state) {
    var configured = scriptProperties.getProperty('HU030_LABEL_' + state.toUpperCase());
    var name = configured || FACTURA_IMPORTACION_LABELS_DEFAULT[state];
    if (typeof name !== 'string' || name.trim() !== name || name.length < 1 || name.length > 120) {
      throw errorFacturaImportacion('CONFIGURACION_LABEL_INVALIDA');
    }
    labels[state] = name;
  });
  if (Object.keys(labels).map(function (state) { return labels[state]; }).filter(function (name, index, all) {
    return all.indexOf(name) === index;
  }).length !== Object.keys(labels).length) throw errorFacturaImportacion('CONFIGURACION_LABEL_DUPLICADA');
  return {
    endpoint: endpoint,
    keyId: keyId,
    secret: secret,
    cutoffIso: cutoffIso,
    cutoffMs: cutoffMs,
    lastSweepIso: lastSweepIso || null,
    lastSweepMs: lastSweepMs,
    batchMax: batchMax,
    labels: labels
  };
}

function facturaImportacionVentanaBarrido(config, nowMs) {
  var startMs = config.lastSweepMs === null
    ? config.cutoffMs
    : Math.max(config.cutoffMs, config.lastSweepMs - FACTURA_IMPORTACION_SOLAPAMIENTO_MS);
  var coarseDate = new Date(startMs - 24 * 60 * 60 * 1000);
  var dateText = Utilities.formatDate(coarseDate, 'America/Lima', 'yyyy/MM/dd');
  return {
    startMs: startMs,
    endMs: nowMs === undefined ? Date.now() : nowMs,
    gmailQuery: 'has:attachment {filename:xml filename:pdf} after:' + dateText
  };
}

function facturaImportacionFechaEnVentana(messageDate, window) {
  var messageMs = messageDate instanceof Date ? messageDate.getTime() : Number(messageDate);
  return isFinite(messageMs) && messageMs >= window.startMs && messageMs <= window.endMs;
}

function facturaImportacionGuardarUltimoBarrido(properties, dateMs) {
  properties.setProperty('HU030_ULTIMO_BARRIDO_ISO', new Date(dateMs).toISOString());
}

function facturaImportacionBytesDeBlob(blob) {
  if (!blob || typeof blob.getBytes !== 'function') throw errorFacturaImportacion('ADJUNTO_INVALIDO');
  return blob.getBytes();
}

function facturaImportacionNombreBlob(blob) {
  return typeof blob.getName === 'function' ? String(blob.getName() || '') : '';
}

function facturaImportacionMimeBlob(blob) {
  return typeof blob.getContentType === 'function' ? String(blob.getContentType() || '').toLowerCase() : '';
}

function facturaImportacionClasificarAdjunto(blob) {
  var name = facturaImportacionNombreBlob(blob);
  var mime = facturaImportacionMimeBlob(blob).split(';')[0].trim();
  var extension = /\.([^.\\/]+)$/.exec(name);
  var ext = extension ? extension[1].toLowerCase() : '';
  if (ext === 'zip' || mime === 'application/zip' || mime === 'application/x-zip-compressed') {
    return { kind: 'zip', blob: blob, name: name, mime: mime };
  }
  var isXmlMime = mime === 'application/xml' || mime === 'text/xml' || mime === 'application/soap+xml';
  var isPdfMime = mime === 'application/pdf';
  var isXmlExt = ext === 'xml';
  var isPdfExt = ext === 'pdf';
  if ((isXmlMime || isXmlExt) && (isPdfMime || isPdfExt)) {
    return { kind: 'ambiguous', blob: blob, name: name, mime: mime };
  }
  if (isXmlMime || isXmlExt) return { kind: 'xml', blob: blob, name: name, mime: mime };
  if (isPdfMime || isPdfExt) return { kind: 'pdf', blob: blob, name: name, mime: mime };
  return { kind: 'other', blob: blob, name: name, mime: mime };
}

function facturaImportacionClasificarAdjuntos(blobs) {
  var result = { xml: [], pdf: [], zip: [], other: [], ambiguous: [] };
  (blobs || []).forEach(function (blob) {
    var item = facturaImportacionClasificarAdjunto(blob);
    result[item.kind].push(item);
  });
  return result;
}

function facturaImportacionBaseName(name) {
  var normalized = String(name || '').replace(/\\/g, '/').split('/').pop().trim();
  return normalized.replace(/\.[^.]*$/, '').toLowerCase();
}

function emparejarXmlPdfFacturaImportacion(xmls, pdfs) {
  var pairs = [];
  var unmatchedPdfs = [];
  var review = false;
  if (xmls.length === 1 && pdfs.length === 1) {
    return { pairs: [{ xml: xmls[0], pdf: pdfs[0], review: false }], unmatchedPdfs: [], review: false };
  }
  if (pdfs.length === 0) {
    return { pairs: xmls.map(function (xml) { return { xml: xml, pdf: null, review: false }; }), unmatchedPdfs: [], review: false };
  }
  var pdfUses = pdfs.map(function () { return 0; });
  var matches = xmls.map(function (xml) {
    var base = facturaImportacionBaseName(xml.name);
    var found = [];
    if (base) pdfs.forEach(function (pdf, index) {
      if (facturaImportacionBaseName(pdf.name) === base) found.push(index);
    });
    return found;
  });
  matches.forEach(function (found) { found.forEach(function (index) { pdfUses[index] += 1; }); });
  matches.forEach(function (found, index) {
    if (found.length === 1 && pdfUses[found[0]] === 1) {
      pairs.push({ xml: xmls[index], pdf: pdfs[found[0]], review: false });
      pdfUses[found[0]] = -1;
    } else {
      pairs.push({ xml: xmls[index], pdf: null, review: true });
      review = true;
    }
  });
  pdfUses.forEach(function (usage, index) {
    if (usage !== -1) {
      unmatchedPdfs.push(pdfs[index]);
      review = true;
    }
  });
  return { pairs: pairs, unmatchedPdfs: unmatchedPdfs, review: review };
}

function facturaImportacionAjustarMimeBlob(blob, mime) {
  if (typeof blob.setContentType !== 'function') return blob;
  var adjusted = blob.setContentType(mime);
  return adjusted && typeof adjusted.getBytes === 'function' ? adjusted : blob;
}

function facturaImportacionConstruirSolicitud(config, gmailMessageId, xmlBlob, pdfBlob, nowMs) {
  if (typeof gmailMessageId !== 'string' || !/^[\x21-\x7e]{1,250}$/.test(gmailMessageId)) {
    throw errorFacturaImportacion('MESSAGE_ID_INVALIDO');
  }
  var uploadXml = facturaImportacionAjustarMimeBlob(xmlBlob, 'application/xml');
  var xmlBytes = facturaImportacionBytesDeBlob(uploadXml);
  if (xmlBytes.length > FACTURA_IMPORTACION_MAX_XML_BYTES) throw errorFacturaImportacion('XML_DEMASIADO_GRANDE');
  var sha256Xml = sha256Hex(xmlBytes);
  if (!/^[0-9a-f]{64}$/.test(sha256Xml)) throw errorFacturaImportacion('HASH_XML_INVALIDO');

  var uploadPdf = null;
  var sha256Pdf = null;
  if (pdfBlob) {
    uploadPdf = facturaImportacionAjustarMimeBlob(pdfBlob, 'application/pdf');
    var pdfBytes = facturaImportacionBytesDeBlob(uploadPdf);
    if (pdfBytes.length > FACTURA_IMPORTACION_MAX_PDF_BYTES) throw errorFacturaImportacion('PDF_DEMASIADO_GRANDE');
    if (bytesFirmadosAHex(pdfBytes.slice(0, 5)) !== bytesFirmadosAHex([37, 80, 68, 70, 45])) {
      throw errorFacturaImportacion('PDF_CABECERA_INVALIDA');
    }
    sha256Pdf = sha256Hex(pdfBytes);
  }

  var timestampTexto = timestampUnixFacturaImportacion(nowMs);
  var nonce = nuevoNonceFacturaImportacion();
  var canonical = construirCanonicalFacturaImportacion({
    keyId: config.keyId,
    timestampTexto: timestampTexto,
    nonce: nonce,
    gmailMessageId: gmailMessageId,
    sha256Xml: sha256Xml,
    sha256Pdf: sha256Pdf
  });
  var signature = firmaHmacFacturaImportacion(canonical, config.secret);
  var headers = {
    'X-EPSA-Key-Id': config.keyId,
    'X-EPSA-Timestamp': timestampTexto,
    'X-EPSA-Nonce': nonce,
    'X-EPSA-Message-Id': gmailMessageId,
    'X-EPSA-XML-SHA256': sha256Xml,
    'X-EPSA-PDF-SHA256': sha256Pdf || '-',
    'X-EPSA-Signature': signature
  };
  var payload = { xml: uploadXml };
  if (uploadPdf) payload.pdf = uploadPdf;
  return { headers: headers, payload: payload, canonical: canonical, sha256Xml: sha256Xml, sha256Pdf: sha256Pdf };
}

function facturaImportacionParsearRespuesta(response) {
  var status = Number(response && typeof response.getResponseCode === 'function' ? response.getResponseCode() : 0);
  var body = {};
  try {
    var text = response && typeof response.getContentText === 'function' ? response.getContentText() : '';
    var parsed = text ? JSON.parse(text) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
  } catch (_error) {
    body = {};
  }
  var data = body.data && typeof body.data === 'object' ? body.data : body;
  var code = typeof body.code === 'string' ? body.code
    : typeof data.code === 'string' ? data.code : '';
  if (!/^[A-Z0-9_]{1,80}$/.test(code)) code = '';
  var codrec = typeof data.codrec === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.codrec)
    ? data.codrec : null;
  var coddoc = (typeof data.coddoc === 'string' || typeof data.coddoc === 'number')
    && /^\d{1,20}$/.test(String(data.coddoc)) ? String(data.coddoc) : null;
  return { status: status, code: code, pdfPending: data.pdfPendiente === true, codrec: codrec, coddoc: coddoc };
}

function facturaImportacionClasificarRespuesta(status, code, retryCount, nowMs) {
  var count = Number(retryCount || 0);
  var now = nowMs === undefined ? Date.now() : nowMs;
  if (status === 200 || status === 201) return { state: 'Procesado', retry: false, retryCount: count };
  if (status === 202) return { state: 'Pendiente', retry: true, retryCount: count, nextAttemptAt: new Date(now + 15 * 60 * 1000).toISOString(), consumesRetry: false };
  if (status === 401) return { state: 'Error', retry: false, retryCount: count, globalStop: true };
  var transientCode = code === 'NONCE_REPETIDO' || code === 'LEASE_PERDIDO';
  if (status === 500 || status === 503 || transientCode || status === 0) {
    if (count >= FACTURA_IMPORTACION_MAX_REINTENTOS) return { state: 'Error', retry: false, retryCount: count, exhausted: true };
    var updatedCount = count + 1;
    return {
      state: 'Pendiente', retry: true, retryCount: updatedCount,
      nextAttemptAt: new Date(now + FACTURA_IMPORTACION_ESPERAS_REINTENTO_MS[count]).toISOString(),
      consumesRetry: true
    };
  }
  if (status === 400 || status === 409 || status === 413 || status === 422
    || ['CONFLICTO_DOCUMENTAL', 'PDF_EVIDENCIA_CONFLICTO', 'EVIDENCIA_CONFLICTO',
      'INVARIANTE_RECEPCION', 'INTENTO_CERRADO'].indexOf(code) !== -1) {
    return { state: 'Revision', retry: false, retryCount: count };
  }
  return { state: 'Error', retry: false, retryCount: count };
}

function facturaImportacionIdentidadCola(messageId, sha256Xml) {
  return messageId + '|' + sha256Xml;
}

function facturaImportacionValidarItemCola(item) {
  var keys = item && typeof item === 'object' ? Object.keys(item).sort().join(',') : '';
  return keys === 'messageId,nextAttemptAt,retryCount,sha256Xml'
    && typeof item.messageId === 'string' && /^[\x21-\x7e]{1,250}$/.test(item.messageId)
    && typeof item.sha256Xml === 'string' && /^[0-9a-f]{64}$/.test(item.sha256Xml)
    && Number.isInteger(item.retryCount) && item.retryCount >= 0 && item.retryCount <= FACTURA_IMPORTACION_MAX_REINTENTOS
    && parsearIsoFacturaImportacion(item.nextAttemptAt) !== null;
}

function facturaImportacionCargarCola(properties) {
  var props = properties || PropertiesService.getScriptProperties();
  var raw = props.getProperty(FACTURA_IMPORTACION_PROPIEDAD_COLA);
  if (!raw) return [];
  if (raw.length > FACTURA_IMPORTACION_MAX_JSON_COLA) throw errorFacturaImportacion('COLA_REINTENTO_CORRUPTA');
  var queue;
  try { queue = JSON.parse(raw); } catch (_error) { throw errorFacturaImportacion('COLA_REINTENTO_CORRUPTA'); }
  if (!Array.isArray(queue) || queue.length > FACTURA_IMPORTACION_MAX_COLA || !queue.every(facturaImportacionValidarItemCola)) {
    throw errorFacturaImportacion('COLA_REINTENTO_CORRUPTA');
  }
  var seen = {};
  queue.forEach(function (item) {
    var identity = facturaImportacionIdentidadCola(item.messageId, item.sha256Xml);
    if (seen[identity]) throw errorFacturaImportacion('COLA_REINTENTO_CORRUPTA');
    seen[identity] = true;
  });
  return queue;
}

function facturaImportacionGuardarCola(queue, properties) {
  var props = properties || PropertiesService.getScriptProperties();
  if (!Array.isArray(queue) || queue.length > FACTURA_IMPORTACION_MAX_COLA || !queue.every(facturaImportacionValidarItemCola)) {
    throw errorFacturaImportacion('COLA_REINTENTO_LLENA');
  }
  if (queue.length === 0) {
    props.deleteProperty(FACTURA_IMPORTACION_PROPIEDAD_COLA);
    return;
  }
  var json = JSON.stringify(queue);
  if (json.length > FACTURA_IMPORTACION_MAX_JSON_COLA) throw errorFacturaImportacion('COLA_REINTENTO_LLENA');
  props.setProperty(FACTURA_IMPORTACION_PROPIEDAD_COLA, json);
}

function facturaImportacionActualizarItemCola(queue, item) {
  var identity = facturaImportacionIdentidadCola(item.messageId, item.sha256Xml);
  var index = queue.findIndex(function (existing) {
    return facturaImportacionIdentidadCola(existing.messageId, existing.sha256Xml) === identity;
  });
  if (index < 0) {
    if (queue.length >= FACTURA_IMPORTACION_MAX_COLA) throw errorFacturaImportacion('COLA_REINTENTO_LLENA');
    queue.push(item);
  } else {
    queue[index] = item;
  }
}

function facturaImportacionEliminarItemCola(queue, messageId, sha256Xml) {
  var identity = facturaImportacionIdentidadCola(messageId, sha256Xml);
  return queue.filter(function (item) {
    return facturaImportacionIdentidadCola(item.messageId, item.sha256Xml) !== identity;
  });
}
