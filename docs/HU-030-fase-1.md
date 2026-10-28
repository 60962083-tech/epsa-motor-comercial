# HU-030 / EMT-35 — FASE 1: modelo documental y parser UBL

## Alcance

Esta fase prepara la base de datos y las funciones puras que permitirán reconocer facturas Crosland, conservarlas y producir candidatos de vehículo. No consulta Gmail, no realiza llamadas HTTP, no sube archivos, no crea compras ni unidades, y no cambia HU-002, HU-034 ni el flujo manual de `factura_compra`. Tampoco añade rutas, controllers, services, middleware, Apps Script, HMAC, actor técnico ni frontend.

La migración inicial `supabase/migrations/202610240001_hu030_modelo_documental.sql` fue aplicada manualmente y se conserva inmutable. Los ajustes posteriores se realizan en `supabase/migrations/202610240002_hu030_ajustes_modelo_documental.sql`, que amplía el almacenamiento de importes y datos UBL sin eliminar ni recrear tablas.

## Proveedor y homologaciones

`public.proveedor.rucpro` es `varchar(11) NULL`, acepta solo 11 dígitos y tiene unicidad parcial cuando no es NULL. Las filas históricas permanecen con RUC NULL. La migración busca Crosland por RUC o nombre normalizado; completa una fila sin RUC, inserta una fila activa si no hay coincidencia o aborta cuando nombre y RUC señalan entidades distintas. No actualiza `unidad.codpro`.

Se crean estas equivalencias activas, usando el modelo encontrado por nombre normalizado exacto y sin codificar el ID:

| Proveedor | Código externo | Clasificación | Modelo |
| --- | --- | --- | --- |
| Crosland | `B3-4TLPG250UG4V` | `Vehiculo` | `Torito 250 4V GLP` |
| Crosland | `BAJAJVERDE` | `Accesorio` | ninguno |

El código `B3-4TLPGUG4V` queda sin equivalencia. La fuente de aprobación registrada es `Product Owner HU-030 - 2026-10-24`; `codusuapr` queda NULL porque no se atribuye la aprobación a una cuenta de usuario inventada. La tabla conserva el código original y permite una sola equivalencia activa por proveedor y código normalizado; las inactivas sirven de historial.

## Ancón y modelo documental

`ubicacionclave` protege `ALMACEN_CROSLAND_ANCON` y apunta a una fila real de `ubicacion` activa de tipo `Almacen`. La llave no se puede consultar o modificar directamente mediante `anon` o `authenticated`.

El documento canónico es `documentocompra`; además conserva versión UBL, pedido de cabecera, valor de venta e impuestos declarados, total antes de impuestos, total incluido impuestos, total a pagar, operaciones gratuitas, presencia de firma y advertencias JSONB. Los importes se almacenan como `NUMERIC`; la presencia de una firma no significa que se haya validado criptográficamente. Sus series, número, fechas, moneda, identidades fiscales originales, recepción, estado, errores, `messageId`, SHA-256, rutas opcionales, indicador de PDF pendiente, cuenta operativa y cantidad de intentos permiten conservar incluso documentos incompletos. La identidad documental se protege con un índice único parcial por proveedor, tipo, serie y número; `messageId` tiene unicidad parcial. Las huellas no reemplazan la identidad del documento. No se exige XML ni PDF para crear el registro. Si una identidad existente trae contenido distinto, la siguiente fase debe tratarlo como conflicto y no reemplazar los archivos ni el registro.

`lineadocumentocompra` conserva cantidades e importes como decimales exactos, precio efectivo y referencial, código UNSPSC, indicador de operación gratuita, `PriceTypeCode`, `TaxExemptionReasonCode`, `TaxScheme`, descripción, pedido de línea, clasificación, estado y propiedades complementarias JSONB. `vehiculodocumento` separa motor, VIN y chasis y puede guardar más de un vehículo por línea. `documentocompracompra` enlaza documentos y compras sin duplicar facturas en `factura_compra`; `UNIQUE(coddoc,codcom)` evita repetir el mismo vínculo, pero aún permite asociar una compra a varios documentos. No se agrega `UNIQUE(codcom)` mientras el negocio no defina si admite facturación parcial. `referenciacompra` conserva referencias aprobadas como `PedidoCrosland` y exige unicidad de referencias activas por proveedor. `intentodocumento` registra reintentos sin XML, secretos ni trazas internas y admite `Procesando` sin fecha de fin; los resultados finales requieren `fecfin`.

## Parser y reglas de documento

`parsearFacturaUbl(Buffer)` usa `saxes`, parser XML puro de JavaScript y consciente de namespaces. Resuelve elementos por URI y nombre local, no por prefijo. Extrae cabecera UBL, emisor/receptor, orden de cabecera, líneas, unidades, importes, código de vendedor, clasificación UNSPSC, propiedades por `NameCode`, información adicional y presencia de firma. La firma solo se detecta: no se valida criptográficamente. Los importes no pasan por `Number` y la suma de líneas usa enteros BigInt de precisión fija.

Para Crosland, el RUC se busca primero en `PartyIdentification/ID` con `schemeID="6"`, después en `PartyTaxScheme/CompanyID` y finalmente en `PartyLegalEntity/CompanyID`; otros `PartyIdentification` no se interpretan como RUC. Las propiedades `5012`–`5021` identifican marca, modelo de origen, color, motor, combustible, VIN, chasis/serie, año de fabricación y año de modelo. El `Name` visible se conserva como dato descriptivo, pero no selecciona la propiedad. `AdditionalInformation` con código `3` aporta el pedido de línea; `OrderReference` de cabecera se conserva aparte. Ambos datos permanecen en el XML original y los pedidos no se fusionan al agrupar vehículos.

La validación documental recibe configuración centralizada. Para la primera integración, el emisor autorizado es RUC `20502913752`, el comprador esperado es `20555595469`, el tipo permitido es `01`, la moneda permitida es `PEN` y la tolerancia monetaria es `0.01`. La suma onerosa de `LineExtensionAmount` se compara con el valor de venta declarado; el valor referencial de operaciones gratuitas se suma aparte y se valida contra su subtotal declarado. Una diferencia de hasta un céntimo añade advertencia, una mayor se rechaza. Las bonificaciones con códigos UBL de operación gratuita no se suman como venta onerosa ni como total a pagar. Esto no sustituye una validación tributaria completa de impuestos, anticipos y pagos.

El parser conserva el Buffer en manos del llamador para que fases posteriores calculen el hash de los bytes originales. Intenta UTF-8 con decoder fatal; si el XML declara ISO-8859-1 pero los bytes son UTF-8 válidos, usa UTF-8 y devuelve `ENCODING_DECLARADO_NO_COINCIDE`. Si UTF-8 falla y se declaró ISO-8859-1, decodifica como latin1. Las codificaciones desconocidas fallan de forma controlada.

Límites iniciales: 5 MiB, 50 000 nodos, 120 000 eventos, profundidad 64, 1 000 líneas y 100 propiedades por línea. Se rechazan Buffer vacío, NUL, XML malformado, DOCTYPE/DTD, ENTITY y elementos XInclude; no se resuelven recursos externos. Los errores exponen códigos controlados y no datos del documento.

## Clasificación y agrupación

`clasificarLineasFactura` recibe el documento parseado y equivalencias explícitas. No usa descripción ni UNSPSC para inferir vehículos. Un código desconocido queda `Desconocido` / `Revision` con `CODIGO_SIN_EQUIVALENCIA`. Un vehículo necesita equivalencia con modelo, cantidad exactamente 1 y valores documentales de modelo, motor, chasis y color; de lo contrario queda en revisión. VIN es opcional y nunca se confunde con el chasis. Motores o chasis repetidos en el mismo documento ponen todos los candidatos afectados en `Revision` con códigos controlados. Un accesorio conserva su línea, no produce candidato de unidad y no suma inventario de vehículos.

`agruparComprasFactura` solo considera candidatos válidos y agrupa por modelo interno y color normalizado. Los pedidos se mantienen en cada candidato y se devuelven como lista única en el grupo. Accesorios y líneas en revisión no aparecen en compras candidatas. Ninguna de estas funciones escribe en la base de datos.

## Fixtures y archivos privados

`tests/fixtures/factura-importacion/` contiene facturas sintéticas UBL 2.1, incluida una factura anonimizada de prueba con dos vehículos y dos bonificaciones gratuitas. Los RUC, identidades, motores, VIN, chasis, pedidos, referencias y montos son ficticios. La factura de bonificaciones prueba `schemeID="6"`, códigos de operación gratuita, precio efectivo separado del referencial, subtotales, pedido por código `3`, firma ficticia y tolerancia de un céntimo.

La cuenta operativa es `epsamotor.admin@gmail.com`. Apps Script deberá autorizarse con Google sobre esa cuenta dedicada. El dueño no autorizó acceso a su cuenta personal. Al cierre de Fase 1 no se guardaban contraseñas ni credenciales humanas o `service_role`. Fase 3 incorporó `SUPABASE_SECRET_KEY` únicamente para el backend alojado; es privilegiada, omite RLS y nunca debe guardarse en el repositorio, Apps Script ni logs. La identidad `From` del correo reenviado no es autoridad de proveedor; la validación fiscal se hace contra el XML. La fecha de corte y los filtros/remitentes iniciales siguen pendientes.

Los XML, PDF y Excel reales se mantienen fuera de esta carpeta y del repositorio. El PDF futuro será respaldo privado y puede faltar mientras el XML se procesa; no se utiliza OCR ni IA como sustituto del XML. El Excel de almacenes es una referencia histórica no autorizada para importar inventario ni sembrar equivalencias.

## Pendientes al cierre de Fase 1

Todas las tablas nuevas tienen RLS, revocación de todos los permisos directos para `PUBLIC`, `anon` y `authenticated`, revocación de secuencias y una policy restrictiva que niega acceso directo. Esta fase no concede SELECT ni crea RPC de acceso.

La lista siguiente describe el estado al finalizar Fase 1, no el estado actual de toda HU-030. Las fases posteriores documentan la persistencia transaccional, el backend HMAC y el cliente local de Apps Script. Siguen pendientes la configuración del proyecto Apps Script, la ejecución del E2E aprobado y la activación del trigger. La API administrativa para resolver incidencias no forma parte de estas fases. No se modifican `factura_compra`, HU-002, HU-034, `unidad.codpro`, `sede.telsed`, movimientos HU-003 ni `unidad.vinuni`.
