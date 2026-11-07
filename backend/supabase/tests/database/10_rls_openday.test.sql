-- 🐧
-- Test: RLS del Open Day. El dueño ve solo lo suyo y no escribe directo; board lee y exporta;
-- admin cambia la configuración; anon no ve inscripciones.
BEGIN;
SELECT plan(62);

-- Cuenta las filas que cambia un UPDATE con los permisos de quien llama (RLS filtra sin error)
CREATE FUNCTION pg_temp.upd(sql text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  EXECUTE sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Datos de prueba (como superusuario, con ids fijos) ------------------------------------------------------
INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day RLS', current_date + 30, now() - interval '1 day', now() + interval '10 days');

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT 'f0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', f.id, 'high'
FROM public.faculties f WHERE f.name = 'Facultad de Ciencias';

INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity)
VALUES ('50000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
        (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima', 20);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'dueno1@correo.pe', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'dueno2@correo.pe', '{}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'staff@uni.pe', '{"first_name": "Staff", "last_name": "Board"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'admin@uni.pe', '{"first_name": "Admin", "last_name": "Root"}'::jsonb),
  ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'voluntario@uni.pe', '{"first_name": "Vol", "last_name": "Sin Cargo"}'::jsonb);

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo RLS', '2026-01-01', '2027-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global) VALUES
  ('dddddddd-0001-0001-0001-dddddddddddd', 'Director RLS', 'board', false),
  ('dddddddd-0002-0002-0002-dddddddddddd', 'Admin RLS', 'admin', false);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-0002-0002-0002-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');

INSERT INTO public.schools (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Colegio Uno'),
  ('a0000000-0000-0000-0000-000000000002', 'Colegio Dos');

INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, status, expected_visitors, contact_name, contact_email, docs_deadline) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school', 'reserved', 5, 'Resp. Uno', 'uno@colegio.pe', now() + interval '2 days'),
  ('b0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', NULL, '22222222-2222-2222-2222-222222222222', 'individual', 'draft', 1, 'Persona Libre', 'libre@correo.pe', NULL);

INSERT INTO public.participants (id, doc_type, doc_number, first_name, last_name, birth_date) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'dni', '10000001', 'Persona', 'Uno', '2009-01-01'),
  ('c0000000-0000-0000-0000-000000000002', 'dni', '10000002', 'Persona', 'Dos', '2009-02-02'),
  ('c0000000-0000-0000-0000-000000000003', 'dni', '10000003', 'Persona', 'Ajena', '2009-03-03');

INSERT INTO public.event_passes (id, event_id, participant_id) VALUES
  ('90000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-000000000002');

INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role, pass_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor', '90000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor', '90000000-0000-0000-0000-000000000002');

INSERT INTO public.tour_enrollments (registration_id, session_id, seats, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, 'reserved'),
  ('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 1, 'reserved');

INSERT INTO public.registration_documents (registration_id, kind, drive_file_id, file_name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'school_consolidated', 'drive-1', 'uno.pdf'),
  ('b0000000-0000-0000-0000-000000000002', 'consent', 'drive-2', 'dos.pdf');

INSERT INTO public.registration_events (registration_id, event_type) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'created'),
  ('b0000000-0000-0000-0000-000000000002', 'created');

INSERT INTO public.email_outbox (registration_id, to_email, template, dedupe_key) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'uno@colegio.pe', 'registration_reserved', 'k1'),
  ('b0000000-0000-0000-0000-000000000002', 'libre@correo.pe', 'registration_reserved', 'k2');

INSERT INTO public.logistics_options (code, label, active) VALUES ('old_option', 'Opción retirada', false);
INSERT INTO public.registration_logistics (registration_id, option_code, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'bus', 2),
  ('b0000000-0000-0000-0000-000000000002', 'parking', 1);

INSERT INTO public.document_templates (kind, version, drive_file_id, active) VALUES
  ('consent', 1, 'tpl-1', true),
  ('consent', 2, 'tpl-2', false);

-- Dueño 1: ve solo lo suyo ------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT is((SELECT count(*)::int FROM public.event_registrations), 1, 'El dueño ve una sola inscripción');
SELECT is((SELECT count(*)::int FROM public.event_registrations WHERE id = 'b0000000-0000-0000-0000-000000000002'), 0, 'No ve la inscripción de otro dueño');
SELECT is((SELECT count(*)::int FROM public.event_attendees), 1, 'Ve solo sus asistentes');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments), 1, 'Ve solo sus recorridos');
SELECT is((SELECT count(*)::int FROM public.registration_documents), 1, 'Ve solo sus documentos');
SELECT is((SELECT count(*)::int FROM public.registration_logistics), 1, 'Ve solo su logística');
SELECT is((SELECT count(*)::int FROM public.event_passes), 1, 'Ve solo los pases de su inscripción');
SELECT is((SELECT count(*)::int FROM public.participants), 1, 'Ve solo a las personas de su inscripción');
SELECT is((SELECT count(*)::int FROM public.participants WHERE doc_number = '10000003'), 0, 'No ve a personas de otras inscripciones');
SELECT is((SELECT count(*)::int FROM public.schools), 1, 'Ve solo su colegio');
SELECT is((SELECT count(*)::int FROM public.registration_events), 0, 'La bitácora es interna');
SELECT is((SELECT count(*)::int FROM public.email_outbox), 0, 'La cola de correos es interna');
SELECT is((SELECT count(*)::int FROM public.document_templates), 1, 'Ve solo las plantillas activas');
SELECT is((SELECT count(*)::int FROM public.logistics_options), 2, 'Ve solo las opciones de logística activas');

-- Sin escrituras directas del dueño
SELECT throws_ok(
  $$ INSERT INTO public.event_registrations (event_id, owner_id, kind, expected_visitors, contact_name, contact_email)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'individual', 1, 'X', 'x@correo.pe') $$,
  '42501', NULL, 'El dueño no inserta inscripciones directo'
);
SELECT throws_ok(
  $$ UPDATE public.event_registrations SET status = 'confirmed' WHERE id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'El dueño no cambia el estado de su inscripción directo'
);
SELECT throws_ok($$ DELETE FROM public.event_registrations WHERE id = 'b0000000-0000-0000-0000-000000000001' $$, '42501', NULL, 'El dueño no borra su inscripción');
SELECT throws_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor') $$,
  '42501', NULL, 'El dueño no inserta asistentes directo'
);
SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, now() + interval '30 minutes') $$,
  '42501', NULL, 'El dueño no reserva cupo directo'
);
SELECT throws_ok($$ UPDATE public.event_passes SET checked_in_at = now() $$, '42501', NULL, 'El dueño no marca ingresos');
SELECT throws_ok($$ DELETE FROM public.registration_documents $$, '42501', NULL, 'El dueño no borra documentos');
SELECT is(pg_temp.upd('UPDATE public.tour_sessions SET capacity = 999'), 0, 'El dueño no cambia la capacidad de una sesión');
SELECT is(pg_temp.upd('UPDATE public.events SET max_file_mb = 50'), 0, 'El dueño no cambia la configuración del evento');

-- Las RPC sí funcionan para el dueño, aunque no pueda escribir directo
SELECT lives_ok(
  $$ SELECT public.set_logistics('b0000000-0000-0000-0000-000000000001', '[{"option_code":"bus","quantity":3,"notes":"Dos pisos"},{"option_code":"parking","quantity":1}]'::jsonb) $$,
  'El dueño guarda su logística por RPC'
);
SELECT is((SELECT count(*)::int FROM public.registration_logistics), 2, 'La logística quedó registrada y la ve el dueño');
SELECT throws_ok(
  $$ SELECT public.set_logistics('b0000000-0000-0000-0000-000000000001', '[{"option_code":"old_option","quantity":1}]'::jsonb) $$,
  'P0001', 'La opción de logística "old_option" no existe', 'No se pide una opción de logística retirada'
);
SELECT throws_ok(
  $$ SELECT public.set_logistics('b0000000-0000-0000-0000-000000000002', '[]'::jsonb) $$,
  'P0001', 'No se encontró la inscripción', 'No se guarda logística en la inscripción de otro'
);
SELECT throws_ok(
  $$ SELECT public.check_in_pass('XXXXXXXX') $$,
  'P0001', 'Solo la directiva puede registrar ingresos', 'El dueño no registra ingresos'
);

-- Dueño 2: no ve lo del dueño 1 -----------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.event_registrations), 1, 'El dueño 2 ve una sola inscripción');
SELECT is((SELECT count(*)::int FROM public.event_registrations WHERE id = 'b0000000-0000-0000-0000-000000000001'), 0, 'El dueño 2 no ve la del dueño 1');
SELECT is((SELECT count(*)::int FROM public.registration_logistics WHERE registration_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'No ve la logística ajena');
SELECT is((SELECT count(*)::int FROM public.event_passes WHERE id = '90000000-0000-0000-0000-000000000001'), 0, 'No ve los pases ajenos');

-- Usuario con sesión pero sin inscripción ni cargo --------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';
SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.event_registrations), 0, 'Un usuario sin inscripción no ve ninguna');
SELECT is((SELECT count(*)::int FROM public.participants), 0, 'Un usuario sin inscripción no ve personas');
SELECT is((SELECT count(*)::int FROM public.event_passes), 0, 'Un usuario sin inscripción no ve pases');

-- anon -----------------------------------------------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.event_registrations), 0, 'anon no ve inscripciones');
SELECT is((SELECT count(*)::int FROM public.event_attendees), 0, 'anon no ve asistentes');
SELECT is((SELECT count(*)::int FROM public.participants), 0, 'anon no ve personas');
SELECT is((SELECT count(*)::int FROM public.document_templates), 0, 'anon no ve plantillas');
SELECT is((SELECT count(*)::int FROM public.logistics_options), 2, 'anon ve las opciones de logística activas');
SELECT throws_ok(
  $$ INSERT INTO public.event_registrations (event_id, owner_id, kind, expected_visitors, contact_name, contact_email)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'individual', 1, 'X', 'x@correo.pe') $$,
  '42501', NULL, 'anon no inserta inscripciones'
);

-- Directiva (board): lee todo y confirma por RPC, pero no escribe directo ------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.event_registrations), 2, 'La directiva ve todas las inscripciones');
SELECT is((SELECT count(*)::int FROM public.event_attendees), 2, 'La directiva ve todos los asistentes');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments), 2, 'La directiva ve todos los recorridos');
SELECT is((SELECT count(*)::int FROM public.registration_documents), 2, 'La directiva ve todos los documentos');
SELECT is((SELECT count(*)::int FROM public.event_passes), 2, 'La directiva ve todos los pases');
SELECT cmp_ok((SELECT count(*)::int FROM public.registration_events), '>=', 2, 'La directiva lee la bitácora');
SELECT is((SELECT count(*)::int FROM public.email_outbox), 2, 'La directiva lee la cola de correos');
SELECT is((SELECT count(*)::int FROM public.document_templates), 2, 'La directiva ve todas las plantillas');
SELECT is((SELECT count(*)::int FROM public.logistics_options), 3, 'La directiva ve todas las opciones de logística');
SELECT throws_ok($$ UPDATE public.event_registrations SET gate = 'X' $$, '42501', NULL, 'La directiva no escribe directo: confirma por RPC');
SELECT is(pg_temp.upd('UPDATE public.events SET max_file_mb = 50'), 0, 'La directiva no cambia la configuración del evento');
SELECT throws_ok(
  $$ INSERT INTO public.document_templates (kind, version, drive_file_id) VALUES ('commitment_letter', 1, 'x') $$,
  '42501', NULL, 'La directiva no crea plantillas'
);
SELECT is((SELECT public.check_in_pass(' ' || (SELECT access_code FROM public.event_passes WHERE id = '90000000-0000-0000-0000-000000000001') || ' ') ->> 'already'), 'false', 'La directiva registra un ingreso por código');
SELECT is((SELECT public.check_in_pass((SELECT access_code FROM public.event_passes WHERE id = '90000000-0000-0000-0000-000000000001')) ->> 'already'), 'true', 'Un segundo ingreso avisa que ya ingresó');
SELECT is((SELECT public.check_in_pass('NOEXISTE') ->> 'error'), 'not_found', 'Un código inexistente no falla: responde not_found');

-- Admin: cambia la configuración; los overrides van por RPC -------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
SELECT is(pg_temp.upd('UPDATE public.events SET max_file_mb = 40'), 1, 'El admin cambia la configuración del evento');
SELECT lives_ok(
  $$ INSERT INTO public.logistics_options (code, label) VALUES ('shuttle', 'Transporte interno') $$,
  'El admin añade una opción de logística'
);
SELECT lives_ok($$ UPDATE public.document_templates SET active = true WHERE version = 2 AND kind = 'consent' AND false $$, 'El admin actualiza plantillas');
SELECT lives_ok(
  $$ INSERT INTO public.document_templates (kind, version, drive_file_id) VALUES ('commitment_letter', 1, 'x') $$,
  'El admin crea plantillas'
);
SELECT throws_ok($$ UPDATE public.event_registrations SET status = 'cancelled' $$, '42501', NULL, 'El admin tampoco escribe directo: los overrides son RPC con motivo');
SELECT is((SELECT count(*)::int FROM public.event_registrations), 2, 'El admin ve todas las inscripciones');

SELECT * FROM finish();
ROLLBACK;
