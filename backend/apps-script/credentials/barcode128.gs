/**
 * Código de barras Code 128 (juego B) como imagen PNG, sin dependencias.
 *
 * Apps Script no puede dibujar ni convertir SVG, así que el PNG se arma a mano: 8 bits de gris,
 * sin compresión (bloques "stored" de zlib). Para un código de 8 caracteres pesa unos 28 KB.
 * El contenido es solo el código de acceso (event_passes.access_code), igual que el QR.
 *
 * Los códigos de acceso usan el alfabeto Crockford (0-9 y A-Z sin I, L, O, U): todos caben en el
 * juego B (ASCII 32 a 126).
 */

// Anchos de barra/espacio de cada símbolo (valores 0 a 106; el 106 es la parada, de 13 módulos).
var CODE128_PATTERNS_ = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

/** Cadena de módulos ('1' barra, '0' espacio) de un texto en Code 128-B, con inicio, control y parada. */
function code128Modules_(text) {
  var values = [104]; // Start B
  var sum = 104;
  for (var i = 0; i < text.length; i++) {
    var value = text.charCodeAt(i) - 32;
    if (value < 0 || value > 94) throw new Error('Carácter no válido para Code 128-B: ' + text.charAt(i));
    values.push(value);
    sum += value * (i + 1);
  }
  values.push(sum % 103); // dígito de control
  values.push(106); // Stop

  var bits = '';
  values.forEach(function (value) {
    var pattern = CODE128_PATTERNS_[value];
    for (var k = 0; k < pattern.length; k++) {
      bits += (k % 2 === 0 ? '1' : '0').repeat(Number(pattern.charAt(k)));
    }
  });
  return bits;
}

/**
 * PNG del código de barras. opts: { scale: px por módulo (4), height: alto en px (48), quiet: módulos
 * de margen a cada lado (10, lo mínimo que piden los lectores) }.
 */
function code128Png_(text, opts) {
  opts = opts || {};
  var scale = opts.scale || 4;
  var height = opts.height || 48;
  var quiet = opts.quiet === undefined ? 10 : opts.quiet;

  var bits = code128Modules_(String(text));
  var width = (bits.length + quiet * 2) * scale;

  var row = [0]; // byte de filtro: ninguno
  var x;
  for (x = 0; x < width; x++) {
    var module = Math.floor(x / scale) - quiet;
    var bar = module >= 0 && module < bits.length && bits.charAt(module) === '1';
    row.push(bar ? 0 : 255);
  }
  var raw = [];
  for (var y = 0; y < height; y++) raw = raw.concat(row);

  var ihdr = [].concat(be32_(width), be32_(height), [8, 0, 0, 0, 0]); // 8 bits, escala de grises
  var bytes = [137, 80, 78, 71, 13, 10, 26, 10]
    .concat(pngChunk_('IHDR', ihdr))
    .concat(pngChunk_('IDAT', zlibStored_(raw)))
    .concat(pngChunk_('IEND', []));

  return Utilities.newBlob(signedBytes_(bytes), 'image/png', 'barcode_' + text + '.png');
}

function be32_(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function signedBytes_(bytes) {
  return bytes.map(function (b) { return b > 127 ? b - 256 : b; });
}

function pngChunk_(type, data) {
  var typeBytes = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
  var body = typeBytes.concat(data);
  return be32_(data.length).concat(body, be32_(crc32_(body)));
}

/** Flujo zlib sin compresión: cabecera, bloques "stored" de hasta 65535 bytes y Adler-32. */
function zlibStored_(data) {
  var out = [0x78, 0x01];
  var pos = 0;
  do {
    var len = Math.min(65535, data.length - pos);
    var last = pos + len >= data.length ? 1 : 0;
    out.push(last, len & 255, (len >>> 8) & 255, (~len) & 255, ((~len) >>> 8) & 255);
    for (var i = 0; i < len; i++) out.push(data[pos + i]);
    pos += len;
  } while (pos < data.length);

  var a = 1;
  var b = 0;
  for (var j = 0; j < data.length; j++) {
    a = (a + data[j]) % 65521;
    b = (b + a) % 65521;
  }
  return out.concat(be32_(((b << 16) | a) >>> 0));
}

var CRC_TABLE_ = null;

function crc32_(bytes) {
  if (!CRC_TABLE_) {
    CRC_TABLE_ = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE_[n] = c >>> 0;
    }
  }
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE_[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
