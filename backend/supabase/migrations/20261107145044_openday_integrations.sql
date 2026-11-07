SET local check_function_bodies = off;

CREATE EXTENSION "pg_net" SCHEMA "extensions";

CREATE OR REPLACE FUNCTION public.claim_outbox_emails (
  p_limit        integer DEFAULT 10,
  p_max_attempts integer DEFAULT 5
)
  RETURNS SETOF public.email_outbox
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  return query
  with due as (
    select o.id
    from public.email_outbox o
    where o.status = 'pending' and o.scheduled_at <= now() and o.attempts < p_max_attempts
    order by o.scheduled_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.email_outbox o
  set attempts = o.attempts + 1,
      scheduled_at = now() + interval '2 minutes' * power(2, o.attempts)
  from due
  where o.id = due.id
  returning o.*;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."claim_outbox_emails"(integer, integer) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.complete_outbox_email (
  p_id           uuid,
  p_error        text    DEFAULT NULL::text,
  p_permanent    boolean DEFAULT false,
  p_max_attempts integer DEFAULT 5
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  update public.email_outbox o
  set status = case
        when p_error is null then 'sent'::public.email_status
        when p_permanent or o.attempts >= p_max_attempts then 'failed'::public.email_status
        else o.status
      end,
      sent_at = case when p_error is null then now() else o.sent_at end,
      last_error = left(p_error, 1000)
  where o.id = p_id and o.status = 'pending';
$function$;

REVOKE ALL ON FUNCTION "public"."complete_outbox_email"(uuid, text, boolean, integer) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.credentials_payload (
  p_registration_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'registration', jsonb_build_object(
      'id', r.id,
      'reference_code', r.reference_code,
      'kind', r.kind,
      'status', r.status,
      'gate', r.gate,
      'arrival_at', r.arrival_at,
      'contact_name', r.contact_name,
      'contact_email', r.contact_email,
      'school', s.name
    ),
    'event', jsonb_build_object('name', e.name, 'event_date', e.event_date, 'venue', e.venue),
    'tours', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'faculty', f.name, 'starts_at', ts.starts_at, 'ends_at', ts.ends_at, 'meeting_point', ts.meeting_point
        ) order by ts.starts_at
      ), '[]'::jsonb)
      from public.tour_enrollments te
      join public.tour_sessions ts on ts.id = te.session_id
      join public.event_faculties ef on ef.id = ts.event_faculty_id
      join public.faculties f on f.id = ef.faculty_id
      where te.registration_id = r.id and te.status <> 'released'
    ),
    'people', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'full_name', p.first_name || ' ' || p.last_name,
          'doc_type', p.doc_type,
          'doc_number', p.doc_number,
          'role', ea.attendee_role,
          'relationship', ea.relationship,
          'access_code', ep.access_code
        ) order by ea.attendee_role, p.last_name, p.first_name
      ), '[]'::jsonb)
      from public.event_attendees ea
      join public.participants p on p.id = ea.participant_id
      join public.event_passes ep on ep.id = ea.pass_id and ep.status = 'active'
      where ea.registration_id = r.id
    )
  )
  from public.event_registrations r
  join public.events e on e.id = r.event_id
  left join public.schools s on s.id = r.school_id
  where r.id = p_registration_id;
$function$;

REVOKE ALL ON FUNCTION "public"."credentials_payload"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.email_outbox_after_insert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.scheduled_at <= now() then
    perform public.notify_email_worker();
  end if;
  return null;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."email_outbox_after_insert"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.job_process_email_outbox()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if exists (
    select 1 from public.email_outbox o
    where o.status = 'pending' and o.scheduled_at <= now() and o.attempts < 5
  ) then
    perform public.notify_email_worker();
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."job_process_email_outbox"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.notify_email_worker()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_url text;
  v_secret text;
begin
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'email_worker_url';
  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'email_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
exception when others then
  -- Nunca debe romper el INSERT que encola el correo
  raise warning 'notify_email_worker: %', sqlerrm;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."notify_email_worker"() FROM PUBLIC, "anon", "authenticated";

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
      else array['consent', 'commitment_letter', 'guardian_declaration']::public.document_kind[]
    end;
    if not (p_kind = any (v_allowed)) then
      perform public._fail('invalid_kind', 'Este tipo de documento no corresponde a la inscripción');
    end if;
  end if;

  update public.registration_documents
  set superseded_at = now()
  where registration_id = v_reg.id and kind = p_kind and superseded_at is null;

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

REVOKE ALL ON FUNCTION "public"."record_registration_document"(uuid, uuid, public.document_kind, text, text, bigint) FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER email_outbox_notify
  AFTER INSERT ON public.email_outbox
  FOR EACH ROW
  WHEN ((new.status = 'pending'::public.email_status))
  EXECUTE FUNCTION public.email_outbox_after_insert();

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

REVOKE ALL ON FUNCTION "public"."claim_outbox_emails"(integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_outbox_emails"(integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_outbox_emails"(integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_outbox_email"(uuid, text, boolean, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."complete_outbox_email"(uuid, text, boolean, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."complete_outbox_email"(uuid, text, boolean, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."credentials_payload"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."credentials_payload"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."credentials_payload"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."email_outbox_after_insert"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."email_outbox_after_insert"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."email_outbox_after_insert"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."job_process_email_outbox"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_process_email_outbox"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."job_process_email_outbox"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."notify_email_worker"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_email_worker"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_email_worker"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_registration_document"(uuid, uuid, public.document_kind, text, text, bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_registration_document"(uuid, uuid, public.document_kind, text, text, bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_registration_document"(uuid, uuid, public.document_kind, text, text, bigint) TO "service_role";

SELECT cron.schedule_in_database('openday-process-emails', '* * * * *', 'select public.job_process_email_outbox()', 'postgres', NULL, true);
