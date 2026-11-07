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
  public.tour_enrollments,
  public.registration_documents,
  public.registration_events,
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
-- (La búsqueda por documento la hace la directiva leyendo participants y event_passes.)
create function public.check_in_pass(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass public.event_passes;
  v_name text;
  v_already boolean;
begin
  if not public.is_board() then
    perform public._fail('forbidden', 'Solo la directiva puede registrar ingresos');
  end if;

  select * into v_pass
  from public.event_passes ep
  where ep.access_code = upper(btrim(p_access_code)) and ep.status = 'active'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select p.first_name || ' ' || p.last_name into v_name
  from public.participants p where p.id = v_pass.participant_id;

  v_already := v_pass.checked_in_at is not null;
  if not v_already then
    update public.event_passes set checked_in_at = now() where id = v_pass.id
    returning checked_in_at into v_pass.checked_in_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', v_already,
    'checked_in_at', v_pass.checked_in_at,
    'participant', v_name
  );
end;
$$;

revoke execute on function public.set_logistics(uuid, jsonb), public.check_in_pass(text) from public, anon;
grant execute on function public.set_logistics(uuid, jsonb), public.check_in_pass(text) to authenticated;
