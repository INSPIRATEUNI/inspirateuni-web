create type public.tour_tier as enum ('high', 'mid', 'low');
create type public.tour_session_status as enum ('open', 'closed', 'cancelled');

-- Evento del Open Day (un solo día). Toda la configuración se edita desde el backoffice, sin redeploy.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  venue text,
  registration_open boolean not null default false,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  docs_close_at timestamptz not null,
  hold_minutes integer not null default 30 check (hold_minutes > 0),
  reservation_hours integer not null default 48 check (reservation_hours > 0),
  max_file_mb integer not null default 20 check (max_file_mb between 1 and 50),
  students_per_chaperone integer not null default 10 check (students_per_chaperone > 0),
  max_visitors_per_registration integer check (max_visitors_per_registration > 0),
  max_adults_per_registration integer check (max_adults_per_registration >= 0),
  max_drafts_per_email integer not null default 3 check (max_drafts_per_email > 0),
  travel_buffer_minutes integer not null default 15 check (travel_buffer_minutes >= 0),
  created_at timestamptz not null default now(),
  check (registration_closes_at > registration_opens_at),
  check (docs_close_at >= registration_closes_at)
);

comment on table public.events is 'Evento del Open Day (un solo día) y su configuración editable: plazos, tamaño de archivo, proporciones y topes.';
comment on column public.events.event_date is 'Fecha del evento; la mayoría de edad se calcula a esta fecha.';
comment on column public.events.registration_closes_at is 'Después de esta fecha no se admiten nuevas retenciones de cupo.';
comment on column public.events.docs_close_at is 'Última fecha para subir documentos. Si se omite al insertar, vale registration_closes_at + reservation_hours.';
comment on column public.events.hold_minutes is 'Temporizador de elección de recorridos (por defecto 30).';
comment on column public.events.reservation_hours is 'Plazo para completar datos y documentos tras confirmar la selección (por defecto 48).';
comment on column public.events.max_file_mb is 'Tamaño máximo por archivo subido, entre 1 y 50 MB.';
comment on column public.events.students_per_chaperone is 'Proporción mínima: acompañantes >= ceil(visitantes / este valor).';
comment on column public.events.max_visitors_per_registration is 'Tope de visitantes por inscripción de colegio (NULL = sin tope definido).';
comment on column public.events.max_adults_per_registration is 'Tope de adultos por inscripción de colegio (NULL = sin tope definido).';
comment on column public.events.max_drafts_per_email is 'Anti-acaparamiento: inscripciones en curso (draft, held, reserved) por correo de contacto y evento.';
comment on column public.events.travel_buffer_minutes is 'Margen de traslado entre recorridos, para evitar cruces de horario.';

create function public.events_set_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.docs_close_at is null then
    new.docs_close_at := new.registration_closes_at + make_interval(hours => new.reservation_hours);
  end if;
  return new;
end;
$$;

create trigger events_defaults
before insert or update on public.events
for each row execute function public.events_set_defaults();

-- Facultades que participan en un evento, con su nivel de demanda en ese evento
create table public.event_faculties (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  faculty_id uuid not null references public.faculties (id) on delete restrict,
  tier public.tour_tier not null,
  unique (event_id, faculty_id)
);

create index event_faculties_faculty_id_idx on public.event_faculties (faculty_id);

comment on column public.event_faculties.tier is 'Nivel de demanda: high (muy visitadas), mid (intermedias), low (poco visitadas). Está en el evento porque cambia cada año.';

-- Cada repetición del recorrido de una facultad
create table public.tour_sessions (
  id uuid primary key default gen_random_uuid(),
  event_faculty_id uuid not null references public.event_faculties (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  seats_taken integer not null default 0 check (seats_taken >= 0),
  meeting_point text,
  status public.tour_session_status not null default 'open',
  unique (event_faculty_id, starts_at),
  check (ends_at > starts_at),
  check (seats_taken <= capacity)
);

comment on column public.tour_sessions.seats_taken is 'Solo lo modifican las RPC y los triggers de inscripción; nunca la interfaz.';
comment on constraint tour_sessions_event_faculty_id_starts_at_key on public.tour_sessions is 'Clave natural: la carga por CSV (import_tour_sessions) es idempotente sobre facultad + inicio.';

alter table public.events enable row level security;
alter table public.event_faculties enable row level security;
alter table public.tour_sessions enable row level security;

-- La web pública lee el evento y sus facultades; los horarios y cupos salen por la vista segura
create policy "events: lectura pública" on public.events
  for select to anon, authenticated using (true);
create policy "events: admin escribe" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "event_faculties: lectura pública" on public.event_faculties
  for select to anon, authenticated using (true);
create policy "event_faculties: admin escribe" on public.event_faculties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "tour_sessions: directiva lee" on public.tour_sessions
  for select to authenticated using (public.is_board());
create policy "tour_sessions: admin escribe" on public.tour_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Disponibilidad pública: sesiones, nivel y cupos restantes, sin datos de inscripciones.
-- Es una vista con los privilegios de su dueño a propósito (el público no lee tour_sessions).
create view public.v_tour_availability
with (security_invoker = false)
as
select
  ts.id as session_id,
  ef.event_id,
  ef.faculty_id,
  f.name as faculty_name,
  ef.tier,
  ts.starts_at,
  ts.ends_at,
  ts.meeting_point,
  ts.capacity,
  greatest(ts.capacity - ts.seats_taken, 0) as seats_remaining,
  ts.status
from public.tour_sessions ts
join public.event_faculties ef on ef.id = ts.event_faculty_id
join public.faculties f on f.id = ef.faculty_id
where ts.status <> 'cancelled';

comment on view public.v_tour_availability is 'Disponibilidad pública de recorridos. No expone inscripciones ni seats_taken.';

revoke all on public.v_tour_availability from public, anon, authenticated;
grant select on public.v_tour_availability to anon, authenticated;

-- Carga de horarios por CSV ---------------------------------------------------------------

-- Quita las comillas de un campo CSV y desescapa las comillas dobles ("" -> ")
create function public.csv_unquote(v text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v like '"%"' and length(v) >= 2 then replace(substr(v, 2, length(v) - 2), '""', '"')
    else v
  end;
$$;

create type public.tour_import_row as (
  line integer,
  action text,
  faculty text,
  event_faculty_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  meeting_point text,
  message text
);

-- Importa horarios de recorridos desde un CSV (con encabezado):
--   facultad,inicio,fin,cupo,punto_encuentro
-- · Separador coma o punto y coma (se detecta en el encabezado); admite comillas dobles.
-- · inicio y fin en hora de Lima, p. ej. 2026-11-20 09:30.
-- · La facultad debe estar incluida en el evento (event_faculties).
-- · Idempotente: la clave es (facultad, inicio). Crea las nuevas, actualiza las que cambian y
--   deja igual las demás. Las sesiones que no aparecen en el CSV no se tocan.
-- Con p_apply = false solo devuelve la vista previa. Con p_apply = true aplica todo o nada:
-- si alguna fila tiene error, lanza una excepción y no cambia nada.
create function public.import_tour_sessions(
  p_event_id uuid,
  p_csv text,
  p_apply boolean default false
)
returns setof public.tour_import_row
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.import_tour_sessions(uuid, text, boolean) from public, anon;
grant execute on function public.import_tour_sessions(uuid, text, boolean) to authenticated;
