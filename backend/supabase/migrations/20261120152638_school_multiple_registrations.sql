SET local check_function_bodies = off;

DROP INDEX "public"."event_registrations_school_event_idx";

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

CREATE INDEX event_registrations_event_school_idx ON public.event_registrations USING btree (event_id, school_id)
  WHERE (school_id IS NOT NULL);
