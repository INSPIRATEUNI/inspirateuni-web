# Edge Functions del Open Day

| Función | Qué hace | Quién la llama |
| --- | --- | --- |
| `drive-upload` | `create_session`: abre la subida reanudable a Drive. `finalize`: verifica el PDF y lo registra. `download`: sirve el PDF al staff. | Frontend, solo desde `frontend/src/lib/storage.ts` |
| `send-email` | Worker de `email_outbox`: reclama, envía por SMTP y cierra. Los correos con códigos los envía Apps Script. | Webhook de la BD (`pg_net`) y job `openday-process-emails` |

`_shared/` tiene CORS/errores (`http.ts`) y el cliente de Drive con cuenta de servicio (`google.ts`).

## Variables de entorno

Producción: `supabase secrets set --env-file <archivo>` (el archivo no se commitea). Local: `supabase functions serve --env-file <archivo>`. Plantilla: [`.env.example`](./.env.example).
`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase.

| Variable | Función | Para qué |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | drive-upload | JSON de la cuenta de servicio (contenido, no ruta) |
| `GOOGLE_DRIVE_FOLDER_ID` | drive-upload | Carpeta destino **dentro de una unidad compartida** |
| `GOOGLE_IMPERSONATE_USER` | drive-upload | Opcional: delegación de dominio en vez de unidad compartida |
| `ALLOWED_ORIGINS` | drive-upload | Orígenes del sitio separados por coma (por defecto `http://localhost:3000`) |
| `EMAIL_WEBHOOK_SECRET` | send-email | Igual al secreto `email_worker_secret` de Vault |
| `SITE_URL` | send-email | Base de los enlaces de los correos (sin `/` final) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | send-email | SMTP propio (465 = TLS directo; 587 = STARTTLS) |
| `MAIL_FROM` | send-email | Remitente, p. ej. `InspírateUNI <no-reply@dominio>` |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | send-email | URL `/exec` del web app y su `SHARED_SECRET` |

## Drive

La cuenta de servicio no tiene cuota propia (spike 1.5.0): agrégala como **Content Manager** a una unidad compartida y usa una carpeta de esa unidad. Una carpeta de un Drive personal no sirve: los archivos quedarían a nombre de la cuenta de servicio y la subida falla con `storageQuotaExceeded`. Los archivos rechazados se borran de Drive; los reemplazados se conservan (`superseded_at`).

`finalize` solo acepta un archivo que **abrió su propia sesión** (comprueba `appProperties`: inscripción, tipo y dueño), de modo que un usuario no puede registrar archivos ajenos. Cada descarga del staff queda en `registration_events` (`document_viewed`).

## Cola de correos

1. Un `INSERT` en `email_outbox` dispara `notify_email_worker()` (trigger + `pg_net`), que llama a `send-email`. El job `openday-process-emails` (cada minuto) lo repite para reintentos y correos programados.
2. Configura la URL y el secreto en Vault (SQL Editor, una vez por entorno; la URL es la de la función desplegada):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-email', 'email_worker_url');
   select vault.create_secret('<mismo valor que EMAIL_WEBHOOK_SECRET>', 'email_worker_secret');
   ```
   Sin esos secretos el trigger no hace nada y solo el job procesa la cola (con hasta un minuto de retraso).
3. Entrega **al menos una vez**: hasta 5 intentos con espera de 2, 4, 8 y 16 min; después queda `failed` con `last_error`. Los errores SMTP 5xx, las plantillas desconocidas y las inscripciones ya no confirmadas fallan de inmediato. Idempotencia: `dedupe_key` al encolar, `Message-ID` = id de la fila y, para el PDF de códigos, el marcador por `outbox_id` de Apps Script.
4. Plantillas en `send-email/templates.ts`. Una plantilla nueva: añadir el `case` y encolarla con `_enqueue_email`.

## SMTP del OTP de Supabase Auth

Es independiente de la cola: se configura en el Dashboard (Authentication > SMTP) o con el bloque `[auth.email.smtp]` de `config.toml` (hoy comentado) y las mismas credenciales SMTP. Al activarlo, sube `email_sent` en `[auth.rate_limit]`.

## Probar en local

```bash
cd backend
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env   # copia de .env.example; .env está ignorado por git
```
Los tipos se comprueban con `deno check --node-modules-dir=none --no-lock supabase/functions/*/index.ts` (la raíz del repo tiene un `package.json` que desorienta a Deno si no se pasa esa opción).
