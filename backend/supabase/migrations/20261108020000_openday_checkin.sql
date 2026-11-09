-- Check-in más seguro (Issue 1.5.8): solo inscripciones confirmadas, devuelve puerta e inscripción
-- y registra el primer ingreso en la bitácora. Misma firma y retorno jsonb.

-- Check-in por código: marca la hora de ingreso y avisa si la persona ya había ingresado.
-- Solo entra quien pertenece a una inscripción confirmada: una inscripción reabierta conserva sus
-- pases, pero no da acceso hasta que se vuelva a confirmar. El primer ingreso queda en la bitácora.
-- (La búsqueda por documento o nombre la hace la directiva leyendo participants y event_passes.)
create or replace function public.check_in_pass(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass public.event_passes;
  v_name text;
  v_already boolean;
  v_registration_id uuid;
  v_role public.attendee_role;
  v_reg public.event_registrations;
  v_school text;
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

  -- Inscripción vigente de la persona (la confirmada primero)
  select a.registration_id, a.attendee_role into v_registration_id, v_role
  from public.event_attendees a
  join public.event_registrations r on r.id = a.registration_id
  where a.pass_id = v_pass.id and r.status not in ('cancelled', 'expired')
  order by (r.status = 'confirmed') desc, r.created_at desc
  limit 1;

  if v_registration_id is not null then
    select * into v_reg from public.event_registrations r where r.id = v_registration_id;
    select s.name into v_school from public.schools s where s.id = v_reg.school_id;
  end if;

  if v_reg.id is null or v_reg.status <> 'confirmed' then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_confirmed',
      'participant', v_name,
      'reference_code', v_reg.reference_code,
      'registration_status', v_reg.status
    );
  end if;

  v_already := v_pass.checked_in_at is not null;
  if not v_already then
    update public.event_passes set checked_in_at = now() where id = v_pass.id
    returning checked_in_at into v_pass.checked_in_at;

    perform public._log_registration_event(
      v_reg.id, 'checked_in', v_reg.status, v_reg.status, null,
      jsonb_build_object('pass_id', v_pass.id, 'participant', v_name)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', v_already,
    'checked_in_at', v_pass.checked_in_at,
    'participant', v_name,
    'attendee_role', v_role,
    'registration_id', v_reg.id,
    'reference_code', v_reg.reference_code,
    'school', v_school,
    'gate', v_reg.gate,
    'arrival_at', v_reg.arrival_at
  );
end;
$$;
