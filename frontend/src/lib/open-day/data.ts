import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessPass,
  DocumentTemplate,
  LogisticsOption,
  OpenDayEvent,
  Registration,
  TourSession,
} from "./types";

/**
 * Lecturas del Open Day que sirven tanto en el servidor como en el navegador
 * (reciben el cliente de Supabase). Lo del dueño pasa por RLS: cada quien ve
 * solo sus inscripciones.
 */

const EVENT_COLUMNS =
  "id, name, event_date, venue, registration_open, registration_opens_at, registration_closes_at, docs_close_at, hold_minutes, reservation_hours, max_file_mb, students_per_chaperone, max_visitors_per_registration, max_adults_per_registration, travel_buffer_minutes";

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  registration_open: boolean;
  registration_opens_at: string;
  registration_closes_at: string;
  docs_close_at: string | null;
  hold_minutes: number;
  reservation_hours: number;
  max_file_mb: number;
  students_per_chaperone: number;
  max_visitors_per_registration: number | null;
  max_adults_per_registration: number | null;
  travel_buffer_minutes: number;
};

function mapEvent(row: EventRow): OpenDayEvent {
  return {
    id: row.id,
    name: row.name,
    eventDate: row.event_date,
    venue: row.venue,
    registrationOpen: row.registration_open,
    registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at,
    docsCloseAt: row.docs_close_at,
    holdMinutes: row.hold_minutes,
    reservationHours: row.reservation_hours,
    maxFileMb: row.max_file_mb,
    studentsPerChaperone: row.students_per_chaperone,
    maxVisitorsPerRegistration: row.max_visitors_per_registration,
    maxAdultsPerRegistration: row.max_adults_per_registration,
    travelBufferMinutes: row.travel_buffer_minutes,
  };
}

/** Si la inscripción del evento está abierta ahora mismo. */
export function isRegistrationOpen(event: OpenDayEvent, now = Date.now()) {
  return (
    event.registrationOpen &&
    now >= Date.parse(event.registrationOpensAt) &&
    now < Date.parse(event.registrationClosesAt)
  );
}

/** El próximo Open Day (el de fecha más cercana que aún no pasa). */
export async function fetchUpcomingEvent(
  supabase: SupabaseClient,
  today: string,
): Promise<OpenDayEvent | null> {
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();
  return data ? mapEvent(data) : null;
}

export async function fetchEvent(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle<EventRow>();
  return data ? mapEvent(data) : null;
}

export async function fetchLogisticsOptions(
  supabase: SupabaseClient,
): Promise<LogisticsOption[]> {
  const { data } = await supabase
    .from("logistics_options")
    .select("code, label")
    .eq("active", true)
    .order("label");
  return (data ?? []) as LogisticsOption[];
}

/** Plantillas activas; solo un usuario con sesión las puede leer. */
export async function fetchTemplates(
  supabase: SupabaseClient,
): Promise<DocumentTemplate[]> {
  const { data } = await supabase
    .from("document_templates")
    .select("kind, version, drive_file_id")
    .eq("active", true);
  return (data ?? []).map((row) => ({
    kind: row.kind,
    version: row.version,
    driveFileId: row.drive_file_id,
  }));
}

type AvailabilityRow = {
  session_id: string;
  event_id: string;
  faculty_id: string;
  faculty_name: string;
  tier: TourSession["tier"];
  starts_at: string;
  ends_at: string;
  meeting_point: string | null;
  capacity: number;
  seats_remaining: number;
  status: TourSession["status"];
};

export function mapSession(row: AvailabilityRow): TourSession {
  return {
    sessionId: row.session_id,
    eventId: row.event_id,
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    tier: row.tier,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    meetingPoint: row.meeting_point,
    capacity: row.capacity,
    seatsRemaining: row.seats_remaining,
    status: row.status,
  };
}

export async function fetchAvailability(
  supabase: SupabaseClient,
  eventId: string,
): Promise<TourSession[]> {
  const { data, error } = await supabase
    .from("v_tour_availability")
    .select(
      "session_id, event_id, faculty_id, faculty_name, tier, starts_at, ends_at, meeting_point, capacity, seats_remaining, status",
    )
    .eq("event_id", eventId)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AvailabilityRow[]).map(mapSession);
}

const REGISTRATION_SELECT = `
  id, event_id, reference_code, kind, status, expected_visitors, hold_renewals,
  docs_deadline, submitted_at, confirmed_at, gate, arrival_at, contact_name, contact_email, created_at,
  school:schools (id, name, district),
  enrollments:tour_enrollments (session_id, tier, seats, status, hold_expires_at),
  attendees:event_attendees (
    participant_id, attendee_role, relationship,
    participant:participants (doc_type, doc_number, first_name, last_name, birth_date, grade, email, phone)
  ),
  documents:registration_documents (id, kind, file_name, uploaded_at, observation, verified_at, superseded_at),
  logistics:registration_logistics (option_code, quantity, notes)
`;

type RegistrationRow = {
  id: string;
  event_id: string;
  reference_code: string;
  kind: Registration["kind"];
  status: Registration["status"];
  expected_visitors: number;
  hold_renewals: number;
  docs_deadline: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  gate: string | null;
  arrival_at: string | null;
  contact_name: string;
  contact_email: string;
  school: { id: string; name: string; district: string | null } | null;
  enrollments: {
    session_id: string;
    tier: Registration["enrollments"][number]["tier"];
    seats: number;
    status: Registration["enrollments"][number]["status"];
    hold_expires_at: string | null;
  }[];
  attendees: {
    participant_id: string;
    attendee_role: Registration["attendees"][number]["role"];
    relationship: string | null;
    participant: {
      doc_type: Registration["attendees"][number]["docType"];
      doc_number: string;
      first_name: string;
      last_name: string;
      birth_date: string;
      grade: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  }[];
  documents: {
    id: string;
    kind: Registration["documents"][number]["kind"];
    file_name: string;
    uploaded_at: string;
    observation: string | null;
    verified_at: string | null;
    superseded_at: string | null;
  }[];
  logistics: { option_code: string; quantity: number; notes: string | null }[];
};

function mapRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    eventId: row.event_id,
    referenceCode: row.reference_code,
    kind: row.kind,
    status: row.status,
    expectedVisitors: row.expected_visitors,
    holdRenewals: row.hold_renewals,
    docsDeadline: row.docs_deadline,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    gate: row.gate,
    arrivalAt: row.arrival_at,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    school: row.school,
    enrollments: row.enrollments
      .filter((e) => e.status !== "released")
      .map((e) => ({
        sessionId: e.session_id,
        tier: e.tier,
        seats: e.seats,
        status: e.status,
        holdExpiresAt: e.hold_expires_at,
      })),
    attendees: row.attendees
      .filter((a) => a.participant)
      .map((a) => ({
        participantId: a.participant_id,
        role: a.attendee_role,
        relationship: a.relationship,
        docType: a.participant?.doc_type ?? "dni",
        docNumber: a.participant?.doc_number ?? "",
        firstName: a.participant?.first_name ?? "",
        lastName: a.participant?.last_name ?? "",
        birthDate: a.participant?.birth_date ?? "",
        grade: a.participant?.grade ?? null,
        email: a.participant?.email ?? null,
        phone: a.participant?.phone ?? null,
      })),
    documents: row.documents
      .filter((d) => !d.superseded_at)
      .map((d) => ({
        id: d.id,
        kind: d.kind,
        fileName: d.file_name,
        uploadedAt: d.uploaded_at,
        observation: d.observation,
        verifiedAt: d.verified_at,
      })),
    logistics: row.logistics.map((l) => ({
      optionCode: l.option_code,
      quantity: l.quantity,
      notes: l.notes,
    })),
  };
}

export async function fetchRegistration(
  supabase: SupabaseClient,
  id: string,
): Promise<Registration | null> {
  const { data } = await supabase
    .from("event_registrations")
    .select(REGISTRATION_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapRegistration(data as unknown as RegistrationRow) : null;
}

export async function fetchMyRegistrations(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<Registration[]> {
  const { data } = await supabase
    .from("event_registrations")
    .select(REGISTRATION_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as RegistrationRow[]).map(mapRegistration);
}

/** Pases activos de las personas de una inscripción. */
export async function fetchPasses(
  supabase: SupabaseClient,
  registration: Registration,
): Promise<AccessPass[]> {
  const ids = registration.attendees.map((a) => a.participantId);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("event_passes")
    .select("id, access_code, status, participant_id")
    .eq("event_id", registration.eventId)
    .eq("status", "active")
    .in("participant_id", ids);
  return (data ?? []).map((row) => ({
    id: row.id,
    accessCode: row.access_code,
    status: row.status,
    participantId: row.participant_id,
  }));
}
