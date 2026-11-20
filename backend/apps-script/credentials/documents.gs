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
  var existing = folder.getFilesByName(name);
  if (existing.hasNext()) return { ok: true, already_saved: true, file_id: existing.next().getId() };

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    return { ok: false, error: 'No se pudo descargar el documento (HTTP ' + response.getResponseCode() + ')' };
  }
  var file = folder.createFile(response.getBlob().setName(name));
  file.setDescription('Archivo original: ' + String(req.file_name || '').slice(0, 150));
  return { ok: true, file_id: file.getId() };
}

function childFolder_(parent, name) {
  var found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}
