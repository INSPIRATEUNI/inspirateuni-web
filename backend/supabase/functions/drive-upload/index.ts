// Documentos del Open Day en Google Drive.
//   create_session → abre una sesión de subida reanudable; el navegador sube directo a Google.
//   finalize       → verifica el archivo subido (dueño, tipo, tamaño y %PDF) y lo registra.
//   download       → sirve el PDF al staff (board/admin) en streaming; nunca se comparten enlaces de Drive.
// El navegador no recibe credenciales de Drive. Todo el acceso pasa por lib/storage.ts del frontend.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  createResumableSession,
  discard,
  download,
  driveFolderId,
  getFile,
  readHead,
} from "../_shared/google.ts";
import { corsHeaders, errorResponse, HttpError, json, validOrigin } from "../_shared/http.ts";

const PDF = "application/pdf";
const MAX_NAME = 150;

type UploadKind = "school_consolidated" | "consent" | "guardian_declaration" | "commitment_letter";

// Documentos que sube el dueño según el tipo de inscripción (igual que la RPC y submit_registration)
const KINDS_BY_REGISTRATION: Record<string, UploadKind[]> = {
  school: ["school_consolidated"],
  individual: ["consent", "commitment_letter", "guardian_declaration"],
};

type Registration = {
  id: string;
  kind: "school" | "individual";
  status: string;
  docs_deadline: string | null;
  reference_code: string;
  events: { max_file_mb: number } | null;
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Códigos de negocio de las RPC (HINT) → estado HTTP. */
function rpcError(error: { message: string; hint?: string | null }): HttpError {
  const code = error.hint ?? "internal";
  const status = code === "not_found" ? 404 : code === "internal" ? 500 : 409;
  return new HttpError(status, code, error.message);
}

async function authenticate(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new HttpError(401, "unauthorized", "Inicia sesión para continuar");

  const url = env("SUPABASE_URL");
  const user = createClient(url, env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Tu sesión no es válida");

  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  return { user, admin, userId: data.user.id };
}

/** Inscripción del usuario (la RLS devuelve vacío si es de otro) con las reglas para subir. */
async function loadOwnRegistration(user: SupabaseClient, registrationId: string, kind: UploadKind) {
  const { data, error } = await user
    .from("event_registrations")
    .select("id, kind, status, docs_deadline, reference_code, events(max_file_mb)")
    .eq("id", registrationId)
    .maybeSingle<Registration>();
  if (error) throw error;
  if (!data) throw new HttpError(404, "not_found", "No se encontró la inscripción");

  if (!KINDS_BY_REGISTRATION[data.kind].includes(kind)) {
    throw new HttpError(422, "invalid_kind", "Este tipo de documento no corresponde a la inscripción");
  }
  if (!["reserved", "docs_observed"].includes(data.status)) {
    throw new HttpError(409, "bad_state", "Ya no se pueden subir documentos a esta inscripción");
  }
  if (!data.docs_deadline || new Date(data.docs_deadline) <= new Date()) {
    throw new HttpError(409, "deadline_passed", "Venció el plazo para subir documentos");
  }
  return { ...data, maxBytes: (data.events?.max_file_mb ?? 20) * 1024 * 1024 };
}

function safeFileName(reference: string, kind: string): string {
  return `${reference}_${kind}_${Date.now()}.pdf`.slice(0, MAX_NAME);
}

function parseKind(value: unknown): UploadKind {
  const all = Object.values(KINDS_BY_REGISTRATION).flat();
  if (typeof value !== "string" || !all.includes(value as UploadKind)) {
    throw new HttpError(422, "invalid_kind", "Tipo de documento no válido");
  }
  return value as UploadKind;
}

function parseId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw new HttpError(422, "invalid_request", `Falta ${label}`);
  }
  return value;
}

async function createSession(req: Request, body: Record<string, unknown>) {
  const { user, userId } = await authenticate(req);
  const registrationId = parseId(body.registration_id, "la inscripción");
  const kind = parseKind(body.kind);
  const size = Number(body.size);
  if (body.mime_type !== PDF) throw new HttpError(422, "invalid_type", "Solo se aceptan archivos PDF");
  if (!Number.isInteger(size) || size <= 0) throw new HttpError(422, "invalid_request", "El tamaño no es válido");

  const registration = await loadOwnRegistration(user, registrationId, kind);
  if (size > registration.maxBytes) {
    throw new HttpError(
      413,
      "file_too_large",
      `El archivo supera el máximo de ${registration.maxBytes / 1024 / 1024} MB`,
    );
  }

  const uploadUrl = await createResumableSession({
    name: safeFileName(registration.reference_code, kind),
    size,
    mimeType: PDF,
    folderId: driveFolderId(),
    origin: validOrigin(req),
    appProperties: { registration_id: registration.id, kind, owner_id: userId },
  });
  return json(req, { upload_url: uploadUrl, max_bytes: registration.maxBytes });
}

async function finalize(req: Request, body: Record<string, unknown>) {
  const { user, admin, userId } = await authenticate(req);
  const registrationId = parseId(body.registration_id, "la inscripción");
  const kind = parseKind(body.kind);
  const fileId = parseId(body.file_id, "el archivo");

  // Reintento del mismo archivo: devuelve el registro existente (idempotente)
  const { data: existing } = await admin
    .from("registration_documents")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("drive_file_id", fileId)
    .maybeSingle();
  if (existing) return json(req, { document_id: existing.id });

  const registration = await loadOwnRegistration(user, registrationId, kind);

  const file = await getFile(fileId);
  if (!file) throw new HttpError(422, "file_missing", "No encontramos el archivo subido");

  // El archivo debe ser el que abrió nuestra sesión: misma inscripción, tipo, dueño y carpeta
  const props = file.appProperties ?? {};
  const mine =
    props.registration_id === registration.id &&
    props.kind === kind &&
    props.owner_id === userId &&
    file.parents?.includes(driveFolderId()) === true &&
    !file.trashed;
  if (!mine) throw new HttpError(403, "file_not_yours", "El archivo no corresponde a esta inscripción");

  const size = Number(file.size ?? 0);
  const problem = await checkPdf(file.id, file.mimeType, size, registration.maxBytes);
  if (problem) {
    await discard(file.id);
    throw problem;
  }

  const { data, error } = await admin.rpc("record_registration_document", {
    p_registration_id: registration.id,
    p_actor_id: userId,
    p_kind: kind,
    p_drive_file_id: file.id,
    p_file_name: String(body.file_name ?? file.name).slice(0, MAX_NAME),
    p_size_bytes: size,
  });
  if (error) {
    await discard(file.id);
    throw rpcError(error);
  }
  return json(req, { document_id: data });
}

async function checkPdf(fileId: string, mimeType: string, size: number, maxBytes: number): Promise<HttpError | null> {
  if (mimeType !== PDF) return new HttpError(422, "invalid_type", "Solo se aceptan archivos PDF");
  if (size <= 0) return new HttpError(422, "empty_file", "El archivo está vacío");
  if (size > maxBytes) {
    return new HttpError(413, "file_too_large", `El archivo supera el máximo de ${maxBytes / 1024 / 1024} MB`);
  }
  const head = new TextDecoder("latin1").decode(await readHead(fileId, 5));
  if (head !== "%PDF-") return new HttpError(422, "invalid_pdf", "El archivo no es un PDF válido");
  return null;
}

async function downloadDocument(req: Request, body: Record<string, unknown>) {
  const { user, admin, userId } = await authenticate(req);
  const documentId = parseId(body.document_id, "el documento");

  const { data: isBoard, error: roleError } = await user.rpc("is_board");
  if (roleError) throw roleError;
  if (isBoard !== true) throw new HttpError(403, "forbidden", "Solo la directiva puede ver los documentos");

  const { data: doc, error } = await admin
    .from("registration_documents")
    .select("id, registration_id, drive_file_id, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!doc) throw new HttpError(404, "not_found", "No se encontró el documento");

  // Son datos de menores: cada lectura queda en la bitácora
  await admin.from("registration_events").insert({
    registration_id: doc.registration_id,
    actor_id: userId,
    event_type: "document_viewed",
    detail: { document_id: doc.id },
  });

  const upstream = await download(doc.drive_file_id);
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders(req),
      "Content-Type": PDF,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Método no permitido");
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") throw new HttpError(400, "invalid_request", "Petición no válida");

    switch (body.action) {
      case "create_session":
        return await createSession(req, body);
      case "finalize":
        return await finalize(req, body);
      case "download":
        return await downloadDocument(req, body);
      default:
        throw new HttpError(400, "invalid_request", "Acción desconocida");
    }
  } catch (err) {
    return errorResponse(req, err);
  }
});
