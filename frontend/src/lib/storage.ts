import {
  EVIDENCE_BUCKET,
  type EVIDENCE_TYPES,
  type EvidenceMeta,
} from "@/lib/intranet/evidence";
import { createClient } from "@/lib/supabase/client";

/**
 * Acceso a los archivos desde el navegador. Todo pasa por aquí para poder
 * cambiar el almacenamiento sin tocar los formularios.
 * - Evidencias de horas: hoy en Supabase Storage (la ruta del objeto se guarda
 *   en `submission_evidences.drive_file_id`); destino final: Drive.
 * - Documentos del Open Day: Google Drive vía la Edge Function `drive-upload`
 *   (en local puede usar Supabase Storage, ver `UploadTarget`).
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

/** Documentos que sube quien se inscribe (los `credentials` los genera el sistema). */
export type RegistrationDocumentKind =
  | "school_consolidated"
  | "consent"
  | "guardian_declaration"
  | "commitment_letter";

/** Error con el código estable que devuelve la Edge Function (`file_too_large`, `deadline_passed`...). */
export class StorageError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const DRIVE_FUNCTION = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/drive-upload`;
const PDF_TYPE = "application/pdf";
/** Múltiplo de 256 KiB, como exige Drive para los fragmentos de una subida reanudable. */
const CHUNK_SIZE = 8 * 1024 * 1024;
const CHUNK_RETRIES = 4;

async function callDriveFunction(body: Record<string, unknown>) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new StorageError("unauthorized", "Inicia sesión para continuar.");
  }

  let response: Response;
  try {
    response = await fetch(DRIVE_FUNCTION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StorageError(
      "network",
      "No pudimos conectar. Revisa tu conexión.",
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new StorageError(
      error?.code ?? "internal",
      error?.message ?? "No pudimos completar la operación.",
    );
  }
  return response;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ChunkResult =
  | { done: true; fileId: string }
  | { done: false; next: number };

/** Interpreta la respuesta de Drive a un fragmento (o a la consulta de estado). */
async function readUploadResponse(
  response: Response,
  fallbackNext: number,
): Promise<ChunkResult> {
  if (response.status === 200 || response.status === 201) {
    const file = await response.json();
    return { done: true, fileId: file.id };
  }
  if (response.status === 308) {
    // `Range: bytes=0-N` indica lo que Drive ya tiene; si el navegador no lo expone, se asume el fragmento completo
    const range = response.headers.get("Range");
    const last = range?.match(/bytes=0-(\d+)/)?.[1];
    return { done: false, next: last ? Number(last) + 1 : fallbackNext };
  }
  throw new Error(`HTTP ${response.status}`);
}

async function putChunk(
  url: string,
  file: File,
  start: number,
  signal?: AbortSignal,
): Promise<ChunkResult> {
  const end = Math.min(start + CHUNK_SIZE, file.size);
  let from = start;

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${from}-${end - 1}/${file.size}`,
        },
        body: file.slice(from, end),
        signal,
      });
      return await readUploadResponse(response, end);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt >= CHUNK_RETRIES) {
        throw new StorageError(
          "upload_failed",
          "Se interrumpió la subida. Inténtalo de nuevo.",
        );
      }
      await wait(1000 * 2 ** attempt);
      try {
        const status = await fetch(url, {
          method: "PUT",
          headers: { "Content-Range": `bytes */${file.size}` },
          signal,
        });
        const state = await readUploadResponse(status, from);
        if (state.done) return state;
        from = Math.min(state.next, end);
        if (from >= end) return { done: false, next: end };
      } catch {
        // sin respuesta: se reintenta el mismo fragmento
      }
    }
  }
}

export async function uploadRegistrationDocument(options: {
  file: File;
  registrationId: string;
  kind: RegistrationDocumentKind;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<{ documentId: string }> {
  const { file, registrationId, kind, onProgress, signal } = options;

  if (file.type !== PDF_TYPE) {
    throw new StorageError("invalid_type", "Solo se aceptan archivos PDF.");
  }
  if (file.size === 0) {
    throw new StorageError("empty_file", "El archivo está vacío.");
  }

  const session = await callDriveFunction({
    action: "create_session",
    registration_id: registrationId,
    kind,
    size: file.size,
    mime_type: PDF_TYPE,
  });
  const target = (await session.json()) as UploadTarget;
  const fileId =
    target.provider === "supabase"
      ? await uploadToStorage(target, file, onProgress, signal)
      : await uploadToDrive(target.upload_url, file, onProgress, signal);

  const finalized = await callDriveFunction({
    action: "finalize",
    registration_id: registrationId,
    kind,
    file_id: fileId,
    file_name: file.name,
  });
  const { document_id: documentId } = await finalized.json();
  return { documentId };
}

/** Lo que devuelve `create_session`: Drive (producción) o Storage (respaldo local, DOCUMENT_STORAGE=supabase). */
type UploadTarget =
  | { provider?: "drive"; upload_url: string }
  | { provider: "supabase"; bucket: string; path: string; token: string };

/** Respaldo local: sube de una vez con el token firmado de un solo uso que emitió la función. */
async function uploadToStorage(
  target: { bucket: string; path: string; token: string },
  file: File,
  onProgress?: (sentBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  onProgress?.(0, file.size);
  const { error } = await createClient()
    .storage.from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: PDF_TYPE,
    });
  if (error) {
    throw new StorageError(
      "upload_failed",
      "Se interrumpió la subida. Inténtalo de nuevo.",
    );
  }
  signal?.throwIfAborted();
  onProgress?.(file.size, file.size);
  return target.path;
}

/** Subida reanudable a Drive por fragmentos; devuelve el id del archivo en Drive. */
async function uploadToDrive(
  uploadUrl: string,
  file: File,
  onProgress?: (sentBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
) {
  let offset = 0;
  let fileId: string | null = null;
  onProgress?.(0, file.size);
  while (!fileId) {
    const result = await putChunk(uploadUrl, file, offset, signal);
    if (result.done) {
      fileId = result.fileId;
      onProgress?.(file.size, file.size);
    } else {
      offset = result.next;
      onProgress?.(offset, file.size);
    }
  }
  return fileId;
}

export async function getRegistrationDocumentUrl(documentId: string) {
  const response = await callDriveFunction({
    action: "download",
    document_id: documentId,
  });
  return URL.createObjectURL(await response.blob());
}
