import type { SupabaseClient } from "@supabase/supabase-js";
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
  observadas: { label: "Observadas", statuses: ["docs_observed"] },
  confirmadas: { label: "Confirmadas", statuses: ["confirmed"] },
  "en-curso": { label: "En curso", statuses: ["draft", "held", "reserved"] },
  reasignar: { label: "Por reasignar", statuses: ["needs_reassignment"] },
  cerradas: {
    label: "Canceladas y vencidas",
    statuses: ["cancelled", "expired"],
  },
} satisfies Record<string, { label: string; statuses: RegistrationStatus[] }>;

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
      "id, reference_code, kind, status, expected_visitors, contact_name, contact_email, submitted_at, docs_deadline, created_at, school:schools(name)",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .in("status", INBOX_TABS[tab].statuses);
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
      : tab === "observadas"
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
  }>((from, to) =>
    supabase
      .from("event_registrations")
      .select("status, expected_visitors")
      .eq("event_id", eventId)
      .range(from, to),
  );
  const counts = {} as Record<RegistrationStatus, number>;
  const visitors = {} as Record<RegistrationStatus, number>;
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    visitors[row.status] = (visitors[row.status] ?? 0) + row.expected_visitors;
  }
  return { counts, visitors, total: rows.length };
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
  const [documents, enrollments, passes, events, logistics] = await Promise.all(
    [
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
    ],
  );

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
  docType: DocType;
  docNumber: string;
  role: AttendeeRole;
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
  people: ExportPerson[];
};

/** Inscripciones confirmadas con sus personas y códigos (lista por puerta). */
export async function fetchConfirmedRegistrations(
  supabase: SupabaseClient,
  eventId: string,
) {
  const rows = await fetchAllRows<{
    id: string;
    reference_code: string;
    kind: RegistrationKind;
    gate: string | null;
    arrival_at: string | null;
    contact_name: string;
    contact_email: string;
    school: { name: string } | null;
    attendees: {
      attendee_role: AttendeeRole;
      participant: {
        doc_type: DocType;
        doc_number: string;
        first_name: string;
        last_name: string;
      } | null;
      pass: {
        access_code: string;
        status: string;
        checked_in_at: string | null;
      } | null;
    }[];
  }>((from, to) =>
    supabase
      .from("event_registrations")
      .select(
        "id, reference_code, kind, gate, arrival_at, contact_name, contact_email, school:schools(name), attendees:event_attendees(attendee_role, participant:participants(doc_type, doc_number, first_name, last_name), pass:event_passes(access_code, status, checked_in_at))",
      )
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .order("arrival_at", { ascending: true })
      .range(from, to),
  );
  return rows.map(
    (row): ExportRegistration => ({
      id: row.id,
      referenceCode: row.reference_code,
      kind: row.kind,
      gate: row.gate,
      arrivalAt: row.arrival_at,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      schoolName: row.school?.name ?? null,
      people: row.attendees
        .filter((a) => a.participant)
        .map((a) => ({
          firstName: a.participant?.first_name ?? "",
          lastName: a.participant?.last_name ?? "",
          docType: a.participant?.doc_type ?? "dni",
          docNumber: a.participant?.doc_number ?? "",
          role: a.attendee_role,
          accessCode: a.pass?.status === "active" ? a.pass.access_code : null,
          checkedInAt: a.pass?.checked_in_at ?? null,
        }))
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName, "es") ||
            a.firstName.localeCompare(b.firstName, "es"),
        ),
    }),
  );
}

export type SessionGroup = {
  referenceCode: string;
  kind: RegistrationKind;
  schoolName: string | null;
  contactName: string;
  contactEmail: string;
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
        school: { name: string } | null;
        attendees: { attendee_role: AttendeeRole }[];
      } | null;
    }>((from, to) =>
      supabase
        .from("tour_enrollments")
        .select(
          "session_id, seats, registration:event_registrations!inner(event_id, reference_code, kind, status, contact_name, contact_email, school:schools(name), attendees:event_attendees(attendee_role))",
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
    const visitors = e.registration.attendees.filter(
      (a) => a.attendee_role === "visitor",
    ).length;
    const group: SessionGroup = {
      referenceCode: e.registration.reference_code,
      kind: e.registration.kind,
      schoolName: e.registration.school?.name ?? null,
      contactName: e.registration.contact_name,
      contactEmail: e.registration.contact_email,
      visitors,
      adults: e.registration.attendees.length - visitors,
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
  firstName: string;
  lastName: string;
  docType: DocType;
  docNumber: string;
  role: AttendeeRole | null;
  registrationId: string | null;
  referenceCode: string | null;
  registrationStatus: RegistrationStatus | null;
  schoolName: string | null;
  gate: string | null;
  arrivalAt: string | null;
};

const ACCESS_CODE = /^[0-9A-Z]{8}$/;

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
  if (conditions.length === 0) return [];

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
  if (passRows.length === 0) return [];

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

  return passRows.map((p): CheckInCandidate => {
    const attendee = byPass.get(p.id);
    const registration = attendee?.registration ?? null;
    return {
      accessCode: p.access_code,
      passStatus: p.status,
      checkedInAt: p.checked_in_at,
      firstName: p.participant?.first_name ?? "",
      lastName: p.participant?.last_name ?? "",
      docType: p.participant?.doc_type ?? "dni",
      docNumber: p.participant?.doc_number ?? "",
      role: attendee?.attendee_role ?? null,
      registrationId: registration?.id ?? null,
      referenceCode: registration?.reference_code ?? null,
      registrationStatus: registration?.status ?? null,
      schoolName: registration?.school?.name ?? null,
      gate: registration?.gate ?? null,
      arrivalAt: registration?.arrival_at ?? null,
    };
  });
}

/** Ingresos registrados del evento. */
export async function fetchCheckInCount(
  supabase: SupabaseClient,
  eventId: string,
) {
  const [{ count: checkedIn }, { count: active }] = await Promise.all([
    supabase
      .from("event_passes")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "active")
      .not("checked_in_at", "is", null),
    supabase
      .from("event_passes")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "active"),
  ]);
  return { checkedIn: checkedIn ?? 0, active: active ?? 0 };
}
