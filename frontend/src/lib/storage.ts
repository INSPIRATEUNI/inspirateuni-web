import {
  EVIDENCE_BUCKET,
  type EVIDENCE_TYPES,
  type EvidenceMeta,
} from "@/lib/intranet/evidence";
import { createClient } from "@/lib/supabase/client";

/**
 * Acceso a los archivos de evidencias desde el navegador. Todo pasa por aquí
 * para poder cambiar Supabase Storage por Google Drive (Edge Function) sin
 * tocar los formularios. La ruta del objeto se guarda en
 * `submission_evidences.drive_file_id`.
 */

/** Nombre apto para una ruta de Storage: sin tildes ni caracteres raros. */
function safeName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "archivo").slice(-80);
}

/** Sube una evidencia a `{userId}/{uuid}/{nombre}` y devuelve sus metadatos. */
export async function uploadEvidence(
  file: File,
  userId: string,
): Promise<EvidenceMeta> {
  const path = `${userId}/${crypto.randomUUID()}/${safeName(file.name)}`;
  const { error } = await createClient()
    .storage.from(EVIDENCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`No pudimos subir “${file.name}”.`);

  return {
    path,
    name: file.name,
    mimeType: file.type as (typeof EVIDENCE_TYPES)[number],
    size: file.size,
  };
}

/** Borra archivos ya subidos (por ejemplo, si el reporte no se pudo guardar). */
export async function removeEvidence(paths: string[]) {
  if (paths.length === 0) return;
  await createClient().storage.from(EVIDENCE_BUCKET).remove(paths);
}

/** URL firmada de corta duración para abrir una evidencia (por ejemplo, un director al revisar). */
export async function getEvidenceUrl(path: string) {
  const { data, error } = await createClient()
    .storage.from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data) throw new Error("No pudimos abrir el archivo.");
  return data.signedUrl;
}
