SET local check_function_bodies = off;

ALTER TABLE "public"."events"
  ADD COLUMN "max_drafts_per_email" integer NOT NULL DEFAULT 3;

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

    for v_person in select * from jsonb_array_elements(p_people) loop
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
      -- El bloque se deshizo por completo; el conflicto se registra fuera de él
      perform public._log_registration_event(
        p_registration_id, 'attendee_conflict', v_reg.status, v_reg.status,
        'Un documento ya figura en otra inscripción o se repite en la lista'
      );
      return jsonb_build_object(
        'ok', false,
        'error', 'attendee_conflict',
        'message', 'No pudimos registrar a todas las personas. Revisa los datos ingresados.'
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

REVOKE ALL ON FUNCTION "public"."_apply_attendees"(uuid, jsonb, boolean) FROM PUBLIC, "anon", "authenticated";

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
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('reference_code', r.reference_code),
         p_dedupe_key
  from public.event_registrations r
  where r.id = p_registration_id
  on conflict (dedupe_key) do nothing;
$function$;

REVOKE ALL ON FUNCTION "public"."_enqueue_email"(uuid, text, jsonb, text) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_expire_holds"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_fail"(text, text) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_issue_passes"(uuid) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_lock_owned_registration"(uuid) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_log_registration_event"(uuid, text, public.registration_status, public.registration_status, text, jsonb) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_release_enrollments"(uuid) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_require_reason"(text) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_require_user"() FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."_revoke_orphan_passes"(uuid, uuid[]) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."admin_cancel_registration"(uuid, text) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."admin_override_limits"(uuid, integer, text, boolean) FROM PUBLIC, "anon";

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
  set status = 'reserved', docs_deadline = v_deadline, confirmed_at = null
  where id = v_reg.id;

  perform public._log_registration_event(
    v_reg.id, 'override_reopen', v_reg.status, 'reserved', btrim(p_reason),
    jsonb_build_object('docs_deadline', v_deadline)
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_reopen_registration"(uuid, text, timestamp WITH time zone) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."admin_set_attendees"(uuid, jsonb, text) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."check_seats_taken"(boolean) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."confirm_registration"(uuid, text, timestamp WITH time zone) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."confirm_selection"(uuid) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."hold_tour"(uuid, uuid) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."job_check_seats"() FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."job_enqueue_reminders"() FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."job_expire_holds"() FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."observe_documents"(uuid, text, timestamp WITH time zone, uuid[]) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."release_tour"(uuid, uuid) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."renew_hold"(uuid) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."resubmit_registration"(uuid) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."set_attendees"(uuid, jsonb) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.start_registration (
  p_event_id          uuid,
  p_kind              public.registration_kind,
  p_school_id         uuid,
  p_expected_visitors integer,
  p_contact_name      text,
  p_contact_email     text
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
  if p_kind = 'individual' and p_expected_visitors <> 1 then
    perform public._fail('attendees_invalid', 'Una inscripción individual es para un solo visitante');
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

  -- Anti-acaparamiento: tope de inscripciones en curso por correo de contacto
  select count(*) into v_open_count
  from public.event_registrations r
  where r.event_id = p_event_id
    and lower(r.contact_email::text) = lower(btrim(p_contact_email))
    and r.status in ('draft', 'held', 'reserved');
  if v_open_count >= v_ev.max_drafts_per_email then
    perform public._fail('too_many_drafts', 'Ya tienes demasiadas inscripciones en curso con este correo');
  end if;

  begin
    insert into public.event_registrations (event_id, school_id, owner_id, kind, expected_visitors, contact_name, contact_email)
    values (p_event_id, v_school_id, v_uid, p_kind, p_expected_visitors, btrim(p_contact_name), btrim(p_contact_email))
    returning * into v_reg;
  exception
    when unique_violation then
      perform public._fail('school_taken', 'Este colegio ya tiene una inscripción para el evento');
  end;

  perform public._log_registration_event(v_reg.id, 'created', null, 'draft');
  return jsonb_build_object('id', v_reg.id, 'reference_code', v_reg.reference_code);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."start_registration"(uuid, public.registration_kind, uuid, integer, text, text) FROM PUBLIC, "anon";

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
  elsif v_minor_visitor and v_adults < 1 then
    perform public._fail('attendees_invalid', 'Un visitante menor de edad debe ir con un adulto acompañante');
  end if;

  select array_agg(distinct d.kind) into v_kinds
  from public.registration_documents d
  where d.registration_id = v_reg.id and d.superseded_at is null;

  v_required := case
    when v_reg.kind = 'school' then array['school_consolidated']::public.document_kind[]
    when v_minor_visitor then array['consent', 'commitment_letter', 'guardian_declaration']::public.document_kind[]
    else array['consent', 'commitment_letter']::public.document_kind[]
  end;

  select array_agg(k::text order by k::text) into v_missing
  from unnest(v_required) k
  where v_kinds is null or not (k = any (v_kinds));
  if v_missing is not null then
    perform public._fail('docs_missing', 'Faltan documentos: ' || array_to_string(v_missing, ', '));
  end if;

  update public.event_registrations
  set status = 'submitted', submitted_at = now(), accepted_terms_at = now(), terms_version = btrim(p_terms_version)
  where id = v_reg.id;

  perform public._log_registration_event(v_reg.id, 'submitted', 'reserved', 'submitted');
  perform public._enqueue_email(
    v_reg.id, 'registration_received',
    jsonb_build_object('event_name', v_ev.name),
    'received:' || v_reg.id || ':' || extract(epoch from now())::bigint
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."submit_registration"(uuid, text) FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."tour_sessions_cancelled"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_max_drafts_per_email_check" CHECK ((max_drafts_per_email > 0));

CREATE TRIGGER tour_sessions_cancelled
  AFTER UPDATE OF status ON public.tour_sessions
  FOR EACH ROW
  WHEN (((new.status = 'cancelled'::public.tour_session_status) AND (old.status IS DISTINCT FROM 'cancelled'::public.tour_session_status)))
  EXECUTE FUNCTION public.tour_sessions_cancelled();

COMMENT ON COLUMN "public"."events"."max_drafts_per_email" IS 'Anti-acaparamiento: inscripciones en curso (draft, held, reserved) por correo de contacto y evento.';

REVOKE ALL ON FUNCTION "public"."_apply_attendees"(uuid, jsonb, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_apply_attendees"(uuid, jsonb, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_apply_attendees"(uuid, jsonb, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_enqueue_email"(uuid, text, jsonb, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_enqueue_email"(uuid, text, jsonb, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_enqueue_email"(uuid, text, jsonb, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_expire_holds"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_expire_holds"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_expire_holds"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_fail"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_fail"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_fail"(text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_issue_passes"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_issue_passes"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_issue_passes"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_lock_owned_registration"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_lock_owned_registration"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_lock_owned_registration"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_log_registration_event"(uuid, text, public.registration_status, public.registration_status, text, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_log_registration_event"(uuid, text, public.registration_status, public.registration_status, text, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_log_registration_event"(uuid, text, public.registration_status, public.registration_status, text, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_release_enrollments"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_release_enrollments"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_release_enrollments"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_require_reason"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_require_reason"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_require_reason"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_require_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_require_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_require_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_revoke_orphan_passes"(uuid, uuid[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_revoke_orphan_passes"(uuid, uuid[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_revoke_orphan_passes"(uuid, uuid[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."admin_cancel_registration"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_cancel_registration"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cancel_registration"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cancel_registration"(uuid, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."admin_override_limits"(uuid, integer, text, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_override_limits"(uuid, integer, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_override_limits"(uuid, integer, text, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_override_limits"(uuid, integer, text, boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."admin_reopen_registration"(uuid, text, timestamp WITH time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_reopen_registration"(uuid, text, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_reopen_registration"(uuid, text, timestamp WITH time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_reopen_registration"(uuid, text, timestamp WITH time zone) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."admin_set_attendees"(uuid, jsonb, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_set_attendees"(uuid, jsonb, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_set_attendees"(uuid, jsonb, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_set_attendees"(uuid, jsonb, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_seats_taken"(boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_seats_taken"(boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_seats_taken"(boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."confirm_registration"(uuid, text, timestamp WITH time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."confirm_registration"(uuid, text, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirm_registration"(uuid, text, timestamp WITH time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirm_registration"(uuid, text, timestamp WITH time zone) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."confirm_selection"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."confirm_selection"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirm_selection"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirm_selection"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."hold_tour"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."hold_tour"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."hold_tour"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."hold_tour"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."job_check_seats"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_check_seats"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_check_seats"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."job_enqueue_reminders"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_enqueue_reminders"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_enqueue_reminders"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."job_expire_holds"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_expire_holds"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_expire_holds"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."observe_documents"(uuid, text, timestamp WITH time zone, uuid[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."observe_documents"(uuid, text, timestamp WITH time zone, uuid[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."observe_documents"(uuid, text, timestamp WITH time zone, uuid[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."observe_documents"(uuid, text, timestamp WITH time zone, uuid[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."release_tour"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."release_tour"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."release_tour"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."release_tour"(uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."renew_hold"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."renew_hold"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."renew_hold"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."renew_hold"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."resubmit_registration"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."resubmit_registration"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."resubmit_registration"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."resubmit_registration"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_attendees"(uuid, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_attendees"(uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_attendees"(uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_attendees"(uuid, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."start_registration"(uuid, public.registration_kind, uuid, integer, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."start_registration"(uuid, public.registration_kind, uuid, integer, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."start_registration"(uuid, public.registration_kind, uuid, integer, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."start_registration"(uuid, public.registration_kind, uuid, integer, text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."submit_registration"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_registration"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_registration"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_registration"(uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."tour_sessions_cancelled"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_sessions_cancelled"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."tour_sessions_cancelled"() TO "service_role";
