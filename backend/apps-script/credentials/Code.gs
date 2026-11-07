/**
 * Códigos de acceso del Open Day (Issue 1.5.6).
 *
 * Web app que llama la Edge Function `send-email` al confirmar una inscripción (o al cambiar su
 * lista de personas). Recibe los datos ya armados desde la BD, genera el PDF (una tarjeta con QR
 * por persona), guarda una copia en Drive y envía el correo con el PDF adjunto.
 * Devuelve el id del archivo de Drive; la Edge Function lo registra como
 * registration_documents.kind = 'credentials'.
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   SHARED_SECRET    secreto compartido con la Edge Function (APPS_SCRIPT_SECRET). Largo y aleatorio.
 *   DRIVE_FOLDER_ID  carpeta (privada) donde se guardan las copias.
 *   REPLY_TO         opcional: correo al que responden los colegios.
 *
 * El QR contiene solo el código de acceso de 8 caracteres (event_passes.access_code), que es lo que
 * lee check_in_pass() en el ingreso.
 */

var TZ = 'America/Lima';
var SENT_PREFIX = 'sent:';
var MAX_SENT_ENTRIES = 1500; // PropertiesService admite ~500 KB: se podan las más antiguas

var ROLE_LABELS = { visitor: 'Visitante', chaperone: 'Acompañante', guardian: 'Apoderado' };
var DOC_LABELS = { dni: 'DNI', ce: 'CE', passport: 'Pasaporte', other: 'Doc.' };

// ---------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (!safeEqual_(String(req.secret || ''), prop_('SHARED_SECRET'))) {
      return json_({ ok: false, error: 'unauthorized', permanent: true });
    }
    if (req.action !== 'send_credentials') {
      return json_({ ok: false, error: 'acción desconocida', permanent: true });
    }
    return json_(sendCredentials_(req));
  } catch (err) {
    // Sin 'permanent': la Edge Function reintenta con espera
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function sendCredentials_(req) {
  var outboxId = String(req.outbox_id || '');
  if (!outboxId || !req.to || !req.data || !req.data.people || !req.data.people.length) {
    return { ok: false, error: 'Faltan datos del correo', permanent: true };
  }

  // Un solo envío a la vez: dos reintentos simultáneos no deben duplicar el correo
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var state = readState_(props, outboxId);

    // Ya enviado (la Edge Function reintenta porque no pudo registrar el PDF): se devuelve lo guardado
    if (state && state.sent) {
      return { ok: true, already_sent: true, file_id: state.fileId, file_name: state.name, size: state.size };
    }

    var file;
    if (state) {
      file = DriveApp.getFileById(state.fileId); // el PDF ya se guardó pero el correo falló
    } else {
      var pdf = buildPdf_(req.data);
      file = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(pdf);
      state = { fileId: file.getId(), name: file.getName(), size: file.getSize(), sent: false, at: Date.now() };
      writeState_(props, outboxId, state);
    }

    var message = {
      to: req.to,
      subject: req.subject,
      htmlBody: req.html,
      body: req.text,
      name: req.from_name || 'InspírateUNI',
      attachments: [file.getBlob()]
    };
    var replyTo = props.getProperty('REPLY_TO');
    if (replyTo) message.replyTo = replyTo;
    MailApp.sendEmail(message);

    state.sent = true;
    writeState_(props, outboxId, state);
    prune_(props);
    return { ok: true, file_id: state.fileId, file_name: state.name, size: state.size };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------------------------
// Estado de idempotencia (por outbox_id)
// ---------------------------------------------------------------------------------------------

function readState_(props, outboxId) {
  var raw = props.getProperty(SENT_PREFIX + outboxId);
  return raw ? JSON.parse(raw) : null;
}

function writeState_(props, outboxId, state) {
  props.setProperty(SENT_PREFIX + outboxId, JSON.stringify(state));
}

function prune_(props) {
  var all = props.getProperties();
  var keys = Object.keys(all).filter(function (k) { return k.indexOf(SENT_PREFIX) === 0; });
  if (keys.length <= MAX_SENT_ENTRIES) return;
  keys.sort(function (a, b) { return JSON.parse(all[a]).at - JSON.parse(all[b]).at; });
  keys.slice(0, keys.length - MAX_SENT_ENTRIES).forEach(function (k) { props.deleteProperty(k); });
}

// ---------------------------------------------------------------------------------------------
// PDF: itinerario + una tarjeta con QR por persona (2 por fila, con tablas: el conversor de
// HtmlService no soporta bien flexbox)
// ---------------------------------------------------------------------------------------------

function buildPdf_(data) {
  var reg = data.registration;
  var name = 'codigos_' + reg.reference_code + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm') + '.pdf';
  return HtmlService.createHtmlOutput(buildHtml_(data)).getAs(MimeType.PDF).setName(name);
}

function buildHtml_(data) {
  var reg = data.registration;
  var people = data.people;

  var rows = '';
  for (var i = 0; i < people.length; i += 2) {
    rows += '<tr>' + card_(people[i], reg, data.event) + (people[i + 1] ? card_(people[i + 1], reg, data.event) : '<td></td>') + '</tr>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@page { size: A4; margin: 12mm; }' +
    'body { font-family: Arial, Helvetica, sans-serif; color: #1c1c28; }' +
    'h1 { font-size: 18px; margin: 0 0 2px; }' +
    'h2 { font-size: 13px; margin: 14px 0 4px; }' +
    '.muted { color: #6b6b80; font-size: 10px; }' +
    'table.tours { border-collapse: collapse; width: 100%; font-size: 10px; }' +
    'table.tours td, table.tours th { border: 1px solid #d6d6e0; padding: 4px 6px; text-align: left; }' +
    'table.cards { width: 100%; border-collapse: separate; border-spacing: 8px; }' +
    'table.cards > tbody > tr > td { width: 50%; vertical-align: top; }' +
    'table.card { width: 100%; border: 1.5px solid #c9c9d8; border-collapse: collapse; page-break-inside: avoid; }' +
    'table.card td { padding: 6px 8px; vertical-align: middle; }' +
    '.brand { font-size: 10px; font-weight: bold; color: #e6007e; border-bottom: 2px solid #e6007e; }' +
    '.who { font-size: 12px; font-weight: bold; }' +
    '.role { font-size: 9px; font-weight: bold; color: #444; }' +
    '.meta { font-size: 8.5px; color: #555; }' +
    '.code { font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; text-align: center; }' +
    '</style></head><body>' +
    '<h1>' + esc_(data.event.name) + '</h1>' +
    '<div class="muted">' + esc_(formatDate_(data.event.event_date + 'T12:00:00-05:00', 'EEEE d \'de\' MMMM yyyy')) +
    (data.event.venue ? ' · ' + esc_(data.event.venue) : '') + '</div>' +
    '<div class="muted">' + esc_(reg.school || reg.contact_name) + ' · Código de referencia ' + esc_(reg.reference_code) + '</div>' +
    '<h2>Ingreso</h2>' +
    '<div style="font-size:11px">Puerta: <b>' + esc_(reg.gate || '') + '</b> · Hora de llegada: <b>' +
    esc_(reg.arrival_at ? formatDate_(reg.arrival_at, 'HH:mm') : '') + '</b></div>' +
    toursTable_(data.tours) +
    '<h2>Códigos de acceso (' + people.length + ')</h2>' +
    '<div class="muted">Cada persona presenta su propio código (impreso o en el celular) junto con su documento de identidad.</div>' +
    '<table class="cards"><tbody>' + rows + '</tbody></table>' +
    '</body></html>';
}

function toursTable_(tours) {
  if (!tours || !tours.length) return '';
  var body = tours.map(function (t) {
    return '<tr><td>' + esc_(t.faculty) + '</td><td>' + esc_(formatDate_(t.starts_at, 'HH:mm')) + ' – ' +
      esc_(formatDate_(t.ends_at, 'HH:mm')) + '</td><td>' + esc_(t.meeting_point || '') + '</td></tr>';
  }).join('');
  return '<h2>Recorridos</h2><table class="tours"><tr><th>Facultad</th><th>Horario</th><th>Punto de encuentro</th></tr>' + body + '</table>';
}

function card_(person, reg, event) {
  return '<td><table class="card"><tr><td colspan="2" class="brand">' + esc_(event.name) + ' · ACCESO</td></tr><tr>' +
    '<td><div class="who">' + esc_(person.full_name) + '</div>' +
    '<div class="role">' + esc_(ROLE_LABELS[person.role] || person.role) +
    (person.relationship ? ' · ' + esc_(person.relationship) : '') + '</div>' +
    '<div class="meta">' + esc_(DOC_LABELS[person.doc_type] || '') + ' ' + esc_(person.doc_number) + '</div>' +
    '<div class="meta">' + esc_(reg.school || '') + '</div>' +
    '<div class="meta">Puerta: ' + esc_(reg.gate || '') + '</div></td>' +
    '<td style="width:92px"><img src="' + qrDataUrl_(person.access_code) + '" width="84" height="84">' +
    '<div class="code">' + esc_(person.access_code) + '</div></td>' +
    '</tr></table></td>';
}

/** QR (GIF en data URI) con nivel de corrección M. El contenido es solo el código de acceso. */
function qrDataUrl_(code) {
  var qr = qrcode(0, 'M');
  qr.addData(String(code));
  qr.make();
  return qr.createDataURL(4, 2);
}

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

function formatDate_(iso, pattern) {
  return Utilities.formatDate(new Date(iso), TZ, pattern);
}

function esc_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function prop_(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('Falta la propiedad del script ' + name);
  return value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeEqual_(a, b) {
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------------------------
// Pruebas manuales (ejecutar desde el editor de Apps Script)
// ---------------------------------------------------------------------------------------------

/** Genera un PDF de ejemplo con N personas, lo guarda en DRIVE_FOLDER_ID y registra el tiempo. */
function testGenerateSample() {
  var n = 60;
  var alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var people = [];
  for (var i = 1; i <= n; i++) {
    var code = '';
    for (var j = 0; j < 8; j++) code += alphabet.charAt(Math.floor(Math.random() * 32));
    people.push({
      full_name: 'Estudiante de Prueba ' + i, doc_type: 'dni', doc_number: String(70000000 + i),
      role: i === 1 ? 'chaperone' : 'visitor', relationship: i === 1 ? 'Docente' : null, access_code: code
    });
  }
  var data = {
    registration: { reference_code: 'OD-PRUEBA', gate: 'Puerta 3', arrival_at: '2026-12-05T13:30:00-05:00', school: 'I.E. de Prueba', contact_name: 'Responsable' },
    event: { name: 'Open Day UNI', event_date: '2026-12-05', venue: 'Campus UNI' },
    tours: [{ faculty: 'Facultad de Ciencias', starts_at: '2026-12-05T14:00:00-05:00', ends_at: '2026-12-05T15:00:00-05:00', meeting_point: 'Hall central' }],
    people: people
  };
  var t0 = Date.now();
  var file = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(buildPdf_(data));
  Logger.log('PDF de ' + n + ' tarjetas en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, ' +
    Math.round(file.getSize() / 1024) + ' KB: ' + file.getUrl());
  Logger.log('Revisa que los QR aparezcan y se escaneen antes de desplegar.');
}
