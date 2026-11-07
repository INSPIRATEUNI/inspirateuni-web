SET local check_function_bodies = off;

CREATE TABLE "public"."document_templates" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "version"       integer                  NOT NULL,
  "drive_file_id" text                     NOT NULL,
  "active"        boolean                  NOT NULL DEFAULT false,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "document_templates_pkey" PRIMARY KEY (id),
  CONSTRAINT "document_templates_version_check" CHECK ((version > 0))
);

ALTER TABLE "public"."document_templates"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."email_outbox" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid,
  "to_email"        extensions.citext        NOT NULL,
  "template"        text                     NOT NULL,
  "payload"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "attempts"        integer                  NOT NULL DEFAULT 0,
  "last_error"      text,
  "dedupe_key"      text,
  "scheduled_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "sent_at"         timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "email_outbox_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "email_outbox_dedupe_key_key" UNIQUE (dedupe_key),
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."email_outbox"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."event_attendees" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid                     NOT NULL,
  "participant_id"  uuid                     NOT NULL,
  "pass_id"         uuid,
  "event_id"        uuid                     NOT NULL,
  "relationship"    text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "event_attendees_pkey" PRIMARY KEY (id),
  CONSTRAINT "event_attendees_registration_id_participant_id_key" UNIQUE (registration_id, participant_id)
);

ALTER TABLE "public"."event_attendees"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."event_passes" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "event_id"       uuid                     NOT NULL,
  "participant_id" uuid                     NOT NULL,
  "checked_in_at"  timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "event_passes_event_id_participant_id_key" UNIQUE (event_id, participant_id),
  CONSTRAINT "event_passes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."event_passes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."event_registrations" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "event_id"          uuid                     NOT NULL,
  "school_id"         uuid,
  "owner_id"          uuid                     NOT NULL,
  "expected_visitors" integer                  NOT NULL,
  "hold_renewals"     integer                  NOT NULL DEFAULT 0,
  "reserved_at"       timestamp with time zone,
  "docs_deadline"     timestamp with time zone,
  "submitted_at"      timestamp with time zone,
  "confirmed_at"      timestamp with time zone,
  "gate"              text,
  "arrival_at"        timestamp with time zone,
  "contact_name"      text                     NOT NULL,
  "contact_email"     extensions.citext        NOT NULL,
  "accepted_terms_at" timestamp with time zone,
  "terms_version"     text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "event_registrations_expected_visitors_check" CHECK ((expected_visitors > 0)),
  CONSTRAINT "event_registrations_hold_renewals_check" CHECK (((hold_renewals >= 0) AND (hold_renewals <= 1))),
  CONSTRAINT "event_registrations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."event_registrations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."logistics_options" (
  "code"   text    NOT NULL,
  "label"  text    NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  CONSTRAINT "logistics_options_code_check" CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text)),
  CONSTRAINT "logistics_options_pkey" PRIMARY KEY (code)
);

ALTER TABLE "public"."logistics_options"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."registration_documents" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "registration_id"  uuid                     NOT NULL,
  "drive_file_id"    text                     NOT NULL,
  "file_name"        text                     NOT NULL,
  "size_bytes"       bigint,
  "template_version" integer,
  "uploaded_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "verified_by"      uuid,
  "verified_at"      timestamp with time zone,
  "observation"      text,
  "superseded_at"    timestamp with time zone,
  CONSTRAINT "registration_documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "registration_documents_size_bytes_check" CHECK ((size_bytes >= 0))
);

ALTER TABLE "public"."registration_documents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."registration_events" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid                     NOT NULL,
  "actor_id"        uuid,
  "event_type"      text                     NOT NULL,
  "reason"          text,
  "detail"          jsonb,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "registration_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."registration_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."registration_logistics" (
  "id"              uuid    NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid    NOT NULL,
  "option_code"     text    NOT NULL,
  "quantity"        integer NOT NULL,
  "notes"           text,
  CONSTRAINT "registration_logistics_pkey" PRIMARY KEY (id),
  CONSTRAINT "registration_logistics_quantity_check" CHECK ((quantity > 0)),
  CONSTRAINT "registration_logistics_registration_id_option_code_key" UNIQUE (registration_id, option_code)
);

ALTER TABLE "public"."registration_logistics"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tour_enrollments" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid                     NOT NULL,
  "session_id"      uuid                     NOT NULL,
  "tier"            public.tour_tier         NOT NULL,
  "time_range"      tstzrange                NOT NULL,
  "seats"           integer                  NOT NULL,
  "hold_expires_at" timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tour_enrollments_pkey" PRIMARY KEY (id),
  CONSTRAINT "tour_enrollments_seats_check" CHECK ((seats > 0))
);

ALTER TABLE "public"."tour_enrollments"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."attendee_role" AS ENUM (
  'visitor',
  'chaperone',
  'guardian'
);

ALTER TABLE "public"."event_attendees"
  ADD COLUMN "attendee_role" public.attendee_role NOT NULL;

CREATE TYPE "public"."document_kind" AS ENUM (
  'school_consolidated',
  'consent',
  'guardian_declaration',
  'commitment_letter',
  'credentials'
);

ALTER TABLE "public"."document_templates"
  ADD COLUMN "kind" public.document_kind NOT NULL;

ALTER TABLE "public"."registration_documents"
  ADD COLUMN "kind" public.document_kind NOT NULL;

CREATE TYPE "public"."email_status" AS ENUM (
  'pending',
  'sent',
  'failed'
);

ALTER TABLE "public"."email_outbox"
  ADD COLUMN "status" public.email_status NOT NULL DEFAULT 'pending'::public.email_status;

CREATE TYPE "public"."enrollment_status" AS ENUM (
  'held',
  'reserved',
  'released'
);

ALTER TABLE "public"."tour_enrollments"
  ADD COLUMN "status" public.enrollment_status NOT NULL DEFAULT 'held'::public.enrollment_status;

CREATE TYPE "public"."pass_status" AS ENUM (
  'active',
  'revoked'
);

ALTER TABLE "public"."event_passes"
  ADD COLUMN "status" public.pass_status NOT NULL DEFAULT 'active'::public.pass_status;

CREATE TYPE "public"."registration_kind" AS ENUM (
  'school',
  'individual'
);

ALTER TABLE "public"."event_registrations"
  ADD COLUMN "kind" public.registration_kind NOT NULL;

CREATE TYPE "public"."registration_status" AS ENUM (
  'draft',
  'held',
  'reserved',
  'submitted',
  'docs_observed',
  'confirmed',
  'needs_reassignment',
  'expired',
  'cancelled'
);

ALTER TABLE "public"."event_registrations"
  ADD COLUMN "status" public.registration_status NOT NULL DEFAULT 'draft'::public.registration_status;

ALTER TABLE "public"."registration_events"
  ADD COLUMN "from_status" public.registration_status;

ALTER TABLE "public"."registration_events"
  ADD COLUMN "to_status" public.registration_status;

CREATE OR REPLACE FUNCTION public.event_attendees_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."event_attendees_guard"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.random_code (
  len integer
)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
begin
  for i in 1 .. len loop
    result := result || substr(alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1);
  end loop;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tour_enrollments_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."tour_enrollments_guard"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.tour_enrollments_seats()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."tour_enrollments_seats"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."document_templates"
  ADD CONSTRAINT "document_templates_kind_check"
    CHECK ((kind = ANY (ARRAY['consent'::public.document_kind, 'guardian_declaration'::public.document_kind, 'commitment_letter'::public.document_kind])));

ALTER TABLE "public"."document_templates"
  ADD CONSTRAINT "document_templates_kind_version_key" UNIQUE (kind, VERSION);

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_passes"
  ADD CONSTRAINT "event_passes_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_passes"
  ADD CONSTRAINT "event_passes_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_pass_id_fkey" FOREIGN KEY (pass_id) REFERENCES public.event_passes(id) ON DELETE SET NULL;

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_check1" CHECK (((kind <> 'individual'::public.registration_kind) OR (expected_visitors = 1)));

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_check" CHECK (((kind = 'school'::public.registration_kind) = (school_id IS NOT NULL)));

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."email_outbox"
  ADD CONSTRAINT "email_outbox_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE SET NULL;

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE RESTRICT;

ALTER TABLE "public"."registration_documents"
  ADD CONSTRAINT "registration_documents_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;

ALTER TABLE "public"."registration_documents"
  ADD CONSTRAINT "registration_documents_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."registration_events"
  ADD CONSTRAINT "registration_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."registration_events"
  ADD CONSTRAINT "registration_events_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;

ALTER TABLE "public"."registration_logistics"
  ADD CONSTRAINT "registration_logistics_option_code_fkey" FOREIGN KEY (option_code) REFERENCES public.logistics_options(code) ON DELETE RESTRICT;

ALTER TABLE "public"."registration_logistics"
  ADD CONSTRAINT "registration_logistics_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;

ALTER TABLE "public"."tour_enrollments"
  ADD CONSTRAINT "tour_enrollments_check" CHECK (((status <> 'held'::public.enrollment_status) OR (hold_expires_at IS NOT NULL)));

ALTER TABLE "public"."tour_enrollments"
  ADD CONSTRAINT "tour_enrollments_no_overlap" EXCLUDE USING gist (registration_id WITH =, time_range WITH &&) WHERE ((status <> 'released'::public.enrollment_status));

ALTER TABLE "public"."tour_enrollments"
  ADD CONSTRAINT "tour_enrollments_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;

ALTER TABLE "public"."tour_enrollments"
  ADD CONSTRAINT "tour_enrollments_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.tour_sessions(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX document_templates_active_idx ON public.document_templates USING btree (kind)
  WHERE active;

CREATE INDEX email_outbox_pending_idx ON public.email_outbox USING btree (scheduled_at)
  WHERE (status = 'pending'::public.email_status);

CREATE INDEX email_outbox_registration_id_idx ON public.email_outbox USING btree (registration_id);

CREATE UNIQUE INDEX event_attendees_chaperone_event_idx ON public.event_attendees USING btree (event_id, participant_id)
  WHERE (attendee_role = 'chaperone'::public.attendee_role);

CREATE INDEX event_attendees_event_id_idx ON public.event_attendees USING btree (event_id);

CREATE INDEX event_attendees_participant_id_idx ON public.event_attendees USING btree (participant_id);

CREATE INDEX event_attendees_pass_id_idx ON public.event_attendees USING btree (pass_id);

CREATE UNIQUE INDEX event_attendees_visitor_event_idx ON public.event_attendees USING btree (event_id, participant_id)
  WHERE (attendee_role = 'visitor'::public.attendee_role);

CREATE INDEX event_passes_participant_id_idx ON public.event_passes USING btree (participant_id);

CREATE INDEX event_registrations_event_id_idx ON public.event_registrations USING btree (event_id);

CREATE INDEX event_registrations_owner_id_idx ON public.event_registrations USING btree (owner_id);

CREATE UNIQUE INDEX event_registrations_school_event_idx ON public.event_registrations USING btree (event_id, school_id)
  WHERE ((school_id IS NOT NULL) AND (status <> ALL (ARRAY['expired'::public.registration_status, 'cancelled'::public.registration_status])));

CREATE INDEX event_registrations_school_id_idx ON public.event_registrations USING btree (school_id);

CREATE INDEX event_registrations_status_idx ON public.event_registrations USING btree (status);

CREATE INDEX registration_documents_registration_id_idx ON public.registration_documents USING btree (registration_id, kind);

CREATE INDEX registration_documents_verified_by_idx ON public.registration_documents USING btree (verified_by);

CREATE INDEX registration_events_actor_id_idx ON public.registration_events USING btree (actor_id);

CREATE INDEX registration_events_registration_id_idx ON public.registration_events USING btree (registration_id, created_at);

CREATE INDEX registration_logistics_option_code_idx ON public.registration_logistics USING btree (option_code);

CREATE INDEX tour_enrollments_hold_expires_idx ON public.tour_enrollments USING btree (hold_expires_at)
  WHERE (status = 'held'::public.enrollment_status);

CREATE INDEX tour_enrollments_registration_id_idx ON public.tour_enrollments USING btree (registration_id);

CREATE UNIQUE INDEX tour_enrollments_registration_tier_idx ON public.tour_enrollments USING btree (registration_id, tier)
  WHERE (status <> 'released'::public.enrollment_status);

CREATE INDEX tour_enrollments_session_id_idx ON public.tour_enrollments USING btree (session_id);

CREATE TRIGGER event_attendees_guard
  BEFORE INSERT OR UPDATE ON public.event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.event_attendees_guard();

CREATE TRIGGER tour_enrollments_guard
  BEFORE INSERT OR UPDATE OF registration_id, session_id ON public.tour_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.tour_enrollments_guard();

CREATE TRIGGER tour_enrollments_seats
  AFTER INSERT OR DELETE OR UPDATE ON public.tour_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.tour_enrollments_seats();

COMMENT ON COLUMN "public"."email_outbox"."dedupe_key" IS 'Clave de idempotencia: un mismo correo lógico no se encola dos veces.';

COMMENT ON COLUMN "public"."event_attendees"."event_id" IS 'Copia de event_registrations.event_id, la fija un trigger (permite los índices únicos por evento).';

COMMENT ON COLUMN "public"."event_attendees"."relationship" IS 'Texto libre: profesor, madre, chofer del bus...';

COMMENT ON COLUMN "public"."event_registrations"."expected_visitors" IS 'Visitantes declarados; es la cantidad de asientos que se reserva en cada recorrido.';

COMMENT ON COLUMN "public"."event_registrations"."hold_renewals" IS 'El temporizador de elección se renueva una sola vez (0 o 1).';

COMMENT ON COLUMN "public"."tour_enrollments"."seats" IS 'Cantidad de visitantes; es lo que ocupa de seats_taken en la sesión.';

COMMENT ON COLUMN "public"."tour_enrollments"."tier" IS 'Copia del nivel de la sesión en el evento (la fija un trigger).';

COMMENT ON COLUMN "public"."tour_enrollments"."time_range" IS 'Copia de [starts_at, ends_at + travel_buffer_minutes) de la sesión (la fija un trigger).';

COMMENT ON TABLE "public"."event_passes" IS 'Un pase con código por persona y evento, aunque el adulto figure en varias inscripciones.';

COMMENT ON TABLE "public"."event_registrations" IS 'Trámite de inscripción al Open Day (colegio o persona libre). El dueño no escribe directo: todo pasa por RPC.';

COMMENT ON TABLE "public"."logistics_options" IS 'Catálogo de logística (hoy bus y parking). Añadir una opción es un INSERT, sin migración de schema.';

COMMENT ON TABLE "public"."registration_documents" IS 'PDFs en Google Drive (drive_file_id). Un archivo reemplazado queda con superseded_at; no se borra.';

COMMENT ON TABLE "public"."registration_events" IS 'Bitácora: transiciones, overrides (con motivo), conflictos de documento y observaciones. Quién, cuándo y de qué estado a cuál.';

REVOKE ALL ON FUNCTION "public"."event_attendees_guard"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."event_attendees_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."event_attendees_guard"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."random_code"(integer) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."random_code"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."random_code"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."random_code"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."tour_enrollments_guard"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_enrollments_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_enrollments_guard"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."tour_enrollments_seats"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_enrollments_seats"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_enrollments_seats"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_templates" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."document_templates" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_templates" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_templates" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."email_outbox" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."email_outbox" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."email_outbox" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."email_outbox" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."event_attendees" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_passes" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."event_passes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_passes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_passes" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_registrations" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."event_registrations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_registrations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_registrations" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logistics_options" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."logistics_options" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logistics_options" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logistics_options" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_documents" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."registration_documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_documents" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_documents" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_events" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."registration_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_logistics" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."registration_logistics" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_logistics" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."registration_logistics" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_enrollments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tour_enrollments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_enrollments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_enrollments" TO "service_role";

ALTER TABLE "public"."event_passes"
  ADD COLUMN "access_code" text NOT NULL DEFAULT public.random_code(8);

ALTER TABLE "public"."event_passes"
  ADD CONSTRAINT "event_passes_access_code_check" CHECK ((access_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'::text));

ALTER TABLE "public"."event_passes"
  ADD CONSTRAINT "event_passes_access_code_key" UNIQUE (access_code);

ALTER TABLE "public"."event_registrations"
  ADD COLUMN "reference_code" text NOT NULL DEFAULT ('OD-'::text || public.random_code(5));

ALTER TABLE "public"."event_registrations"
  ADD CONSTRAINT "event_registrations_reference_code_key" UNIQUE (reference_code);

COMMENT ON COLUMN "public"."event_registrations"."reference_code" IS 'Código corto para consultas con el staff (p. ej. OD-7K3F9). No es una credencial.';
