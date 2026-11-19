# Apps Script: PDF de códigos del Open Day

Web app que llama la Edge Function `send-email` cuando se confirma una inscripción (`registration_confirmed`) o el admin cambia su lista (`credentials_updated`). Genera el PDF (una página por persona: datos, recorridos, QR y código de barras), guarda una copia en Drive y envía el correo con el PDF adjunto. La Edge Function registra la copia como `registration_documents.kind = 'credentials'`.

## Archivos

- `Code.gs`: web app, idempotencia, diseño HTML de respaldo y pruebas (`testGenerateSample()`, `testGenerateTemplateSample()`).
- `template.gs`: PDF desde una plantilla de Google Docs, una página por persona, y `createTemplateDoc()`.
- `barcode128.gs`: código de barras Code 128 como PNG, sin dependencias.
- `qrcode.gs`: `qrcode-generator` 1.4.4 (MIT), sin cambios.
- `appsscript.json`: manifiesto (zona horaria, scopes, web app).

> El generador de QR del spike (`backend/spikes/apps_script_qr_benchmark.gs`) **no produce códigos escaneables** (sin patrones de alineación; `jsQR` no decodifica ninguno). Solo sirve para medir tiempos. No lo uses.

## Despliegue

1. Crea el proyecto en script.google.com con una cuenta institucional que tenga acceso a la carpeta de Drive (con `clasp` o pegando los tres archivos).
2. Propiedades del script: `SHARED_SECRET` (largo y aleatorio), `DRIVE_FOLDER_ID` (carpeta privada) y, opcional, `TEMPLATE_DOC_ID` (ver «Plantilla de Google Docs») y `REPLY_TO`.
3. **Antes de desplegar**, ejecuta `testGenerateSample()`: genera 60 tarjetas, imprime tiempo y tamaño en el registro y guarda el PDF en la carpeta. Ábrelo y comprueba que los QR se ven y se escanean con un celular. Si el conversor de `HtmlService` no pinta los QR (data URI), la alternativa es construir un Google Doc con `DocumentApp` e insertar los QR como imágenes.
4. Implementar > Aplicación web: ejecutar como **yo**, acceso **cualquier persona** (la autenticación es `SHARED_SECRET` en el cuerpo, porque Apps Script no lee cabeceras). Autoriza los permisos de Drive y de envío de correo.
5. Pon la URL `/exec` y el secreto en la Edge Function: `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET`.

## Plantilla de Google Docs (una página por persona)

Con `TEMPLATE_DOC_ID` el PDF se arma desde un Google Doc que tú diseñas (logo, colores, textos). Sin esa propiedad, o si la plantilla falla (se registra el error), se usa el diseño HTML de respaldo: el colegio siempre recibe sus códigos.

1. Ejecuta `createTemplateDoc()` una vez: crea en `DRIVE_FOLDER_ID` un Doc de partida con todos los marcadores y registra su id.
2. Edítalo a tu gusto y guarda su id en la propiedad `TEMPLATE_DOC_ID`. La cuenta que despliega el script debe poder leerlo.
3. Ejecuta `testGenerateTemplateSample()` (33 personas, como un colegio típico): mide el tiempo (el límite es 6 min) y revisa el PDF. **Escanea el QR y las barras con un lector real.**

La plantilla es **una sola página**: se repite por cada persona. Si el contenido pasa de una página, cada persona ocupará dos.

| Marcador | Contenido |
| --- | --- |
| `{{evento}}`, `{{fecha_evento}}`, `{{lugar}}` | Nombre, fecha («jueves 3 de diciembre de 2026») y sede |
| `{{colegio}}`, `{{codigo_inscripcion}}`, `{{puerta}}`, `{{hora_llegada}}` | Datos de la inscripción |
| `{{nombre}}`, `{{rol}}`, `{{parentesco}}`, `{{documento}}`, `{{codigo}}` | Datos de la persona y su código de acceso |
| `{{numero}}`, `{{total}}` | Posición de la persona y cantidad total |
| `{{qr}}`, `{{barcode}}` | Imágenes. Deben estar **solos en su párrafo**; conservan la alineación del párrafo |
| `{{recorrido_facultad}}`, `{{recorrido_horario}}`, `{{recorrido_punto}}` | En una **fila modelo** de una tabla: se repite por cada recorrido y la modelo se elimina |

Los marcadores funcionan en párrafos, listas y celdas de tabla del cuerpo, **no en el encabezado ni en el pie**. El código de barras es Code 128 y el QR y las barras llevan el mismo `access_code`, que es lo que lee `check_in_pass()`. Para agregar un dato nuevo, inclúyelo en `credentials_payload()` (migración) y en `commonFields_`/`personFields_` de `template.gs`.

## Comportamiento

- **Idempotente por `outbox_id`**: si la Edge Function reintenta, no se reenvía el correo ni se duplica el PDF. Si el PDF se guardó pero el correo falló, el reintento reutiliza el archivo.
- **Cuota de correo** (`MailApp`): unos 100 al día en cuentas personales y 1500 en Google Workspace; en el Open Day se envían como mucho dos correos con códigos por inscripción. Un error de cuota se reintenta con espera y, si se agota, el correo queda `failed` en `email_outbox`.
- **Límite de ejecución**: 6 minutos. Mide el tiempo real con `testGenerateSample()`.
- El QR y el código de barras contienen solo el `access_code` de 8 caracteres, que es lo que lee `check_in_pass()`.
- Al desplegar con la plantilla, autoriza de nuevo el script: pide el permiso de Documentos (`documents`).
