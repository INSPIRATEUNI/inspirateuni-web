/**
 * Mensajes para los códigos estables que devuelven las RPC del Open Day
 * (`error.hint` con errcode P0001) y la Edge Function `drive-upload`.
 * Si la RPC trae un mensaje propio en español se usa ese; estos son el respaldo
 * y los textos de los casos que la interfaz trata de forma especial.
 */
const MESSAGES: Record<string, string> = {
  not_found:
    "No encontramos la inscripción. Vuelve a ingresar desde Mi inscripción.",
  bad_state:
    "La inscripción cambió de estado. Recarga la página para ver cómo va.",
  registration_closed: "La inscripción no está abierta en este momento.",
  too_many_drafts:
    "Ya tienes demasiadas inscripciones en curso con este correo. Continúa una desde Mi inscripción.",
  school_taken:
    "Tu colegio ya tiene una inscripción para este Open Day. Pide al responsable que te comparta el acceso.",
  session_not_found: "Ese recorrido ya no existe. Elige otro.",
  session_closed: "Ese recorrido ya no acepta inscripciones. Elige otro.",
  tier_taken: "Ya elegiste un recorrido de ese nivel. Suéltalo para cambiarlo.",
  overlap: "Ese recorrido se cruza con otro que ya elegiste.",
  no_capacity: "Ese recorrido ya no tiene cupo para todo tu grupo. Elige otro.",
  hold_expired:
    "Se acabó el tiempo y liberamos tus recorridos. Vuelve a elegirlos.",
  renew_used: "Ya usaste la única renovación del tiempo.",
  no_selection: "Elige al menos un recorrido.",
  sold_out: "Ya no quedan recorridos con cupo para tu grupo.",
  levels_incomplete: "Aún puedes elegir un recorrido en otro nivel.",
  docs_closed: "Ya pasó la fecha límite para completar la inscripción.",
  attendees_invalid: "Revisa la lista de personas.",
  attendee_conflict:
    "Una de las personas ya está inscrita en otra inscripción de este evento.",
  chaperones: "Faltan acompañantes del colegio.",
  docs_missing: "Faltan documentos por subir.",
  deadline_passed: "Venció el plazo para completar la inscripción.",
  docs_pending: "Aún hay documentos observados sin reemplazar.",
  invalid_option: "Una de las opciones de logística ya no está disponible.",
  invalid_input: "Revisa los datos que escribiste.",
  // drive-upload
  unauthorized: "Tu sesión venció. Vuelve a ingresar con tu correo.",
  invalid_kind: "Ese tipo de documento no corresponde a tu inscripción.",
  file_too_large: "El archivo supera el tamaño máximo permitido.",
  invalid_type: "Solo se aceptan archivos PDF.",
  invalid_pdf: "El archivo no parece un PDF válido.",
  empty_file: "El archivo está vacío.",
  network: "No pudimos conectar. Revisa tu conexión.",
  upload_failed: "Se interrumpió la subida. Inténtalo de nuevo.",
  file_missing: "No encontramos el archivo subido. Vuelve a subirlo.",
  file_not_yours:
    "El archivo no corresponde a esta inscripción. Vuelve a subirlo.",
  invalid_request: "No pudimos procesar la solicitud. Recarga la página.",
  storage_not_configured:
    "La subida de documentos aún no está configurada. Avísale al equipo de InspírateUNI.",
  storage_unavailable:
    "No pudimos conectar con el almacenamiento de documentos. Inténtalo en unos minutos.",
  internal: "Algo falló de nuestro lado. Inténtalo de nuevo en unos minutos.",
  // staff
  forbidden: "No tienes permiso para hacer esto.",
  reason_required: "Escribe el motivo.",
  not_confirmed: "La inscripción de esta persona no está confirmada.",
};

const FALLBACK = "No pudimos completar la operación. Inténtalo de nuevo.";

export type OpenDayError = { code: string; message: string };

type PostgrestLikeError = {
  code?: string;
  hint?: string | null;
  message?: string;
};

/** Traduce un error de Supabase (RPC o PostgREST) a un código y un mensaje para mostrar. */
export function toOpenDayError(error: PostgrestLikeError | null | undefined) {
  if (!error) return { code: "internal", message: FALLBACK };

  if (error.code === "P0001" && error.hint) {
    // Los mensajes de las RPC ya están en español y son más precisos (nombran niveles o cantidades)
    return {
      code: error.hint,
      message: error.message || MESSAGES[error.hint] || FALLBACK,
    };
  }
  if (error.code === "42501") {
    return { code: "unauthorized", message: MESSAGES.unauthorized };
  }
  if (error.code === "PGRST301" || error.code === "PGRST303") {
    return { code: "unauthorized", message: MESSAGES.unauthorized };
  }
  return { code: error.code ?? "internal", message: FALLBACK };
}

/** Mensaje para un código conocido (por ejemplo, de `StorageError`). */
export function messageFor(code: string, fallback?: string) {
  return MESSAGES[code] ?? fallback ?? FALLBACK;
}
