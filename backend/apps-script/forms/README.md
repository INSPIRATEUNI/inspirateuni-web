# Apps Script: formularios de la web

Guarda en una Google Sheet los formularios de voluntariado, Inspírate Girl y visitas guiadas, y envía los correos.

## Instalar

1. Crea una Google Sheet y copia su ID (lo que va entre `/d/` y `/edit` en la URL).
2. En [script.google.com](https://script.google.com) crea un proyecto (o en la hoja: **Extensiones → Apps Script**) y pega `Code.gs` y `appsscript.json`.
   - Para ver `appsscript.json`: **Configuración del proyecto → Mostrar el archivo de manifiesto**.
3. **Configuración del proyecto → Propiedades del script**:
   - `SHARED_SECRET`: un secreto largo.
   - `SPREADSHEET_ID`: el ID del paso 1.
   - `NOTIFY_EMAIL`: el correo que recibe los avisos.
4. Ejecuta `testSubmit` y acepta los permisos. Debe aparecer una fila y llegarte dos correos.
5. **Implementar → Nueva implementación → Aplicación web**: ejecutar como **yo**, acceso **cualquier persona**. Copia la URL `/exec`.
6. En `frontend/.env.local`:

```env
FORMS_APPS_SCRIPT_URL=<url /exec>
FORMS_APPS_SCRIPT_SECRET=<el SHARED_SECRET>
```

Si cambias el código, publica con **Implementar → Gestionar implementaciones → Editar → Nueva versión** (así no cambia la URL).

> Cada envío usa 2 correos. Gmail permite unos 100 al día (1500 con Google Workspace).
