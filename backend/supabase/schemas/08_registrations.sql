create type public.registration_kind as enum ('school', 'individual');
create type public.registration_status as enum (
  'draft', 'held', 'reserved', 'submitted', 'docs_observed', 'confirmed',
  'needs_reassignment', 'expired', 'cancelled'
);
create type public.attendee_role as enum ('visitor', 'chaperone', 'guardian');
create type public.enrollment_status as enum ('held', 'reserved', 'released');
create type public.pass_status as enum ('active', 'revoked');
create type public.document_kind as enum (
  'school_consolidated', 'consent', 'guardian_declaration', 'commitment_letter', 'credentials'
);
create type public.email_status as enum ('pending', 'sent', 'failed');

-- Código aleatorio en base32 Crockford (sin I, L, O, U). Sin relación con ningún dato personal.
create function public.random_code(len integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
begin
  for i in 1 .. len loop
    result := result || substr(alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Inscripción: una unidad (colegio o persona libre), sin grupos --------------------------------

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  school_id uuid references public.schools (id) on delete restrict,
  owner_id uuid not null references auth.users (id) on delete restrict,
  reference_code text not null unique default ('OD-' || public.random_code(5)),
  kind public.registration_kind not null,
  status public.registration_status not null default 'draft',
  expected_visitors integer not null check (expected_visitors > 0),
  hold_renewals integer not null default 0 check (hold_renewals between 0 and 1),
  reserved_at timestamptz,
  docs_deadline timestamptz,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  gate text,
  arrival_at timestamptz,
  contact_name text not null,
  contact_email extensions.citext not null,
  accepted_terms_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  check ((kind = 'school') = (school_id is not null)),
  check (kind <> 'individual' or expected_visitors = 1)
);

create index event_registrations_event_id_idx on public.event_registrations (event_id);
create index event_registrations_owner_id_idx on public.event_registrations (owner_id);
create index event_registrations_school_id_idx on public.event_registrations (school_id);
create index event_registrations_status_idx on public.event_registrations (status);

-- Un colegio tiene una sola inscripción viva por evento
create unique index event_registrations_school_event_idx
  on public.event_registrations (event_id, school_id)
  where school_id is not null and status not in ('expired', 'cancelled');

comment on table public.event_registrations is 'Trámite de inscripción al Open Day (colegio o persona libre). El dueño no escribe directo: todo pasa por RPC.';
comment on column public.event_registrations.reference_code is 'Código corto para consultas con el staff (p. ej. OD-7K3F9). No es una credencial.';
comment on column public.event_registrations.expected_visitors is 'Visitantes declarados; es la cantidad de asientos que se reserva en cada recorrido.';
comment on column public.event_registrations.hold_renewals is 'El temporizador de elección se renueva una sola vez (0 o 1).';

-- Pases: uno por persona y por evento --------------------------------------------------------

create table public.event_passes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete restrict,
  access_code text not null unique default public.random_code(8)
    check (access_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  status public.pass_status not null default 'active',
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, participant_id)
);

create index event_passes_participant_id_idx on public.event_passes (participant_id);

comment on table public.event_passes is 'Un pase con código por persona y evento, aunque el adulto figure en varias inscripciones.';

-- Personas de una inscripción -----------------------------------------------------------------

create table public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete restrict,
  pass_id uuid references public.event_passes (id) on delete set null,
  event_id uuid not null references public.events (id) on delete restrict,
  attendee_role public.attendee_role not null,
  relationship text,
  created_at timestamptz not null default now(),
  unique (registration_id, participant_id)
);

create index event_attendees_participant_id_idx on public.event_attendees (participant_id);
create index event_attendees_pass_id_idx on public.event_attendees (pass_id);
create index event_attendees_event_id_idx on public.event_attendees (event_id);

-- Un visitante está en una sola inscripción por evento
create unique index event_attendees_visitor_event_idx
  on public.event_attendees (event_id, participant_id)
  where attendee_role = 'visitor';

-- Un acompañante del colegio pertenece a una sola inscripción por evento
create unique index event_attendees_chaperone_event_idx
  on public.event_attendees (event_id, participant_id)
  where attendee_role = 'chaperone';

comment on column public.event_attendees.event_id is 'Copia de event_registrations.event_id, la fija un trigger (permite los índices únicos por evento).';
comment on column public.event_attendees.relationship is 'Texto libre: profesor, madre, chofer del bus...';

-- Recorridos elegidos por una inscripción -----------------------------------------------------

create table public.tour_enrollments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  session_id uuid not null references public.tour_sessions (id) on delete restrict,
  tier public.tour_tier not null,
  time_range tstzrange not null,
  seats integer not null check (seats > 0),
  status public.enrollment_status not null default 'held',
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'held' or hold_expires_at is not null)
);

create index tour_enrollments_registration_id_idx on public.tour_enrollments (registration_id);
create index tour_enrollments_session_id_idx on public.tour_enrollments (session_id);
create index tour_enrollments_hold_expires_idx on public.tour_enrollments (hold_expires_at) where status = 'held';

-- Un recorrido por nivel (de ahí sale el máximo de 3)
create unique index tour_enrollments_registration_tier_idx
  on public.tour_enrollments (registration_id, tier)
  where status <> 'released';

-- Sin cruces de horario (time_range ya incluye el margen de traslado)
alter table public.tour_enrollments
  add constraint tour_enrollments_no_overlap
  exclude using gist (registration_id with =, time_range with &&)
  where (status <> 'released');

comment on column public.tour_enrollments.tier is 'Copia del nivel de la sesión en el evento (la fija un trigger).';
comment on column public.tour_enrollments.time_range is 'Copia de [starts_at, ends_at + travel_buffer_minutes) de la sesión (la fija un trigger).';
comment on column public.tour_enrollments.seats is 'Cantidad de visitantes; es lo que ocupa de seats_taken en la sesión.';

-- Documentos ----------------------------------------------------------------------------------

create table public.registration_documents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  kind public.document_kind not null,
  drive_file_id text not null,
  file_name text not null,
  size_bytes bigint check (size_bytes >= 0),
  template_version integer,
  uploaded_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  observation text,
  superseded_at timestamptz
);

create index registration_documents_registration_id_idx on public.registration_documents (registration_id, kind);
create index registration_documents_verified_by_idx on public.registration_documents (verified_by);

comment on table public.registration_documents is 'PDFs en Google Drive (drive_file_id). Un archivo reemplazado queda con superseded_at; no se borra.';

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  kind public.document_kind not null check (kind in ('consent', 'guardian_declaration', 'commitment_letter')),
  version integer not null check (version > 0),
  drive_file_id text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

-- Una sola versión activa por tipo de plantilla
create unique index document_templates_active_idx on public.document_templates (kind) where active;

-- Bitácora ------------------------------------------------------------------------------------

create table public.registration_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  from_status public.registration_status,
  to_status public.registration_status,
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index registration_events_registration_id_idx on public.registration_events (registration_id, created_at);
create index registration_events_actor_id_idx on public.registration_events (actor_id);

comment on table public.registration_events is 'Bitácora: transiciones, overrides (con motivo), conflictos de documento y observaciones. Quién, cuándo y de qué estado a cuál.';

-- Logística extensible ------------------------------------------------------------------------

create table public.logistics_options (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  active boolean not null default true
);

comment on table public.logistics_options is 'Catálogo de logística (hoy bus y parking). Añadir una opción es un INSERT, sin migración de schema.';

create table public.registration_logistics (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  option_code text not null references public.logistics_options (code) on delete restrict,
  quantity integer not null check (quantity > 0),
  notes text,
  unique (registration_id, option_code)
);

create index registration_logistics_option_code_idx on public.registration_logistics (option_code);

-- Cola de correos -----------------------------------------------------------------------------

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.event_registrations (id) on delete set null,
  to_email extensions.citext not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  dedupe_key text unique,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_outbox_registration_id_idx on public.email_outbox (registration_id);
create index email_outbox_pending_idx on public.email_outbox (scheduled_at) where status = 'pending';

comment on column public.email_outbox.dedupe_key is 'Clave de idempotencia: un mismo correo lógico no se encola dos veces.';

-- Triggers ------------------------------------------------------------------------------------

-- event_id desnormalizado, edad mínima de los adultos y coherencia del pase
create function public.event_attendees_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_kind public.registration_kind;
  v_event_date date;
  v_birth_date date;
  v_pass public.event_passes;
begin
  select r.event_id, r.kind into v_event_id, v_kind
  from public.event_registrations r where r.id = new.registration_id;

  new.event_id := v_event_id;

  if new.attendee_role in ('chaperone', 'guardian') then
    select e.event_date, p.birth_date into v_event_date, v_birth_date
    from public.events e, public.participants p
    where e.id = v_event_id and p.id = new.participant_id;

    if extract(year from age(v_event_date, v_birth_date)) < 18 then
      raise exception 'Un % debe ser mayor de edad a la fecha del evento', new.attendee_role
        using errcode = 'check_violation';
    end if;
  end if;

  if new.attendee_role = 'chaperone' and v_kind <> 'school' then
    raise exception 'Solo las inscripciones de colegio tienen acompañantes del colegio'
      using errcode = 'check_violation';
  end if;

  if new.pass_id is not null then
    select * into v_pass from public.event_passes ep where ep.id = new.pass_id;
    if v_pass.event_id <> v_event_id or v_pass.participant_id <> new.participant_id then
      raise exception 'El pase no corresponde a esta persona y evento'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.event_attendees_guard() from public, anon, authenticated;

create trigger event_attendees_guard
before insert or update on public.event_attendees
for each row execute function public.event_attendees_guard();

-- Copia de tier y time_range desde la sesión; la sesión debe ser del mismo evento y estar abierta
create function public.tour_enrollments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg_event_id uuid;
  v_event_id uuid;
  v_tier public.tour_tier;
  v_starts timestamptz;
  v_ends timestamptz;
  v_status public.tour_session_status;
  v_buffer integer;
begin
  select r.event_id into v_reg_event_id
  from public.event_registrations r where r.id = new.registration_id;

  select ef.event_id, ef.tier, ts.starts_at, ts.ends_at, ts.status, e.travel_buffer_minutes
    into v_event_id, v_tier, v_starts, v_ends, v_status, v_buffer
  from public.tour_sessions ts
  join public.event_faculties ef on ef.id = ts.event_faculty_id
  join public.events e on e.id = ef.event_id
  where ts.id = new.session_id;

  if v_event_id is distinct from v_reg_event_id then
    raise exception 'La sesión no pertenece al evento de la inscripción'
      using errcode = 'check_violation';
  end if;

  if new.status <> 'released'
    and v_status <> 'open'
    and (tg_op = 'INSERT' or new.session_id is distinct from old.session_id) then
    raise exception 'La sesión no está abierta'
      using errcode = 'check_violation';
  end if;

  new.tier := v_tier;
  new.time_range := tstzrange(v_starts, v_ends + make_interval(mins => v_buffer), '[)');
  return new;
end;
$$;

revoke execute on function public.tour_enrollments_guard() from public, anon, authenticated;

create trigger tour_enrollments_guard
before insert or update of registration_id, session_id on public.tour_enrollments
for each row execute function public.tour_enrollments_guard();

-- Contador de cupo: seats_taken suma los asientos de los recorridos no liberados.
-- El UPDATE bloquea la fila de la sesión y CHECK (seats_taken <= capacity) rechaza el exceso
-- de forma atómica, sin bloqueos largos.
create function public.tour_enrollments_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_active boolean := false;
  v_new_active boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_active := old.status <> 'released';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_active := new.status <> 'released';
  end if;

  if tg_op = 'UPDATE' and old.session_id = new.session_id then
    if (case when v_new_active then new.seats else 0 end) - (case when v_old_active then old.seats else 0 end) <> 0 then
      update public.tour_sessions
      set seats_taken = seats_taken
        + (case when v_new_active then new.seats else 0 end)
        - (case when v_old_active then old.seats else 0 end)
      where id = new.session_id;
    end if;
  else
    if v_new_active then
      update public.tour_sessions set seats_taken = seats_taken + new.seats where id = new.session_id;
    end if;
    if v_old_active then
      update public.tour_sessions set seats_taken = seats_taken - old.seats where id = old.session_id;
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.tour_enrollments_seats() from public, anon, authenticated;

create trigger tour_enrollments_seats
after insert or update or delete on public.tour_enrollments
for each row execute function public.tour_enrollments_seats();

-- RLS: se habilita aquí sin políticas (nadie accede directo). Las políticas van en 10_rls_openday.sql.
alter table public.event_registrations enable row level security;
alter table public.event_passes enable row level security;
alter table public.event_attendees enable row level security;
alter table public.tour_enrollments enable row level security;
alter table public.registration_documents enable row level security;
alter table public.document_templates enable row level security;
alter table public.registration_events enable row level security;
alter table public.logistics_options enable row level security;
alter table public.registration_logistics enable row level security;
alter table public.email_outbox enable row level security;
