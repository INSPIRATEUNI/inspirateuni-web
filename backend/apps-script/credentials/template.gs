/**
 * PDF de códigos a partir de una plantilla de Google Docs: UNA PÁGINA POR PERSONA.
 *
 * La plantilla (propiedad TEMPLATE_DOC_ID) es una sola página con marcadores `{{...}}`. Por cada
 * persona se copia esa página, se reemplazan los marcadores y se insertan el QR y el código de
 * barras; todas las páginas se juntan en una copia temporal del Doc, que se exporta a PDF y se borra.
 *
 * Marcadores de texto (en cualquier párrafo o celda de tabla del cuerpo; no en encabezado ni pie):
 *   Evento      {{evento}} {{fecha_evento}} {{lugar}}
 *   Inscripción {{colegio}} {{codigo_inscripcion}} {{puerta}} {{hora_llegada}}
 *   Persona     {{nombre}} {{rol}} {{parentesco}} {{documento}} {{codigo}} {{numero}} {{total}}
 *
 * Imágenes: `{{qr}}` y `{{barcode}}` deben estar SOLOS en su párrafo (el párrafo se sustituye por la
 * imagen y conserva su alineación).
 *
 * Recorridos: una tabla con una fila modelo que contenga {{recorrido_facultad}}, {{recorrido_horario}}
 * y/o {{recorrido_punto}}. La fila se repite por cada recorrido y la modelo se elimina.
 *
 * `createTemplateDoc()` crea una plantilla de partida con todos los marcadores.
 */

var QR_SIZE_PT = 130;
var BARCODE_WIDTH_PT = 240;
var MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function templateDocId_() {
  return PropertiesService.getScriptProperties().getProperty('TEMPLATE_DOC_ID');
}

function buildTemplatePdf_(data) {
  var reg = data.registration;
  var name = 'codigos_' + reg.reference_code + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm') + '.pdf';
  var folder = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID'));
  var copy = DriveApp.getFileById(templateDocId_()).makeCopy('tmp_' + name, folder);
  try {
    var doc = DocumentApp.openById(copy.getId());
    fillDocument_(doc, data);
    doc.saveAndClose();
    return copy.getAs(MimeType.PDF).setName(name);
  } finally {
    copy.setTrashed(true); // la copia temporal no debe quedar en Drive
  }
}

function fillDocument_(doc, data) {
  var body = doc.getBody();
  var pages = [];
  for (var i = 0; i < body.getNumChildren(); i++) pages.push(body.getChild(i).copy());
  body.clear();

  var common = commonFields_(data);
  var people = data.people;
  for (var p = 0; p < people.length; p++) {
    if (p > 0) body.appendPageBreak();
    var person = people[p];
    var fields = {};
    Object.keys(common).forEach(function (k) { fields[k] = common[k]; });
    var own = personFields_(person, p + 1, people.length);
    Object.keys(own).forEach(function (k) { fields[k] = own[k]; });
    var images = { qr: qrBlob_(person.access_code), barcode: code128Png_(person.access_code) };
    pages.forEach(function (element) {
      appendFilled_(body, element.copy(), fields, images, data.tours || []);
    });
  }

  // body.clear() deja un párrafo vacío al inicio
  var first = body.getChild(0);
  if (body.getNumChildren() > 1 && first.getType() === DocumentApp.ElementType.PARAGRAPH && first.asParagraph().getText() === '' &&
      first.asParagraph().getNumChildren() === 0) {
    body.removeChild(first);
  }
}

function commonFields_(data) {
  var reg = data.registration;
  var event = data.event;
  return {
    evento: event.name,
    fecha_evento: spanishDate_(event.event_date + 'T12:00:00-05:00'),
    lugar: event.venue || '',
    colegio: reg.school || reg.contact_name || '',
    codigo_inscripcion: reg.reference_code,
    puerta: reg.gate || '',
    hora_llegada: reg.arrival_at ? formatDate_(reg.arrival_at, 'HH:mm') : ''
  };
}

function personFields_(person, number, total) {
  return {
    nombre: person.full_name,
    rol: ROLE_LABELS[person.role] || person.role,
    parentesco: person.relationship || '',
    documento: ((DOC_LABELS[person.doc_type] || '') + ' ' + person.doc_number).trim(),
    codigo: person.access_code,
    numero: String(number),
    total: String(total)
  };
}

function appendFilled_(body, element, fields, images, tours) {
  var types = DocumentApp.ElementType;
  var out;
  switch (element.getType()) {
    case types.PARAGRAPH: out = body.appendParagraph(element.asParagraph()); break;
    case types.TABLE: out = body.appendTable(element.asTable()); break;
    case types.LIST_ITEM: out = body.appendListItem(element.asListItem()); break;
    case types.HORIZONTAL_RULE: body.appendHorizontalRule(); return;
    default: return;
  }
  fill_(out, fields, images, tours);
}

function fill_(element, fields, images, tours) {
  var types = DocumentApp.ElementType;
  switch (element.getType()) {
    case types.TABLE:
      expandTourRows_(element.asTable(), fields, images, tours);
      fillChildren_(element, fields, images, tours);
      break;
    case types.TABLE_ROW:
    case types.TABLE_CELL:
      fillChildren_(element, fields, images, tours);
      break;
    case types.PARAGRAPH:
      var paragraph = element.asParagraph();
      var text = paragraph.getText().trim();
      if (text === '{{qr}}') return insertImage_(paragraph, images.qr, QR_SIZE_PT, QR_SIZE_PT);
      if (text === '{{barcode}}') return insertImage_(paragraph, images.barcode, BARCODE_WIDTH_PT, BARCODE_WIDTH_PT * 48 / 572);
      replaceFields_(paragraph, fields);
      break;
    case types.LIST_ITEM:
      replaceFields_(element.asListItem(), fields);
      break;
    default:
  }
}

function fillChildren_(container, fields, images, tours) {
  for (var i = 0; i < container.getNumChildren(); i++) fill_(container.getChild(i), fields, images, tours);
}

function replaceFields_(element, fields) {
  if (element.getText().indexOf('{{') < 0) return;
  Object.keys(fields).forEach(function (key) {
    // replaceText interpreta `$1` y `\` en el reemplazo: se quitan del dato
    var value = String(fields[key] === null || fields[key] === undefined ? '' : fields[key]).replace(/[$\\]/g, '');
    element.replaceText('\\{\\{' + key + '\\}\\}', value);
  });
}

function insertImage_(paragraph, blob, width, height) {
  paragraph.clear();
  paragraph.appendInlineImage(blob).setWidth(width).setHeight(height);
}

/** Repite la fila modelo de la tabla de recorridos (la que lleva {{recorrido_...}}) una vez por recorrido. */
function expandTourRows_(table, fields, images, tours) {
  for (var r = 0; r < table.getNumRows(); r++) {
    if (table.getRow(r).getText().indexOf('{{recorrido_') < 0) continue;
    var model = table.getRow(r);
    for (var k = 0; k < tours.length; k++) {
      var clone = table.insertTableRow(r + k, model.copy().asTableRow());
      var tourFields = {
        recorrido_facultad: tours[k].faculty,
        recorrido_horario: formatDate_(tours[k].starts_at, 'HH:mm') + ' – ' + formatDate_(tours[k].ends_at, 'HH:mm'),
        recorrido_punto: tours[k].meeting_point || ''
      };
      Object.keys(fields).forEach(function (key) { tourFields[key] = fields[key]; });
      fill_(clone, tourFields, images, tours);
    }
    // Una tabla no puede quedar sin filas; la modelo solo se quita si queda alguna otra
    if (table.getNumRows() > 1) table.removeRow(r + tours.length);
    return;
  }
}

function qrBlob_(code) {
  var bytes = Utilities.base64Decode(qrDataUrl_(code, 8).split(',')[1]);
  return Utilities.newBlob(bytes, 'image/gif', 'qr_' + code + '.gif');
}

/** "jueves 3 de diciembre de 2026" (Utilities.formatDate saldría en inglés). */
function spanishDate_(iso) {
  var date = new Date(iso);
  var day = Number(Utilities.formatDate(date, TZ, 'd'));
  var weekday = DAYS_ES[Number(Utilities.formatDate(date, TZ, 'u')) % 7]; // 'u': 1 = lunes … 7 = domingo
  var month = MONTHS_ES[Number(Utilities.formatDate(date, TZ, 'M')) - 1];
  return weekday + ' ' + day + ' de ' + month + ' de ' + Utilities.formatDate(date, TZ, 'yyyy');
}

// ---------------------------------------------------------------------------------------------
// Plantilla de partida (ejecutar una vez desde el editor y copiar el id al script)
// ---------------------------------------------------------------------------------------------

/** Crea en DRIVE_FOLDER_ID un Doc con todos los marcadores. Rediséñalo (logo, colores) y usa su id como TEMPLATE_DOC_ID. */
function createTemplateDoc() {
  var doc = DocumentApp.create('Plantilla de códigos - Open Day');
  var body = doc.getBody();
  body.setMarginTop(40).setMarginBottom(40).setMarginLeft(50).setMarginRight(50);

  var title = body.getChild(0).asParagraph().setText('{{evento}}');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{fecha_evento}} · {{lugar}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('PASE DE ACCESO').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{nombre}}').setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{rol}} {{parentesco}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{documento}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{colegio}} · Inscripción {{codigo_inscripcion}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Puerta de ingreso: {{puerta}} · Hora de llegada: {{hora_llegada}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Recorridos').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendTable([
    ['Facultad', 'Horario', 'Punto de encuentro'],
    ['{{recorrido_facultad}}', '{{recorrido_horario}}', '{{recorrido_punto}}']
  ]).getRow(0).editAsText().setBold(true);
  body.appendParagraph('{{qr}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{barcode}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('{{codigo}}').setAlignment(DocumentApp.HorizontalAlignment.CENTER).editAsText().setBold(true).setFontSize(16);
  body.appendParagraph('Presenta este código (impreso o en el celular) junto con tu documento de identidad. Pase {{numero}} de {{total}}.')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER).editAsText().setFontSize(9);
  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  file.moveTo(DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')));
  Logger.log('Plantilla creada: ' + file.getUrl());
  Logger.log('Guarda este id en la propiedad del script TEMPLATE_DOC_ID: ' + doc.getId());
}
