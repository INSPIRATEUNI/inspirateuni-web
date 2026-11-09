/**
 * Formularios públicos de la web: voluntariado, Inspírate Girl y visitas guiadas.
 *
 * Las Server Actions de Next.js hacen POST (text/plain) con { secret, action, submission_id, data }.
 * Cada envío se agrega como fila en una pestaña de la hoja, se avisa a NOTIFY_EMAIL y se manda una
 * confirmación corta a quien llenó el formulario.
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   SHARED_SECRET   el mismo valor que FORMS_APPS_SCRIPT_SECRET en el frontend. Largo y aleatorio.
 *   SPREADSHEET_ID  ID de la Google Sheet (lo que va entre /d/ y /edit en la URL).
 *   NOTIFY_EMAIL    correo que recibe el aviso de cada envío (varios: separados por coma).
 *
 * Respuesta: { ok: true } o { ok: false, error, permanent? }. Sin 'permanent' se puede reintentar
 * con el mismo submission_id: no duplica la fila ni los correos.
 */

var TZ = 'America/Lima';
var DONE_TTL = 21600; // 6 h, el máximo de CacheService
var MAX_LENGTH = 2000;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// [clave en data, encabezado de la columna, obligatorio]
var FORMS = {
  volunteer_application: {
    sheet: 'Voluntariado',
    title: 'Voluntariado',
    fields: [
      ['first_name', 'Nombres', true],
      ['last_name', 'Apellidos', true],
      ['email', 'Correo', true],
      ['phone', 'Celular', true],
      ['student_code', 'Código UNI', true],
      ['faculty', 'Facultad', true],
      ['cycle', 'Ciclo', true],
      ['area', 'Dónde quiere apoyar', true],
      ['motivation', 'Motivación', true],
      ['interest_only', 'Solo pide aviso', false]
    ],
    who: function (d) { return d.first_name + ' ' + d.last_name; },
    confirm: function (d) {
      return {
        subject: d.interest_only ? 'Te avisaremos de la convocatoria' : 'Recibimos tu postulación',
        body: d.interest_only
          ? 'Guardamos tus datos. Te escribiremos apenas abra la convocatoria de voluntariado.'
          : 'Recibimos tu postulación al voluntariado de Inspírate UNI. Revisaremos tus datos y te escribiremos con los siguientes pasos.'
      };
    }
  },
  igirl_interest: {
    sheet: 'Inspírate Girl',
    title: 'Inspírate Girl',
    fields: [
      ['interest', 'Cómo quiere participar', true],
      ['first_name', 'Nombres', true],
      ['last_name', 'Apellidos', true],
      ['email', 'Correo', true],
      ['phone', 'Celular', false],
      ['institution', 'Colegio o universidad', true],
      ['grade', 'Grado o ciclo', false],
      ['message', 'Mensaje', false]
    ],
    who: function (d) { return d.first_name + ' ' + d.last_name; },
    confirm: function () {
      return {
        subject: 'Recibimos tu mensaje',
        body: 'Gracias por escribir a Inspírate Girl. Te contaremos de nuestras próximas actividades.'
      };
    }
  },
  guided_visit: {
    sheet: 'Visitas guiadas',
    title: 'Visita guiada',
    fields: [
      ['school', 'Colegio', true],
      ['district', 'Distrito', true],
      ['students', 'Escolares', true],
      ['mode', 'Modalidad', true],
      ['date', 'Fecha', true],
      ['shift', 'Turno', true],
      ['name', 'Contacto', true],
      ['email', 'Correo', true],
      ['phone', 'Celular', false]
    ],
    who: function (d) { return d.school; },
    confirm: function (d) {
      return {
        subject: 'Recibimos tu solicitud de visita',
        body: 'Recibimos tu solicitud de visita para ' + d.school + ' el ' + prettyDate_(d.date) +
          ', turno ' + String(d.shift).toLowerCase() + '. Te escribiremos en las próximas 48 horas para confirmar la fecha.'
      };
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (!safeEqual_(String(req.secret || ''), prop_('SHARED_SECRET'))) {
      return json_({ ok: false, error: 'unauthorized', permanent: true });
    }
    return json_(handle_(req));
  } catch (err) {
    // Sin 'permanent': se puede reintentar
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function handle_(req) {
  var form = FORMS[req.action];
  if (!form) return { ok: false, error: 'acción desconocida', permanent: true };

  var id = String(req.submission_id || '');
  if (!ID_RE.test(id)) return { ok: false, error: 'submission_id no válido', permanent: true };

  var data = clean_(form, req.data || {});
  var problem = validate_(form, data);
  if (problem) return { ok: false, error: problem, permanent: true };

  // Un envío a la vez: dos reintentos simultáneos no deben duplicar la fila
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'ocupado, reintenta' };
  try {
    var cache = CacheService.getScriptCache();
    var key = 'done:' + id;
    if (cache.get(key)) return { ok: true, duplicate: true };

    appendRow_(form, id, data);
    cache.put(key, '1', DONE_TTL);
  } finally {
    lock.releaseLock();
  }

  // La fila ya está guardada: si falla un correo (p. ej., cuota) no se reporta error
  notify_(form, data);
  confirm_(form, data);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------

/** Solo las claves conocidas, como texto recortado (booleanos y números se conservan). */
function clean_(form, raw) {
  var data = {};
  form.fields.forEach(function (f) {
    var value = raw[f[0]];
    if (typeof value === 'boolean' || typeof value === 'number') data[f[0]] = value;
    else data[f[0]] = value === null || value === undefined ? '' : String(value).trim().slice(0, MAX_LENGTH);
  });
  return data;
}

function validate_(form, data) {
  for (var i = 0; i < form.fields.length; i++) {
    var f = form.fields[i];
    if (f[2] && data[f[0]] === '') return 'Falta ' + f[1];
  }
  if (!EMAIL_RE.test(data.email)) return 'Correo no válido';
  return null;
}

function appendRow_(form, id, data) {
  var ss = SpreadsheetApp.openById(prop_('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName(form.sheet) || ss.insertSheet(form.sheet);

  // Encabezados que falten (pestaña nueva o campo nuevo) se agregan al final
  var wanted = ['Fecha (Lima)', 'ID de envío'].concat(form.fields.map(function (f) { return f[1]; }));
  var lastCol = sheet.getLastColumn();
  var header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var missing = wanted.filter(function (h) { return header.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    header = header.concat(missing);
  }

  var row = header.map(function () { return ''; });
  row[header.indexOf('Fecha (Lima)')] = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  row[header.indexOf('ID de envío')] = id;
  form.fields.forEach(function (f) {
    var value = data[f[0]];
    if (typeof value === 'boolean') value = value ? 'Sí' : 'No';
    row[header.indexOf(f[1])] = cellSafe_(value);
  });
  sheet.appendRow(row);
}

/** Evita que un texto que empieza con = + - @ se interprete como fórmula. */
function cellSafe_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

// ---------------------------------------------------------------------------------------------
// Correos
// ---------------------------------------------------------------------------------------------

function notify_(form, data) {
  try {
    var lines = form.fields.map(function (f) {
      var value = data[f[0]];
      if (typeof value === 'boolean') value = value ? 'Sí' : 'No';
      return f[1] + ': ' + (value === '' ? '—' : value);
    });
    MailApp.sendEmail({
      to: prop_('NOTIFY_EMAIL'),
      subject: '[Web] ' + form.title + ': ' + form.who(data),
      body: lines.join('\n') + '\n\nHoja: https://docs.google.com/spreadsheets/d/' + prop_('SPREADSHEET_ID'),
      replyTo: data.email,
      name: 'Formularios Inspírate UNI'
    });
  } catch (err) {
    console.error('Aviso no enviado: ' + err);
  }
}

function confirm_(form, data) {
  try {
    var msg = form.confirm(data);
    var hello = data.first_name || data.name;
    MailApp.sendEmail({
      to: data.email,
      subject: msg.subject + ' · Inspírate UNI',
      body: 'Hola' + (hello ? ' ' + hello : '') + ':\n\n' + msg.body +
        '\n\nEquipo Inspírate UNI\n\nSi no llenaste este formulario, ignora este correo.',
      replyTo: prop_('NOTIFY_EMAIL').split(',')[0].trim(),
      name: 'Inspírate UNI'
    });
  } catch (err) {
    console.error('Confirmación no enviada: ' + err);
  }
}

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** aaaa-mm-dd → dd/mm/aaaa (si no lo es, se deja igual). */
function prettyDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso);
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
// Prueba manual (ejecutar desde el editor): agrega una fila y envía los dos correos a NOTIFY_EMAIL
// ---------------------------------------------------------------------------------------------

function testSubmit() {
  var to = prop_('NOTIFY_EMAIL').split(',')[0].trim();
  var result = handle_({
    action: 'guided_visit',
    submission_id: Utilities.getUuid(),
    data: {
      school: 'I.E. de Prueba', district: 'Rímac', students: 40, mode: 'En la UNI',
      date: '2026-12-01', shift: 'Mañana', name: 'Prueba', email: to, phone: '987654321'
    }
  });
  Logger.log(JSON.stringify(result));
}
