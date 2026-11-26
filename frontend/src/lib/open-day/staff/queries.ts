import type { SupabaseClient } from "@supabase/supabase-js";
import { DOC_TYPE_LABELS, ROLE_LABELS } from "@/lib/open-day/constants";
import type {
  AttendeeRole,
  DocType,
  DocumentKind,
  RegistrationKind,
  RegistrationStatus,
  Tier,
} from "@/lib/open-day/types";

/**
 * Lecturas del backoffice. Todas usan la sesión del staff: la RLS deja a la
 * directiva leer todas las inscripciones (y nada de escritura directa).
 */

/** PostgREST corta en 1000 filas (`max_rows`); esto pide página tras página. */
export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < size) return rows;
  }
}

// Bandeja ----------------------------------------------------------------------------------------

export const INBOX_TABS = {
  "por-validar": { label: "Por validar", statuses: ["submitted"] },
  comentarios: {
    label: "Mensajes pendientes",
    statuses: [
      "draft",
      "held",
      "reserved",
      "submitted",
      "docs_observed",
      "confirmed",
      "needs_reassignment",
    ],
    commented: true,
  },
  reabiertas: {
    label: "Reabiertas",
    statuses: ["reserved"],
    reopened: true,
  },
  observadas: { label: "Observadas", statuses: ["docs_observed"] },
  confirmadas: { label: "Confirmadas", statuses: ["confirmed"] },
  "por-recibir": {
    label: "Documentos por recibir",
    statuses: ["confirmed"],
    docsPending: true,
  },
  "en-curso": {
    label: "En curso",
    statuses: ["draft", "held", "reserved"],
    reopened: false,
  },
  reasignar: { label: "Por reasignar", statuses: ["needs_reassignment"] },
  cerradas: {
    label: "Canceladas y vencidas",
    statuses: ["cancelled", "expired"],
  },
} satisfies Record<
  string,
  {
    label: string;
    statuses: RegistrationStatus[];
    /** true: solo reabiertas por un admin; false: sin las reabiertas. */
    reopened?: boolean;
    /** true: solo las que aún no entregaron los documentos en físico. */
    docsPending?: boolean;
    /** true: solo las que esperan respuesta del staff en el chat. */
    commented?: boolean;
  }
>;

export type InboxTab = keyof typeof INBOX_TABS;

export function isInboxTab(value: unknown): value is InboxTab {
  return typeof value === "string" && value in INBOX_TABS;
}

export type InboxRow = {
  id: string;
  referenceCode: string;
  kind: RegistrationKind;
  status: RegistrationStatus;
  expectedVisitors: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  awaitingStaff: boolean;
  schoolName: string | null;
  submittedAt: string | null;
  docsDeadline: string | null;
  createdAt: string;
};

type InboxDbRow = {
  id: string;
  reference_code: string;
  kind: RegistrationKind;
  status: RegistrationStatus;
  expected_visitors: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  awaiting_staff: boolean;
  submitted_at: string | null;
  docs_deadline: string | null;
  created_at: string;
  school: { name: string } | null;
};

export const INBOX_PAGE_SIZE = 25;

/** Quita lo que rompe un filtro `or` de PostgREST. */
function safeTerm(value: string) {
  return value
    .replace(/[%,()*\\"]/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Patrón ILIKE que tolera tildes y la ñ (`ilike` no las ignora): vocales y n valen por
 * cualquier letra. Así «sofia» encuentra «Sofía» y «nunez» a «Núñez».
 */
function accentTolerantLike(term: string) {
  return `%${term.replace(/[aeiounáéíóúüñ]/gi, "_")}%`;
}

export async function fetchInbox(
  supabase: SupabaseClient,
  options: {
    eventId: string;
    tab: InboxTab;
    kind: RegistrationKind | null;
    query: string;
    page: number;
  },
) {
  const { eventId, tab, kind, page } = options;
  const term = safeTerm(options.query);

  let request = supabase
    .from("event_registrations")
    .select(
      "id, reference_code, kind, status, expected_visitors, contact_name, contact_email, contact_phone, awaiting_staff, submitted_at, docs_deadline, created_at, school:schools(name)",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .in("status", INBOX_TABS[tab].statuses);
  const reopened = (INBOX_TABS[tab] as { reopened?: boolean }).reopened;
  if (reopened === true) request = request.not("reopen_reason", "is", null);
  if (reopened === false) request = request.is("reopen_reason", null);
  if ((INBOX_TABS[tab] as { commented?: boolean }).commented)
    request = request.eq("awaiting_staff", true);
  if ((INBOX_TABS[tab] as { docsPending?: boolean }).docsPending)
    request = request.is("docs_received_at", null);
  if (kind) request = request.eq("kind", kind);

  if (term) {
    const like = `%${term}%`;
    const tolerant = accentTolerantLike(term);
    const { data: schools } = await supabase
      .from("schools")
      .select("id")
      .ilike("name", tolerant)
      .limit(50);
    const filters = [
      `reference_code.ilike.${like}`,
      `contact_name.ilike.${tolerant}`,
      `contact_email.ilike.${like}`,
    ];
    const schoolIds = (schools ?? []).map((s) => s.id);
    if (schoolIds.length > 0)
      filters.push(`school_id.in.(${schoolIds.join(",")})`);
    request = request.or(filters.join(","));
  }

  // Lo que espera validación se atiende por orden de llegada
  request =
    tab === "por-validar"
      ? request.order("submitted_at", { ascending: true })
      : tab === "observadas" || tab === "reabiertas"
        ? request.order("docs_deadline", { ascending: true })
        : request.order("created_at", { ascending: false });

  const from = (page - 1) * INBOX_PAGE_SIZE;
  const { data, count, error } = await request.range(
    from,
    from + INBOX_PAGE_SIZE - 1,
  );
  if (error) throw new Error(error.message);

  const rows: InboxRow[] = ((data ?? []) as unknown as InboxDbRow[]).map(
    (row) => ({
      id: row.id,
      referenceCode: row.reference_code,
      kind: row.kind,
      status: row.status,
      expectedVisitors: row.expected_visitors,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      awaitingStaff: row.awaiting_staff,
      schoolName: row.school?.name ?? null,
      submittedAt: row.submitted_at,
      docsDeadline: row.docs_deadline,
      createdAt: row.created_at,
    }),
  );
  return { rows, total: count ?? 0 };
}

/** Cuántas inscripciones hay por estado (para las pestañas y el resumen). */
export async function fetchStatusCounts(
  supabase: SupabaseClient,
  eventId: string,
) {
  const rows = await fetchAllRows<{
    status: RegistrationStatus;
    expected_visitors: number;
    reopen_reason: string | null;
    awaiting_staff: boolean;
    docs_received_at: string | null;
  }>((from, to) =>
    supabase
      .from("event_registrations")
      .select(
        "status, expected_visitors, reopen_reason, awaiting_staff, docs_received_at",
      )
      .eq("event_id", eventId)
      .range(from, to),
  );
  const counts = {} as Record<RegistrationStatus, number>;
  const visitors = {} as Record<RegistrationStatus, number>;
  let reopened = 0;
  let commented = 0;
  let docsPending = 0;
  for (const row of rows) {
    if (row.status === "confirmed" && !row.docs_received_at) docsPending += 1;
    if (
      row.awaiting_staff &&
      row.status !== "cancelled" &&
      row.status !== "expired"
    )
      commented += 1;
    if (row.status === "reserved" && row.reopen_reason) reopened += 1;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    visitors[row.status] = (visitors[row.status] ?? 0) + row.expected_visitors;
  }
  return {
    counts,
    visitors,
    reopened,
    commented,
    docsPending,
    total: rows.length,
  };
}

// Detalle ----------------------------------------------------------------------------------------

export type StaffDocument = {
  id: string;
  kind: DocumentKind | "credentials";
  fileName: string;
  sizeBytes: number | null;
  uploadedAt: string;
  observation: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  supersededAt: string | null;
};

export type StaffEnrollment = {
  id: string;
  tier: Tier;
  seats: number;
  status: "held" | "reserved" | "released";
  startsAt: string;
  endsAt: string;
  meetingPoint: string | null;
  facultyName: string;
};

export type StaffPass = {
  participantId: string;
  accessCode: string;
  status: "active" | "revoked";
  checkedInAt: string | null;
};

export type TimelineEntry = {
  id: string;
  eventType: string;
  fromStatus: RegistrationStatus | null;
  toStatus: RegistrationStatus | null;
  reason: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
};

export async function fetchRegistrationExtras(
  supabase: SupabaseClient,
  registrationId: string,
  eventId: string,
  participantIds: string[],
) {
  const [documents, enrollments, passes, events, logistics, groupPass] =
    await Promise.all([
      supabase
        .from("registration_documents")
        .select(
          "id, kind, file_name, size_bytes, uploaded_at, observation, verified_at, verified_by, superseded_at",
        )
        .eq("registration_id", registrationId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("tour_enrollments")
        .select(
          "id, tier, seats, status, session:tour_sessions(starts_at, ends_at, meeting_point, event_faculty:event_faculties(faculty:faculties(name)))",
        )
        .eq("registration_id", registrationId)
        .neq("status", "released"),
      participantIds.length > 0
        ? supabase
            .from("event_passes")
            .select("participant_id, access_code, status, checked_in_at")
            .eq("event_id", eventId)
            .in("participant_id", participantIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("registration_events")
        .select(
          "id, actor_id, event_type, from_status, to_status, reason, detail, created_at",
        )
        .eq("registration_id", registrationId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("logistics_options").select("code, label"),
      supabase
        .from("registration_passes")
        .select("access_code, status, checked_in_at")
        .eq("registration_id", registrationId)
        .maybeSingle<{
          access_code: string;
          status: StaffPass["status"];
          checked_in_at: string | null;
        }>(),
    ]);

  const eventRows = (events.data ?? []) as {
    id: string;
    actor_id: string | null;
    event_type: string;
    from_status: RegistrationStatus | null;
    to_status: RegistrationStatus | null;
    reason: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
  }[];
  const docRows = (documents.data ?? []) as {
    id: string;
    kind: StaffDocument["kind"];
    file_name: string;
    size_bytes: number | null;
    uploaded_at: string;
    observation: string | null;
    verified_at: string | null;
    verified_by: string | null;
    superseded_at: string | null;
  }[];

  // registration_events.actor_id apunta a auth.users: los nombres salen de profiles
  const actorIds = [
    ...new Set(
      [
        ...eventRows.map((e) => e.actor_id),
        ...docRows.map((d) => d.verified_by),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", actorIds);
    for (const p of data ?? []) {
      // Quien se inscribe por OTP no tiene nombre en profiles: se muestra su correo
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      names.set(p.id, name || p.email || "Sin nombre");
    }
  }

  type EnrollmentRow = {
    id: string;
    tier: Tier;
    seats: number;
    status: StaffEnrollment["status"];
    session: {
      starts_at: string;
      ends_at: string;
      meeting_point: string | null;
      event_faculty: { faculty: { name: string } | null } | null;
    } | null;
  };

  return {
    documents: docRows.map(
      (d): StaffDocument => ({
        id: d.id,
        kind: d.kind,
        fileName: d.file_name,
        sizeBytes: d.size_bytes,
        uploadedAt: d.uploaded_at,
        observation: d.observation,
        verifiedAt: d.verified_at,
        verifiedBy: d.verified_by ? (names.get(d.verified_by) ?? null) : null,
        supersededAt: d.superseded_at,
      }),
    ),
    enrollments: ((enrollments.data ?? []) as unknown as EnrollmentRow[])
      .map(
        (e): StaffEnrollment => ({
          id: e.id,
          tier: e.tier,
          seats: e.seats,
          status: e.status,
          startsAt: e.session?.starts_at ?? "",
          endsAt: e.session?.ends_at ?? "",
          meetingPoint: e.session?.meeting_point ?? null,
          facultyName: e.session?.event_faculty?.faculty?.name ?? "Facultad",
        }),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    passes: (
      (passes.data ?? []) as {
        participant_id: string;
        access_code: string;
        status: StaffPass["status"];
        checked_in_at: string | null;
      }[]
    ).map(
      (p): StaffPass => ({
        participantId: p.participant_id,
        accessCode: p.access_code,
        status: p.status,
        checkedInAt: p.checked_in_at,
      }),
    ),
    groupPass: groupPass.data
      ? {
          accessCode: groupPass.data.access_code,
          status: groupPass.data.status,
          checkedInAt: groupPass.data.checked_in_at,
        }
      : null,
    timeline: eventRows.map(
      (e): TimelineEntry => ({
        id: e.id,
        eventType: e.event_type,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        reason: e.reason,
        detail: e.detail,
        createdAt: e.created_at,
        actorName: e.actor_id
          ? (names.get(e.actor_id) ?? "Sistema")
          : "Sistema",
      }),
    ),
    logisticsLabels: Object.fromEntries(
      ((logistics.data ?? []) as { code: string; label: string }[]).map((o) => [
        o.code,
        o.label,
      ]),
    ) as Record<string, string>,
  };
}

/** Puertas ya usadas en el evento (sugerencias al confirmar). */
export async function fetchUsedGates(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { data } = await supabase
    .from("event_registrations")
    .select("gate")
    .eq("event_id", eventId)
    .not("gate", "is", null)
    .limit(1000);
  return [...new Set((data ?? []).map((r) => r.gate as string))].sort();
}

// Sesiones ---------------------------------------------------------------------------------------

export type StaffSession = {
  id: string;
  facultyName: string;
  tier: Tier;
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsTaken: number;
  meetingPoint: string | null;
  status: "open" | "closed" | "cancelled";
};

export async function fetchSessions(supabase: SupabaseClient, eventId: string) {
  const rows = await fetchAllRows<{
    id: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    seats_taken: number;
    meeting_point: string | null;
    status: StaffSession["status"];
    event_faculty: { tier: Tier; faculty: { name: string } | null } | null;
  }>((from, to) =>
    supabase
      .from("tour_sessions")
      .select(
        "id, starts_at, ends_at, capacity, seats_taken, meeting_point, status, event_faculty:event_faculties!inner(event_id, tier, faculty:faculties(name))",
      )
      .eq("event_faculty.event_id", eventId)
      .order("starts_at")
      .range(from, to),
  );
  return rows
    .map(
      (row): StaffSession => ({
        id: row.id,
        facultyName: row.event_faculty?.faculty?.name ?? "Facultad",
        tier: row.event_faculty?.tier ?? "mid",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        capacity: row.capacity,
        seatsTaken: row.seats_taken,
        meetingPoint: row.meeting_point,
        status: row.status,
      }),
    )
    .sort(
      (a, b) =>
        a.facultyName.localeCompare(b.facultyName, "es") ||
        a.startsAt.localeCompare(b.startsAt),
    );
}

export type StaffEventFaculty = {
  id: string;
  facultyId: string;
  name: string;
  tier: Tier;
};

export async function fetchEventFaculties(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { data } = await supabase
    .from("event_faculties")
    .select("id, faculty_id, tier, faculty:faculties(name)")
    .eq("event_id", eventId);
  return (
    (data ?? []) as unknown as {
      id: string;
      faculty_id: string;
      tier: Tier;
      faculty: { name: string } | null;
    }[]
  )
    .map(
      (row): StaffEventFaculty => ({
        id: row.id,
        facultyId: row.faculty_id,
        name: row.faculty?.name ?? "Facultad",
        tier: row.tier,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// Exportaciones ----------------------------------------------------------------------------------

export type ExportPerson = {
  firstName: string;
  lastName: string;
  docType: DocType | null;
  docNumber: string;
  roleLabel: string;
  accessCode: string | null;
  checkedInAt: string | null;
};

export type ExportRegistration = {
  id: string;
  referenceCode: string;
  kind: RegistrationKind;
  gate: string | null;
  arrivalAt: string | null;
  contactName: string;
  contactEmail: string;
  schoolName: string | null;
  /** Escolares declarados de un colegio (no figuran en `people`). */
  students: number;
  people: ExportPerson[];
};

/**
 * Inscripciones confirmadas con sus personas y códigos (lista por puerta). De un
 * colegio salen el representante y los tutores, todos con el código del colegio.
 */
export async function fetchConfirmedRegistrations(
  supabase: SupabaseClient,
  eventId: string,
) {
  type PassRow = {
    access_code: string;
    status: string;
    checked_in_at: string | null;
  };
  const rows = await fetchAllRows<{
    id: string;
    reference_code: string;
    kind: RegistrationKind;
    gate: string | null;
    arrival_at: string | null;
    contact_name: string;
    contact_email: string;
    expected_visitors: number;
    representative_doc_type: DocType | null;
    representative_doc_number: string | null;
    representative_attends: boolean;
    school: { name: string } | null;
    group_pass: PassRow | PassRow[] | null;
    attendees: {
      attendee_role: AttendeeRole;
      participant: {
        doc_type: DocType;
        doc_number: string;
        first_name: string;
        last_name: string;
      } | null;
      pass: PassRow | null;
    }[];
  }>((from, to) =>
    supabase
      .from("event_registrations")
      .select(
        "id, reference_code, kind, gate, arrival_at, contact_name, contact_email, expected_visitors, representative_doc_type, representative_doc_number, representative_attends, school:schools(name), group_pass:registration_passes(access_code, status, checked_in_at), attendees:event_attendees(attendee_role, participant:participants(doc_type, doc_number, first_name, last_name), pass:event_passes(access_code, status, checked_in_at))",
      )
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .order("arrival_at", { ascending: true })
      .range(from, to),
  );
  return rows.map((row): ExportRegistration => {
    const isSchool = row.kind === "school";
    const group = Array.isArray(row.group_pass)
      ? row.group_pass[0]
      : row.group_pass;
    const codeOf = (pass: PassRow | null | undefined) =>
      pass?.status === "active" ? pass.access_code : null;
    const people = row.attendees
      .filter((a) => a.participant)
      // Los escolares registrados con el formato anterior ya no se listan
      .filter((a) => !isSchool || a.attendee_role === "chaperone")
      .map((a): ExportPerson => {
        const pass = isSchool ? group : a.pass;
        return {
          firstName: a.participant?.first_name ?? "",
          lastName: a.participant?.last_name ?? "",
          docType: a.participant?.doc_type ?? "dni",
          docNumber: a.participant?.doc_number ?? "",
          roleLabel: isSchool ? "Tutor" : ROLE_LABELS[a.attendee_role],
          accessCode: codeOf(pass),
          checkedInAt: pass?.checked_in_at ?? null,
        };
      })
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, "es") ||
          a.firstName.localeCompare(b.firstName, "es"),
      );
    if (isSchool) {
      people.unshift({
        firstName: row.contact_name,
        lastName: "",
        docType: row.representative_doc_type,
        docNumber: row.representative_doc_number ?? "",
        roleLabel: `Representante${row.representative_attends ? "" : " (no asiste)"} · ${row.expected_visitors} escolares`,
        accessCode: codeOf(group),
        checkedInAt: group?.checked_in_at ?? null,
      });
    }
    return {
      id: row.id,
      referenceCode: row.reference_code,
      kind: row.kind,
      gate: row.gate,
      arrivalAt: row.arrival_at,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      schoolName: row.school?.name ?? null,
      students: isSchool ? row.expected_visitors : 0,
      people,
    };
  });
}

export type SessionGroup = {
  referenceCode: string;
  kind: RegistrationKind;
  schoolName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  visitors: number;
  adults: number;
  seats: number;
};

/** Grupos confirmados por sesión (lista para el guía de cada facultad). */
export async function fetchSessionRoster(
  supabase: SupabaseClient,
  eventId: string,
) {
  const [sessions, enrollments] = await Promise.all([
    fetchSessions(supabase, eventId),
    fetchAllRows<{
      session_id: string;
      seats: number;
      registration: {
        reference_code: string;
        kind: RegistrationKind;
        status: RegistrationStatus;
        contact_name: string;
        contact_email: string;
        contact_phone: string | null;
        school: { name: string } | null;
        expected_visitors: number;
        representative_attends: boolean;
        attendees: { attendee_role: AttendeeRole }[];
      } | null;
    }>((from, to) =>
      supabase
        .from("tour_enrollments")
        .select(
          "session_id, seats, registration:event_registrations!inner(event_id, reference_code, kind, status, contact_name, contact_email, contact_phone, expected_visitors, representative_attends, school:schools(name), attendees:event_attendees(attendee_role))",
        )
        .eq("registration.event_id", eventId)
        .eq("registration.status", "confirmed")
        .neq("status", "released")
        .range(from, to),
    ),
  ]);

  const bySession = new Map<string, SessionGroup[]>();
  for (const e of enrollments) {
    if (!e.registration) continue;
    const isSchool = e.registration.kind === "school";
    const listedVisitors = e.registration.attendees.filter(
      (a) => a.attendee_role === "visitor",
    ).length;
    const visitors = isSchool
      ? e.registration.expected_visitors
      : listedVisitors;
    const adults =
      e.registration.attendees.length -
      listedVisitors +
      (isSchool && e.registration.representative_attends ? 1 : 0);
    const group: SessionGroup = {
      referenceCode: e.registration.reference_code,
      kind: e.registration.kind,
      schoolName: e.registration.school?.name ?? null,
      contactName: e.registration.contact_name,
      contactEmail: e.registration.contact_email,
      contactPhone: e.registration.contact_phone,
      visitors,
      adults,
      seats: e.seats,
    };
    bySession.set(e.session_id, [
      ...(bySession.get(e.session_id) ?? []),
      group,
    ]);
  }
  return sessions
    .filter((s) => s.status !== "cancelled")
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        a.facultyName.localeCompare(b.facultyName, "es"),
    )
    .map((session) => ({
      session,
      groups: (bySession.get(session.id) ?? []).sort((a, b) =>
        (a.schoolName ?? a.contactName).localeCompare(
          b.schoolName ?? b.contactName,
          "es",
        ),
      ),
    }));
}

export type LogisticsRow = {
  optionCode: string;
  optionLabel: string;
  quantity: number;
  notes: string | null;
  referenceCode: string;
  schoolName: string | null;
  contactName: string;
  gate: string | null;
  arrivalAt: string | null;
};

/** Buses, estacionamiento y demás opciones de las inscripciones confirmadas. */
export async function fetchLogistics(
  supabase: SupabaseClient,
  eventId: string,
) {
  const [rows, options] = await Promise.all([
    fetchAllRows<{
      option_code: string;
      quantity: number;
      notes: string | null;
      registration: {
        reference_code: string;
        contact_name: string;
        gate: string | null;
        arrival_at: string | null;
        school: { name: string } | null;
      } | null;
    }>((from, to) =>
      supabase
        .from("registration_logistics")
        .select(
          "option_code, quantity, notes, registration:event_registrations!inner(event_id, status, reference_code, contact_name, gate, arrival_at, school:schools(name))",
        )
        .eq("registration.event_id", eventId)
        .eq("registration.status", "confirmed")
        .range(from, to),
    ),
    supabase.from("logistics_options").select("code, label"),
  ]);
  const labels = new Map(
    ((options.data ?? []) as { code: string; label: string }[]).map((o) => [
      o.code,
      o.label,
    ]),
  );
  return rows
    .filter((r) => r.registration && r.quantity > 0)
    .map(
      (r): LogisticsRow => ({
        optionCode: r.option_code,
        optionLabel: labels.get(r.option_code) ?? r.option_code,
        quantity: r.quantity,
        notes: r.notes,
        referenceCode: r.registration?.reference_code ?? "",
        schoolName: r.registration?.school?.name ?? null,
        contactName: r.registration?.contact_name ?? "",
        gate: r.registration?.gate ?? null,
        arrivalAt: r.registration?.arrival_at ?? null,
      }),
    )
    .sort(
      (a, b) =>
        a.optionLabel.localeCompare(b.optionLabel, "es") ||
        (a.arrivalAt ?? "").localeCompare(b.arrivalAt ?? ""),
    );
}

// Check-in ---------------------------------------------------------------------------------------

export type CheckInCandidate = {
  accessCode: string;
  passStatus: "active" | "revoked";
  checkedInAt: string | null;
  title: string;
  subtitle: string;
  referenceCode: string | null;
  registrationStatus: RegistrationStatus | null;
};

const ACCESS_CODE = /^[0-9A-Z]{8}$/;

type GroupRow = {
  access_code: string;
  status: "active" | "revoked";
  checked_in_at: string | null;
  registration: {
    id: string;
    reference_code: string;
    status: RegistrationStatus;
    contact_name: string;
    expected_visitors: number;
    school: { name: string } | null;
  };
};

const GROUP_SELECT =
  "access_code, status, checked_in_at, registration:event_registrations!inner(id, event_id, reference_code, status, contact_name, expected_visitors, school:schools(name))";

function groupCandidate(row: GroupRow): CheckInCandidate {
  const reg = row.registration;
  return {
    accessCode: row.access_code,
    passStatus: row.status,
    checkedInAt: row.checked_in_at,
    title: reg.school?.name ?? reg.contact_name,
    subtitle: `Colegio · Representante: ${reg.contact_name} · ${reg.expected_visitors} escolares`,
    referenceCode: reg.reference_code,
    registrationStatus: reg.status,
  };
}

/** Fichas de colegio por código, colegio, representante, inscripción o tutor. */
async function searchGroupPasses(
  supabase: SupabaseClient,
  eventId: string,
  term: string,
  upper: string,
  matchedIds: string[],
): Promise<CheckInCandidate[]> {
  const tolerant = accentTolerantLike(term);
  const [{ data: schools }, { data: tutorOf }] = await Promise.all([
    supabase.from("schools").select("id").ilike("name", tolerant).limit(20),
    matchedIds.length > 0
      ? supabase
          .from("event_attendees")
          .select("registration_id")
          .eq("event_id", eventId)
          .eq("attendee_role", "chaperone")
          .in("participant_id", matchedIds)
      : Promise.resolve({ data: [] as { registration_id: string }[] }),
  ]);

  const filters = [
    `reference_code.ilike.%${term}%`,
    `contact_name.ilike.${tolerant}`,
    `representative_doc_number.ilike.${upper}%`,
  ];
  if (schools && schools.length > 0)
    filters.push(`school_id.in.(${schools.map((s) => s.id).join(",")})`);
  if (tutorOf && tutorOf.length > 0)
    filters.push(`id.in.(${tutorOf.map((t) => t.registration_id).join(",")})`);

  const [byCode, byData] = await Promise.all([
    ACCESS_CODE.test(upper)
      ? supabase
          .from("registration_passes")
          .select(GROUP_SELECT)
          .eq("registration.event_id", eventId)
          .eq("access_code", upper)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("registration_passes")
      .select(GROUP_SELECT)
      .eq("registration.event_id", eventId)
      .or(filters.join(","), { referencedTable: "registration" })
      .limit(20),
  ]);
  if (byCode.error) throw new Error(byCode.error.message);
  if (byData.error) throw new Error(byData.error.message);

  const rows = [
    ...((byCode.data ?? []) as unknown as GroupRow[]),
    ...((byData.data ?? []) as unknown as GroupRow[]),
  ];
  return [...new Map(rows.map((r) => [r.access_code, r])).values()].map(
    groupCandidate,
  );
}

/** Busca pases del evento por código, documento o nombre. */
export async function searchPasses(
  supabase: SupabaseClient,
  eventId: string,
  query: string,
): Promise<CheckInCandidate[]> {
  const term = safeTerm(query);
  if (term.length < 2) return [];

  const upper = term.toUpperCase().replace(/\s+/g, "");

  // Por documento o nombre: primero se buscan las personas. Cada palabra debe estar en
  // el nombre o el apellido; la BD filtra sin tildes y aquí se afina con el texto exacto.
  const words = term.split(/\s+/).filter(Boolean);
  const byName = words
    .map((word) => {
      const like = accentTolerantLike(word);
      return `or(first_name.ilike.${like},last_name.ilike.${like})`;
    })
    .join(",");
  const { data: people } = await supabase
    .from("participants")
    .select("id, first_name, last_name, doc_number")
    .or(`doc_number.ilike.${upper}%,and(${byName})`)
    .limit(200);
  const normalized = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matchedIds = (people ?? [])
    .filter((p) => {
      if (p.doc_number.toUpperCase().startsWith(upper)) return true;
      const full = normalized(`${p.first_name} ${p.last_name}`);
      return words.every((w) => full.includes(normalized(w)));
    })
    .map((p) => p.id)
    .slice(0, 50);

  const conditions: string[] = [];
  if (ACCESS_CODE.test(upper)) conditions.push(`access_code.eq.${upper}`);
  if (matchedIds.length > 0)
    conditions.push(`participant_id.in.(${matchedIds.join(",")})`);
  const groups = await searchGroupPasses(
    supabase,
    eventId,
    term,
    upper,
    matchedIds,
  );
  if (conditions.length === 0) return groups;

  const { data: passes, error } = await supabase
    .from("event_passes")
    .select(
      "id, access_code, status, checked_in_at, participant:participants(id, doc_type, doc_number, first_name, last_name)",
    )
    .eq("event_id", eventId)
    .or(conditions.join(","))
    .limit(20);
  if (error) throw new Error(error.message);

  const passRows = (passes ?? []) as unknown as {
    id: string;
    access_code: string;
    status: "active" | "revoked";
    checked_in_at: string | null;
    participant: {
      id: string;
      doc_type: DocType;
      doc_number: string;
      first_name: string;
      last_name: string;
    } | null;
  }[];
  if (passRows.length === 0) return groups;

  const { data: attendees } = await supabase
    .from("event_attendees")
    .select(
      "pass_id, attendee_role, registration:event_registrations(id, reference_code, status, gate, arrival_at, created_at, school:schools(name))",
    )
    .in(
      "pass_id",
      passRows.map((p) => p.id),
    );
  type AttendeeRow = {
    pass_id: string;
    attendee_role: AttendeeRole;
    registration: {
      id: string;
      reference_code: string;
      status: RegistrationStatus;
      gate: string | null;
      arrival_at: string | null;
      created_at: string;
      school: { name: string } | null;
    } | null;
  };
  // Si la persona estuvo en varias inscripciones, vale la confirmada (o la más reciente)
  const byPass = new Map<string, AttendeeRow>();
  for (const a of (attendees ?? []) as unknown as AttendeeRow[]) {
    const current = byPass.get(a.pass_id);
    const rank = (row?: AttendeeRow) =>
      !row?.registration
        ? -1
        : row.registration.status === "confirmed"
          ? 2
          : ["cancelled", "expired"].includes(row.registration.status)
            ? 0
            : 1;
    if (
      !current ||
      rank(a) > rank(current) ||
      (rank(a) === rank(current) &&
        (a.registration?.created_at ?? "") >
          (current.registration?.created_at ?? ""))
    ) {
      byPass.set(a.pass_id, a);
    }
  }

  const passCandidates = passRows.map((p): CheckInCandidate => {
    const attendee = byPass.get(p.id);
    const registration = attendee?.registration ?? null;
    return {
      accessCode: p.access_code,
      passStatus: p.status,
      checkedInAt: p.checked_in_at,
      title: `${p.participant?.first_name ?? ""} ${p.participant?.last_name ?? ""}`,
      subtitle: [
        `${DOC_TYPE_LABELS[p.participant?.doc_type ?? "dni"]} ${p.participant?.doc_number ?? ""}`,
        attendee && ROLE_LABELS[attendee.attendee_role],
        registration?.school?.name,
      ]
        .filter(Boolean)
        .join(" · "),
      referenceCode: registration?.reference_code ?? null,
      registrationStatus: registration?.status ?? null,
    };
  });
  return [...groups, ...passCandidates];
}

/** Ingresos registrados del evento: códigos de personas libres y de colegios. */
export async function fetchCheckInCount(
  supabase: SupabaseClient,
  eventId: string,
) {
  const people = () =>
    supabase
      .from("event_passes")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "active");
  const schools = () =>
    supabase
      .from("registration_passes")
      .select("id, registration:event_registrations!inner(event_id)", {
        count: "exact",
        head: true,
      })
      .eq("registration.event_id", eventId)
      .eq("status", "active");
  const results = await Promise.all([
    people().not("checked_in_at", "is", null),
    schools().not("checked_in_at", "is", null),
    people(),
    schools(),
  ]);
  const [inPeople, inSchools, allPeople, allSchools] = results.map(
    (r) => r.count ?? 0,
  );
  return {
    checkedIn: inPeople + inSchools,
    active: allPeople + allSchools,
  };
}
