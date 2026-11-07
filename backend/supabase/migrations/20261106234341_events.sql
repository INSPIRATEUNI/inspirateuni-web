SET local check_function_bodies = off;

CREATE TABLE "public"."event_faculties" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id"   uuid NOT NULL,
  "faculty_id" uuid NOT NULL,
  CONSTRAINT "event_faculties_event_id_faculty_id_key" UNIQUE (event_id, faculty_id),
  CONSTRAINT "event_faculties_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."event_faculties"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."events" (
  "id"                            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                          text                     NOT NULL,
  "event_date"                    date                     NOT NULL,
  "venue"                         text,
  "registration_open"             boolean                  NOT NULL DEFAULT false,
  "registration_opens_at"         timestamp with time zone NOT NULL,
  "registration_closes_at"        timestamp with time zone NOT NULL,
  "docs_close_at"                 timestamp with time zone NOT NULL,
  "hold_minutes"                  integer                  NOT NULL DEFAULT 30,
  "reservation_hours"             integer                  NOT NULL DEFAULT 48,
  "max_file_mb"                   integer                  NOT NULL DEFAULT 20,
  "students_per_chaperone"        integer                  NOT NULL DEFAULT 10,
  "max_visitors_per_registration" integer,
  "max_adults_per_registration"   integer,
  "travel_buffer_minutes"         integer                  NOT NULL DEFAULT 15,
  "created_at"                    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_check1" CHECK ((docs_close_at >= registration_closes_at)),
  CONSTRAINT "events_check" CHECK ((registration_closes_at > registration_opens_at)),
  CONSTRAINT "events_hold_minutes_check" CHECK ((hold_minutes > 0)),
  CONSTRAINT "events_max_adults_per_registration_check" CHECK ((max_adults_per_registration >= 0)),
  CONSTRAINT "events_max_file_mb_check" CHECK (((max_file_mb >= 1) AND (max_file_mb <= 50))),
  CONSTRAINT "events_max_visitors_per_registration_check" CHECK ((max_visitors_per_registration > 0)),
  CONSTRAINT "events_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_reservation_hours_check" CHECK ((reservation_hours > 0)),
  CONSTRAINT "events_students_per_chaperone_check" CHECK ((students_per_chaperone > 0)),
  CONSTRAINT "events_travel_buffer_minutes_check" CHECK ((travel_buffer_minutes >= 0))
);

ALTER TABLE "public"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tour_sessions" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "event_faculty_id" uuid                     NOT NULL,
  "starts_at"        timestamp with time zone NOT NULL,
  "ends_at"          timestamp with time zone NOT NULL,
  "capacity"         integer                  NOT NULL,
  "seats_taken"      integer                  NOT NULL DEFAULT 0,
  "meeting_point"    text,
  CONSTRAINT "tour_sessions_capacity_check" CHECK ((capacity > 0)),
  CONSTRAINT "tour_sessions_check1" CHECK ((seats_taken <= capacity)),
  CONSTRAINT "tour_sessions_check" CHECK ((ends_at > starts_at)),
  CONSTRAINT "tour_sessions_event_faculty_id_starts_at_key" UNIQUE (event_faculty_id, starts_at),
  CONSTRAINT "tour_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "tour_sessions_seats_taken_check" CHECK ((seats_taken >= 0))
);

ALTER TABLE "public"."tour_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."tour_import_row" AS (
  "line"             integer,
  "action"           text,
  "faculty"          text,
  "event_faculty_id" uuid,
  "starts_at"        timestamp WITH time zone,
  "ends_at"          timestamp WITH time zone,
  "capacity"         integer,
  "meeting_point"    text,
  "message"          text
);

CREATE TYPE "public"."tour_session_status" AS ENUM (
  'open',
  'closed',
  'cancelled'
);

ALTER TABLE "public"."tour_sessions"
  ADD COLUMN "status" public.tour_session_status NOT NULL DEFAULT 'open'::public.tour_session_status;

CREATE TYPE "public"."tour_tier" AS ENUM (
  'high',
  'mid',
  'low'
);

ALTER TABLE "public"."event_faculties"
  ADD COLUMN "tier" public.tour_tier NOT NULL;

CREATE OR REPLACE FUNCTION public.csv_unquote (
  v text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case
    when v like '"%"' and length(v) >= 2 then replace(substr(v, 2, length(v) - 2), '""', '"')
    else v
  end;
$function$;

CREATE OR REPLACE FUNCTION public.events_set_defaults()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.docs_close_at is null then
    new.docs_close_at := new.registration_closes_at + make_interval(hours => new.reservation_hours);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.import_tour_sessions (
  p_event_id uuid,
  p_csv      text,
  p_apply    boolean DEFAULT false
)
  RETURNS SETOF public.tour_import_row
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_event_date date;
  v_lines text[];
  v_delim text;
  v_fields text[];
  v_field text;
  v_i integer;
  v_header text[];
  v_idx_fac integer;
  v_idx_ini integer;
  v_idx_fin integer;
  v_idx_cup integer;
  v_idx_pto integer;
  v_rows public.tour_import_row[] := '{}';
  v_seen text[] := '{}';
  v_row public.tour_import_row;
  v_existing public.tour_sessions;
  v_raw text;
  v_errors integer;
begin
  if not public.is_board() then
    raise exception 'Solo la directiva puede importar horarios' using errcode = 'insufficient_privilege';
  end if;

  select e.event_date into v_event_date from public.events e where e.id = p_event_id;
  if not found then
    raise exception 'El evento % no existe', p_event_id using errcode = 'no_data_found';
  end if;

  v_lines := array(
    select l
    from unnest(regexp_split_to_array(replace(regexp_replace(p_csv, '^﻿', ''), E'\r', ''), E'\n')) with ordinality as t (l, n)
    where btrim(l) <> ''
    order by n
  );
  if coalesce(array_length(v_lines, 1), 0) < 2 then
    raise exception 'El CSV debe tener un encabezado y al menos una fila' using errcode = 'invalid_parameter_value';
  end if;

  v_delim := case when position(';' in v_lines[1]) > 0 and position(',' in v_lines[1]) = 0 then ';' else ',' end;

  -- Encabezado
  select array_agg(lower(btrim(public.csv_unquote(m[1]))) order by ord)
    into v_header
  from regexp_matches(v_lines[1] || v_delim, '("(?:[^"]|"")*"|[^' || v_delim || ']*)' || v_delim, 'g') with ordinality as t (m, ord);

  v_idx_fac := array_position(v_header, 'facultad');
  v_idx_ini := array_position(v_header, 'inicio');
  v_idx_fin := array_position(v_header, 'fin');
  v_idx_cup := array_position(v_header, 'cupo');
  v_idx_pto := array_position(v_header, 'punto_encuentro');
  if v_idx_fac is null or v_idx_ini is null or v_idx_fin is null or v_idx_cup is null then
    raise exception 'El encabezado debe incluir: facultad, inicio, fin, cupo (y opcionalmente punto_encuentro)'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_i in 2 .. array_length(v_lines, 1) loop
    select array_agg(btrim(public.csv_unquote(m[1])) order by ord)
      into v_fields
    from regexp_matches(v_lines[v_i] || v_delim, '("(?:[^"]|"")*"|[^' || v_delim || ']*)' || v_delim, 'g') with ordinality as t (m, ord);

    v_row := row(v_i, null, v_fields[v_idx_fac], null, null, null, null, nullif(v_fields[v_idx_pto], ''), null)::public.tour_import_row;

    begin
      select ef.id into v_row.event_faculty_id
      from public.event_faculties ef
      join public.faculties f on f.id = ef.faculty_id
      where ef.event_id = p_event_id and lower(f.name) = lower(v_row.faculty);
      if v_row.event_faculty_id is null then
        raise exception 'La facultad "%" no está incluida en el evento', v_row.faculty;
      end if;

      v_raw := v_fields[v_idx_ini];
      v_row.starts_at := (v_raw::timestamp) at time zone 'America/Lima';
      v_raw := v_fields[v_idx_fin];
      v_row.ends_at := (v_raw::timestamp) at time zone 'America/Lima';
      v_raw := v_fields[v_idx_cup];
      v_row.capacity := v_raw::integer;

      if (v_row.starts_at at time zone 'America/Lima')::date <> v_event_date then
        raise exception 'El inicio no cae en la fecha del evento (%)', v_event_date;
      end if;
      if v_row.ends_at <= v_row.starts_at then
        raise exception 'El fin debe ser posterior al inicio';
      end if;
      if v_row.capacity <= 0 then
        raise exception 'El cupo debe ser mayor que 0';
      end if;
      if (v_row.event_faculty_id::text || '|' || v_row.starts_at::text) = any (v_seen) then
        raise exception 'Fila duplicada en el archivo (misma facultad e inicio)';
      end if;
      v_seen := v_seen || (v_row.event_faculty_id::text || '|' || v_row.starts_at::text);

      select * into v_existing
      from public.tour_sessions ts
      where ts.event_faculty_id = v_row.event_faculty_id and ts.starts_at = v_row.starts_at;

      if not found then
        v_row.action := 'insert';
        v_row.message := 'Se creará la sesión';
      elsif v_existing.ends_at = v_row.ends_at
        and v_existing.capacity = v_row.capacity
        and v_existing.meeting_point is not distinct from v_row.meeting_point then
        v_row.action := 'unchanged';
        v_row.message := 'Sin cambios';
      elsif v_row.capacity < v_existing.seats_taken then
        raise exception 'El cupo (%) no puede ser menor que los asientos ya tomados (%)', v_row.capacity, v_existing.seats_taken;
      else
        v_row.action := 'update';
        v_row.message := 'Se actualizará la sesión';
      end if;
    exception
      when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then
        v_row.action := 'error';
        v_row.message := 'Valor inválido en la fila (revisa fechas AAAA-MM-DD HH:MM y el cupo)';
      when others then
        v_row.action := 'error';
        v_row.message := sqlerrm;
    end;

    v_rows := v_rows || v_row;
  end loop;

  select count(*) into v_errors from unnest(v_rows) r where r.action = 'error';

  if p_apply then
    if v_errors > 0 then
      raise exception 'El CSV tiene % fila(s) con error; no se aplicó ningún cambio', v_errors
        using errcode = 'check_violation';
    end if;

    foreach v_row in array v_rows loop
      if v_row.action = 'insert' then
        insert into public.tour_sessions (event_faculty_id, starts_at, ends_at, capacity, meeting_point)
        values (v_row.event_faculty_id, v_row.starts_at, v_row.ends_at, v_row.capacity, v_row.meeting_point);
      elsif v_row.action = 'update' then
        update public.tour_sessions ts
        set ends_at = v_row.ends_at, capacity = v_row.capacity, meeting_point = v_row.meeting_point
        where ts.event_faculty_id = v_row.event_faculty_id and ts.starts_at = v_row.starts_at;
      end if;
    end loop;
  end if;

  return query select * from unnest(v_rows);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."import_tour_sessions"(uuid, text, boolean) FROM PUBLIC, "anon";

ALTER TABLE "public"."event_faculties"
  ADD CONSTRAINT "event_faculties_faculty_id_fkey" FOREIGN KEY (faculty_id) REFERENCES public.faculties(id) ON DELETE RESTRICT;

ALTER TABLE "public"."event_faculties"
  ADD CONSTRAINT "event_faculties_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE "public"."tour_sessions"
  ADD CONSTRAINT "tour_sessions_event_faculty_id_fkey" FOREIGN KEY (event_faculty_id) REFERENCES public.event_faculties(id) ON DELETE CASCADE;

CREATE VIEW "public"."v_tour_availability" WITH (security_invoker=false) AS  SELECT ts.id AS session_id,
    ef.event_id,
    ef.faculty_id,
    f.name AS faculty_name,
    ef.tier,
    ts.starts_at,
    ts.ends_at,
    ts.meeting_point,
    ts.capacity,
    GREATEST((ts.capacity - ts.seats_taken), 0) AS seats_remaining,
    ts.status
   FROM ((public.tour_sessions ts
     JOIN public.event_faculties ef ON ((ef.id = ts.event_faculty_id)))
     JOIN public.faculties f ON ((f.id = ef.faculty_id)))
  WHERE (ts.status <> 'cancelled'::public.tour_session_status);

CREATE INDEX event_faculties_faculty_id_idx ON public.event_faculties USING btree (faculty_id);

CREATE TRIGGER events_defaults
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_set_defaults();

CREATE POLICY "event_faculties: admin escribe" ON "public"."event_faculties"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "event_faculties: lectura pública" ON "public"."event_faculties"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "events: admin escribe" ON "public"."events"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "events: lectura pública" ON "public"."events"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "tour_sessions: admin escribe" ON "public"."tour_sessions"
  FOR ALL
  TO "authenticated"
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "tour_sessions: directiva lee" ON "public"."tour_sessions"
  FOR SELECT
  TO "authenticated"
  USING (public.is_board());

COMMENT ON COLUMN "public"."event_faculties"."tier" IS 'Nivel de demanda: high (muy visitadas), mid (intermedias), low (poco visitadas). Está en el evento porque cambia cada año.';

COMMENT ON COLUMN "public"."events"."docs_close_at" IS 'Última fecha para subir documentos. Si se omite al insertar, vale registration_closes_at + reservation_hours.';

COMMENT ON COLUMN "public"."events"."event_date" IS 'Fecha del evento; la mayoría de edad se calcula a esta fecha.';

COMMENT ON COLUMN "public"."events"."hold_minutes" IS 'Temporizador de elección de recorridos (por defecto 30).';

COMMENT ON COLUMN "public"."events"."max_adults_per_registration" IS 'Tope de adultos por inscripción de colegio (NULL = sin tope definido).';

COMMENT ON COLUMN "public"."events"."max_file_mb" IS 'Tamaño máximo por archivo subido, entre 1 y 50 MB.';

COMMENT ON COLUMN "public"."events"."max_visitors_per_registration" IS 'Tope de visitantes por inscripción de colegio (NULL = sin tope definido).';

COMMENT ON COLUMN "public"."events"."registration_closes_at" IS 'Después de esta fecha no se admiten nuevas retenciones de cupo.';

COMMENT ON COLUMN "public"."events"."reservation_hours" IS 'Plazo para completar datos y documentos tras confirmar la selección (por defecto 48).';

COMMENT ON COLUMN "public"."events"."students_per_chaperone" IS 'Proporción mínima: acompañantes >= ceil(visitantes / este valor).';

COMMENT ON COLUMN "public"."events"."travel_buffer_minutes" IS 'Margen de traslado entre recorridos, para evitar cruces de horario.';

COMMENT ON COLUMN "public"."tour_sessions"."seats_taken" IS 'Solo lo modifican las RPC y los triggers de inscripción; nunca la interfaz.';

COMMENT ON CONSTRAINT "tour_sessions_event_faculty_id_starts_at_key" ON "public"."tour_sessions" IS 'Clave natural: la carga por CSV (import_tour_sessions) es idempotente sobre facultad + inicio.';

COMMENT ON TABLE "public"."events" IS 'Evento del Open Day (un solo día) y su configuración editable: plazos, tamaño de archivo, proporciones y topes.';

COMMENT ON VIEW "public"."v_tour_availability" IS 'Disponibilidad pública de recorridos. No expone inscripciones ni seats_taken.';

GRANT EXECUTE ON FUNCTION "public"."csv_unquote"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."csv_unquote"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."csv_unquote"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."csv_unquote"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."events_set_defaults"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."events_set_defaults"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."events_set_defaults"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."events_set_defaults"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."import_tour_sessions"(uuid, text, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."import_tour_sessions"(uuid, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_tour_sessions"(uuid, text, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_tour_sessions"(uuid, text, boolean) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_faculties" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."event_faculties" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_faculties" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_faculties" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_sessions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tour_sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tour_sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."v_tour_availability" FROM "anon";

GRANT SELECT ON TABLE "public"."v_tour_availability" TO "anon";

REVOKE ALL ON TABLE "public"."v_tour_availability" FROM "authenticated";

GRANT SELECT ON TABLE "public"."v_tour_availability" TO "authenticated";

REVOKE ALL ON TABLE "public"."v_tour_availability" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."v_tour_availability" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."v_tour_availability" TO "service_role";
