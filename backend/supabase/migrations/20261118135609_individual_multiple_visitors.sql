SET local check_function_bodies = off;

ALTER TABLE "public"."event_registrations"
  DROP CONSTRAINT "event_registrations_check1";

ALTER TABLE "public"."events"
  ADD COLUMN "max_visitors_individual" integer NOT NULL DEFAULT 5;

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

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_max_visitors_individual_check" CHECK ((max_visitors_individual > 0));

COMMENT ON COLUMN "public"."events"."max_visitors_individual" IS 'Tope de visitantes (sin contar apoderados) por inscripción de persona libre.';
