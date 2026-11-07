-- Integraciones del Open Day (Issue 1.5.6): registro de documentos subidos a Drive, cola de correos
-- (webhook + reintentos) y datos para el PDF de códigos.
-- Todas las funciones son SECURITY DEFINER y solo las llama la Edge Function con la service role:
-- ningún usuario con sesión (authenticated) ni anónimo puede ejecutarlas.

-- Documentos ----------------------------------------------------------------------------------------------

-- Registra un archivo ya verificado en Drive. Reemplaza (supersede) el anterior del mismo tipo.
-- Un documento del dueño exige inscripción reservada u observada y dentro del plazo; las
-- credenciales (PDF de códigos, generado por Apps Script) exigen inscripción confirmada.
create function public.record_registration_document(
  p_registration_id uuid,
  p_actor_id uuid,
  p_kind public.document_kind,
  p_drive_file_id text,
  p_file_name text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Datos para el PDF de códigos: evento, inscripción, recorridos y una fila por persona con su pase activo
create function public.credentials_payload(p_registration_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

-- Cola de correos -----------------------------------------------------------------------------------------
-- Semántica: al menos una vez. La Edge Function reclama filas (claim), las envía y las cierra
-- (complete). Reclamar cuenta el intento y corre scheduled_at hacia adelante (2, 4, 8 y 16 min):
-- sirve de reserva si la función muere a mitad y de espera entre reintentos. La idempotencia al
-- encolar es email_outbox.dedupe_key; al enviar, el id de la fila viaja como Message-ID.

create function public.claim_outbox_emails(p_limit integer default 10, p_max_attempts integer default 5)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Cierra un correo: sin error queda 'sent'; con error queda pendiente (se reintenta) o 'failed' si
-- ya agotó los intentos o el error es permanente (plantilla desconocida, inscripción cancelada...).
create function public.complete_outbox_email(
  p_id uuid,
  p_error text default null,
  p_permanent boolean default false,
  p_max_attempts integer default 5
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
  set status = case
        when p_error is null then 'sent'::public.email_status
        when p_permanent or o.attempts >= p_max_attempts then 'failed'::public.email_status
        else o.status
      end,
      sent_at = case when p_error is null then now() else o.sent_at end,
      last_error = left(p_error, 1000)
  where o.id = p_id and o.status = 'pending';
$$;

-- Avisa a la Edge Function (webhook). URL y secreto salen de Vault (email_worker_url y
-- email_worker_secret); si faltan, no hace nada y el job de cada minuto procesa la cola igual.
-- net.http_post es asíncrono: la petición solo sale si la transacción se confirma.
create function public.notify_email_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create function public.email_outbox_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scheduled_at <= now() then
    perform public.notify_email_worker();
  end if;
  return null;
end;
$$;

create trigger email_outbox_notify
after insert on public.email_outbox
for each row
when (new.status = 'pending')
execute function public.email_outbox_after_insert();

-- Cada minuto: reintentos y correos programados que ya vencieron
create function public.job_process_email_outbox()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.email_outbox o
    where o.status = 'pending' and o.scheduled_at <= now() and o.attempts < 5
  ) then
    perform public.notify_email_worker();
  end if;
end;
$$;

-- Permisos: solo la service role (la Edge Function) y pg_cron (corre como postgres) -----------------------
revoke execute on function
  public.record_registration_document(uuid, uuid, public.document_kind, text, text, bigint),
  public.credentials_payload(uuid),
  public.claim_outbox_emails(integer, integer),
  public.complete_outbox_email(uuid, text, boolean, integer),
  public.notify_email_worker(),
  public.email_outbox_after_insert(),
  public.job_process_email_outbox()
from public, anon, authenticated;

grant execute on function
  public.record_registration_document(uuid, uuid, public.document_kind, text, text, bigint),
  public.credentials_payload(uuid),
  public.claim_outbox_emails(integer, integer),
  public.complete_outbox_email(uuid, text, boolean, integer)
to service_role;
