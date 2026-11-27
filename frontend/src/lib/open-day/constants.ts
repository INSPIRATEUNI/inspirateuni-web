import type { RelayColor } from "@/lib/relay";
import type {
  AttendeeRole,
  DocType,
  DocumentKind,
  RegistrationStatus,
  Tier,
} from "./types";

/** Versión del aviso de privacidad y la declaración que se acepta al enviar. */
export const TERMS_VERSION = "2026-4";

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
  school_consolidated: "Cartas del colegio (un solo PDF)",
  individual_consolidated: "Documentos firmados (un solo PDF)",
  presentation_letter: "Carta de presentación y autorización de delegación",
  minor_authorization: "Autorización de participación del menor",
  consent: "Autorización de uso de imagen",
  guardian_declaration: "Cuidado de instalaciones y bienes",
  commitment_letter: "Carta de compromiso",
  credentials: "Códigos de acceso",
};

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  draft: "En borrador",
  held: "Recorridos retenidos",
  reserved: "Recorridos reservados",
  submitted: "Enviada, en revisión",
  docs_observed: "Con observaciones",
  confirmed: "Confirmada",
  needs_reassignment: "Requiere elegir otro recorrido",
  expired: "Vencida",
  cancelled: "Cancelada",
};

/** Color de la etiqueta de cada estado. */
export const STATUS_TONES: Record<RegistrationStatus, RelayColor> = {
  draft: "orange",
  held: "orange",
  reserved: "blue",
  submitted: "blue",
  docs_observed: "magenta",
  confirmed: "green",
  needs_reassignment: "magenta",
  expired: "orange",
  cancelled: "orange",
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

/**
 * El PDF que se puede subir según el tipo de inscripción. Es opcional: los
 * documentos firmados se llevan impresos el día del evento en cualquier caso.
 */
export function uploadKind(kind: "school" | "individual") {
  return kind === "school"
    ? ("school_consolidated" as const)
    : ("individual_consolidated" as const);
}

/** Enlace de descarga directa de una plantilla compartida en Drive. */
export function driveDownloadUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}
