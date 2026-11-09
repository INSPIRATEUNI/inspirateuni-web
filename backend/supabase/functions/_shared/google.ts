// Cliente mínimo de Google Drive con cuenta de servicio (sin dependencias).
// La cuenta de servicio no tiene cuota propia: GOOGLE_DRIVE_FOLDER_ID debe estar en una unidad
// compartida (o usar delegación de dominio con GOOGLE_IMPERSONATE_USER). Ver spike 1.5.0.
// Los fallos se devuelven como HttpError con código estable: `storage_not_configured` si falta
// una variable y `storage_unavailable` si Google responde mal (el detalle queda en el log).
import { HttpError } from "./http.ts";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FILES_URI = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URI = "https://www.googleapis.com/upload/drive/v3/files";

type ServiceAccount = { client_email: string; private_key: string };

let cached: { token: string; expiresAt: number } | null = null;
let signingKey: CryptoKey | null = null;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`Falta la variable de entorno ${name} (ver supabase/functions/README.md)`);
    throw new HttpError(
      503,
      "storage_not_configured",
      "La subida de documentos aún no está configurada. Avísale al equipo de InspírateUNI.",
    );
  }
  return value;
}

/** Error de Google: se registra el detalle y el usuario recibe un mensaje estable. */
function upstream(detail: string): HttpError {
  console.error(detail);
  return new HttpError(
    502,
    "storage_unavailable",
    "No pudimos conectar con el almacenamiento de documentos. Inténtalo en unos minutos.",
  );
}

function serviceAccount(): ServiceAccount {
  try {
    return JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON")) as ServiceAccount;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw upstream("GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido (debe ir en una sola línea)");
  }
}

export function driveFolderId(): string {
  return env("GOOGLE_DRIVE_FOLDER_ID");
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function importKey(pem: string): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  signingKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return signingKey;
}

/** Token de acceso OAuth de la cuenta de servicio (se reutiliza hasta un minuto antes de vencer). */
export async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.token;

  const account = serviceAccount();
  const claims: Record<string, unknown> = {
    iss: account.client_email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600,
  };
  const impersonate = Deno.env.get("GOOGLE_IMPERSONATE_USER");
  if (impersonate) claims.sub = impersonate;

  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const key = await importKey(account.private_key);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw upstream(`Google no entregó el token (HTTP ${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: now + data.expires_in };
  return cached.token;
}

async function authHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await accessToken()}` };
}

/**
 * Abre una sesión de subida reanudable y devuelve su URL. El navegador sube directo a Google;
 * el Origin permite que esa subida cruce CORS. appProperties amarra el archivo a la inscripción
 * y al usuario, y es lo que verifica `finalize` (el navegador no puede cambiarlo).
 */
export async function createResumableSession(opts: {
  name: string;
  size: number;
  mimeType: string;
  folderId: string;
  origin: string | null;
  appProperties: Record<string, string>;
}): Promise<string> {
  const res = await fetch(`${UPLOAD_URI}?uploadType=resumable&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mimeType,
      "X-Upload-Content-Length": String(opts.size),
      ...(opts.origin ? { Origin: opts.origin } : {}),
    },
    body: JSON.stringify({
      name: opts.name,
      mimeType: opts.mimeType,
      parents: [opts.folderId],
      appProperties: opts.appProperties,
    }),
  });
  if (!res.ok) {
    throw upstream(`Drive no abrió la sesión de subida (HTTP ${res.status}): ${await res.text()}`);
  }
  const location = res.headers.get("location");
  if (!location) throw upstream("Drive no devolvió la URL de subida");
  return location;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
  appProperties?: Record<string, string>;
};

export async function getFile(fileId: string): Promise<DriveFile | null> {
  const fields = "id,name,mimeType,size,parents,trashed,appProperties";
  const res = await fetch(
    `${FILES_URI}/${encodeURIComponent(fileId)}?fields=${fields}&supportsAllDrives=true`,
    { headers: await authHeaders() },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw upstream(`Drive no leyó el archivo (HTTP ${res.status})`);
  return (await res.json()) as DriveFile;
}

/** Primeros bytes del archivo (para comprobar la firma %PDF). */
export async function readHead(fileId: string, bytes: number): Promise<Uint8Array> {
  const res = await fetch(`${FILES_URI}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { ...(await authHeaders()), Range: `bytes=0-${bytes - 1}` },
  });
  if (!res.ok && res.status !== 206) throw upstream(`Drive no leyó el contenido (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
}

/** Descarga completa como respuesta en streaming (no carga el PDF en memoria). */
export async function download(fileId: string): Promise<Response> {
  const res = await fetch(`${FILES_URI}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw upstream(`Drive no descargó el archivo (HTTP ${res.status})`);
  return res;
}

/** Borra un archivo rechazado. Nunca lanza: es una limpieza de mejor esfuerzo. */
export async function discard(fileId: string): Promise<void> {
  try {
    await fetch(`${FILES_URI}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
  } catch (err) {
    console.error("No se pudo borrar el archivo rechazado", fileId, err);
  }
}
