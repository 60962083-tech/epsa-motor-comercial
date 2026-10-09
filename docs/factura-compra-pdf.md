# PDF de factura de compra

Los tres endpoints requieren `Authorization: Bearer <access_token>` de un
**Gerente** o una **Administradora**, una compra existente y su factura registrada
mediante HU-002 (`PUT /api/compras/:id/factura`). `:id` es el `codcom` entero positivo
hasta 9223372036854775807; se devuelve como texto para conservar su precisión.

## Subir

`POST /api/compras/:id/factura/archivo`

En Postman: selecciona **Body → form-data**, agrega la clave `archivo`, cambia su
tipo a **File** y selecciona el PDF. Debe tener MIME `application/pdf` y máximo
`10 * 1024 * 1024` bytes. Envía un solo archivo, sin campos adicionales.
Deja que Postman establezca `Content-Type: multipart/form-data` con su boundary.
En Authorization selecciona Bearer Token y usa `{{access_token}}`.

Respuesta **201**:

```json
{"ok":true,"data":{"codcom":"15","archivo_adjuntado":true,"nombre":"factura.pdf"},"message":"PDF de factura adjuntado correctamente"}
```

Se guarda en el bucket privado `facturas-compra`, ruta `compras/15/factura.pdf`.
El nombre original no cambia esa ruta. Se recibe en memoria y se sube con el
cliente Supabase de la petición, que transmite el JWT. No usa service_role,
no escribe en disco ni agrega columnas, migraciones o policies.
No hay reemplazo ni eliminación: una segunda subida responde **409**, incluso
si dos usuarios intentan subir al mismo tiempo (`upsert: false`).

## Consultar

`GET /api/compras/:id/factura/archivo`

En Postman usa GET, el mismo Bearer y la compra ya facturada. No requiere body.
Respuesta **200**, sin URL pública:

```json
{"ok":true,"data":{"codcom":"15","archivo_adjuntado":false}}
```

Tras subir, `archivo_adjuntado` será `true`.
Se reutiliza `hu002_consultar_unidades` para validar compra/factura, y Storage
para obtener el estado real. La proyección anterior de HU-002 permanece intacta;
su campo `archivo_adjuntado` continúa siendo el valor fijo previo. Consulta este
nuevo endpoint para conocer el estado del PDF.

## Abrir o descargar

`GET /api/compras/:id/factura/archivo/url`

En Postman usa GET y el mismo Bearer, sin body. Respuesta **200**:

```json
{"ok":true,"data":{"url":"https://<proyecto>.supabase.co/storage/v1/object/sign/...","expira_en":60}}
```

Abre el valor de `data.url` en el navegador para ver o guardar el PDF. La URL
permite acceder al archivo durante 60 segundos; genera otra cuando caduque.
El bucket sigue siendo privado. Sin PDF responde **404**.

## Errores

Todos respetan `{"ok":false,"message":"..."}` sin detalles internos de Supabase.

| Estado | Caso | Ejemplo de message |
| --- | --- | --- |
| 400 | ID inválido | codcom debe ser un identificador entero positivo válido |
| 400 | Archivo ausente | Envía un archivo PDF en el campo archivo |
| 400 | MIME diferente | El archivo debe ser application/pdf |
| 400 | Más de 10 MB | El archivo no debe superar 10 MB |
| 400 | Multipart inválido, varios archivos o campo incorrecto | Envía un único PDF en el campo archivo mediante multipart/form-data |
| 401 | Sin Bearer | Se requiere un token Bearer válido |
| 403 | Rol sin permiso | Solo gerente y administradora pueden realizar esta operación de gestión |
| 404 | Compra inexistente | La compra no existe |
| 404 | Sin factura registrada | La compra no tiene factura registrada |
| 404 | URL solicitada sin archivo | La factura no tiene un archivo PDF |
| 409 | PDF ya adjunto | La factura ya tiene un archivo |
| 500 | Fallo inesperado de Storage | Error al procesar el archivo de factura |

La colección `HU-002.postman_collection.json` incluye las tres peticiones y
hereda el Bearer de la colección. Primero inicia sesión y registra los metadatos
de factura; después selecciona el PDF en la petición de subida.

Las pruebas API simulan autenticación, la consulta HU-002 y Storage. No realizan
llamadas reales a Supabase.
