// Dónde se guardan los PDFs del Open Day.
//   drive    → Google Drive con cuenta de servicio (producción).
//   supabase → bucket privado `openday-documents` (respaldo para desarrollo local sin credenciales de Google).
// DOCUMENT_STORAGE elige dónde se SUBE (por defecto drive). Para LEER se decide por el id guardado:
// `supabase:<ruta>` está en Storage y cualquier otro valor es un id de Drive.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as drive from "./google.ts";

export const DOCUMENTS_BUCKET = "openday-documents";
const SUPABASE_PREFIX = "supabase:";

/** A quién pertenece un archivo; se verifica en `finalize` para que nadie registre archivos ajenos. */
export type Owner = { registration_id: string; kind: string; owner_id: string };

export type UploadTarget =
  | { provider: "drive"; upload_url: string }
  | { provider: "supabase"; bucket: string; path: string; token: string };

export type StoredFile = {
  /** Valor para `registration_documents.drive_file_id`. */
  storedId: string;
  name: string;
  mimeType: string;
  size: number;
  /** El archivo lo abrió nuestra sesión para esa inscripción, tipo y dueño. */
  owned: boolean;
};

export interface DocumentStore {
  createUpload(opts: {
    name: string;
    size: number;
    mimeType: string;
    origin: string | null;
    owner: Owner;
  }): Promise<UploadTarget>;
  /** Id que se guarda en la BD para el archivo que devolvió el navegador. */
  storedId(fileId: string): string;
  inspect(fileId: string, owner: Owner): Promise<StoredFile | null>;
  readHead(fileId: string, bytes: number): Promise<Uint8Array>;
  discard(fileId: string): Promise<void>;
  download(fileId: string): Promise<Response>;
}

const driveStore: DocumentStore = {
  async createUpload({ name, size, mimeType, origin, owner }) {
    const uploadUrl = await drive.createResumableSession({
      name,
      size,
      mimeType,
      folderId: drive.driveFolderId(),
      origin,
      appProperties: owner,
    });
    return { provider: "drive", upload_url: uploadUrl };
  },
  storedId: (fileId) => fileId,
  async inspect(fileId, owner) {
    const file = await drive.getFile(fileId);
    if (!file) return null;
    const props = file.appProperties ?? {};
    const owned =
      props.registration_id === owner.registration_id &&
      props.kind === owner.kind &&
      props.owner_id === owner.owner_id &&
      file.parents?.includes(drive.driveFolderId()) === true &&
      !file.trashed;
    return { storedId: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size ?? 0), owned };
  },
  readHead: (fileId, bytes) => drive.readHead(fileId, bytes),
  discard: (fileId) => drive.discard(fileId),
  download: (fileId) => drive.download(fileId),
};

function supabaseStore(admin: SupabaseClient): DocumentStore {
  const bucket = () => admin.storage.from(DOCUMENTS_BUCKET);
  const pathOf = (fileId: string) => (fileId.startsWith(SUPABASE_PREFIX) ? fileId.slice(SUPABASE_PREFIX.length) : fileId);
  const folderOf = (owner: Owner) => `${owner.registration_id}/${owner.kind}/${owner.owner_id}`;

  async function signedUrl(path: string): Promise<string> {
    const { data, error } = await bucket().createSignedUrl(path, 60);
    if (error || !data) throw new Error(`Storage no firmó la URL de ${path}: ${error?.message}`);
    return data.signedUrl;
  }

  return {
    async createUpload({ owner }) {
      // La ruta amarra el archivo a la inscripción, el tipo y el dueño (lo comprueba `inspect`)
      const path = `${folderOf(owner)}/${crypto.randomUUID()}.pdf`;
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw new Error(`Storage no abrió la subida: ${error?.message}`);
      return { provider: "supabase", bucket: DOCUMENTS_BUCKET, path: data.path, token: data.token };
    },
    storedId: (fileId) => `${SUPABASE_PREFIX}${pathOf(fileId)}`,
    async inspect(fileId, owner) {
      const path = pathOf(fileId);
      const folder = folderOf(owner);
      const name = path.slice(folder.length + 1);
      const owned = path.startsWith(`${folder}/`) && /^[0-9a-f-]{36}\.pdf$/.test(name);
      if (!owned) return { storedId: `${SUPABASE_PREFIX}${path}`, name: path, mimeType: "", size: 0, owned: false };

      const { data, error } = await bucket().list(folder, { search: name, limit: 5 });
      if (error) throw new Error(`Storage no listó ${folder}: ${error.message}`);
      const object = data?.find((item) => item.name === name);
      if (!object) return null;
      const metadata = (object.metadata ?? {}) as { size?: number; mimetype?: string };
      return {
        storedId: `${SUPABASE_PREFIX}${path}`,
        name,
        mimeType: metadata.mimetype ?? "",
        size: Number(metadata.size ?? 0),
        owned: true,
      };
    },
    async readHead(fileId, bytes) {
      const res = await fetch(await signedUrl(pathOf(fileId)), { headers: { Range: `bytes=0-${bytes - 1}` } });
      if (!res.ok || !res.body) throw new Error(`Storage no leyó el contenido (HTTP ${res.status})`);
      // Si el servidor ignora el Range, se leen solo los primeros fragmentos y se corta
      const reader = res.body.getReader();
      const head = new Uint8Array(bytes);
      let read = 0;
      while (read < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const take = Math.min(value.length, bytes - read);
        head.set(value.subarray(0, take), read);
        read += take;
      }
      await reader.cancel().catch(() => {});
      return head.slice(0, read);
    },
    async discard(fileId) {
      const { error } = await bucket().remove([pathOf(fileId)]);
      if (error) console.error("No se pudo borrar el archivo rechazado", fileId, error);
    },
    async download(fileId) {
      const res = await fetch(await signedUrl(pathOf(fileId)));
      if (!res.ok) throw new Error(`Storage no descargó el archivo (HTTP ${res.status})`);
      return res;
    },
  };
}

/** Almacén donde se suben los archivos nuevos (DOCUMENT_STORAGE). */
export function uploadStore(admin: SupabaseClient): DocumentStore {
  return Deno.env.get("DOCUMENT_STORAGE") === "supabase" ? supabaseStore(admin) : driveStore;
}

/** Almacén de un archivo ya registrado, según su id guardado. */
export function storeFor(storedId: string, admin: SupabaseClient): DocumentStore {
  return storedId.startsWith(SUPABASE_PREFIX) ? supabaseStore(admin) : driveStore;
}
