import type {
  AttendeeRole,
  DocType,
  DocumentKind,
  RegistrationStatus,
  Tier,
} from "./types";

/** Versión del aviso de privacidad y la declaración que se acepta al enviar. */
export const TERMS_VERSION = "2026-1";

export const OPEN_DAY_ROUTES = {
  selector: "/provov/open-day/inscripcion",
  schools: "/provov/open-day/inscripcion/colegios",
  individuals: "/provov/open-day/inscripcion/libres",
  mine: "/provov/open-day/inscripcion/mi-inscripcion",
  codes: "/provov/open-day/inscripcion/mi-inscripcion/codigos",
} as const;

export const AVAILABILITY_ENDPOINT = "/api/open-day/disponibilidad";

export const TIERS: Tier[] = ["high", "mid", "low"];

export const TIER_LABELS: Record<Tier, string> = {
  high: "Facultades más visitadas",
  mid: "Facultades intermedias",
  low: "Facultades por descubrir",
};

export const ROLE_LABELS: Record<AttendeeRole, string> = {
  visitor: "Visitante",
  chaperone: "Acompañante del colegio",
  guardian: "Adulto acompañante",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  dni: "DNI",
  ce: "Carné de extranjería",
  passport: "Pasaporte",
  other: "Otro",
};

export const DOCUMENT_LABELS: Record<DocumentKind | "credentials", string> = {
  school_consolidated: "Consolidado del colegio (un solo PDF)",
  consent: "Autorización de uso de datos",
  guardian_declaration: "Declaración del apoderado",
  commitment_letter: "Carta de compromiso",
  credentials: "Códigos de acceso",
};

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  draft: "En borrador",
  held: "Recorridos retenidos",
  reserved: "Recorridos reservados",
  submitted: "Enviada, en revisión",
  docs_observed: "Documentos observados",
  confirmed: "Confirmada",
  needs_reassignment: "Requiere elegir otro recorrido",
  expired: "Vencida",
  cancelled: "Cancelada",
};

/** Estados en los que todavía se puede continuar el trámite. */
export const ACTIVE_STATUSES: RegistrationStatus[] = [
  "draft",
  "held",
  "reserved",
  "submitted",
  "docs_observed",
  "confirmed",
  "needs_reassignment",
];

/** Documentos obligatorios según el tipo de inscripción y la edad del visitante. */
export function requiredDocuments(
  kind: "school" | "individual",
  minorVisitor: boolean,
): DocumentKind[] {
  if (kind === "school") return ["school_consolidated"];
  return minorVisitor
    ? ["consent", "commitment_letter", "guardian_declaration"]
    : ["consent", "commitment_letter"];
}

/** Enlace de descarga directa de una plantilla compartida en Drive. */
export function driveDownloadUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}
