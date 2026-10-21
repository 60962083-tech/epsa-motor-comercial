# HU-036: pruebas manuales de imágenes de modelos

Esta guía verifica el bucket real y las policies de Storage, que no se pueden certificar con los mocks ni con la base PGlite local. La migración de HU-036 debe estar aplicada y el bucket público `modelos` debe existir antes de la prueba.

## Configuración previa

En Supabase Storage, confirma que `modelos` sea público y tenga límite de 6 MB y MIME permitidos `image/jpeg`, `image/png` e `image/webp`. No cambies el bucket `compra-factura` ni sus policies. La aplicación usa la clave anon pública más el access token de la sesión normal; nunca debe incluir una clave `service_role` en el bundle del navegador.

Prepara cuentas activas de Gerente, Administradora y Vendedor, además de una cuenta cuyo usuario de EPSA esté inactivo. Identifica un modelo existente en Supabase y conserva su `codmod`, `estmod` y las referencias/imágenes actuales para poder verificar regresiones.

## Escenarios y resultados esperados

| Prueba | Pasos | Resultado esperado |
| --- | --- | --- |
| Gerente | Inicia sesión, abre Modelos, edita un modelo con `codmod` real y sube un JPEG menor o igual a 6 MB. | Storage crea `modelos/<codmod>/<uuid>.jpg`; después la API registra una referencia con `codimo`, `codmod`, `urlimo`, `ordimo` y `estimo=true`. Solo se anuncia éxito al terminar ambas operaciones. |
| Administradora | Repite la carga y registra también una URL HTTPS existente. | Ambas operaciones terminan y aparecen en la lista administrativa con su orden. |
| Vendedor | Inicia sesión y trata de abrir la gestión o llamar a POST/PUT/PATCH de imágenes con su token. | La API responde 403. Si se intenta un upload directo, Storage lo rechaza y no se registra la referencia. |
| Usuario inactivo | Inicia sesión con el usuario Auth asociado a un usuario EPSA inactivo e intenta subir. | La verificación de identidad o `hu026_rol_actual()` deniega la operación; no se crea una referencia ni se considera completada. |
| Visitante | Sin iniciar sesión, consulta una URL pública conocida y trata de subir/borrar con la clave anon. | La lectura pública de una imagen devuelve el archivo; upload y delete son rechazados. |
| JPEG, PNG y WEBP | Sube un archivo real de cada formato, cada uno de hasta 6 MB. | Cada uno llega al bucket y la API guarda URL HTTPS bajo `/storage/v1/object/public/modelos/<codmod>/…`. |
| Archivo mayor a 6 MB | Selecciona un archivo de más de 6 MB. | El navegador lo rechaza antes de contactar Storage; no aparece objeto ni referencia nueva. |
| Formato no admitido | Selecciona GIF, SVG o PDF. | El navegador lo rechaza antes de contactar Storage; no aparece objeto ni referencia nueva. |
| Recarga y otra sesión | Tras una carga exitosa, recarga la página, cierra sesión y consulta desde otro navegador/cuenta. | La API vuelve a entregar la referencia central y la imagen sigue disponible. No depende de `localStorage` ni de la sesión que la cargó. |
| Catálogo y ficha | Abre el catálogo y la ficha pública del mismo modelo. Si hay varias imágenes, elige las miniaturas en la ficha. | La portada del catálogo y la primera imagen de la ficha usan la misma URL activa de menor orden; las demás imágenes activas aparecen en la ficha. |
| Imagen no disponible | En un entorno de prueba, registra una URL autorizada que responda 404 y consulta catálogo/ficha. | Se muestra el respaldo visual controlado “imagen no disponible”/ilustración; la página y el resto de imágenes siguen funcionando. No se sustituye por la foto de otro modelo. |
| Orden | Cambia `ordimo` de dos imágenes desde el panel y recarga catálogo/ficha. | Las imágenes públicas aparecen en el orden guardado. |
| Sustitución | En una imagen existente sube un archivo nuevo; luego simula fallo de la API de actualización bloqueando esa llamada. | Si PUT falla, la referencia anterior sigue activa y el archivo nuevo se elimina si la compensación está permitida. Si la limpieza también falla, el panel informa que quedó una carga temporal sin referencia. |
| Sustitución exitosa | Repite sin bloquear la API. | PUT reemplaza la URL/orden de la misma referencia `codimo`. El objeto Storage previo se conserva; no se borra por si otra referencia lo comparte. |
| Baja lógica | Desactiva una imagen de un modelo con más de una imagen activa y recarga catálogo/ficha. | `estimo=false`; la imagen deja de aparecer públicamente, pero no se borra físicamente de Storage. |
| Última imagen activa | Intenta desactivar la única imagen activa de un modelo Publicado. | La RPC rechaza la operación con error controlado y la imagen permanece activa. |
| Modelo Borrador | Sube una imagen a un modelo Borrador y consulta su fila en la respuesta administrativa. | La imagen queda registrada, pero `estmod` permanece `Borrador`; cargar una imagen nunca publica el modelo. |
| Fallo de Storage | Para un usuario autorizado, simula un rechazo de Storage o una interrupción de esa petición. | No se llama a POST/PUT de referencias, no hay toast de éxito y la imagen anterior permanece. |
| Fallo de API después de Storage | Mantén Storage disponible y bloquea solo POST de referencia; revisa también el caso en que el DELETE compensatorio falle. | La UI no anuncia éxito. Intenta borrar exclusivamente el UUID nuevo; nunca elimina la referencia u objeto previo. Si DELETE falla, comunica que el objeto quedó sin referencia. |

## Evidencia que conviene guardar

Para cada rol anota resultado HTTP de las rutas `/api/modelos/:id/imagenes`, `/api/modelos/:id/imagenes/:codimo` y `/api/modelos/:id/imagenes/:codimo/estado`, y captura `codmod`, `codimo`, `urlimo`, `ordimo`, `estimo` y `estmod` antes/después. En Storage verifica el path exacto y el MIME del objeto. No compartas tokens ni claves en las capturas.
