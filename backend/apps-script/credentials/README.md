# Apps Script: PDF de códigos del Open Day

Web app que llama la Edge Function `send-email` cuando se confirma una inscripción (`registration_confirmed`) o el admin cambia su lista (`credentials_updated`). Genera el PDF (itinerario + una tarjeta con QR por persona), guarda una copia en Drive y envía el correo con el PDF adjunto. La Edge Function registra la copia como `registration_documents.kind = 'credentials'`.

## Archivos

- `Code.gs`: web app, PDF, idempotencia y `testGenerateSample()`.
- `qrcode.gs`: `qrcode-generator` 1.4.4 (MIT), sin cambios.
- `appsscript.json`: manifiesto (zona horaria, scopes, web app).

> El generador de QR del spike (`backend/spikes/apps_script_qr_benchmark.gs`) **no produce códigos escaneables** (sin patrones de alineación; `jsQR` no decodifica ninguno). Solo sirve para medir tiempos. No lo uses.

## Despliegue

1. Crea el proyecto en script.google.com con una cuenta institucional que tenga acceso a la carpeta de Drive (con `clasp` o pegando los tres archivos).
2. Propiedades del script: `SHARED_SECRET` (largo y aleatorio), `DRIVE_FOLDER_ID` (carpeta privada) y, opcional, `REPLY_TO`.
3. **Antes de desplegar**, ejecuta `testGenerateSample()`: genera 60 tarjetas, imprime tiempo y tamaño en el registro y guarda el PDF en la carpeta. Ábrelo y comprueba que los QR se ven y se escanean con un celular. Si el conversor de `HtmlService` no pinta los QR (data URI), la alternativa es construir un Google Doc con `DocumentApp` e insertar los QR como imágenes.
4. Implementar > Aplicación web: ejecutar como **yo**, acceso **cualquier persona** (la autenticación es `SHARED_SECRET` en el cuerpo, porque Apps Script no lee cabeceras). Autoriza los permisos de Drive y de envío de correo.
5. Pon la URL `/exec` y el secreto en la Edge Function: `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET`.

## Comportamiento

- **Idempotente por `outbox_id`**: si la Edge Function reintenta, no se reenvía el correo ni se duplica el PDF. Si el PDF se guardó pero el correo falló, el reintento reutiliza el archivo.
- **Cuota de correo** (`MailApp`): unos 100 al día en cuentas personales y 1500 en Google Workspace; en el Open Day se envían como mucho dos correos con códigos por inscripción. Un error de cuota se reintenta con espera y, si se agota, el correo queda `failed` en `email_outbox`.
- **Límite de ejecución**: 6 minutos. Mide el tiempo real con `testGenerateSample()`.
- El QR contiene solo el `access_code` de 8 caracteres, que es lo que lee `check_in_pass()`.
