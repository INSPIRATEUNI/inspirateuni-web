-- 🐧
-- Test: reglas de negocio del Open Day a través de las RPC (cupo y concurrencia lógica, niveles,
-- proporción de acompañantes, edad de adultos, duplicados, transiciones y vencimientos).
-- Las RPC identifican al usuario con auth.uid(); se simula fijando los claims del JWT.
BEGIN;
SELECT plan(59);

CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid);
CREATE TEMP TABLE conc (n integer, rid uuid, ok boolean, hint text);

-- Lista de personas de prueba: n visitantes (menores) y m adultos con el rol indicado
CREATE FUNCTION pg_temp.people(p_visitors integer, p_adults integer, p_adult_role text, p_prefix text DEFAULT '7')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT jsonb_agg(jsonb_build_object('doc_type', 'dni', 'doc_number', p_prefix || lpad(i::text, 7, '0'),
      'first_name', 'Visitante' || i, 'last_name', 'Prueba', 'birth_date', '2009-01-01', 'attendee_role', 'visitor'))
    FROM generate_series(1, p_visitors) i
  ), '[]'::jsonb) || coalesce((
    SELECT jsonb_agg(jsonb_build_object('doc_type', 'dni', 'doc_number', '8' || lpad(i::text, 7, '0'),
      'first_name', 'Adulto' || i, 'last_name', 'Prueba', 'birth_date', '1980-01-01', 'attendee_role', p_adult_role))
    FROM generate_series(1, p_adults) i
  ), '[]'::jsonb);
$$;

-- Datos de prueba ---------------------------------------------------------------------------------------------
INSERT INTO public.events (id, name, event_date, registration_open, registration_opens_at, registration_closes_at,
                           max_visitors_per_registration, max_drafts_per_email)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day Reglas', current_date + 30, true,
        now() - interval '1 day', now() + interval '10 days', 100, 50);

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT v.id::uuid, 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', f.id, v.tier::public.tour_tier
FROM (VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Facultad de Ciencias', 'high'),
  ('f0000000-0000-0000-0000-000000000002', 'Facultad de Ingeniería Civil', 'mid'),
  ('f0000000-0000-0000-0000-000000000003', 'Facultad de Ingeniería Mecánica', 'low')
) AS v (id, name, tier)
JOIN public.faculties f ON f.name = v.name;

-- H1 y M1 no se cruzan (margen de 15 min). L2 se cruza con ambas. H2 (cupo 4) es para la concurrencia. L1 tiene 1 plaza.
INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity) VALUES
  ('50000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001', (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima', 30),
  ('50000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-000000000001', (current_date + 30 + time '11:00') at time zone 'America/Lima', (current_date + 30 + time '12:00') at time zone 'America/Lima', 4),
  ('50000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000002', (current_date + 30 + time '10:15') at time zone 'America/Lima', (current_date + 30 + time '11:00') at time zone 'America/Lima', 30),
  ('50000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-000000000003', (current_date + 30 + time '15:00') at time zone 'America/Lima', (current_date + 30 + time '16:00') at time zone 'America/Lima', 1),
  ('50000000-0000-0000-0000-0000000000c2', 'f0000000-0000-0000-0000-000000000003', (current_date + 30 + time '09:30') at time zone 'America/Lima', (current_date + 30 + time '10:30') at time zone 'America/Lima', 30);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'dueno@correo.pe', '{}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'staff@uni.pe', '{"first_name": "Staff", "last_name": "Board"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'admin@uni.pe', '{"first_name": "Admin", "last_name": "Root"}'::jsonb);
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo Reglas', '2026-01-01', '2027-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global) VALUES
  ('dddddddd-0001-0001-0001-dddddddddddd', 'Director Reglas', 'board', false),
  ('dddddddd-0002-0002-0002-dddddddddddd', 'Admin Reglas', 'admin', false);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-0002-0002-0002-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');
INSERT INTO public.schools (id, name) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'Colegio A'),
  ('a0000000-0000-0000-0000-00000000000b', 'Colegio B');

-- Dueño -------------------------------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- 1. Cupo y concurrencia lógica: 6 inscripciones individuales compiten por 4 plazas ------------------------------------
DO $$
DECLARE
  i integer;
  rid uuid;
  v_hint text;
BEGIN
  FOR i IN 1 .. 6 LOOP
    rid := (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona ' || i, 'p' || i || '@correo.pe') ->> 'id')::uuid;
    BEGIN
      PERFORM public.hold_tour(rid, '50000000-0000-0000-0000-0000000000a2');
      INSERT INTO conc VALUES (i, rid, true, NULL);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
      INSERT INTO conc VALUES (i, rid, false, v_hint);
    END;
  END LOOP;
END;
$$;
SELECT is((SELECT count(*)::int FROM conc WHERE ok), 4, 'Exactamente 4 de 6 consiguen la plaza');
SELECT is((SELECT count(*)::int FROM conc WHERE hint = 'no_capacity'), 2, 'Las otras 2 reciben no_capacity');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-0000000000a2'), 4, 'seats_taken coincide con el cupo, sin sobreventa');
SELECT throws_ok(
  $$ UPDATE public.tour_sessions SET seats_taken = 5 WHERE id = '50000000-0000-0000-0000-0000000000a2' $$,
  '23514', NULL, 'CHECK (seats_taken <= capacity) es la última defensa'
);

INSERT INTO ids SELECT 'sA', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-00000000000a', 3, 'Resp. A', 'a@colegio.pe') ->> 'id')::uuid;
SELECT public.release_tour((SELECT rid FROM conc WHERE n = 1), '50000000-0000-0000-0000-0000000000a2');
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'sA'), '50000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'No hay cupo suficiente en este recorrido', 'Un grupo de 3 no cabe en 1 plaza libre (todo o nada)'
);
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-0000000000a2'), 3, 'El intento fallido del grupo no ocupa plazas');

-- Liberar las 3 retenciones restantes para no ensuciar el resto
UPDATE public.tour_enrollments SET status = 'released' WHERE session_id = '50000000-0000-0000-0000-0000000000a2';

-- 2. Regla de niveles (maximal) ------------------------------------------------------------------------------------------
INSERT INTO ids SELECT 'X', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Ocupa L1', 'x@correo.pe') ->> 'id')::uuid;
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'X'), '50000000-0000-0000-0000-0000000000c1') $$, 'X ocupa la única plaza de L1');

SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'sA'), '50000000-0000-0000-0000-0000000000a1');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'sA'), '50000000-0000-0000-0000-0000000000b1');
SELECT lives_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'sA')) $$,
  'Se omite un nivel si ninguna sesión es viable (L1 llena para 3, L2 se cruza)'
);
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'sA')), 'reserved'::public.registration_status, 'sA queda reservada con 2 de 3 niveles');

INSERT INTO ids SELECT 'Q', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona Q', 'q@correo.pe') ->> 'id')::uuid;
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'Q'), '50000000-0000-0000-0000-0000000000a1');
SELECT throws_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'Q')) $$,
  'P0001', 'Aún puedes elegir un recorrido en estos niveles: mid', 'No se omite el nivel mid si tiene una sesión viable'
);
SELECT throws_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'Q'), '50000000-0000-0000-0000-0000000000c2') $$,
  'P0001', 'Este recorrido se cruza con otro que ya elegiste', 'L2 se cruza con lo ya elegido'
);

-- Sin selección: con sesiones viables pide elegir; sin ninguna, avisa que no quedan cupos
SELECT public.release_tour((SELECT id FROM ids WHERE k = 'Q'), '50000000-0000-0000-0000-0000000000a1');
UPDATE public.event_registrations SET status = 'needs_reassignment' WHERE id = (SELECT id FROM ids WHERE k = 'Q');
SELECT throws_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'Q')) $$,
  'P0001', 'Elige al menos un recorrido', 'Sin recorridos y con sesiones viables: pide elegir uno'
);
UPDATE public.tour_sessions SET status = 'closed';
SELECT throws_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'Q')) $$,
  'P0001', 'Ya no quedan recorridos con cupo para tu grupo', 'Sin ninguna sesión viable: cupos agotados'
);
UPDATE public.tour_sessions SET status = 'open';
UPDATE public.event_registrations SET status = 'draft' WHERE id = (SELECT id FROM ids WHERE k = 'Q');

-- 3. Proporción de acompañantes (colegio de 11 visitantes: ceil(11/10) = 2) ------------------------------------------------
INSERT INTO ids SELECT 'sB', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'school', 'a0000000-0000-0000-0000-00000000000b', 11, 'Resp. B', 'b@colegio.pe') ->> 'id')::uuid;
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'sB'), '50000000-0000-0000-0000-0000000000a1');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'sB'), '50000000-0000-0000-0000-0000000000b1');
SELECT lives_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'sB')) $$, 'sB confirma sus recorridos');
SELECT is((SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sB'), pg_temp.people(11, 1, 'chaperone')) ->> 'ok'), 'true', 'sB registra 11 visitantes y 1 acompañante');
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'sB'), 'v1') $$,
  'P0001', 'Se necesitan al menos 2 acompañantes del colegio (hay 1)', '11 visitantes exigen 2 acompañantes'
);
SELECT is((SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sB'), pg_temp.people(11, 2, 'chaperone')) ->> 'ok'), 'true', 'sB completa con 2 acompañantes');
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'sB'), 'v1') $$,
  'P0001', 'Faltan documentos: school_consolidated', 'Con la proporción correcta, el siguiente requisito es el documento'
);
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'sB'), '') $$,
  'P0001', 'Debes aceptar el aviso de privacidad y la declaración de responsabilidad', 'Sin aceptar los términos no se envía'
);
SELECT is((SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sB'), pg_temp.people(10, 2, 'chaperone')) ->> 'ok'), 'true', 'Se puede cargar menos visitantes que los declarados...');
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'sB'), 'v1') $$,
  'P0001', 'Debes registrar exactamente 11 visitantes (hay 10)', '...pero al enviar deben ser exactamente los declarados'
);

-- 4. Edad de los adultos (a la fecha del evento) ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sA'), jsonb_build_array(jsonb_build_object(
       'doc_type', 'dni', 'doc_number', '90000001', 'first_name', 'Menor', 'last_name', 'Acompañante',
       'birth_date', '2015-01-01', 'attendee_role', 'chaperone'))) $$,
  '23514', 'Un chaperone debe ser mayor de edad a la fecha del evento', 'Un acompañante menor es rechazado'
);
SELECT throws_ok(
  $$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sA'), jsonb_build_array(jsonb_build_object(
       'doc_type', 'dni', 'doc_number', '90000002', 'first_name', 'Menor', 'last_name', 'Apoderado',
       'birth_date', '2015-01-01', 'attendee_role', 'guardian'))) $$,
  '23514', 'Un guardian debe ser mayor de edad a la fecha del evento', 'Un apoderado menor es rechazado'
);
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sA'), jsonb_build_array(jsonb_build_object(
     'doc_type', 'dni', 'doc_number', '90000003', 'first_name', 'Justo', 'last_name', 'Mayor',
     'birth_date', ((current_date + 30) - interval '18 years')::date, 'attendee_role', 'chaperone'))) ->> 'ok'),
  'true', 'Quien cumple 18 el día del evento es adulto'
);
SELECT throws_ok(
  $$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sA'), jsonb_build_array(jsonb_build_object(
       'doc_type', 'dni', 'doc_number', '90000004', 'first_name', 'Casi', 'last_name', 'Mayor',
       'birth_date', (((current_date + 30) - interval '18 years') + interval '1 day')::date, 'attendee_role', 'chaperone'))) $$,
  '23514', 'Un chaperone debe ser mayor de edad a la fecha del evento', 'Un día antes de cumplir 18 aún es menor'
);
SELECT is((SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'sA')), 1, 'Un rechazo no deja la lista a medias');

-- 5. Duplicado de visitante -----------------------------------------------------------------------------------------------------
INSERT INTO ids SELECT 'W', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona W', 'w@correo.pe') ->> 'id')::uuid;
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'W'), '50000000-0000-0000-0000-0000000000a1');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'W'), '50000000-0000-0000-0000-0000000000b1');
SELECT lives_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'W')) $$, 'W confirma sus recorridos');

SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'sA'), $j$[
    {"doc_type":"dni","doc_number":"91000001","first_name":"Nico","last_name":"Visitante","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"92000001","first_name":"Rosa","last_name":"Apoderada","birth_date":"1975-01-01","attendee_role":"guardian"}
  ]$j$::jsonb) ->> 'ok'),
  'true', 'sA registra a un visitante y a una apoderada'
);
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'W'), $j$[
    {"doc_type":"dni","doc_number":"91000001","first_name":"Nico","last_name":"Visitante","birth_date":"2009-01-01","attendee_role":"visitor"}
  ]$j$::jsonb) ->> 'error'),
  'attendee_conflict', 'El mismo visitante no puede estar en otra inscripción del evento'
);
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'W'), $j$[
    {"doc_type":"dni","doc_number":"93000001","first_name":"Leo","last_name":"Otro","birth_date":"2009-01-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"92000001","first_name":"Rosa","last_name":"Apoderada","birth_date":"1975-01-01","attendee_role":"guardian"}
  ]$j$::jsonb) ->> 'ok'),
  'true', 'Una apoderada sí puede figurar en varias inscripciones'
);
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'W'), $j$[
    {"doc_type":"dni","doc_number":"92000001","first_name":"Rosa","last_name":"Apoderada","birth_date":"1975-01-01","attendee_role":"guardian"},
    {"doc_type":"dni","doc_number":"92000001","first_name":"Rosa","last_name":"Apoderada","birth_date":"1975-01-01","attendee_role":"guardian"}
  ]$j$::jsonb) ->> 'error'),
  'attendee_conflict', 'Un documento repetido en la misma lista también es conflicto'
);
SELECT is((SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'W')), 2, 'El conflicto deja intacta la lista anterior de W');
SELECT is((SELECT count(*)::int FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'W') AND event_type = 'attendee_conflict'), 2, 'Cada conflicto queda en la bitácora');

-- 6. Transiciones de estado inválidas ---------------------------------------------------------------------------------------------
INSERT INTO ids SELECT 'D1', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona D1', 'd1@correo.pe') ->> 'id')::uuid;
SELECT throws_ok($$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'D1'), 'v1') $$, 'P0001', 'Esta inscripción no se puede enviar', 'No se envía un draft');
SELECT throws_ok($$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'D1'), '[]'::jsonb) $$, 'P0001', 'La lista de personas ya no se puede cambiar', 'No se cargan personas en un draft');
SELECT throws_ok($$ SELECT public.set_logistics((SELECT id FROM ids WHERE k = 'D1'), '[]'::jsonb) $$, 'P0001', 'La logística ya no se puede cambiar', 'No se guarda logística en un draft');
SELECT throws_ok($$ SELECT public.renew_hold((SELECT id FROM ids WHERE k = 'D1')) $$, 'P0001', 'Tu tiempo de elección venció', 'No se renueva sin retenciones');
SELECT throws_ok($$ SELECT public.release_tour((SELECT id FROM ids WHERE k = 'D1'), '50000000-0000-0000-0000-0000000000a1') $$, 'P0001', 'La selección de recorridos ya no se puede cambiar', 'No se suelta un recorrido en un draft');
SELECT throws_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'W')) $$, 'P0001', 'No hay una selección para confirmar', 'No se reconfirma una selección ya reservada');
SELECT throws_ok($$ SELECT public.resubmit_registration((SELECT id FROM ids WHERE k = 'W')) $$, 'P0001', 'Esta inscripción no tiene documentos observados', 'No se reenvía sin observación');

UPDATE public.event_registrations SET docs_deadline = now() - interval '1 hour' WHERE id = (SELECT id FROM ids WHERE k = 'W');
SELECT throws_ok($$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'W'), 'v1') $$, 'P0001', 'Venció el plazo para completar la inscripción', 'Pasado el plazo no se envía');
SELECT throws_ok($$ SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'W'), '[]'::jsonb) $$, 'P0001', 'Venció el plazo para completar la inscripción', 'Pasado el plazo no se cargan personas');
UPDATE public.event_registrations SET docs_deadline = now() + interval '1 day' WHERE id = (SELECT id FROM ids WHERE k = 'W');

SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.confirm_registration((SELECT id FROM ids WHERE k = 'W'), 'Puerta 1', now()) $$, 'P0001', 'Solo se confirma una inscripción enviada', 'No se confirma una inscripción sin enviar');
SELECT throws_ok($$ SELECT public.observe_documents((SELECT id FROM ids WHERE k = 'W'), 'Falta algo', now() + interval '1 day') $$, 'P0001', 'Solo se observan los documentos de una inscripción enviada', 'No se observan documentos sin enviar');

SET LOCAL "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.admin_reopen_registration((SELECT id FROM ids WHERE k = 'D1'), 'Prueba') $$, 'P0001', 'Solo se reabre una inscripción enviada, observada o confirmada', 'No se reabre un draft');
SELECT throws_ok($$ SELECT public.admin_set_attendees((SELECT id FROM ids WHERE k = 'D1'), '[]'::jsonb, 'Prueba') $$, 'P0001', 'No se puede editar la lista en este estado', 'El admin no edita la lista de un draft');
SELECT lives_ok($$ SELECT public.admin_cancel_registration((SELECT id FROM ids WHERE k = 'D1'), 'Prueba') $$, 'El admin cancela un draft');
SELECT throws_ok($$ SELECT public.admin_cancel_registration((SELECT id FROM ids WHERE k = 'D1'), 'Otra vez') $$, 'P0001', 'La inscripción ya terminó', 'Cancelada es un estado final');
SELECT throws_ok($$ SELECT public.admin_reopen_registration((SELECT id FROM ids WHERE k = 'D1'), 'Prueba') $$, 'P0001', 'Solo se reabre una inscripción enviada, observada o confirmada', 'No se reabre una cancelada');
SELECT throws_ok($$ SELECT public.admin_override_limits((SELECT id FROM ids WHERE k = 'D1'), 2, 'Prueba') $$, 'P0001', 'La inscripción ya terminó', 'No se cambian cupos de una cancelada');

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'D1'), '50000000-0000-0000-0000-0000000000a1') $$, 'P0001', 'La selección de recorridos ya no se puede cambiar', 'Una inscripción cancelada no retiene cupo');

-- 7. Vencimiento de retenciones ----------------------------------------------------------------------------------------------------------
INSERT INTO ids SELECT 'V', (public.start_registration('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'individual', NULL, 1, 'Persona V', 'v@correo.pe') ->> 'id')::uuid;
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'V'), '50000000-0000-0000-0000-0000000000a1');
SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'V'), '50000000-0000-0000-0000-0000000000b1');
CREATE TEMP TABLE before_seats AS SELECT seats_taken AS a1 FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-0000000000a1';
UPDATE public.tour_enrollments SET hold_expires_at = now() - interval '1 minute' WHERE registration_id = (SELECT id FROM ids WHERE k = 'V');
SELECT public.job_expire_holds();
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'V')), 'draft'::public.registration_status, 'Vencido el temporizador, la inscripción vuelve a draft');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'V') AND status <> 'released'), 0, 'Se liberan todas sus retenciones, no solo una');
SELECT is((SELECT seats_taken FROM public.tour_sessions WHERE id = '50000000-0000-0000-0000-0000000000a1'), (SELECT a1 FROM before_seats) - 1, 'Los asientos vuelven a la sesión');
SELECT throws_ok($$ SELECT public.renew_hold((SELECT id FROM ids WHERE k = 'V')) $$, 'P0001', 'Tu tiempo de elección venció', 'Vencido, el temporizador no se renueva');
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'V'), '50000000-0000-0000-0000-0000000000a1') $$, 'Tras vencer, se puede volver a elegir con un temporizador nuevo');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'sA') AND status = 'reserved'), 2, 'El job no toca los recorridos ya reservados');

-- Una inscripción enviada nunca vence sola, aunque pase su plazo
UPDATE public.event_registrations SET status = 'submitted', docs_deadline = now() - interval '3 days' WHERE id = (SELECT id FROM ids WHERE k = 'sA');
SELECT public.job_expire_holds();
SELECT is((SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'sA')), 'submitted'::public.registration_status, 'Una inscripción enviada no vence sola');
SELECT is((SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'sA') AND status = 'reserved'), 2, 'Y conserva sus cupos');

SELECT * FROM finish();
ROLLBACK;
