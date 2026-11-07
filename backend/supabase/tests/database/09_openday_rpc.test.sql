-- 🐧
-- Test: RPC del Open Day (flujo del dueño, staff, overrides de admin y jobs)
-- Las RPC identifican al usuario con auth.uid(); se simula fijando los claims del JWT.
BEGIN;
SELECT plan(90);

CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid);

-- Datos de prueba ----------------------------------------------------------------------------------
INSERT INTO public.events (id, name, event_date, registration_open, registration_opens_at, registration_closes_at,
                           max_visitors_per_registration, max_drafts_per_email)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day RPC', current_date + 30, true,
        now() - interval '1 day', now() + interval '10 days', 100, 2);

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT v.id::uuid, 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', f.id, v.tier::public.tour_tier
FROM (VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Facultad de Ciencias', 'high'),
  ('f0000000-0000-0000-0000-000000000002', 'Facultad de Ingeniería Civil', 'mid'),
  ('f0000000-0000-0000-0000-000000000003', 'Facultad de Ingeniería Mecánica', 'low')
) AS v (id, name, tier)
JOIN public.faculties f ON f.name = v.name;

INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity, status) VALUES
  ('50000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima', 10, 'open'),
  ('50000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', (current_date + 30 + time '11:00') at time zone 'America/Lima', (current_date + 30 + time '12:00') at time zone 'America/Lima', 10, 'open'),
  ('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', (current_date + 30 + time '09:30') at time zone 'America/Lima', (current_date + 30 + time '10:30') at time zone 'America/Lima', 10, 'open'),
  ('50000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', (current_date + 30 + time '10:15') at time zone 'America/Lima', (current_date + 30 + time '11:00') at time zone 'America/Lima', 10, 'open'),
  ('50000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', (current_date + 30 + time '13:00') at time zone 'America/Lima', (current_date + 30 + time '14:00') at time zone 'America/Lima', 1, 'open'),
  ('50000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000003', (current_date + 30 + time '15:00') at time zone 'America/Lima', (current_date + 30 + time '16:00') at time zone 'America/Lima', 10, 'open'),
  ('50000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', (current_date + 30 + time '18:30') at time zone 'America/Lima', (current_date + 30 + time '19:00') at time zone 'America/Lima', 10, 'closed');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'dueno1@correo.pe', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'dueno2@correo.pe', '{}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'staff@uni.pe', '{"first_name": "Staff", "last_name": "Board"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'admin@uni.pe', '{"first_name": "Admin", "last_name": "Root"}'::jsonb);

INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo RPC', '2026-01-01', '2027-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global) VALUES
  ('dddddddd-0001-0001-0001-dddddddddddd', 'Director RPC', 'board', false),
  ('dddddddd-0002-0002-0002-dddddddddddd', 'Admin RPC', 'admin', false);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-0002-0002-0002-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');

INSERT INTO public.schools (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Colegio Uno'),
  ('a0000000-0000-0000-0000-000000000002', 'Colegio Dos');

-- Permisos --------------------------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'X', 'x@correo.pe') $$,
  '42501', NULL, 'anon no puede iniciar una inscripción'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public._expire_holds() $$, '42501', NULL, 'Las funciones internas no se llaman desde la API');
SELECT throws_ok($$ SELECT public.job_expire_holds() $$, '42501', NULL, 'Los jobs no se llaman desde la API');
RESET ROLE;

-- Dueño 1: inscripción de colegio ------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

UPDATE public.events SET registration_open = false;
SELECT throws_ok(
  $$ SELECT public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-000000000001', 5, 'Resp. Uno', 'uno@colegio.pe') $$,
  'P0001', 'La inscripción no está abierta', 'No se inicia con la inscripción cerrada'
);
UPDATE public.events SET registration_open = true;

INSERT INTO ids SELECT 'r1', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-000000000001', 5, 'Resp. Uno', 'uno@colegio.pe') ->> 'id')::uuid;
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'draft'::public.registration_status, 'La inscripción nace en draft');
SELECT is((SELECT owner_id FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), '11111111-1111-1111-1111-111111111111'::uuid, 'El dueño es auth.uid()');

SELECT throws_ok(
  $$ SELECT public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-000000000001', 5, 'Otro', 'otro@colegio.pe') $$,
  'P0001', 'Este colegio ya tiene una inscripción para el evento', 'Un colegio no se inscribe dos veces'
);
SELECT throws_ok(
  $$ SELECT public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-000000000002', 200, 'Resp. Dos', 'dos@colegio.pe') $$,
  'P0001', 'Superaste el máximo de visitantes por inscripción', 'Se respeta el tope de visitantes del evento'
);

-- Retener recorridos
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000001') $$,
  'Retener un recorrido funciona'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'held'::public.registration_status, 'La inscripción pasa a held');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 5, 'La retención ocupa 5 asientos');
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Ya elegiste un recorrido de ese nivel', 'Un recorrido por nivel'
);
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000003') $$,
  'P0001', 'Este recorrido se cruza con otro que ya elegiste', 'No se retienen recorridos que se cruzan'
);
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000005') $$,
  'P0001', 'No hay cupo suficiente en este recorrido', 'Sin cupo para el grupo completo'
);
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Este recorrido no está disponible', 'No se retiene una sesión cerrada'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000004') $$,
  'Segundo recorrido (otro nivel, sin cruce)'
);
SELECT is(
  (SELECT count(DISTINCT hold_expires_at)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND status = 'held'),
  1, 'Todas las retenciones comparten un solo temporizador'
);

SELECT lives_ok(
  $$ SELECT public.release_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000004') $$,
  'Soltar un recorrido retenido'
);
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000004'), 0, 'Soltar devuelve el cupo');
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000004') $$,
  'Se puede volver a elegir tras soltar'
);

SELECT lives_ok($$ SELECT public.renew_hold((SELECT id FROM ids WHERE k = 'r1')) $$, 'Renovar el temporizador una vez');
SELECT throws_ok(
  $$ SELECT public.renew_hold((SELECT id FROM ids WHERE k = 'r1')) $$,
  'P0001', 'Ya renovaste el tiempo una vez', 'No se renueva dos veces'
);

-- Confirmar selección (regla de niveles maximal)
SELECT throws_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'r1')) $$,
  'P0001', 'Aún puedes elegir un recorrido en estos niveles: low', 'No se confirma si queda un nivel con sesión viable'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000006') $$,
  'Se elige el nivel que faltaba'
);
SELECT lives_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'r1')) $$, 'Confirmar la selección');
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'reserved'::public.registration_status, 'La inscripción pasa a reserved');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND status = 'reserved'), 3, 'Los 3 recorridos quedan reservados');
SELECT ok((SELECT docs_deadline FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')) > now(), 'Se fija el plazo de documentos');
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template = 'registration_reserved'), 1, 'Se encola el correo de reserva');
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000002') $$,
  'P0001', 'La selección de recorridos ya no se puede cambiar', 'Confirmada la selección, no se cambia'
);

-- Dueño 2: liberación perezosa y límite de borradores --------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

INSERT INTO ids SELECT 'rA', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona Libre', 'libre@correo.pe') ->> 'id')::uuid;
INSERT INTO ids SELECT 'rB', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona Libre', 'libre@correo.pe') ->> 'id')::uuid;
SELECT throws_ok(
  $$ SELECT public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona Libre', 'LIBRE@correo.pe') $$,
  'P0001', 'Ya tienes demasiadas inscripciones en curso con este correo', 'Tope de inscripciones en curso por correo'
);
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'r1'), '50000000-0000-0000-0000-000000000005') $$,
  'P0001', 'No se encontró la inscripción', 'No se puede operar la inscripción de otro'
);

SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rA'), '50000000-0000-0000-0000-000000000005') $$, 'rA retiene la última plaza');
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rB'), '50000000-0000-0000-0000-000000000005') $$,
  'P0001', 'No hay cupo suficiente en este recorrido', 'rB no cabe mientras la retención de rA sea vigente'
);
UPDATE public.tour_enrollments SET hold_expires_at = now() - interval '1 minute'
WHERE registration_id = (SELECT id FROM ids WHERE k = 'rA');
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rB'), '50000000-0000-0000-0000-000000000005') $$,
  'Liberación perezosa: la retención vencida de rA no bloquea a rB'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'rA')), 'draft'::public.registration_status, 'rA vuelve a draft');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000005'), 1, 'La plaza la tiene rB');

SELECT throws_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'rA')) $$,
  'P0001', 'No hay una selección para confirmar', 'No se confirma un draft'
);

-- Dueño 1: personas, envío y documentos -----------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'r1'), $j$[
    {"doc_type":"dni","doc_number":"20000001","first_name":"Ana","last_name":"Uno","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000002","first_name":"Beto","last_name":"Dos","birth_date":"2009-02-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000003","first_name":"Cami","last_name":"Tres","birth_date":"2009-03-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000004","first_name":"Dani","last_name":"Cuatro","birth_date":"2009-04-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000005","first_name":"Eli","last_name":"Cinco","birth_date":"2009-05-01","attendee_role":"visitor"}
  ]$j$::jsonb) ->> 'ok'),
  'true', 'Se registran las 5 personas en una sola transacción'
);
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'r1'), 'v1') $$,
  'P0001', 'Se necesitan al menos 1 acompañantes del colegio (hay 0)', 'La proporción de acompañantes se exige al enviar'
);
SELECT throws_ok(
  $$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'r1'), $j$[
    {"doc_type":"dni","doc_number":"20000001","first_name":"A","last_name":"A","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000002","first_name":"B","last_name":"B","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000003","first_name":"C","last_name":"C","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000004","first_name":"D","last_name":"D","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000005","first_name":"E","last_name":"E","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000006","first_name":"F","last_name":"F","birth_date":"2009-01-01","attendee_role":"visitor"}
  ]$j$::jsonb) $$,
  'P0001', 'Hay más visitantes que los declarados en la inscripción', 'No hay más visitantes que los declarados'
);
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'r1'), $j$[
    {"doc_type":"dni","doc_number":"20000001","first_name":"Ana","last_name":"Uno","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000002","first_name":"Beto","last_name":"Dos","birth_date":"2009-02-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000003","first_name":"Cami","last_name":"Tres","birth_date":"2009-03-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000004","first_name":"Dani","last_name":"Cuatro","birth_date":"2009-04-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000005","first_name":"Eli","last_name":"Cinco","birth_date":"2009-05-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"30000001","first_name":"Profe","last_name":"Uno","birth_date":"1980-01-01","attendee_role":"chaperone","relationship":"profesor"}
  ]$j$::jsonb) ->> 'ok'),
  'true', 'Se reemplaza la lista con un acompañante'
);
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'r1'), 'v1') $$,
  'P0001', 'Faltan documentos: school_consolidated', 'Sin el PDF consolidado no se envía'
);
INSERT INTO public.registration_documents (id, registration_id, kind, drive_file_id, file_name)
VALUES ('d0c00000-0000-0000-0000-000000000001', (SELECT id FROM ids WHERE k = 'r1'), 'school_consolidated', 'drive-a', 'consolidado.pdf');
SELECT lives_ok($$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'r1'), 'v1') $$, 'Enviar la inscripción completa');
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'submitted'::public.registration_status, 'La inscripción queda submitted');
SELECT is((SELECT terms_version FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'v1', 'Se guarda la versión de los términos aceptados');
SELECT throws_ok(
  $$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'r1'), '[]'::jsonb) $$,
  'P0001', 'La lista de personas ya no se puede cambiar', 'Enviada, la lista de personas queda bloqueada'
);

-- Conflicto de visitante entre inscripciones (dueño 2, otra inscripción reservada) ----------------------------------
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

INSERT INTO ids SELECT 'rC', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Otra Persona', 'otra@correo.pe') ->> 'id')::uuid;
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rC'), '50000000-0000-0000-0000-000000000001');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rC'), '50000000-0000-0000-0000-000000000004');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'rC'), '50000000-0000-0000-0000-000000000006');
SELECT lives_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'rC')) $$, 'rC confirma sus 3 recorridos');
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'rC'), $j$[
    {"doc_type":"dni","doc_number":"20000001","first_name":"Ana","last_name":"Uno","birth_date":"2009-01-01","attendee_role":"visitor"}
  ]$j$::jsonb) ->> 'error'),
  'attendee_conflict', 'Un visitante ya inscrito en otra inscripción devuelve un conflicto genérico'
);
SELECT is((SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'rC')), 0, 'El conflicto no deja filas a medias');
SELECT is((SELECT count(*)::int FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'rC') AND event_type = 'attendee_conflict'), 1, 'El conflicto queda en la bitácora');

-- Staff: observar y confirmar -----------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.observe_documents((SELECT id FROM ids WHERE k = 'r1'), 'Falta firma', now() + interval '2 days') $$,
  'P0001', 'Solo la directiva puede observar documentos', 'Un dueño no puede observar documentos'
);

SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.observe_documents((SELECT id FROM ids WHERE k = 'r1'), '  ', now() + interval '2 days') $$,
  'P0001', 'Debes indicar el motivo', 'Observar exige un motivo'
);
SELECT lives_ok(
  $$ SELECT public.observe_documents((SELECT id FROM ids WHERE k = 'r1'), 'Falta la firma del director', now() + interval '2 days') $$,
  'La directiva observa los documentos'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'docs_observed'::public.registration_status, 'Pasa a docs_observed');
SELECT is(
  (SELECT reason FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND event_type = 'docs_observed'),
  'Falta la firma del director', 'La observación queda en la bitácora con su motivo'
);

SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.resubmit_registration((SELECT id FROM ids WHERE k = 'r1')) $$,
  'P0001', 'Aún hay documentos observados sin reemplazar', 'No se reenvía sin reemplazar el documento observado'
);
UPDATE public.registration_documents SET superseded_at = now() WHERE id = 'd0c00000-0000-0000-0000-000000000001';
INSERT INTO public.registration_documents (registration_id, kind, drive_file_id, file_name)
VALUES ((SELECT id FROM ids WHERE k = 'r1'), 'school_consolidated', 'drive-b', 'consolidado-v2.pdf');
SELECT lives_ok($$ SELECT public.resubmit_registration((SELECT id FROM ids WHERE k = 'r1')) $$, 'Con el documento reemplazado se reenvía');

SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.confirm_registration((SELECT id FROM ids WHERE k = 'r1'), '', now()) $$,
  'P0001', 'Indica la puerta y la hora de llegada', 'Confirmar exige puerta'
);
SELECT lives_ok(
  $$ SELECT public.confirm_registration((SELECT id FROM ids WHERE k = 'r1'), 'Puerta 3', now() + interval '30 days') $$,
  'La directiva confirma la inscripción'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'confirmed'::public.registration_status, 'Pasa a confirmed');
SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND pass_id IS NOT NULL),
  6, 'Se emite un pase por cada persona'
);
SELECT ok(
  (SELECT bool_and(verified_at IS NOT NULL) FROM public.registration_documents WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND superseded_at IS NULL),
  'Confirmar valida los documentos vigentes'
);

-- Overrides de admin -------------------------------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT public.admin_cancel_registration((SELECT id FROM ids WHERE k = 'r1'), 'Prueba') $$,
  'P0001', 'Solo el administrador puede cancelar inscripciones', 'La directiva no hace overrides de admin'
);

SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.admin_cancel_registration((SELECT id FROM ids WHERE k = 'r1'), '') $$,
  'P0001', 'Debes indicar el motivo', 'Los overrides exigen motivo'
);

SELECT is(
  (SELECT public.admin_set_attendees((SELECT id FROM ids WHERE k = 'r1'), $j$[
    {"doc_type":"dni","doc_number":"20000001","first_name":"Ana","last_name":"Uno","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000002","first_name":"Beto","last_name":"Dos","birth_date":"2009-02-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000003","first_name":"Cami","last_name":"Tres","birth_date":"2009-03-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000004","first_name":"Dani","last_name":"Cuatro","birth_date":"2009-04-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"20000005","first_name":"Eli","last_name":"Cinco","birth_date":"2009-05-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"30000002","first_name":"Profe","last_name":"Dos","birth_date":"1985-01-01","attendee_role":"chaperone"}
  ]$j$::jsonb, 'Cambio de profesor') ->> 'ok'),
  'true', 'El admin edita la lista de una inscripción confirmada'
);
SELECT is(
  (SELECT status FROM public.event_passes WHERE participant_id = (SELECT id FROM public.participants WHERE doc_number = '30000001')),
  'revoked'::public.pass_status, 'El pase de quien sale se revoca'
);
SELECT is(
  (SELECT status FROM public.event_passes WHERE participant_id = (SELECT id FROM public.participants WHERE doc_number = '30000002')),
  'active'::public.pass_status, 'Quien entra recibe su pase'
);
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template = 'credentials_updated'), 1, 'Se encola el reenvío de códigos');

SELECT throws_ok(
  $$ SELECT public.admin_override_limits((SELECT id FROM ids WHERE k = 'r1'), 20, 'Colegio grande') $$,
  'P0001', 'Algún recorrido no tiene cupo suficiente (usa p_raise_capacity para ampliarlo)', 'Sin p_raise_capacity no se supera el cupo'
);
SELECT lives_ok(
  $$ SELECT public.admin_override_limits((SELECT id FROM ids WHERE k = 'r1'), 12, 'Colegio grande', true) $$,
  'Superar el cupo ampliando la capacidad'
);
SELECT is((SELECT capacity FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 13, 'La capacidad se amplía lo justo');
SELECT is((SELECT expected_visitors FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 12, 'Se actualizan los visitantes declarados');

SELECT lives_ok(
  $$ SELECT public.admin_reopen_registration((SELECT id FROM ids WHERE k = 'r1'), 'El colegio corrige datos') $$,
  'El admin reabre una inscripción confirmada'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'r1')), 'reserved'::public.registration_status, 'Vuelve a reserved');

SELECT lives_ok(
  $$ SELECT public.admin_cancel_registration((SELECT id FROM ids WHERE k = 'r1'), 'El colegio desiste') $$,
  'El admin cancela la inscripción'
);
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 1, 'Cancelar libera los asientos');
SELECT is((SELECT count(*)::int FROM public.event_passes WHERE status = 'active'), 0, 'Cancelar revoca los pases');
SELECT is(
  (SELECT reason FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'r1') AND event_type = 'override_cancel'),
  'El colegio desiste', 'El override queda en la bitácora con su motivo'
);

-- Sesión cancelada ---------------------------------------------------------------------------------------------------
RESET ROLE;
UPDATE public.tour_sessions SET status = 'cancelled' WHERE id = '50000000-0000-0000-0000-000000000006';
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'rC')), 'needs_reassignment'::public.registration_status, 'Cancelar una sesión deja la inscripción en needs_reassignment');
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template = 'session_cancelled'), 1, 'Se avisa por correo');

-- Jobs --------------------------------------------------------------------------------------------------------------------
UPDATE public.tour_enrollments SET hold_expires_at = now() - interval '1 minute' WHERE registration_id = (SELECT id FROM ids WHERE k = 'rB');
SELECT public.job_expire_holds();
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'rB')), 'draft'::public.registration_status, 'El job libera las retenciones vencidas');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000005'), 0, 'El job devuelve el cupo');

UPDATE public.event_registrations SET created_at = now() - interval '3 days' WHERE id = (SELECT id FROM ids WHERE k = 'rA');
SELECT public.job_expire_holds();
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'rA')), 'expired'::public.registration_status, 'El job vence los borradores abandonados');

UPDATE public.event_registrations SET status = 'reserved', docs_deadline = now() + interval '6 hours' WHERE id = (SELECT id FROM ids WHERE k = 'rC');
SELECT public.job_enqueue_reminders();
SELECT public.job_enqueue_reminders();
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template = 'reservation_reminder'), 1, 'El recordatorio de reserva se encola una sola vez');

UPDATE public.event_registrations SET docs_deadline = now() - interval '1 hour' WHERE id = (SELECT id FROM ids WHERE k = 'rC');
SELECT public.job_expire_holds();
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'rC')), 'expired'::public.registration_status, 'El job vence una reserva pasada de plazo');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'rC') AND status <> 'released'), 0, 'Vencer libera todos sus recorridos');

UPDATE public.tour_sessions SET seats_taken = 5 WHERE id = '50000000-0000-0000-0000-000000000002';
SELECT is((SELECT count(*)::int FROM public.check_seats_taken(false) WHERE session_id = '50000000-0000-0000-0000-000000000002'), 1, 'check_seats_taken detecta un descuadre');
SELECT public.job_check_seats();
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-000000000002'), 0, 'El job corrige el descuadre');

SELECT is((SELECT count(*)::int FROM cron.job WHERE jobname LIKE 'openday-%'), 4, 'Los 4 jobs de pg_cron están programados');

SELECT * FROM finish();
ROLLBACK;
