# HU-030 / EMT-35 — Fase 3: integración técnica de facturas

## Alcance

La Fase 3 incorpora `POST /api/integraciones/facturas` para recibir un XML UBL y un PDF opcional desde un futuro cliente técnico. No implementa Gmail ni Apps Script. El endpoint no admite Bearer ni sesión humana: verifica una firma HMAC y usa un cliente Supabase exclusivo de servidor.

La clave `SUPABASE_SECRET_KEY` es privilegiada, equivale a `service_role` y omite RLS. No es una clave de mínimo privilegio. Nuestro código la utiliza únicamente en la interfaz RPC técnica de HU-030 y en el Storage privado. Debe configurarse solo en el backend alojado, nunca en frontend, Apps Script, repositorio, logs o respuestas. `integracion.facturas@epsa.internal` permanece como actor de auditoría y no se autentica.

## Contrato HMAC

Headers requeridos:

| Header | Regla |
| --- | --- |
| `X-EPSA-Key-Id` | ASCII `[A-Za-z0-9._-]`, hasta 64 caracteres; clave actual o anterior configurada |
| `X-EPSA-Timestamp` | Segundos Unix enteros, forma canónica sin espacios ni ceros iniciales |
| `X-EPSA-Nonce` | UUID canónico en minúsculas; único por key ID |
| `X-EPSA-Message-Id` | Identificador Gmail opaco printable ASCII, hasta 250 caracteres |
| `X-EPSA-XML-SHA256` | SHA-256 hexadecimal minúsculo del XML |
| `X-EPSA-PDF-SHA256` | SHA-256 hexadecimal minúsculo o `-` si no se envía PDF |
| `X-EPSA-Signature` | `v1=` seguido de 64 dígitos hexadecimales minúsculos |

Canonical UTF-8, separada por LF y sin LF final:

```text
EPSA-HU030-HMAC-V1
POST
/api/integraciones/facturas
<key-id>
<timestamp>
<nonce>
<gmail-message-id>
<sha256-xml>
<sha256-pdf-o->
```

La firma es HMAC-SHA256. La tolerancia predeterminada y máxima es 300 segundos. El backend compara con `timingSafeEqual`. La rotación acepta `HU030_HMAC_CURRENT_*` y, de forma opcional, `HU030_HMAC_PREVIOUS_*` con key IDs distintos.

El backend valida firma y reserva nonce/recepción antes de leer multipart. Luego recalcula los hashes de bytes recibidos; una firma válida solo prueba los hashes declarados hasta que se comparan con los archivos.

## Multipart y respuestas

- `xml`: exactamente un archivo, `application/xml` o `text/xml`, máximo 5 MiB.
- `pdf`: cero o un archivo, `application/pdf`, máximo 10 MiB y magic bytes `%PDF-`.
- No acepta campos de formulario ni archivos adicionales. Los nombres de archivo nunca construyen rutas.
- `201`: recepción nueva procesada; `200`: reintento completado; `202`: otra solicitud procesa la recepción e incluye `Retry-After: 2`.
- `400`: headers/partes/archivo inválidos; `401`: clave, timestamp o HMAC; `409`: nonce o evidencia conflictiva; `413`: tamaño; `422`: rechazo documental/fiscal; `500/503`: fallo técnico controlado.
- La respuesta solo contiene un resumen sanitizado, conteos y advertencias en forma de códigos. No devuelve documento, rutas Storage, payload RPC ni seriales completos.

## Idempotencia y evidencia

La identidad de transporte es `(gmailMessageId, sha256Xml)`. XML distintos del mismo mensaje producen recepciones diferentes; el mismo XML recibido en mensajes distintos tiene recepciones distintas, mientras la importación documental de Fase 2 conserva su idempotencia propia. Cada HTTP necesita timestamp/nonce/firma nuevos; `(keyId, nonce)` no se puede reutilizar.

El bucket `facturas-compra` usa el prefijo privado `documentos/<uuid-recepcion>/original.xml|pdf`, con `upsert: false`. El XML debe quedar almacenado antes de importar. Sin PDF, o si su almacenamiento falla, el XML se importa y la recepción registra `pdfpendiente=true`. Un PDF recibido más adelante completa la evidencia sin volver a importar ni crear compras/unidades. Si la evidencia ya existe, el backend lee y compara su hash antes de reutilizarla; nunca sobrescribe contenido diferente. El prefijo humano HU-002 `compras/<codcom>/factura.pdf` no cambia.

Los intentos de transporte se guardan en `intentointegracionfactura`, separados de `intentodocumento`. Las recepciones durables se guardan en `recepcionintegracionfactura`. `coditiactivo` apunta al intento propietario. PostgreSQL serializa reservas y solo ese intento puede finalizar el procesamiento durable. Al vencer el lease de 15 minutos, una reserva nueva reemplaza al propietario; el intento antiguo solo puede cerrar su propio resultado como `LEASE_PERDIDO`.

Los resultados HTTP se guardan en el intento y no degradan una recepción `Completada`. Un reintento completo inválido cierra su intento y conserva intactos documento, rutas, resumen, error durable y estado PDF. La finalización del PDF pendiente adquiere su propio lease, actualiza únicamente la evidencia PDF y no llama de nuevo al importador. Mientras otro intento posee ese lease, la API responde `202`; hashes PDF ya confirmados incompatibles responden `409 PDF_EVIDENCIA_CONFLICTO`. Un conflicto documental durable se reproduce como `409 CONFLICTO_DOCUMENTAL` en retries, con el mismo `coddoc` y estado `Pendiente de revision`.

El hash PDF de los headers HMAC es solo una declaración durante la reserva y se conserva en el intento para auditoría. `recepcionintegracionfactura.sha256pdf` se establece únicamente al finalizar un intento propietario después de que Render haya recibido el PDF y comprobado MIME, magic bytes y SHA-256 real. Si los bytes son válidos pero falla Storage, se conserva el hash confirmado con `pdfpendiente=true`, `rutapdf=NULL` y `PDF_STORAGE_PENDING`; los retries deben declarar el mismo hash.

Antes de reutilizar una recepción completada, el backend verifica que el XML privado exista y que su SHA-256 coincida. Si el PDF ya figura completo, verifica también su objeto y hash antes de responder. La evidencia faltante produce un error técnico controlado; la evidencia con contenido distinto produce un conflicto. Los objetos nunca se sobrescriben.

## Fuente de verdad de evidencia

Fase 3 elige la opción B: `recepcionintegracionfactura` es la fuente de verdad de transporte y evidencia. No sincroniza `documentocompra.gmailmessageid`, `sha256pdf`, `rutaxml`, `rutapdf`, `pdfpendiente` ni `cuentaoperativa`. La importación de Fase 2 no recibe un `gmailMessageId` desde Apps Script y sus restricciones históricas siguen siendo parte del modelo documental; por ello Fase 3 no reemplaza ni amplía su índice único por message ID. La idempotencia del transporte se impone con la clave única `(gmailmessageid, sha256xml)` de la tabla de recepción.

## Migración

`supabase/migrations/202610250001_hu030_integracion_backend.sql` mantiene la migración 003 inmutable, reemplaza las funciones humanas por wrappers con sus mismas firmas y conserva una sola lógica documental en funciones core internas. Los wrappers técnicos solo se conceden a `service_role`; las funciones core no tienen EXECUTE para `PUBLIC`, `anon`, `authenticated` ni `service_role`. Las tablas de transporte tienen RLS y acceso mediante RPC.

Se conserva sin cambios el índice histórico de `documentocompra.gmailmessageid`. Fase 3 no escribe ese campo en `documentocompra`; la unicidad de transporte es `(recepcionintegracionfactura.gmailmessageid, recepcionintegracionfactura.sha256xml)` y `recepcionintegracionfactura` es la fuente de verdad de transporte y evidencia.

## Baseline de migraciones aplicadas

Según lo reportado y verificado previamente por el equipo en Supabase, las migraciones HU-030 001–004 fueron aplicadas. Los siguientes SHA-256 corresponden a los archivos locales que se incorporarán por primera vez al repositorio; no fueron obtenidos desde Supabase.

| Migración | SHA-256 local |
| --- | --- |
| `202610240001_hu030_modelo_documental.sql` | `5ea95f424d170f7351eeacf57f9a084636f94b0e2ee73838041ba6c11cd1d95c` |
| `202610240002_hu030_ajustes_modelo_documental.sql` | `973374bca3592d40347e7a94694888f44df1ccff09e98356409a40e2e856fe11` |
| `202610240003_hu030_importacion_transaccional.sql` | `d4e8c672ead2135aef6464b7ce35c5ab6a929f5c66822c2b97544a054aad137e` |
| `202610250001_hu030_integracion_backend.sql` | `e6cd1dbfab8b20a4d9d55271ea47cf461745bb26e0f0240349599df71073ac89` |

Desde el primer commit que incorpore estos archivos, se consideran migraciones históricas e inmutables. Cualquier corrección futura debe agregarse como una migración nueva.

## Estado de aplicación y verificación manual

Según confirmación del equipo, las migraciones HU-030 001–004, incluida `202610250001_hu030_integracion_backend.sql`, fueron aplicadas manualmente en Supabase. Esta revisión no consultó Supabase. Las migraciones no crean ni modifican el bucket; su existencia, privacidad y policies requieren verificación manual:

- existe el bucket `facturas-compra`;
- `public = false`;
- revisar las policies actuales y confirmar que el prefijo nuevo `documentos/` no queda público;
- probar que el flujo existente de HU-002 en `compras/<codcom>/factura.pdf` sigue funcionando;
- confirmar que la clave server-side puede realizar las operaciones Storage necesarias;
- configurar la clave Supabase y los secretos HMAC en el backend alojado, no en el repositorio ni en Apps Script.

## Límite conocido

La clave `SUPABASE_SECRET_KEY` es amplia por diseño y omite RLS. La restricción a RPC técnicas describe el uso del código de integración, no una reducción efectiva de privilegios de la clave. La protección de negocio está en los wrappers y el código del backend; la exposición accidental de la clave permitiría operaciones más amplias y requiere rotación inmediata.
