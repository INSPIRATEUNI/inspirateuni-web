SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._apply_attendees (
  p_registration_id uuid,
  p_people          jsonb,
  p_enforce_cap     boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_prev uuid[];
  v_person jsonb;
  v_pid uuid;
  v_role public.attendee_role;
  v_visitors integer;
  v_idx integer;
  v_constraint text;
  v_message text;
begin
  select * into v_reg from public.event_registrations r where r.id = p_registration_id;

  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    perform public._fail('attendees_invalid', 'La lista de personas no es válida');
  end if;

  select count(*) into v_visitors
  from jsonb_array_elements(p_people) e
  where e ->> 'attendee_role' = 'visitor';

  if p_enforce_cap and v_visitors > v_reg.expected_visitors then
    perform public._fail('attendees_invalid', 'Hay más visitantes que los declarados en la inscripción');
  end if;

  select array_agg(ea.participant_id) into v_prev
  from public.event_attendees ea where ea.registration_id = p_registration_id;

  begin
    delete from public.event_attendees where registration_id = p_registration_id;

    for v_person, v_idx in
      select e.value, e.ord::integer from jsonb_array_elements(p_people) with ordinality as e(value, ord)
    loop
      v_role := (v_person ->> 'attendee_role')::public.attendee_role;

      insert into public.participants (doc_type, doc_number, first_name, last_name, birth_date, grade, email, phone, school_id)
      values (
        (v_person ->> 'doc_type')::public.doc_type,
        btrim(v_person ->> 'doc_number'),
        btrim(v_person ->> 'first_name'),
        btrim(v_person ->> 'last_name'),
        (v_person ->> 'birth_date')::date,
        nullif(btrim(v_person ->> 'grade'), ''),
        nullif(btrim(v_person ->> 'email'), ''),
        nullif(btrim(v_person ->> 'phone'), ''),
        case when v_role = 'visitor' then v_reg.school_id end
      )
      on conflict (doc_type, doc_number) do update
        set grade = coalesce(public.participants.grade, excluded.grade),
            email = coalesce(public.participants.email, excluded.email),
            phone = coalesce(public.participants.phone, excluded.phone)
      returning id into v_pid;

      insert into public.event_attendees (registration_id, participant_id, event_id, attendee_role, relationship)
      values (p_registration_id, v_pid, v_reg.event_id, v_role, nullif(btrim(v_person ->> 'relationship'), ''));
    end loop;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      v_message := case
        when v_constraint = 'event_attendees_registration_id_participant_id_key' then
          format('Fila %s: el documento %s está repetido en la lista.', v_idx, btrim(v_person ->> 'doc_number'))
        else
          format('Fila %s: el documento %s ya figura en otra inscripción de este evento. Si es un error, escríbenos con tu código de referencia (%s).',
                 v_idx, btrim(v_person ->> 'doc_number'), v_reg.reference_code)
      end;
      -- El bloque se deshizo por completo; el conflicto se registra fuera de él
      perform public._log_registration_event(
        p_registration_id, 'attendee_conflict', v_reg.status, v_reg.status,
        'Un documento ya figura en otra inscripción o se repite en la lista',
        jsonb_build_object('row', v_idx, 'doc_number', btrim(v_person ->> 'doc_number'), 'constraint', v_constraint)
      );
      return jsonb_build_object(
        'ok', false,
        'error', 'attendee_conflict',
        'message', v_message
      );
  end;

  perform public._revoke_orphan_passes(v_reg.event_id, v_prev);
  perform public._log_registration_event(
    p_registration_id, 'attendees_replaced', v_reg.status, v_reg.status, null,
    jsonb_build_object('people', jsonb_array_length(p_people), 'visitors', v_visitors)
  );

  return jsonb_build_object('ok', true, 'people', jsonb_array_length(p_people), 'visitors', v_visitors);
end;
$function$;

CREATE OR REPLACE FUNCTION public._enqueue_email (
  p_registration_id uuid,
  p_template        text,
  p_payload         jsonb,
  p_dedupe_key      text
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  insert into public.email_outbox (registration_id, to_email, template, payload, dedupe_key)
  select r.id, r.contact_email, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('reference_code', r.reference_code, 'kind', r.kind),
         p_dedupe_key
  from public.event_registrations r
  where r.id = p_registration_id
  on conflict (dedupe_key) do nothing;
$function$;

CREATE OR REPLACE FUNCTION public._expire_holds (
  p_session_id      uuid DEFAULT NULL::uuid,
  p_registration_id uuid DEFAULT NULL::uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_ids uuid[];
begin
  select array_agg(distinct te.registration_id) into v_ids
  from public.tour_enrollments te
  where te.status = 'held'
    and te.hold_expires_at < now()
    and (p_session_id is null or te.session_id = p_session_id)
    and (p_registration_id is null or te.registration_id = p_registration_id);

  if v_ids is null then
    return 0;
  end if;

  update public.tour_enrollments
  set status = 'released'
  where registration_id = any (v_ids) and status = 'held';

  with changed as (
    update public.event_registrations
    set status = 'draft'
    where id = any (v_ids) and status = 'held'
    returning id
  )
  insert into public.registration_events (registration_id, actor_id, event_type, from_status, to_status, reason)
  select id, (select auth.uid()), 'hold_expired', 'held', 'draft', 'Venció el temporizador de elección'
  from changed;

  return array_length(v_ids, 1);
end;
$function$;

CREATE OR REPLACE FUNCTION public._fail (
  p_code    text,
  p_message text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = p_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public._issue_passes (
  p_registration_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  with passes as (
    insert into public.event_passes (event_id, participant_id)
    select ea.event_id, ea.participant_id
    from public.event_attendees ea
    where ea.registration_id = p_registration_id
    on conflict (event_id, participant_id) do update set status = 'active'
    returning id, participant_id
  )
  update public.event_attendees ea
  set pass_id = passes.id
  from passes
  where ea.registration_id = p_registration_id and ea.participant_id = passes.participant_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public._lock_owned_registration (
  p_registration_id uuid
)
  RETURNS public.event_registrations
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
begin
  select * into v_reg
  from public.event_registrations r
  where r.id = p_registration_id and r.owner_id = public._require_user()
  for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  return v_reg;
end;
$function$;

CREATE OR REPLACE FUNCTION public._log_registration_event (
  p_registration_id uuid,
  p_event_type      text,
  p_from            public.registration_status,
  p_to              public.registration_status,
  p_reason          text                       DEFAULT NULL::text,
  p_detail          jsonb                      DEFAULT NULL::jsonb
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  insert into public.registration_events (registration_id, actor_id, event_type, from_status, to_status, reason, detail)
  values (p_registration_id, (select auth.uid()), p_event_type, p_from, p_to, p_reason, p_detail);
$function$;

CREATE OR REPLACE FUNCTION public._release_enrollments (
  p_registration_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_count integer;
begin
  update public.tour_enrollments
  set status = 'released'
  where registration_id = p_registration_id and status <> 'released';
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public._require_reason (
  p_reason text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if p_reason is null or btrim(p_reason) = '' then
    perform public._fail('reason_required', 'Debes indicar el motivo');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public._require_user()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public._revoke_orphan_passes (
  p_event_id        uuid,
  p_participant_ids uuid[]
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  update public.event_passes ep
  set status = 'revoked'
  where ep.event_id = p_event_id
    and ep.status = 'active'
    and ep.participant_id = any (coalesce(p_participant_ids, '{}'))
    and not exists (
      select 1
      from public.event_attendees ea
      join public.event_registrations r on r.id = ea.registration_id
      where ea.event_id = ep.event_id
        and ea.participant_id = ep.participant_id
        and r.status not in ('expired', 'cancelled')
    );
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_registration (
  p_registration_id uuid,
  p_reason          text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_participants uuid[];
begin
  if not public.is_admin() then
    perform public._fail('forbidden', 'Solo el administrador puede cancelar inscripciones');
  end if;
  perform public._require_reason(p_reason);

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status in ('expired', 'cancelled') then
    perform public._fail('bad_state', 'La inscripción ya terminó');
  end if;

  select array_agg(ea.participant_id) into v_participants
  from public.event_attendees ea where ea.registration_id = v_reg.id;

  perform public._release_enrollments(v_reg.id);
  update public.event_registrations set status = 'cancelled' where id = v_reg.id;
  perform public._revoke_orphan_passes(v_reg.event_id, v_participants);

  perform public._log_registration_event(v_reg.id, 'override_cancel', v_reg.status, 'cancelled', btrim(p_reason));
  perform public._enqueue_email(
    v_reg.id, 'registration_cancelled', jsonb_build_object('reason', btrim(p_reason)),
    'cancelled:' || v_reg.id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_override_limits (
  p_registration_id   uuid,
  p_expected_visitors integer,
  p_reason            text,
  p_raise_capacity    boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_enr record;
  v_delta integer;
begin
  if not public.is_admin() then
    perform public._fail('forbidden', 'Solo el administrador puede superar topes o cupos');
  end if;
  perform public._require_reason(p_reason);
  if p_expected_visitors is null or p_expected_visitors < 1 then
    perform public._fail('attendees_invalid', 'Indica una cantidad de visitantes válida');
  end if;

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status in ('expired', 'cancelled') then
    perform public._fail('bad_state', 'La inscripción ya terminó');
  end if;

  begin
    for v_enr in
      select te.id, te.session_id, te.seats
      from public.tour_enrollments te
      where te.registration_id = v_reg.id and te.status <> 'released'
    loop
      v_delta := p_expected_visitors - v_enr.seats;
      if p_raise_capacity and v_delta > 0 then
        update public.tour_sessions ts
        set capacity = ts.capacity + greatest(v_delta - (ts.capacity - ts.seats_taken), 0)
        where ts.id = v_enr.session_id;
      end if;
      update public.tour_enrollments set seats = p_expected_visitors where id = v_enr.id;
    end loop;

    update public.event_registrations set expected_visitors = p_expected_visitors where id = v_reg.id;
  exception
    when check_violation then
      perform public._fail('no_capacity', 'Algún recorrido no tiene cupo suficiente (usa p_raise_capacity para ampliarlo)');
  end;

  perform public._log_registration_event(
    v_reg.id, 'override_limits', v_reg.status, v_reg.status, btrim(p_reason),
    jsonb_build_object('from', v_reg.expected_visitors, 'to', p_expected_visitors, 'raise_capacity', p_raise_capacity)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reopen_registration (
  p_registration_id uuid,
  p_reason          text,
  p_docs_deadline   timestamp with time zone DEFAULT NULL::timestamp WITH time zone
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_hours integer;
  v_deadline timestamptz;
begin
  if not public.is_admin() then
    perform public._fail('forbidden', 'Solo el administrador puede reabrir inscripciones');
  end if;
  perform public._require_reason(p_reason);

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status not in ('submitted', 'docs_observed', 'confirmed') then
    perform public._fail('bad_state', 'Solo se reabre una inscripción enviada, observada o confirmada');
  end if;

  select e.reservation_hours into v_hours from public.events e where e.id = v_reg.event_id;
  v_deadline := coalesce(p_docs_deadline, now() + make_interval(hours => v_hours));

  update public.event_registrations
  set status = 'reserved', docs_deadline = v_deadline, confirmed_at = null, reopen_reason = btrim(p_reason)
  where id = v_reg.id;

  perform public._log_registration_event(
    v_reg.id, 'override_reopen', v_reg.status, 'reserved', btrim(p_reason),
    jsonb_build_object('docs_deadline', v_deadline)
  );
  perform public._enqueue_email(
    v_reg.id, 'registration_reopened',
    jsonb_build_object('reason', btrim(p_reason), 'deadline', v_deadline),
    'reopened:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_attendees (
  p_registration_id uuid,
  p_people          jsonb,
  p_reason          text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_result jsonb;
begin
  if not public.is_admin() then
    perform public._fail('forbidden', 'Solo el administrador puede editar la lista de personas');
  end if;
  perform public._require_reason(p_reason);

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status not in ('reserved', 'submitted', 'docs_observed', 'confirmed') then
    perform public._fail('bad_state', 'No se puede editar la lista en este estado');
  end if;

  v_result := public._apply_attendees(v_reg.id, p_people, false);
  if (v_result ->> 'ok')::boolean then
    perform public._log_registration_event(v_reg.id, 'override_attendees', v_reg.status, v_reg.status, btrim(p_reason), v_result);
    if v_reg.status = 'confirmed' then
      perform public._issue_passes(v_reg.id);
      perform public._enqueue_email(
        v_reg.id, 'credentials_updated', '{}'::jsonb,
        'credentials:' || v_reg.id || ':' || extract(epoch from now())::bigint
      );
    end if;
  end if;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_seats_taken (
  p_fix boolean DEFAULT false
)
  RETURNS TABLE (
    session_id   uuid,
    seats_taken  integer,
    actual_seats integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  return query
  with actual as (
    select ts.id, coalesce(sum(te.seats) filter (where te.status <> 'released'), 0)::integer as seats
    from public.tour_sessions ts
    left join public.tour_enrollments te on te.session_id = ts.id
    group by ts.id
  )
  select ts.id, ts.seats_taken, actual.seats
  from public.tour_sessions ts
  join actual on actual.id = ts.id
  where ts.seats_taken <> actual.seats;

  if p_fix then
    update public.tour_sessions ts
    set seats_taken = actual.seats
    from (
      select s.id, coalesce(sum(te.seats) filter (where te.status <> 'released'), 0)::integer as seats
      from public.tour_sessions s
      left join public.tour_enrollments te on te.session_id = s.id
      group by s.id
    ) actual
    where actual.id = ts.id and ts.seats_taken <> actual.seats;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_registration (
  p_registration_id uuid,
  p_gate            text,
  p_arrival_at      timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_ev public.events;
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede confirmar inscripciones');
  end if;
  if p_gate is null or btrim(p_gate) = '' or p_arrival_at is null then
    perform public._fail('attendees_invalid', 'Indica la puerta y la hora de llegada');
  end if;

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status <> 'submitted' then
    perform public._fail('bad_state', 'Solo se confirma una inscripción enviada');
  end if;
  select * into v_ev from public.events e where e.id = v_reg.event_id;

  update public.registration_documents
  set verified_by = (select auth.uid()), verified_at = now()
  where registration_id = v_reg.id and superseded_at is null and verified_at is null;

  perform public._issue_passes(v_reg.id);

  update public.event_registrations
  set status = 'confirmed', confirmed_at = now(), gate = btrim(p_gate), arrival_at = p_arrival_at
  where id = v_reg.id;

  perform public._log_registration_event(
    v_reg.id, 'confirmed', 'submitted', 'confirmed', null,
    jsonb_build_object('gate', btrim(p_gate), 'arrival_at', p_arrival_at)
  );
  perform public._enqueue_email(
    v_reg.id, 'registration_confirmed',
    jsonb_build_object('event_name', v_ev.name, 'gate', btrim(p_gate), 'arrival_at', p_arrival_at),
    'confirmed:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_selection (
  p_registration_id uuid
)
  RETURNS timestamp WITH time zone
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_ev public.events;
  v_active_tiers public.tour_tier[];
  v_missing text[];
  v_deadline timestamptz;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  perform public._expire_holds(null, v_reg.id);
  select * into v_reg from public.event_registrations r where r.id = v_reg.id;

  if v_reg.status not in ('held', 'needs_reassignment') then
    perform public._fail('bad_state', 'No hay una selección para confirmar');
  end if;
  select * into v_ev from public.events e where e.id = v_reg.event_id;

  select array_agg(distinct te.tier) into v_active_tiers
  from public.tour_enrollments te
  where te.registration_id = v_reg.id and te.status <> 'released';

  select coalesce(array_agg(distinct ef.tier::text order by ef.tier::text), '{}') into v_missing
  from public.event_faculties ef
  where ef.event_id = v_reg.event_id
    and (v_active_tiers is null or not (ef.tier = any (v_active_tiers)))
    and exists (
      select 1
      from public.tour_sessions ts
      where ts.event_faculty_id = ef.id
        and ts.status = 'open'
        and ts.capacity - ts.seats_taken >= v_reg.expected_visitors
        and not exists (
          select 1
          from public.tour_enrollments te
          where te.registration_id = v_reg.id
            and te.status <> 'released'
            and te.time_range && tstzrange(ts.starts_at, ts.ends_at + make_interval(mins => v_ev.travel_buffer_minutes), '[)')
        )
    );

  if v_active_tiers is null then
    if array_length(v_missing, 1) is null then
      perform public._fail('sold_out', 'Ya no quedan recorridos con cupo para tu grupo');
    end if;
    perform public._fail('no_selection', 'Elige al menos un recorrido');
  end if;
  if array_length(v_missing, 1) is not null then
    perform public._fail(
      'levels_incomplete',
      'Aún puedes elegir un recorrido en estos niveles: ' || array_to_string(v_missing, ', ')
    );
  end if;

  v_deadline := case
    when v_reg.status = 'needs_reassignment' then now() + make_interval(hours => v_ev.reservation_hours)
    else least(now() + make_interval(hours => v_ev.reservation_hours), v_ev.docs_close_at)
  end;
  if v_deadline <= now() then
    perform public._fail('docs_closed', 'Ya pasó la fecha límite para completar la inscripción');
  end if;

  update public.tour_enrollments
  set status = 'reserved', hold_expires_at = null
  where registration_id = v_reg.id and status = 'held';

  update public.event_registrations
  set status = 'reserved', reserved_at = now(), docs_deadline = v_deadline
  where id = v_reg.id;

  perform public._log_registration_event(v_reg.id, 'selection_confirmed', v_reg.status, 'reserved');
  perform public._enqueue_email(
    v_reg.id, 'registration_reserved',
    jsonb_build_object('docs_deadline', v_deadline, 'event_name', v_ev.name),
    'reserved:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );

  return v_deadline;
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.hold_tour (
  p_registration_id uuid,
  p_session_id      uuid
)
  RETURNS timestamp WITH time zone
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
  v_ev public.events;
  v_status public.tour_session_status;
  v_expires timestamptz;
  v_table text;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status not in ('draft', 'held', 'needs_reassignment') then
    perform public._fail('bad_state', 'La selección de recorridos ya no se puede cambiar');
  end if;

  -- Si su propio temporizador ya venció, se liberan sus retenciones y se parte de cero
  perform public._expire_holds(null, v_reg.id);
  select * into v_reg from public.event_registrations r where r.id = v_reg.id;

  select * into v_ev from public.events e where e.id = v_reg.event_id;
  if v_reg.status <> 'needs_reassignment'
    and not (v_ev.registration_open and now() >= v_ev.registration_opens_at and now() < v_ev.registration_closes_at) then
    perform public._fail('registration_closed', 'La inscripción no está abierta');
  end if;

  select ts.status into v_status
  from public.tour_sessions ts
  join public.event_faculties ef on ef.id = ts.event_faculty_id
  where ts.id = p_session_id and ef.event_id = v_reg.event_id;
  if not found then
    perform public._fail('session_not_found', 'No se encontró el recorrido');
  end if;
  if v_status <> 'open' then
    perform public._fail('session_closed', 'Este recorrido no está disponible');
  end if;

  -- Liberación perezosa: las retenciones vencidas de esta sesión no deben ocupar cupo
  perform public._expire_holds(p_session_id, null);

  v_expires := coalesce(
    (select max(te.hold_expires_at) from public.tour_enrollments te where te.registration_id = v_reg.id and te.status = 'held'),
    now() + make_interval(mins => v_ev.hold_minutes)
  );

  begin
    insert into public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
    values (v_reg.id, p_session_id, v_reg.expected_visitors, v_expires);
  exception
    when unique_violation then
      perform public._fail('tier_taken', 'Ya elegiste un recorrido de ese nivel');
    when exclusion_violation then
      perform public._fail('overlap', 'Este recorrido se cruza con otro que ya elegiste');
    when check_violation then
      get stacked diagnostics v_table = table_name;
      if v_table = 'tour_sessions' then
        perform public._fail('no_capacity', 'No hay cupo suficiente en este recorrido');
      end if;
      raise;
  end;

  if v_reg.status = 'draft' then
    update public.event_registrations set status = 'held' where id = v_reg.id;
    perform public._log_registration_event(v_reg.id, 'hold', 'draft', 'held', null, jsonb_build_object('session_id', p_session_id));
  end if;

  return v_expires;
end;
$function$;

CREATE OR REPLACE FUNCTION public.job_check_seats()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_rec record;
begin
  for v_rec in select * from public.check_seats_taken(true) loop
    raise warning 'seats_taken descuadrado en la sesión %: tenía %, la suma real es %',
      v_rec.session_id, v_rec.seats_taken, v_rec.actual_seats;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.job_enqueue_reminders()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_rec record;
begin
  for v_rec in
    select r.id, r.docs_deadline, e.name
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    where r.status = 'reserved'
      and r.docs_deadline > now()
      and r.docs_deadline <= now() + interval '12 hours'
  loop
    perform public._enqueue_email(
      v_rec.id, 'reservation_reminder',
      jsonb_build_object('docs_deadline', v_rec.docs_deadline, 'event_name', v_rec.name),
      'reservation_reminder:' || v_rec.id
    );
  end loop;

  for v_rec in
    select r.id, r.gate, r.arrival_at, e.name
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    where r.status = 'confirmed'
      and e.event_date - 1 = (now() at time zone 'America/Lima')::date
  loop
    perform public._enqueue_email(
      v_rec.id, 'event_reminder',
      jsonb_build_object('event_name', v_rec.name, 'gate', v_rec.gate, 'arrival_at', v_rec.arrival_at),
      'event_reminder:' || v_rec.id
    );
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.job_expire_holds()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_rec record;
begin
  perform public._expire_holds();

  for v_rec in
    select r.id, r.status
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    where (r.status = 'reserved' and r.docs_deadline < now())
       or (r.status = 'draft' and r.created_at < now() - make_interval(hours => e.reservation_hours))
    for update of r skip locked
  loop
    perform public._release_enrollments(v_rec.id);
    update public.event_registrations set status = 'expired' where id = v_rec.id;
    perform public._log_registration_event(
      v_rec.id, 'expired', v_rec.status, 'expired',
      case when v_rec.status = 'reserved' then 'Venció el plazo de 48 h' else 'Borrador sin completar' end
    );
    if v_rec.status = 'reserved' then
      perform public._enqueue_email(v_rec.id, 'reservation_expired', '{}'::jsonb, 'expired:' || v_rec.id);
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.observe_documents (
  p_registration_id uuid,
  p_observation     text,
  p_deadline        timestamp with time zone,
  p_document_ids    uuid[]                   DEFAULT NULL::uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_reg public.event_registrations;
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede observar documentos');
  end if;
  perform public._require_reason(p_observation);
  if p_deadline is null or p_deadline <= now() then
    perform public._fail('attendees_invalid', 'El plazo para reemplazar los documentos debe estar en el futuro');
  end if;

  select * into v_reg from public.event_registrations r where r.id = p_registration_id for update;
  if not found then
    perform public._fail('not_found', 'No se encontró la inscripción');
  end if;
  if v_reg.status not in ('submitted', 'docs_observed') then
    perform public._fail('bad_state', 'Solo se observan los documentos de una inscripción enviada');
  end if;

  update public.registration_documents
  set observation = btrim(p_observation)
  where registration_id = v_reg.id
    and superseded_at is null
    and (p_document_ids is null or id = any (p_document_ids));

  update public.event_registrations
  set status = 'docs_observed', docs_deadline = p_deadline
  where id = v_reg.id;

  perform public._log_registration_event(
    v_reg.id, 'docs_observed', v_reg.status, 'docs_observed', btrim(p_observation),
    jsonb_build_object('deadline', p_deadline)
  );
  perform public._enqueue_email(
    v_reg.id, 'documents_observed',
    jsonb_build_object('observation', btrim(p_observation), 'deadline', p_deadline),
    'observed:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );
end;
$function$;

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

