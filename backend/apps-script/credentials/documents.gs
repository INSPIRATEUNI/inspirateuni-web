/**
 * Copia a Drive los documentos que los colegios suben a Supabase Storage.
 *
 * La Edge Function drive-upload (con DOCUMENT_STORAGE=supabase) llama aquí tras cada subida con una
 * URL firmada de 10 minutos. El archivo se guarda con la cuenta que despliega el script, así que usa
 * su espacio de Drive (no hace falta cuenta de servicio ni unidad compartida).
 *
 * Carpeta: DOCS_FOLDER_ID (propiedad opcional) o, si no existe, DRIVE_FOLDER_ID. Dentro se crea una
 * subcarpeta por inscripción (su reference_code). Es idempotente por document_id.
 */

function saveDocument_(req) {
  var url = String(req.url || '');
  var documentId = String(req.document_id || '');
  if (url.indexOf('https://') !== 0 || !documentId || !req.reference) {
    return { ok: false, error: 'Faltan datos del documento', permanent: true };
  }

  var props = PropertiesService.getScriptProperties();
  var rootId = props.getProperty('DOCS_FOLDER_ID') || prop_('DRIVE_FOLDER_ID');
  var root = DriveApp.getFolderById(rootId);
  var folder = childFolder_(root, String(req.reference).replace(/[^A-Za-z0-9_-]/g, '_'));

  var name = String(req.kind || 'documento').replace(/[^A-Za-z0-9_-]/g, '_') + '_' + documentId + '.pdf';
  // getFilesByName también devuelve archivos de la papelera: se ignoran
  var existing = folder.getFilesByName(name);
  while (existing.hasNext()) {
    var previous = existing.next();
    if (!previous.isTrashed() && previous.getSize() > 0) {
      console.log('Documento ya guardado: ' + previous.getUrl());
      return { ok: true, already_saved: true, file_id: previous.getId() };
    }
  }

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var code = response.getResponseCode();
  var blob = response.getBlob();
  if (code !== 200 || blob.getBytes().length === 0) {
    console.error('Descarga fallida: HTTP ' + code + ', ' + blob.getBytes().length + ' bytes');
    return { ok: false, error: 'No se pudo descargar el documento (HTTP ' + code + ')' };
  }
  var file = folder.createFile(blob.setName(name).setContentType('application/pdf'));
  file.setDescription('Archivo original: ' + String(req.file_name || '').slice(0, 150));
  console.log('Documento guardado: ' + file.getUrl() + ' (' + file.getSize() + ' bytes) en ' + folder.getUrl());
  return { ok: true, file_id: file.getId() };
}

function childFolder_(parent, name) {
  var found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

/**
 * Ejecutar UNA vez desde el editor (botón Ejecutar) para que Google pida y registre el permiso de
 * conexión a servicios externos (UrlFetchApp). Sin esto, el web app falla con
 * "You do not have permission to call UrlFetchApp.fetch".
 */
function authorizeExternalRequests() {
  var response = UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  Logger.log('Permiso concedido (HTTP ' + response.getResponseCode() + ').');
}

/**
 * Entrega un PDF de la carpeta de códigos o de documentos en base64, para que la intranet lo muestre
 * (la Edge Function no tiene acceso a este Drive). Solo sirve archivos dentro de esas carpetas.
 */
function getFile_(req) {
  var id = String(req.file_id || '');
  if (!id) return { ok: false, error: 'Falta file_id', permanent: true };

  var props = PropertiesService.getScriptProperties();
  var roots = [prop_('DRIVE_FOLDER_ID'), props.getProperty('DOCS_FOLDER_ID')].filter(String);
  var file = DriveApp.getFileById(id);
  if (file.isTrashed() || !insideFolders_(file, roots)) {
    return { ok: false, error: 'Archivo no permitido', permanent: true };
  }
  var blob = file.getBlob();
  return { ok: true, name: file.getName(), data: Utilities.base64Encode(blob.getBytes()) };
}

/** true si el archivo cuelga (hasta 2 niveles) de alguna de las carpetas. */
function insideFolders_(file, rootIds) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (rootIds.indexOf(parent.getId()) >= 0) return true;
    var grand = parent.getParents();
    while (grand.hasNext()) if (rootIds.indexOf(grand.next().getId()) >= 0) return true;
  }
  return false;
}
