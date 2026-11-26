-- RLS del Open Day.
-- · El dueño ve solo su inscripción y lo que cuelga de ella. No escribe directo en ninguna tabla:
--   todo pasa por las RPC de 09_openday_rpc.sql (SECURITY DEFINER, que no pasan por RLS).
-- · board lee todo (validar, confirmar, exportar). Sus cambios también van por RPC.
-- · admin cambia la configuración (events, event_faculties, tour_sessions, document_templates,
--   logistics_options). Los overrides sobre inscripciones van por RPC, con motivo y bitácora.
-- · anon no ve inscripciones. Lee solo el catálogo de logística activo y, desde 07, los eventos.

-- Helpers (security definer para no encadenar RLS entre tablas) --------------------------------------

create function public.owns_registration(target_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_registrations r
    where r.id = target_registration_id
      and r.owner_id = (select auth.uid())
  );
$$;

-- El pase es de una persona que figura en una inscripción del usuario
create function public.owns_pass(target_pass_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_attendees ea
    join public.event_registrations r on r.id = ea.registration_id
    where ea.pass_id = target_pass_id
      and r.owner_id = (select auth.uid())
  );
$$;

-- La persona figura en una inscripción del usuario
create function public.owns_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_attendees ea
    join public.event_registrations r on r.id = ea.registration_id
    where ea.participant_id = target_participant_id
      and r.owner_id = (select auth.uid())
  );
$$;

-- El colegio es el de una inscripción del usuario
create function public.owns_school(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_registrations r
    where r.school_id = target_school_id
      and r.owner_id = (select auth.uid())
  );
$$;

revoke execute on function
  public.owns_registration(uuid),
  public.owns_pass(uuid),
  public.owns_participant(uuid),
  public.owns_school(uuid)
from public, anon;

grant execute on function
  public.owns_registration(uuid),
  public.owns_pass(uuid),
  public.owns_participant(uuid),
  public.owns_school(uuid)
to authenticated;

-- Sin escrituras directas: se quitan los privilegios de escritura además de no definir políticas.
-- Defensa en profundidad: aunque alguien añada una política por error, la tabla no acepta escrituras.
revoke insert, update, delete, truncate on
  public.event_registrations,
  public.event_attendees,
  public.event_passes,
  public.registration_passes,
  public.tour_enrollments,
  public.registration_documents,
  public.registration_events,
  public.registration_messages,
  public.registration_logistics,
  public.email_outbox
from anon, authenticated;

-- Inscripciones -----------------------------------------------------------------------------------------

create policy "event_registrations: dueño ve la suya" on public.event_registrations
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "event_registrations: directiva ve todas" on public.event_registrations
  for select to authenticated using (public.is_board());

create policy "event_attendees: dueño ve los suyos" on public.event_attendees
  for select to authenticated using (public.owns_registration(registration_id));
create policy "event_attendees: directiva ve todos" on public.event_attendees
  for select to authenticated using (public.is_board());

create policy "tour_enrollments: dueño ve los suyos" on public.tour_enrollments
  for select to authenticated using (public.owns_registration(registration_id));
create policy "tour_enrollments: directiva ve todos" on public.tour_enrollments
  for select to authenticated using (public.is_board());

create policy "registration_documents: dueño ve los suyos" on public.registration_documents
  for select to authenticated using (public.owns_registration(registration_id));
create policy "registration_documents: directiva ve todos" on public.registration_documents
  for select to authenticated using (public.is_board());

create policy "registration_logistics: dueño ve la suya" on public.registration_logistics
  for select to authenticated using (public.owns_registration(registration_id));
create policy "registration_logistics: directiva ve todas" on public.registration_logistics
  for select to authenticated using (public.is_board());

-- El dueño ve los pases de las personas de su inscripción ("Mis códigos")
create policy "event_passes: dueño ve los de su inscripción" on public.event_passes
  for select to authenticated using (public.owns_pass(id));
create policy "event_passes: directiva ve todos" on public.event_passes
  for select to authenticated using (public.is_board());

create policy "registration_passes: dueño ve la suya" on public.registration_passes
  for select to authenticated using (public.owns_registration(registration_id));
create policy "registration_passes: directiva ve todas" on public.registration_passes
  for select to authenticated using (public.is_board());

-- Chat: el dueño lee los mensajes de su inscripción; la directiva, todos. Se escribe solo por RPC.
create policy "registration_messages: dueño ve los suyos" on public.registration_messages
  for select to authenticated using (public.owns_registration(registration_id));
create policy "registration_messages: directiva ve todos" on public.registration_messages
  for select to authenticated using (public.is_board());

-- La bitácora y la cola de correos son internas: solo la directiva
create policy "registration_events: directiva lee" on public.registration_events
  for select to authenticated using (public.is_board());
create policy "email_outbox: directiva lee" on public.email_outbox
  for select to authenticated using (public.is_board());

-- Personas y colegios: el dueño ve los de su inscripción (la directiva y admin ya tienen políticas en 06)
create policy "participants: dueño ve los de su inscripción" on public.participants
  for select to authenticated using (public.owns_participant(id));
create policy "schools: dueño ve el suyo" on public.schools
  for select to authenticated using (public.owns_school(id));

-- Configuración ------------------------------------------------------------------------------------------

-- Plantillas: cualquier usuario con sesión ve las activas (las descarga el formulario)
create policy "document_templates: lectura de activas" on public.document_templates
  for select to authenticated using (active);
create policy "document_templates: directiva ve todas" on public.document_templates
  for select to authenticated using (public.is_board());
create policy "document_templates: admin escribe" on public.document_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Logística: el formulario dibuja las opciones activas
create policy "logistics_options: lectura de activas" on public.logistics_options
  for select to anon, authenticated using (active);
create policy "logistics_options: directiva ve todas" on public.logistics_options
  for select to authenticated using (public.is_board());
create policy "logistics_options: admin escribe" on public.logistics_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- RPC adicionales que cierran el flujo sin escrituras directas ------------------------------------------------

-- Logística de la inscripción (solo mientras está reservada): [{option_code, quantity, notes?}]
create function public.set_logistics(p_registration_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg public.event_registrations;
  v_item jsonb;
begin
  v_reg := public._lock_owned_registration(p_registration_id);
  if v_reg.status <> 'reserved' then
    perform public._fail('bad_state', 'La logística ya no se puede cambiar');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    perform public._fail('attendees_invalid', 'La logística no es válida');
  end if;

  delete from public.registration_logistics where registration_id = v_reg.id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (
      select 1 from public.logistics_options o where o.code = v_item ->> 'option_code' and o.active
    ) then
      perform public._fail('invalid_option', 'La opción de logística "' || coalesce(v_item ->> 'option_code', '') || '" no existe');
    end if;
    insert into public.registration_logistics (registration_id, option_code, quantity, notes)
    values (v_reg.id, v_item ->> 'option_code', (v_item ->> 'quantity')::integer, nullif(btrim(v_item ->> 'notes'), ''));
  end loop;

  perform public._log_registration_event(
    v_reg.id, 'logistics_set', v_reg.status, v_reg.status, null,
    jsonb_build_object('items', jsonb_array_length(p_items))
  );
end;
$$;

-- Check-in por código: marca la hora de ingreso y avisa si la persona ya había ingresado.
-- Datos de un código: ficha grupal de un colegio (registration_passes) o pase de una persona
-- (event_passes). Devuelve null si el código no existe. Solo entra quien pertenece a una inscripción
-- confirmada: una reabierta conserva sus códigos, pero no da acceso hasta que se vuelva a confirmar.
create function public._pass_info(p_access_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_access_code));
  v_group public.registration_passes;
  v_pass public.event_passes;
  v_reg public.event_registrations;
  v_kind text;
  v_pass_id uuid;
  v_name text;
  v_role public.attendee_role;
  v_checked timestamptz;
  v_school text;
  v_tutors jsonb;
begin
  select * into v_group
  from public.registration_passes rp where rp.access_code = v_code and rp.status = 'active';

  if v_group.id is not null then
    select * into v_reg from public.event_registrations r where r.id = v_group.registration_id;
    v_kind := 'group';
    v_pass_id := v_group.id;
    v_name := v_reg.contact_name;
    v_checked := v_group.checked_in_at;
  else
    select * into v_pass
    from public.event_passes ep where ep.access_code = v_code and ep.status = 'active';
    if v_pass.id is null then
      return null;
    end if;
    v_kind := 'person';
    v_pass_id := v_pass.id;
    v_checked := v_pass.checked_in_at;
    select p.first_name || ' ' || p.last_name into v_name
    from public.participants p where p.id = v_pass.participant_id;

    -- Inscripción vigente de la persona (la confirmada primero)
    select r.* into v_reg
    from public.event_attendees a
    join public.event_registrations r on r.id = a.registration_id
    where a.pass_id = v_pass.id and r.status not in ('cancelled', 'expired')
    order by (r.status = 'confirmed') desc, r.created_at desc
    limit 1;

    select a.attendee_role into v_role
    from public.event_attendees a
    where a.pass_id = v_pass.id and a.registration_id = v_reg.id;
  end if;

  select s.name into v_school from public.schools s where s.id = v_reg.school_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', p.first_name || ' ' || p.last_name,
      'doc_type', p.doc_type,
      'doc_number', p.doc_number
    ) order by p.last_name, p.first_name
  ), '[]'::jsonb)
  into v_tutors
  from public.event_attendees a
  join public.participants p on p.id = a.participant_id
  where v_kind = 'group' and a.registration_id = v_reg.id and a.attendee_role = 'chaperone';

  return jsonb_build_object(
    'ok', coalesce(v_reg.status = 'confirmed', false),
    'error', case when v_reg.status = 'confirmed' then null else 'not_confirmed' end,
    'pass_kind', v_kind,
    'pass_id', v_pass_id,
    'participant', v_name,
    'attendee_role', v_role,
    'registration_id', v_reg.id,
    'registration_status', v_reg.status,
    'reference_code', v_reg.reference_code,
    'school', v_school,
    'gate', v_reg.gate,
    'arrival_at', v_reg.arrival_at,
    'students', case when v_kind = 'group' then v_reg.expected_visitors end,
    'tutors', v_tutors,
    'representative_attends', v_reg.representative_attends,
    'docs_pending', v_reg.docs_received_at is null,
    'already', v_checked is not null,
    'checked_in_at', v_checked
  );
end;
$$;

-- Lo que muestra el lector al escanear, sin registrar nada
create function public.preview_pass(p_access_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede registrar ingresos');
  end if;
  return coalesce(public._pass_info(p_access_code), jsonb_build_object('ok', false, 'error', 'not_found'));
end;
$$;

-- Registra el ingreso (uno por código). Sin los documentos firmados en físico solo se entra con un
-- motivo, que queda en la bitácora. (La búsqueda por documento o nombre la hace la directiva leyendo
-- participants y event_passes.)
create function public.check_in_pass(p_access_code text, p_override_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_access_code));
  v_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_info jsonb;
  v_now timestamptz := now();
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede registrar ingresos');
  end if;

  -- Bloquea el código: dos lectores a la vez no registran dos ingresos
  perform 1 from public.registration_passes rp where rp.access_code = v_code for update;
  perform 1 from public.event_passes ep where ep.access_code = v_code for update;

  v_info := public._pass_info(v_code);
  if v_info is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not (v_info ->> 'ok')::boolean or (v_info ->> 'already')::boolean then
    return v_info;
  end if;
  if (v_info ->> 'docs_pending')::boolean and v_reason is null then
    return v_info || jsonb_build_object('ok', false, 'error', 'docs_pending');
  end if;

  if v_info ->> 'pass_kind' = 'group' then
    update public.registration_passes set checked_in_at = v_now where id = (v_info ->> 'pass_id')::uuid;
  else
    update public.event_passes set checked_in_at = v_now where id = (v_info ->> 'pass_id')::uuid;
  end if;

  perform public._log_registration_event(
    (v_info ->> 'registration_id')::uuid, 'checked_in', 'confirmed', 'confirmed',
    case when (v_info ->> 'docs_pending')::boolean then v_reason end,
    jsonb_build_object(
      'pass_id', v_info ->> 'pass_id',
      'participant', v_info ->> 'participant',
      'docs_pending', (v_info ->> 'docs_pending')::boolean
    )
  );

  return v_info || jsonb_build_object('checked_in_at', v_now);
end;
$$;

revoke execute on function public._pass_info(text) from public, anon, authenticated;

revoke execute on function public.set_logistics(uuid, jsonb), public.preview_pass(text), public.check_in_pass(text, text) from public, anon;
grant execute on function public.set_logistics(uuid, jsonb), public.preview_pass(text), public.check_in_pass(text, text) to authenticated;
