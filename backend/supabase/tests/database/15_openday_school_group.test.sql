-- 🐧
-- Test: colegios con ficha única (representante y tutores sin lista de escolares, documentos en
-- físico e ingreso con un solo código).
BEGIN;
SELECT plan(27);

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

INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at)
VALUES ('eeeeeeee-0000-0000-0000-000000000015', 'Open Day Colegios', current_date + 30, now() - interval '1 day', now() + interval '10 days');
INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT 'f0000000-0000-0000-0000-000000000015', 'eeeeeeee-0000-0000-0000-000000000015', f.id, 'high'
FROM public.faculties f WHERE f.name = 'Facultad de Ciencias';
INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity)
VALUES ('50000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000015',
        (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima', 40);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'profe15@colegio.pe', '{}'::jsonb),
  ('15000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staff15@correo.pe', '{"full_name": "Staff Quince"}'::jsonb);

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('15000000-0000-0000-0000-0000000000cc', 'Gestión 15', '2026-01-01', '2027-01-01', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('15000000-0000-0000-0000-0000000000dd', 'Directiva 15', 'board', false);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status)
VALUES ('15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-0000000000dd', '15000000-0000-0000-0000-0000000000cc', 'active');

INSERT INTO public.schools (id, name) VALUES ('a0000000-0000-0000-0000-000000000015', 'Colegio Quince');
INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline)
VALUES ('b0000000-0000-0000-0000-000000000015', 'eeeeeeee-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000015',
        '15000000-0000-0000-0000-000000000001', 'school', 'reserved', 30, 'Rosa Directora', 'profe15@colegio.pe', now() + interval '2 days');
INSERT INTO public.tour_enrollments (registration_id, session_id, seats, status)
VALUES ('b0000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000015', 30, 'reserved');

-- El representante registra solo tutores ------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '15000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "15000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  pg_temp.hint($$SELECT public.save_school_people('b0000000-0000-0000-0000-000000000015',
    '{"role":"Directora","doc_type":"dni","doc_number":"41000001","attends":false}', '[]')$$),
  'chaperones', 'Sin tutores y sin el representante no se guarda');
SELECT is(
  public.save_school_people('b0000000-0000-0000-0000-000000000015',
    '{"role":"Directora","doc_type":"dni","doc_number":"41000001","attends":true}', '[]') ->> 'ok',
  'true', 'El representante que asiste cuenta como tutor');
SELECT is(
  pg_temp.hint($$SELECT public.save_school_people('b0000000-0000-0000-0000-000000000015',
    '{"role":"Directora","doc_type":"dni","doc_number":"41000001","attends":true}',
    '[{"doc_type":"dni","doc_number":"41000001","first_name":"Rosa","last_name":"Directora","birth_date":"1980-01-01"}]')$$),
  'attendees_invalid', 'El representante no se repite como tutor');
SELECT is(
  public.save_school_people('b0000000-0000-0000-0000-000000000015',
    '{"role":"Directora","doc_type":"dni","doc_number":"41000001","attends":true}',
    '[{"doc_type":"dni","doc_number":"41000002","first_name":"Luis","last_name":"Tutor","birth_date":"1985-01-01"}]') ->> 'ok',
  'true', 'Guarda representante y un tutor, sin escolares');
SELECT is(
  (SELECT string_agg(attendee_role::text, ',') FROM public.event_attendees WHERE registration_id = 'b0000000-0000-0000-0000-000000000015'),
  'chaperone', 'La lista queda solo con tutores');

SELECT lives_ok($$SELECT public.submit_registration('b0000000-0000-0000-0000-000000000015', '2026-2')$$,
  'Se envía sin lista de escolares y sin PDF');
SELECT lives_ok($$SELECT public.set_expected_visitors('b0000000-0000-0000-0000-000000000015', 25)$$,
  'Antes de la aceptación el colegio puede cambiar la cantidad');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000015'), 25, 'Se ajustan los cupos');

-- Observar sin ningun documento ---------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '15000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "15000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT lives_ok($$SELECT public.observe_documents('b0000000-0000-0000-0000-000000000015', 'Falta el celular de un tutor', now() + interval '1 day', '{}'::uuid[])$$,
  'Se envian indicaciones aunque no haya documentos');
SELECT is(
  (SELECT body FROM public.registration_messages WHERE registration_id = 'b0000000-0000-0000-0000-000000000015' AND sender = 'staff'),
  'Falta el celular de un tutor', 'La indicacion queda en el chat');
SET LOCAL "request.jwt.claim.sub" = '15000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "15000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok($$SELECT public.resubmit_registration('b0000000-0000-0000-0000-000000000015')$$,
  'Se reenvia sin subir nada');

-- La directiva acepta sin documentos ----------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '15000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "15000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT lives_ok($$SELECT public.confirm_registration('b0000000-0000-0000-0000-000000000015', 'Puerta 3', now() + interval '30 days')$$,
  'Se acepta sin documentos');
SELECT is((SELECT count(*)::int FROM public.registration_passes WHERE registration_id = 'b0000000-0000-0000-0000-000000000015'), 1, 'Un solo código para el colegio');
SELECT is((SELECT count(*)::int FROM public.event_passes WHERE event_id = 'eeeeeeee-0000-0000-0000-000000000015'), 0, 'No se emiten pases por persona');

SELECT is(jsonb_array_length(public.credentials_payload('b0000000-0000-0000-0000-000000000015') -> 'people'), 1, 'La ficha tiene una sola página');
SELECT is(public.credentials_payload('b0000000-0000-0000-0000-000000000015') -> 'people' -> 0 ->> 'full_name', 'Rosa Directora', 'La ficha lleva al representante');
SELECT is(public.credentials_payload('b0000000-0000-0000-0000-000000000015') -> 'people' -> 0 ->> 'relationship', '25 escolares · 2 tutores', 'La ficha lleva las cantidades');

CREATE TEMP TABLE code AS
SELECT access_code FROM public.registration_passes WHERE registration_id = 'b0000000-0000-0000-0000-000000000015';

-- Ingreso -------------------------------------------------------------------------------------------
SELECT is(public.preview_pass((SELECT access_code FROM code)) ->> 'students', '25', 'Al escanear se ve la cantidad de escolares');
SELECT is(jsonb_array_length(public.preview_pass((SELECT access_code FROM code)) -> 'tutors'), 1, 'Y la lista de tutores');
SELECT is((SELECT count(*)::int FROM public.registration_passes WHERE checked_in_at IS NOT NULL AND registration_id = 'b0000000-0000-0000-0000-000000000015'), 0, 'Escanear no registra el ingreso');
SELECT is(public.check_in_pass((SELECT access_code FROM code)) ->> 'error', 'docs_pending', 'Sin documentos en físico no entra sin motivo');
SELECT is(public.check_in_pass((SELECT access_code FROM code), 'Los traen en la tarde') ->> 'already', 'false', 'Con un motivo se registra el ingreso');
SELECT is(public.check_in_pass((SELECT access_code FROM code)) ->> 'already', 'true', 'Un colegio ingresa una sola vez');
SELECT is(
  (SELECT reason FROM public.registration_events WHERE registration_id = 'b0000000-0000-0000-0000-000000000015' AND event_type = 'checked_in'),
  'Los traen en la tarde', 'El motivo queda en la bitácora');
SELECT lives_ok($$SELECT public.mark_documents_received('b0000000-0000-0000-0000-000000000015')$$, 'La directiva marca los documentos recibidos');
SELECT is(public.preview_pass((SELECT access_code FROM code)) ->> 'docs_pending', 'false', 'Ya no figuran pendientes');
SELECT ok(
  (SELECT docs_received_by = '15000000-0000-0000-0000-000000000002' FROM public.event_registrations WHERE id = 'b0000000-0000-0000-0000-000000000015'),
  'Queda quién los recibió');

SELECT * FROM finish();
ROLLBACK;
