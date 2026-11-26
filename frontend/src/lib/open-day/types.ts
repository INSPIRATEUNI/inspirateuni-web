/** Tipos del Open Day, espejo de las tablas y vistas de `backend/supabase/schemas/07-12`. */

export type Tier = "high" | "mid" | "low";

export type RegistrationKind = "school" | "individual";

export type RegistrationStatus =
  | "draft"
  | "held"
  | "reserved"
  | "submitted"
  | "docs_observed"
  | "confirmed"
  | "needs_reassignment"
  | "expired"
  | "cancelled";

export type AttendeeRole = "visitor" | "chaperone" | "guardian";

export type DocType = "dni" | "ce" | "passport" | "other";

export type DocumentKind =
  | "school_consolidated"
  | "individual_consolidated"
  | "consent"
  | "guardian_declaration"
  | "commitment_letter";

/** Configuración pública del evento (anon la puede leer). */
export type OpenDayEvent = {
  id: string;
  name: string;
  eventDate: string;
  venue: string | null;
  registrationOpen: boolean;
  registrationOpensAt: string;
  registrationClosesAt: string;
  docsCloseAt: string | null;
  holdMinutes: number;
  reservationHours: number;
  maxFileMb: number;
  studentsPerChaperone: number;
  maxVisitorsPerRegistration: number | null;
  maxVisitorsIndividual: number;
  maxAdultsPerRegistration: number | null;
  travelBufferMinutes: number;
};

/** Fila de `v_tour_availability`. */
export type TourSession = {
  sessionId: string;
  eventId: string;
  facultyId: string;
  facultyName: string;
  tier: Tier;
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  capacity: number;
  seatsRemaining: number;
  status: "open" | "closed";
};

export type LogisticsOption = { code: string; label: string };

/** Plantillas que se descargan y se firman. */
export type TemplateKind = Exclude<
  DocumentKind,
  "school_consolidated" | "individual_consolidated"
>;

export type DocumentTemplate = {
  kind: TemplateKind;
  version: number;
  driveFileId: string;
};

export type Enrollment = {
  sessionId: string;
  tier: Tier;
  seats: number;
  status: "held" | "reserved" | "released";
  holdExpiresAt: string | null;
};

export type Attendee = {
  participantId: string;
  role: AttendeeRole;
  relationship: string | null;
  docType: DocType;
  docNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  grade: string | null;
  email: string | null;
  phone: string | null;
};

export type RegistrationDocument = {
  id: string;
  kind: DocumentKind | "credentials";
  fileName: string;
  uploadedAt: string;
  observation: string | null;
  verifiedAt: string | null;
};

export type RegistrationLogistics = {
  optionCode: string;
  quantity: number;
  notes: string | null;
};

/** Ficha de un colegio: un solo código por inscripción. */
export type GroupPass = {
  accessCode: string;
  checkedInAt: string | null;
};

export type AccessPass = {
  id: string;
  accessCode: string;
  status: "active" | "revoked";
  participantId: string;
};

/** Inscripción del dueño con todo lo que necesita el asistente. */
export type Registration = {
  id: string;
  eventId: string;
  referenceCode: string;
  kind: RegistrationKind;
  status: RegistrationStatus;
  expectedVisitors: number;
  holdRenewals: number;
  docsDeadline: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  gate: string | null;
  arrivalAt: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  reopenReason: string | null;
  /** Colegios: datos del representante (su nombre es `contactName`). */
  representativeRole: string | null;
  representativeDocType: DocType | null;
  representativeDocNumber: string | null;
  /** Si asiste, cuenta como tutor sin figurar en `attendees`. */
  representativeAttends: boolean;
  /** Cuándo el staff recibió los documentos firmados en físico. */
  docsReceivedAt: string | null;
  /** Cuándo y qué versión de las condiciones aceptó al enviar. */
  acceptedTermsAt: string | null;
  termsVersion: string | null;
  awaitingStaff: boolean;
  school: { id: string; name: string; district: string | null } | null;
  enrollments: Enrollment[];
  attendees: Attendee[];
  documents: RegistrationDocument[];
  logistics: RegistrationLogistics[];
};
