-- 🐧
-- Test: inscripciones, recorridos, cupos, cruces, unicidad de visitantes y edad de los adultos
BEGIN;
SELECT plan(38);

-- Datos de prueba (como superusuario) ---------------------------------------------------------
INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at) VALUES
  ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day A', '2026-11-20', '2026-10-01', '2026-11-10'),
  ('eeeeeeee-0000-0000-0000-bbbbbbbbbbbb', 'Open Day B', '2026-12-05', '2026-10-01', '2026-11-25');

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT v.id::uuid, v.event_id::uuid, f.id, v.tier::public.tour_tier
FROM (VALUES
  ('f0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Facultad de Ciencias', 'high'),
  ('f0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Facultad de Ingeniería Civil', 'mid'),
  ('f0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Facultad de Ingeniería Mecánica', 'low'),
  ('f0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-bbbbbbbbbbbb', 'Facultad de Ciencias', 'high')
) AS v (id, event_id, name, tier)
JOIN public.faculties f ON f.name = v.name;

-- Horas en America/Lima (-05). s1 y s3 se cruzan; s4 empieza justo cuando termina el margen de s1
INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity, status) VALUES
  ('50000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-11-20 09:00-05', '2026-11-20 10:00-05', 10, 'open'),
  ('50000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '2026-11-20 11:00-05', '2026-11-20 12:00-05', 10, 'open'),
  ('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', '2026-11-20 09:30-05', '2026-11-20 10:30-05', 10, 'open'),
  ('50000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', '2026-11-20 10:15-05', '2026-11-20 11:00-05', 10, 'open'),
  ('50000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', '2026-11-20 13:00-05', '2026-11-20 14:00-05', 10, 'closed'),
  ('50000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000004', '2026-12-05 09:00-05', '2026-12-05 10:00-05', 10, 'open');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'dueno1@correo.pe', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'dueno2@correo.pe', '{}'::jsonb);

INSERT INTO public.schools (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Colegio Uno'),
  ('a0000000-0000-0000-0000-000000000002', 'Colegio Dos');

INSERT INTO public.event_registrations (id, event_id, school_id, owner_id, kind, expected_visitors, contact_name, contact_email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'school', 5, 'Resp. Uno', 'uno@colegio.pe'),
  ('b0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', NULL, '22222222-2222-2222-2222-222222222222', 'individual', 1, 'Persona Libre', 'libre@correo.pe'),
  ('b0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'school', 6, 'Resp. Dos', 'dos@colegio.pe');

INSERT INTO public.participants (id, doc_type, doc_number, first_name, last_name, birth_date) VALUES
  ('c0000000-0000-0000-0000-00000000000a', 'dni', '10000001', 'Menor', 'Uno', '2009-05-01'),
  ('c0000000-0000-0000-0000-00000000000b', 'dni', '10000002', 'Adulto', 'Uno', '1980-03-10'),
  ('c0000000-0000-0000-0000-00000000000c', 'dni', '10000003', 'Menor', 'Dos', '2010-08-15'),
  ('c0000000-0000-0000-0000-00000000000d', 'dni', '10000004', 'Adulto', 'Dos', '1985-01-20');

-- Registro e identificadores -----------------------------------------------------------------
SELECT has_table('public', 'event_registrations', 'event_registrations existe');
SELECT has_table('public', 'tour_enrollments', 'tour_enrollments existe');
SELECT has_table('public', 'email_outbox', 'email_outbox existe');
SELECT matches(
  (SELECT reference_code FROM public.event_registrations WHERE id = 'b0000000-0000-0000-0000-000000000001'),
  '^OD-[0-9A-HJKMNP-TV-Z]{5}$',
  'reference_code se genera con formato OD-XXXXX'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_registrations (event_id, owner_id, kind, expected_visitors, contact_name, contact_email)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'individual', 2, 'X', 'x@correo.pe') $$,
  '23514', NULL, 'Una inscripción individual tiene exactamente 1 visitante'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_registrations (event_id, owner_id, kind, expected_visitors, contact_name, contact_email)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'school', 5, 'X', 'x@correo.pe') $$,
  '23514', NULL, 'Una inscripción de colegio exige school_id'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_registrations (event_id, school_id, owner_id, kind, expected_visitors, contact_name, contact_email)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'school', 5, 'X', 'x@correo.pe') $$,
  '23505', NULL, 'Un colegio tiene una sola inscripción viva por evento'
);

-- Recorridos: copia de tier y time_range, cupo y contador --------------------------------------
INSERT INTO public.tour_enrollments (id, registration_id, session_id, seats, hold_expires_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, now() + interval '30 minutes');

SELECT is((SELECT tier FROM public.tour_enrollments WHERE id = 'd0000000-0000-0000-0000-000000000001'), 'high'::public.tour_tier, 'El trigger copia el tier de la sesión');
SELECT is(
  (SELECT time_range FROM public.tour_enrollments WHERE id = 'd0000000-0000-0000-0000-000000000001'),
  tstzrange('2026-11-20 09:00-05', '2026-11-20 10:15-05', '[)'),
  'time_range incluye el margen de traslado de 15 min'
);
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 5, 'Reservar suma los asientos a seats_taken');

SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 6, now() + interval '30 minutes') $$,
  '23514', NULL, 'No se puede superar el cupo de la sesión (CHECK seats_taken <= capacity)'
);
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 5, 'El intento fallido no altera seats_taken');

INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
VALUES ('b0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 5, now() + interval '30 minutes');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 10, 'Dos inscripciones llenan la sesión exactamente');

SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 5, now() + interval '30 minutes') $$,
  '23505', NULL, 'Un solo recorrido por nivel'
);
SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', 5, now() + interval '30 minutes') $$,
  '23P01', NULL, 'No se permiten recorridos que se cruzan'
);
SELECT lives_ok(
  $$ INSERT INTO public.tour_enrollments (id, registration_id, session_id, seats, hold_expires_at)
     VALUES ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', 5, now() + interval '30 minutes') $$,
  'Una sesión que empieza justo al terminar el margen no se cruza'
);
SELECT is((SELECT tier FROM public.tour_enrollments WHERE id = 'd0000000-0000-0000-0000-000000000004'), 'mid'::public.tour_tier, 'Segundo recorrido: nivel mid copiado');
SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 5, now() + interval '30 minutes') $$,
  '23514', NULL, 'No se reserva una sesión cerrada'
);
SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats, hold_expires_at)
     VALUES ('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b', 1, now() + interval '30 minutes') $$,
  '23514', NULL, 'La sesión debe ser del mismo evento que la inscripción'
);
SELECT throws_ok(
  $$ INSERT INTO public.tour_enrollments (registration_id, session_id, seats)
     VALUES ('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 1) $$,
  '23514', NULL, 'Una retención (held) exige hold_expires_at'
);

-- Liberar devuelve el cupo y libera el nivel
UPDATE public.tour_enrollments SET status = 'released' WHERE id = 'd0000000-0000-0000-0000-000000000001';
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 5, 'Liberar devuelve los asientos');
INSERT INTO public.tour_enrollments (id, registration_id, session_id, seats, hold_expires_at)
VALUES ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 5, now() + interval '30 minutes');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 10, 'Tras liberar, el nivel vuelve a estar disponible y el cupo se reocupa');
DELETE FROM public.tour_enrollments WHERE id = 'd0000000-0000-0000-0000-000000000005';
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 5, 'Borrar un recorrido devuelve los asientos');

-- Asistentes -------------------------------------------------------------------------------------
INSERT INTO public.event_attendees (id, registration_id, participant_id, event_id, attendee_role)
VALUES ('e0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000a',
        'eeeeeeee-0000-0000-0000-bbbbbbbbbbbb', 'visitor');
SELECT is(
  (SELECT event_id FROM public.event_attendees WHERE id = 'e0000000-0000-0000-0000-00000000000a'),
  'eeeeeeee-0000-0000-0000-eeeeeeeeeeee'::uuid,
  'El trigger fija event_id con el de la inscripción (ignora el recibido)'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'visitor') $$,
  '23505', NULL, 'Un visitante no puede estar en dos inscripciones del mismo evento'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'chaperone') $$,
  '23514', NULL, 'Un acompañante menor de edad es rechazado'
);
SELECT lives_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role, relationship)
     VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'chaperone', 'profesor') $$,
  'Un acompañante adulto es aceptado'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'chaperone') $$,
  '23505', NULL, 'Un acompañante pertenece a una sola inscripción'
);
SELECT throws_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000d', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'chaperone') $$,
  '23514', NULL, 'Una inscripción individual no tiene acompañantes del colegio'
);
SELECT lives_ok(
  $$ INSERT INTO public.event_attendees (registration_id, participant_id, event_id, attendee_role)
     VALUES ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000d', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'guardian') $$,
  'Un apoderado adulto es aceptado en una inscripción individual'
);

-- Pases ------------------------------------------------------------------------------------------
INSERT INTO public.event_passes (id, event_id, participant_id)
VALUES ('90000000-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-00000000000b');
SELECT matches((SELECT access_code FROM public.event_passes WHERE id = '90000000-0000-0000-0000-00000000000b'), '^[0-9A-HJKMNP-TV-Z]{8}$', 'El pase genera un código Crockford de 8 caracteres');
SELECT throws_ok(
  $$ INSERT INTO public.event_passes (event_id, participant_id)
     VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'c0000000-0000-0000-0000-00000000000b') $$,
  '23505', NULL, 'Un solo pase por persona y evento'
);
SELECT throws_ok(
  $$ UPDATE public.event_attendees SET pass_id = '90000000-0000-0000-0000-00000000000b' WHERE id = 'e0000000-0000-0000-0000-00000000000a' $$,
  '23514', NULL, 'No se asigna a un asistente el pase de otra persona'
);

-- Plantillas, logística y correos ---------------------------------------------------------------
INSERT INTO public.document_templates (kind, version, drive_file_id, active) VALUES ('consent', 1, 'drive-1', true);
SELECT throws_ok(
  $$ INSERT INTO public.document_templates (kind, version, drive_file_id, active) VALUES ('consent', 2, 'drive-2', true) $$,
  '23505', NULL, 'Una sola versión activa por tipo de plantilla'
);
SELECT is((SELECT count(*)::int FROM public.logistics_options WHERE code IN ('bus', 'parking')), 2, 'Logística inicial: bus y parking');

INSERT INTO public.email_outbox (to_email, template, dedupe_key) VALUES ('uno@colegio.pe', 'reserva', 'reserva:b1');
SELECT throws_ok(
  $$ INSERT INTO public.email_outbox (to_email, template, dedupe_key) VALUES ('uno@colegio.pe', 'reserva', 'reserva:b1') $$,
  '23505', NULL, 'dedupe_key evita encolar dos veces el mismo correo'
);

-- Acceso: sin políticas todavía, anon no ve nada --------------------------------------------------
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.event_registrations), 0, 'anon no ve inscripciones');
SELECT is((SELECT count(*)::int FROM public.event_attendees), 0, 'anon no ve asistentes');

SELECT * FROM finish();
ROLLBACK;
