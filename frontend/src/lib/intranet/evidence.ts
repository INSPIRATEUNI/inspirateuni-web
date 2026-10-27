/** Reglas de las evidencias de un reporte de horas; las usan cliente y servidor. */

export const EVIDENCE_BUCKET = "evidences";
export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_MB = 10;
export const MAX_EVIDENCE_BYTES = MAX_EVIDENCE_MB * 1024 * 1024;

export const EVIDENCE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

/** Valor del atributo `accept` del selector de archivos. */
export const EVIDENCE_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf";

/** Metadatos de una evidencia ya subida; `path` es la ruta del objeto en Storage. */
export type EvidenceMeta = {
  path: string;
  name: string;
  mimeType: (typeof EVIDENCE_TYPES)[number];
  size: number;
};

type FileLike = { name: string; size: number; type: string };

/** Devuelve el motivo por el que el archivo no sirve como evidencia, o null. */
export function evidenceFileError(file: FileLike) {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(file.type)) {
    return `“${file.name}” no es una imagen (PNG, JPG, WebP) ni un PDF.`;
  }
  if (file.size === 0) return `“${file.name}” está vacío.`;
  if (file.size > MAX_EVIDENCE_BYTES) {
    return `“${file.name}” pesa más de ${MAX_EVIDENCE_MB} MB.`;
  }
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
