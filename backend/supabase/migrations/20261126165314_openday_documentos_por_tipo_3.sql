SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.record_registration_document (
  p_registration_id uuid,
  p_actor_id        uuid,
  p_kind            public.document_kind,
  p_drive_file_id   text,
  p_file_name       text,
  p_size_bytes      bigint
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_allowed public.document_kind[];
  v_id uuid;
begin
  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;

  if p_kind = 'credentials' then
    if v_reg.status <> 'confirmed' then
      perform public._fail('bad_state', 'Los códigos solo se generan para una inscripción confirmada');
    end if;
  else
    if p_actor_id is distinct from v_reg.owner_id then
      perform public._fail('not_found', 'No se encontró la inscripción');
    end if;
    if v_reg.status not in ('reserved', 'docs_observed') then
      perform public._fail('bad_state', 'Ya no se pueden subir documentos a esta inscripción');
    end if;
    if v_reg.docs_deadline is null or v_reg.docs_deadline <= now() then
      perform public._fail('deadline_passed', 'Venció el plazo para subir documentos');
    end if;
    v_allowed := case
      when v_reg.kind = 'school' then array['school_consolidated']::public.document_kind[]
      else array['individual_consolidated']::public.document_kind[]
    end;
    if not (p_kind = any (v_allowed)) then
      perform public._fail('invalid_kind', 'Este tipo de documento no corresponde a la inscripción');
    end if;
  end if;

  -- El consolidado de una persona libre reemplaza también los PDF sueltos del formato anterior
  update public.registration_documents
  set superseded_at = now()
  where registration_id = v_reg.id and superseded_at is null
    and (kind = p_kind or (p_kind = 'individual_consolidated' and kind <> 'credentials'));

  insert into public.registration_documents (registration_id, kind, drive_file_id, file_name, size_bytes)
  values (v_reg.id, p_kind, p_drive_file_id, p_file_name, p_size_bytes)
  returning id into v_id;

  insert into public.registration_events (registration_id, actor_id, event_type, from_status, to_status, detail)
  values (
    v_reg.id, p_actor_id,
    case when p_kind = 'credentials' then 'credentials_generated' else 'document_uploaded' end,
    v_reg.status, v_reg.status,
    jsonb_build_object('kind', p_kind, 'document_id', v_id, 'file_name', p_file_name, 'size_bytes', p_size_bytes)
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_tour (
  p_registration_id uuid,
  p_session_id      uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_updated integer;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status not in ('held', 'needs_reassignment') then
    perform public._fail('bad_state', 'La selección de recorridos ya no se puede cambiar');
  end if;

  update public.tour_enrollments
  set status = 'released'
  where registration_id = v_reg.id and session_id = p_session_id and status = 'held';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    perform public._fail('not_found', 'No tienes ese recorrido en retención');
  end if;

  if v_reg.status = 'held' and not exists (
    select 1 from public.tour_enrollments te where te.registration_id = v_reg.id and te.status = 'held'
  ) then
    update public.event_registrations set status = 'draft' where id = v_reg.id;
    perform public._log_registration_event(v_reg.id, 'hold_released', 'held', 'draft');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.renew_hold (
  p_registration_id uuid
)
  RETURNS timestamp WITH time zone
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_minutes integer;
  v_expires timestamptz;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  perform public._expire_holds(null, v_reg.id);
  select * into v_reg from public.event_registrations r where r.id = v_reg.id;

  if v_reg.status <> 'held' then
    perform public._fail('hold_expired', 'Tu tiempo de elección venció');
  end if;
  if v_reg.hold_renewals >= 1 then
    perform public._fail('renew_used', 'Ya renovaste el tiempo una vez');
  end if;

  select e.hold_minutes into v_minutes from public.events e where e.id = v_reg.event_id;
  v_expires := now() + make_interval(mins => v_minutes);

  update public.tour_enrollments
  set hold_expires_at = v_expires
  where registration_id = v_reg.id and status = 'held';
  update public.event_registrations set hold_renewals = hold_renewals + 1 where id = v_reg.id;
  perform public._log_registration_event(v_reg.id, 'hold_renewed', 'held', 'held');

  return v_expires;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resubmit_registration (
  p_registration_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'docs_observed' then
    perform public._fail('bad_state', 'Esta inscripción no tiene documentos observados');
  end if;
  if v_reg.docs_deadline < now() then
    perform public._fail('deadline_passed', 'Venció el plazo para reemplazar los documentos');
  end if;
  if exists (
    select 1 from public.registration_documents d
    where d.registration_id = v_reg.id and d.superseded_at is null and d.observation is not null
  ) then
    perform public._fail('docs_pending', 'Aún hay documentos observados sin reemplazar');
  end if;

  update public.event_registrations set status = 'submitted', submitted_at = now() where id = v_reg.id;
  perform public._log_registration_event(v_reg.id, 'resubmitted', 'docs_observed', 'submitted');
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_registration_message (
  p_registration_id uuid,
  p_body            text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_body text := btrim(coalesce(p_body, ''));
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status in ('expired', 'cancelled') then
    perform public._fail('bad_state', 'Esta inscripción ya terminó');
  end if;
  if v_body = '' or length(v_body) > 1000 then
    perform public._fail('attendees_invalid', 'Escribe un mensaje de hasta 1000 caracteres');
  end if;

  insert into public.registration_messages (registration_id, sender, sender_id, body)
  values (v_reg.id, 'owner', (select auth.uid()), v_body);

  update public.event_registrations
  set awaiting_staff = true, last_message_at = now()
  where id = v_reg.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_attendees (
  p_registration_id uuid,
  p_people          jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'reserved' then
    perform public._fail('bad_state', 'La lista de personas ya no se puede cambiar');
  end if;
  if v_reg.docs_deadline < now() then
    perform public._fail('deadline_passed', 'Venció el plazo para completar la inscripción');
  end if;
  return public._apply_attendees(v_reg.id, p_people, true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_expected_visitors (
  p_registration_id   uuid,
  p_expected_visitors integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_ev public.events;
  v_visitors integer;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'reserved' then
    perform public._fail('bad_state', 'La cantidad ya no se puede cambiar');
  end if;
  if v_reg.docs_deadline < now() then
    perform public._fail('deadline_passed', 'Venció el plazo para completar la inscripción');
  end if;
  if p_expected_visitors is null or p_expected_visitors < 1 then
    perform public._fail('attendees_invalid', 'Indica cuántos visitantes asistirán');
  end if;

  select * into v_ev from public.events e where e.id = v_reg.event_id;
  if v_reg.kind = 'individual' and p_expected_visitors > v_ev.max_visitors_individual then
    perform public._fail('attendees_invalid', format('Una inscripción individual admite hasta %s visitantes', v_ev.max_visitors_individual));
  end if;
  if v_reg.kind = 'school' and v_ev.max_visitors_per_registration is not null
     and p_expected_visitors > v_ev.max_visitors_per_registration then
    perform public._fail('attendees_invalid', 'Superaste el máximo de visitantes por inscripción');
  end if;

  select count(*) into v_visitors
  from public.event_attendees ea
  where ea.registration_id = v_reg.id and ea.attendee_role = 'visitor';
  if v_visitors > p_expected_visitors then
    perform public._fail(
      'attendees_invalid',
      format('Ya registraste %s visitantes: quita a los que sobran antes de reducir la cantidad', v_visitors)
    );
  end if;

  begin
    update public.tour_enrollments
    set seats = p_expected_visitors
    where registration_id = v_reg.id and status <> 'released';
    update public.event_registrations set expected_visitors = p_expected_visitors where id = v_reg.id;
  exception
    when check_violation then
      perform public._fail('no_capacity', 'Algún recorrido no tiene cupo para esa cantidad de visitantes');
  end;

  perform public._log_registration_event(
    v_reg.id, 'expected_visitors_changed', v_reg.status, v_reg.status, null,
    jsonb_build_object('from', v_reg.expected_visitors, 'to', p_expected_visitors)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_send_message (
  p_registration_id uuid,
  p_body            text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede escribir a las inscripciones');
  end if;
  if v_body = '' or length(v_body) > 1000 then
    perform public._fail('reason_required', 'Escribe un mensaje de hasta 1000 caracteres');
  end if;

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;

  insert into public.registration_messages (registration_id, sender, sender_id, body)
  values (v_reg.id, 'staff', (select auth.uid()), v_body)
  returning id into v_id;

  update public.event_registrations
  set awaiting_staff = false, last_message_at = now()
  where id = v_reg.id;

  perform public._enqueue_email(
    v_reg.id, 'staff_message',
    jsonb_build_object('message', v_body),
    'message:' || v_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_registration (
  p_event_id          uuid,
  p_kind              public.registration_kind,
  p_school_id         uuid,
  p_expected_visitors integer,
  p_contact_name      text,
  p_contact_email     text,
  p_contact_phone     text                     DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_uid uuid := public._require_user();
  v_ev public.events;
  v_school_id uuid := case when p_kind = 'school' then p_school_id end;
  v_open_count integer;
  v_reg public.event_registrations;
begin
  select * into v_ev from public.events e where e.id = p_event_id;
  if not found then
    perform public._fail('not_found', 'No se encontró el evento');
  end if;

  if not (v_ev.registration_open and now() >= v_ev.registration_opens_at and now() < v_ev.registration_closes_at) then
    perform public._fail('registration_closed', 'La inscripción no está abierta');
  end if;

  if p_expected_visitors is null or p_expected_visitors < 1 then
    perform public._fail('attendees_invalid', 'Indica cuántos visitantes asistirán');
  end if;
  if p_kind = 'individual' and p_expected_visitors > v_ev.max_visitors_individual then
    perform public._fail('attendees_invalid', format('Una inscripción individual admite hasta %s visitantes', v_ev.max_visitors_individual));
  end if;
  if p_kind = 'school' then
    if v_school_id is null or not exists (select 1 from public.schools s where s.id = v_school_id) then
      perform public._fail('not_found', 'No se encontró el colegio');
    end if;
    if v_ev.max_visitors_per_registration is not null and p_expected_visitors > v_ev.max_visitors_per_registration then
      perform public._fail('attendees_invalid', 'Superaste el máximo de visitantes por inscripción');
    end if;
  end if;

  if p_contact_name is null or btrim(p_contact_name) = '' or p_contact_email is null or btrim(p_contact_email) = '' then
    perform public._fail('attendees_invalid', 'Indica el nombre y el correo de contacto');
  end if;

  if p_contact_phone is not null and btrim(p_contact_phone) <> ''
     and btrim(p_contact_phone) !~ '^\+?[0-9 -]{6,20}$' then
    perform public._fail('attendees_invalid', 'El teléfono de contacto no es válido');
  end if;

  -- Anti-acaparamiento: tope de inscripciones en curso por correo de contacto
  select count(*) into v_open_count
  from public.event_registrations r
  where r.event_id = p_event_id
    and lower(r.contact_email::text) = lower(btrim(p_contact_email))
    and r.status in ('draft', 'held', 'reserved');
  if v_open_count >= v_ev.max_drafts_per_email then
    perform public._fail('too_many_drafts', 'Ya tienes demasiadas inscripciones en curso con este correo');
  end if;

  insert into public.event_registrations (event_id, school_id, owner_id, kind, expected_visitors, contact_name, contact_email, contact_phone)
  values (p_event_id, v_school_id, v_uid, p_kind, p_expected_visitors, btrim(p_contact_name), btrim(p_contact_email),
          nullif(btrim(coalesce(p_contact_phone, '')), ''))
  returning * into v_reg;

  perform public._log_registration_event(v_reg.id, 'created', null, 'draft');
  return jsonb_build_object('id', v_reg.id, 'reference_code', v_reg.reference_code);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_registration (
  p_registration_id uuid,
  p_terms_version   text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_ev public.events;
  v_visitors integer;
  v_chaperones integer;
  v_adults integer;
  v_minor_visitor boolean;
  v_kinds public.document_kind[];
  v_required public.document_kind[];
  v_missing text[];
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'reserved' then
    perform public._fail('bad_state', 'Esta inscripción no se puede enviar');
  end if;
  if v_reg.docs_deadline < now() then
    perform public._fail('deadline_passed', 'Venció el plazo para completar la inscripción');
  end if;
  if p_terms_version is null or btrim(p_terms_version) = '' then
    perform public._fail('attendees_invalid', 'Debes aceptar el aviso de privacidad y la declaración de responsabilidad');
  end if;
  select * into v_ev from public.events e where e.id = v_reg.event_id;

  select
    count(*) filter (where ea.attendee_role = 'visitor'),
    count(*) filter (where ea.attendee_role = 'chaperone'),
    count(*) filter (where ea.attendee_role in ('chaperone', 'guardian')),
    coalesce(bool_or(ea.attendee_role = 'visitor' and extract(year from age(v_ev.event_date, p.birth_date)) < 18), false)
  into v_visitors, v_chaperones, v_adults, v_minor_visitor
  from public.event_attendees ea
  join public.participants p on p.id = ea.participant_id
  where ea.registration_id = v_reg.id;

  if v_visitors <> v_reg.expected_visitors then
    perform public._fail(
      'attendees_invalid',
      format('Debes registrar exactamente %s visitantes (hay %s)', v_reg.expected_visitors, v_visitors)
    );
  end if;

  if v_reg.kind = 'school' then
    if v_chaperones < ceil(v_visitors::numeric / v_ev.students_per_chaperone) then
      perform public._fail(
        'chaperones',
        format('Se necesitan al menos %s acompañantes del colegio (hay %s)',
               ceil(v_visitors::numeric / v_ev.students_per_chaperone), v_chaperones)
      );
    end if;
    if v_ev.max_visitors_per_registration is not null and v_visitors > v_ev.max_visitors_per_registration then
      perform public._fail('attendees_invalid', 'Superaste el máximo de visitantes por inscripción');
    end if;
    if v_ev.max_adults_per_registration is not null and v_adults > v_ev.max_adults_per_registration then
      perform public._fail('attendees_invalid', 'Superaste el máximo de adultos por inscripción');
    end if;
  elsif v_visitors > v_ev.max_visitors_individual then
    perform public._fail('attendees_invalid', format('Una inscripción individual admite hasta %s visitantes', v_ev.max_visitors_individual));
  elsif v_minor_visitor and v_adults < 1 then
    perform public._fail('attendees_invalid', 'Un visitante menor de edad debe ir con un adulto acompañante');
  end if;

  select array_agg(distinct d.kind) into v_kinds
  from public.registration_documents d
  where d.registration_id = v_reg.id and d.superseded_at is null;

  -- Las personas libres suben un solo PDF con todo; los colegios no suben nada
  v_required := case
    when v_reg.kind = 'school' then array[]::public.document_kind[]
    else array['individual_consolidated']::public.document_kind[]
  end;

  select array_agg(k::text order by k::text) into v_missing
  from unnest(v_required) k
  where v_kinds is null or not (k = any (v_kinds));
  if v_missing is not null then
    perform public._fail('docs_missing', 'Faltan documentos: ' || array_to_string(v_missing, ', '));
  end if;

  update public.event_registrations
  set status = 'submitted', submitted_at = now(), accepted_terms_at = now(), terms_version = btrim(p_terms_version), reopen_reason = null
  where id = v_reg.id;

  perform public._log_registration_event(v_reg.id, 'submitted', 'reserved', 'submitted');
  perform public._enqueue_email(
    v_reg.id, 'registration_received',
    jsonb_build_object('event_name', v_ev.name),
    'received:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );
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

CREATE OR REPLACE FUNCTION public.tour_sessions_cancelled()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_ids uuid[];
  v_id uuid;
  v_status public.registration_status;
begin
  select array_agg(distinct te.registration_id) into v_ids
  from public.tour_enrollments te
  where te.session_id = new.id and te.status <> 'released';

  if v_ids is null then
    return null;
  end if;

  update public.tour_enrollments
  set status = 'released'
  where session_id = new.id and status <> 'released';

  foreach v_id in array v_ids loop
    select r.status into v_status from public.event_registrations r where r.id = v_id;
    if v_status in ('reserved', 'submitted', 'docs_observed', 'confirmed') then
      update public.event_registrations set status = 'needs_reassignment' where id = v_id;
      perform public._log_registration_event(
        v_id, 'session_cancelled', v_status, 'needs_reassignment', 'Se canceló una sesión elegida',
        jsonb_build_object('session_id', new.id)
      );
      perform public._enqueue_email(
        v_id, 'session_cancelled', jsonb_build_object('session_id', new.id),
        'session_cancelled:' || v_id || ':' || new.id
      );
    elsif v_status = 'held' and not exists (
      select 1 from public.tour_enrollments te where te.registration_id = v_id and te.status = 'held'
    ) then
      update public.event_registrations set status = 'draft' where id = v_id;
    end if;
  end loop;

  return null;
end;
$function$;

ALTER TABLE "public"."document_templates"
  ADD CONSTRAINT "document_templates_audience_kind_version_key" UNIQUE (audience, kind, VERSION);

CREATE UNIQUE INDEX document_templates_active_idx ON public.document_templates USING btree (audience, kind)
  WHERE active;

COMMENT ON COLUMN "public"."document_templates"."audience" IS 'A quién va la plantilla: colegios (school) o personas libres (individual).';

