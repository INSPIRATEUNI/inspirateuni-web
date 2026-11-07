-- 🐧
-- Test: integraciones del Open Day (registro de documentos de Drive, datos del PDF de códigos y cola
-- de correos). Todas las funciones son solo de la service role.
BEGIN;
SELECT plan(38);

-- Código estable (HINT) del error de negocio que lanza una sentencia
CREATE FUNCTION pg_temp.hint(sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE h text;
BEGIN
  EXECUTE sql;
  RETURN 'sin error';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS h = PG_EXCEPTION_HINT;
  RETURN h;
END;
$$;

-- Datos de prueba -----------------------------------------------------------------------------------------
INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day Integraciones', current_date + 30, now() - interval '1 day', now() + interval '10 days');

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT 'f0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', f.id, 'high'
FROM public.faculties f WHERE f.name = 'Facultad de Ciencias';

INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity, meeting_point)
VALUES ('50000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
        (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima', 20, 'Hall central');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'dueno1@correo.pe', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'dueno2@correo.pe', '{}'::jsonb);

INSERT INTO public.schools (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Colegio Uno'),
  ('a0000000-0000-0000-0000-000000000002', 'Colegio Dos'),
  ('a0000000-0000-0000-0000-000000000003', 'Colegio Tres');

-- A: colegio reservado (sube documentos) · B: persona libre con plazo vencido ·
-- C: colegio confirmado (códigos) · D: colegio ya enviado
INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline, gate) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school', 'reserved', 5, 'Resp. Uno', 'uno@colegio.pe', now() + interval '2 days', NULL),
  ('b0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', NULL, '22222222-2222-2222-2222-222222222222', 'individual', 'reserved', 1, 'Persona Libre', 'libre@correo.pe', now() - interval '1 hour', NULL),
  ('b0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'school', 'confirmed', 2, 'Resp. Tres', 'tres@colegio.pe', now() + interval '2 days', 'Puerta 3'),
  ('b0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'school', 'submitted', 5, 'Resp. Dos', 'dos@colegio.pe', now() + interval '2 days', NULL);

INSERT INTO public.participants (id, doc_type, doc_number, first_name, last_name, birth_date) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'dni', '10000001', 'Ana', 'Zegarra', '2009-01-01'),
  ('c0000000-0000-0000-0000-000000000002', 'dni', '10000002', 'Beto', 'Alva', '2009-02-02');

INSERT INTO public.event_passes (id, event_id, participant_id, access_code) VALUES
  ('90000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-000000000001', '7K3F9A2B'),
  ('90000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-000000000002', '0123456J');

INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role, pass_id) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor', '90000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor', '90000000-0000-0000-0000-000000000002');

INSERT INTO public.tour_enrollments (registration_id, session_id, seats, status) VALUES
  ('b0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 2, 'reserved');

-- Nadie más que la service role ejecuta estas funciones ---------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT throws_ok($$SELECT * FROM public.claim_outbox_emails()$$, '42501', NULL, 'authenticated no reclama correos');
SELECT throws_ok($$SELECT public.complete_outbox_email(gen_random_uuid())$$, '42501', NULL, 'authenticated no cierra correos');
SELECT throws_ok(
  $$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school_consolidated', 'x', 'x.pdf', 1)$$,
  '42501', NULL, 'authenticated no registra documentos directo (solo la Edge Function)');
SELECT throws_ok($$SELECT public.credentials_payload('b0000000-0000-0000-0000-000000000003')$$, '42501', NULL, 'authenticated no lee el payload de códigos');

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT * FROM public.claim_outbox_emails()$$, '42501', NULL, 'anon no reclama correos');

-- Documentos ----------------------------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE service_role;

SELECT ok(
  public.record_registration_document('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school_consolidated', 'drive-a1', 'colegio.pdf', 1000) IS NOT NULL,
  'Registra el PDF consolidado del colegio');
SELECT is(
  (SELECT count(*)::int FROM public.registration_documents WHERE registration_id = 'b0000000-0000-0000-0000-000000000001' AND superseded_at IS NULL),
  1, 'Queda un documento vigente');

SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school_consolidated', 'drive-a2', 'colegio-v2.pdf', 2000);
SELECT is(
  (SELECT drive_file_id FROM public.registration_documents WHERE registration_id = 'b0000000-0000-0000-0000-000000000001' AND superseded_at IS NULL),
  'drive-a2', 'Al reemplazar queda vigente el nuevo archivo');
SELECT is(
  (SELECT count(*)::int FROM public.registration_documents WHERE registration_id = 'b0000000-0000-0000-0000-000000000001' AND superseded_at IS NOT NULL),
  1, 'El anterior queda con superseded_at (no se borra)');

SELECT is(
  pg_temp.hint($$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'consent', 'x', 'x.pdf', 1)$$),
  'invalid_kind', 'Un colegio solo sube el PDF consolidado');
SELECT is(
  pg_temp.hint($$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'school_consolidated', 'x', 'x.pdf', 1)$$),
  'not_found', 'No se sube a la inscripción de otro dueño');
SELECT is(
  pg_temp.hint($$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'consent', 'x', 'x.pdf', 1)$$),
  'deadline_passed', 'Vencido el plazo no se sube');
SELECT is(
  pg_temp.hint($$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'school_consolidated', 'x', 'x.pdf', 1)$$),
  'bad_state', 'Una inscripción enviada no recibe documentos');
SELECT is(
  pg_temp.hint($$SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000001', NULL, 'credentials', 'x', 'x.pdf', 1)$$),
  'bad_state', 'Los códigos solo se registran con la inscripción confirmada');

SELECT ok(
  public.record_registration_document('b0000000-0000-0000-0000-000000000003', NULL, 'credentials', 'drive-c1', 'codigos.pdf', 5000) IS NOT NULL,
  'Registra el PDF de códigos de una inscripción confirmada');
SELECT public.record_registration_document('b0000000-0000-0000-0000-000000000003', NULL, 'credentials', 'drive-c2', 'codigos-v2.pdf', 5100);
SELECT is(
  (SELECT drive_file_id FROM public.registration_documents WHERE registration_id = 'b0000000-0000-0000-0000-000000000003' AND kind = 'credentials' AND superseded_at IS NULL),
  'drive-c2', 'Regenerar los códigos reemplaza el PDF anterior');

SELECT is(
  (SELECT count(*)::int FROM public.registration_events WHERE registration_id = 'b0000000-0000-0000-0000-000000000001' AND event_type = 'document_uploaded' AND actor_id = '11111111-1111-1111-1111-111111111111'),
  2, 'La bitácora guarda cada subida con su autor');
SELECT is(
  (SELECT count(*)::int FROM public.registration_events WHERE registration_id = 'b0000000-0000-0000-0000-000000000003' AND event_type = 'credentials_generated' AND actor_id IS NULL),
  2, 'La bitácora guarda la generación de códigos sin autor');

-- Payload del PDF de códigos --------------------------------------------------------------------------------
SELECT is(jsonb_array_length(public.credentials_payload('b0000000-0000-0000-0000-000000000003') -> 'people'), 2, 'El payload trae una fila por persona con pase');
SELECT is(jsonb_array_length(public.credentials_payload('b0000000-0000-0000-0000-000000000003') -> 'tours'), 1, 'El payload trae los recorridos');
SELECT is(public.credentials_payload('b0000000-0000-0000-0000-000000000003') -> 'registration' ->> 'school', 'Colegio Tres', 'El payload trae el colegio');
SELECT is(public.credentials_payload('b0000000-0000-0000-0000-000000000003') -> 'people' -> 0 ->> 'access_code', '0123456J', 'Ordena por apellido y trae el código del pase');
SELECT is(public.credentials_payload(gen_random_uuid()), NULL::jsonb, 'Sin inscripción no hay payload');

-- Cola de correos -------------------------------------------------------------------------------------------
RESET ROLE;
-- Sin secretos en Vault el trigger no hace nada y no rompe el INSERT
SELECT lives_ok($$
  INSERT INTO public.email_outbox (id, registration_id, to_email, template, dedupe_key, scheduled_at) VALUES
    ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'uno@colegio.pe', 'registration_reserved', 'q1', now() - interval '1 minute'),
    ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'uno@colegio.pe', 'registration_received', 'q2', now() - interval '1 minute'),
    ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'uno@colegio.pe', 'event_reminder', 'q3', now() + interval '1 hour')
$$, 'Encolar un correo no falla aunque no haya webhook configurado');
INSERT INTO public.email_outbox (id, registration_id, to_email, template, dedupe_key, scheduled_at, attempts)
VALUES ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'uno@colegio.pe', 'documents_observed', 'q4', now() - interval '1 minute', 4);

SET LOCAL ROLE service_role;
CREATE TEMP TABLE claimed AS SELECT * FROM public.claim_outbox_emails(10, 5);
GRANT SELECT ON claimed TO service_role;

SELECT is((SELECT count(*)::int FROM claimed), 3, 'Reclama solo los correos vencidos (no el programado a futuro)');
SELECT is((SELECT count(*)::int FROM claimed WHERE id = 'e0000000-0000-0000-0000-000000000003'), 0, 'No reclama un correo programado a futuro');
SELECT is((SELECT attempts FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000001'), 1, 'Reclamar cuenta el intento');
SELECT ok(
  (SELECT scheduled_at > now() + interval '1 minute' FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'Reclamar corre scheduled_at hacia adelante (reserva y espera del reintento)');
SELECT is((SELECT count(*)::int FROM public.claim_outbox_emails(10, 5)), 0, 'Un segundo reclamo no repite los correos en curso');
SELECT is((SELECT attempts FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000004'), 5, 'Cuenta el último intento');

SELECT public.complete_outbox_email('e0000000-0000-0000-0000-000000000001');
SELECT is((SELECT status::text FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000001'), 'sent', 'Un envío correcto queda sent');
SELECT ok((SELECT sent_at IS NOT NULL FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000001'), 'Guarda la hora de envío');

SELECT public.complete_outbox_email('e0000000-0000-0000-0000-000000000002', 'smtp caído');
SELECT is(
  (SELECT status::text || ':' || last_error FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000002'),
  'pending:smtp caído', 'Un fallo con intentos disponibles queda pendiente con el error');

SELECT public.complete_outbox_email('e0000000-0000-0000-0000-000000000004', 'smtp caído');
SELECT is((SELECT status::text FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000004'), 'failed', 'Al agotar los intentos queda failed');

SELECT public.complete_outbox_email('e0000000-0000-0000-0000-000000000003', 'plantilla desconocida', true);
SELECT is((SELECT status::text FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000003'), 'failed', 'Un error permanente queda failed de inmediato');

SELECT public.complete_outbox_email('e0000000-0000-0000-0000-000000000001', 'llegó tarde');
SELECT is((SELECT status::text FROM public.email_outbox WHERE id = 'e0000000-0000-0000-0000-000000000001'), 'sent', 'Un correo ya enviado no se reabre');

RESET ROLE;
SELECT lives_ok($$SELECT public.job_process_email_outbox()$$, 'El job de reintentos corre sin webhook configurado');
SELECT lives_ok($$SELECT public.notify_email_worker()$$, 'notify_email_worker sin secretos no hace nada');

SELECT * FROM finish();
ROLLBACK;
