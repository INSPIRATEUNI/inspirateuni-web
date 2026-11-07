-- 🐧
-- Test: eventos, vista pública de disponibilidad e importación idempotente de horarios por CSV
BEGIN;
SELECT plan(26);

-- Datos de prueba (como superusuario)
INSERT INTO public.events (id, name, event_date, registration_opens_at, registration_closes_at)
VALUES ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'Open Day Prueba', '2026-11-20',
        '2026-10-01 00:00-05', '2026-11-10 00:00-05');

INSERT INTO public.event_faculties (event_id, faculty_id, tier)
SELECT 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee', f.id, v.tier::public.tour_tier
FROM (VALUES
  ('Facultad de Ciencias', 'high'),
  ('Facultad de Arquitectura, Urbanismo y Artes', 'mid')
) AS v (name, tier)
JOIN public.faculties f ON f.name = v.name;

-- Directiva (board, período activo)
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Periodo 2026-II', '2026-07-01', '2026-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('dddddddd-0001-0001-0001-dddddddddddd', 'Director de Prueba', 'board', false);
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'director@uni.pe', '{"first_name": "Dir", "last_name": "Ector"}'::jsonb);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'dddddddd-0001-0001-0001-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');

-- Estructura y configuración
SELECT has_table('public', 'events', 'events existe');
SELECT has_table('public', 'tour_sessions', 'tour_sessions existe');
SELECT has_function('public', 'import_tour_sessions', ARRAY['uuid', 'text', 'boolean'], 'import_tour_sessions existe');
SELECT is(
  (SELECT docs_close_at FROM public.events WHERE id = 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee'),
  '2026-11-10 00:00-05'::timestamptz + interval '48 hours',
  'docs_close_at por defecto = cierre + reservation_hours'
);
SELECT throws_ok(
  $$ INSERT INTO public.events (name, event_date, registration_opens_at, registration_closes_at, max_file_mb)
     VALUES ('Archivo enorme', '2026-11-20', '2026-10-01', '2026-11-10', 80) $$,
  '23514', NULL, 'max_file_mb no puede superar 50'
);

-- anon: no importa horarios
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT * FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee', 'facultad,inicio,fin,cupo
Facultad de Ciencias,2026-11-20 09:00,2026-11-20 10:00,30') $$,
  '42501', NULL, 'anon no puede importar horarios'
);
SELECT is((SELECT count(*)::int FROM public.events), 1, 'anon lee el evento');

-- Directiva: vista previa y aplicación
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Facultad con comas entre comillas, separador coma
SELECT is(
  (SELECT string_agg(action, ',' ORDER BY line) FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo,punto_encuentro
Facultad de Ciencias,2026-11-20 09:00,2026-11-20 10:00,30,Puerta 1
Facultad de Ciencias,2026-11-20 10:30,2026-11-20 11:30,30,Puerta 1
"Facultad de Arquitectura, Urbanismo y Artes",2026-11-20 09:00,2026-11-20 10:30,25,"Hall, piso 1"
$csv$)),
  'insert,insert,insert',
  'La vista previa marca 3 sesiones nuevas (con comillas y comas)'
);
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 0, 'La vista previa no escribe nada');

SELECT lives_ok(
  $$ SELECT * FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo,punto_encuentro
Facultad de Ciencias,2026-11-20 09:00,2026-11-20 10:00,30,Puerta 1
Facultad de Ciencias,2026-11-20 10:30,2026-11-20 11:30,30,Puerta 1
"Facultad de Arquitectura, Urbanismo y Artes",2026-11-20 09:00,2026-11-20 10:30,25,"Hall, piso 1"
$csv$, true) $$,
  'Aplicar el CSV funciona'
);
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 3, 'Se crearon 3 sesiones');
SELECT is(
  (SELECT meeting_point FROM public.tour_sessions WHERE capacity = 25),
  'Hall, piso 1',
  'El campo entre comillas conserva su coma'
);
SELECT is(
  (SELECT starts_at FROM public.tour_sessions WHERE capacity = 25),
  '2026-11-20 09:00-05'::timestamptz,
  'La hora se interpreta en America/Lima'
);

-- Idempotencia: repetir el mismo CSV no cambia nada
SELECT is(
  (SELECT string_agg(action, ',' ORDER BY line) FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo,punto_encuentro
Facultad de Ciencias,2026-11-20 09:00,2026-11-20 10:00,30,Puerta 1
Facultad de Ciencias,2026-11-20 10:30,2026-11-20 11:30,30,Puerta 1
"Facultad de Arquitectura, Urbanismo y Artes",2026-11-20 09:00,2026-11-20 10:30,25,"Hall, piso 1"
$csv$, true)),
  'unchanged,unchanged,unchanged',
  'Repetir el CSV es idempotente'
);
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 3, 'Repetir el CSV no duplica sesiones');

-- Actualización, con separador punto y coma
SELECT is(
  (SELECT string_agg(action, ',' ORDER BY line) FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad;inicio;fin;cupo;punto_encuentro
Facultad de Ciencias;2026-11-20 09:00;2026-11-20 10:00;40;Puerta 1
Facultad de Ciencias;2026-11-20 10:30;2026-11-20 11:30;30;Puerta 1
$csv$, true)),
  'update,unchanged',
  'Cambiar el cupo actualiza solo esa sesión (separador ;)'
);
SELECT is((SELECT capacity FROM public.tour_sessions WHERE meeting_point = 'Puerta 1' AND starts_at = '2026-11-20 09:00-05'), 40, 'El cupo se actualizó');
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 3, 'Las sesiones ausentes del CSV no se borran');

-- Errores: nada se aplica si hay una fila inválida
SELECT is(
  (SELECT string_agg(action, ',' ORDER BY line) FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo
Facultad de Ciencias,2026-11-20 13:00,2026-11-20 14:00,30
Facultad Inventada,2026-11-20 13:00,2026-11-20 14:00,30
Facultad de Ciencias,2026-11-21 09:00,2026-11-21 10:00,30
Facultad de Ciencias,2026-11-20 15:00,2026-11-20 14:00,30
Facultad de Ciencias,no-es-fecha,2026-11-20 14:00,30
$csv$)),
  'insert,error,error,error,error',
  'Se marcan como error la facultad desconocida, la fecha fuera del evento, el fin anterior y la fecha inválida'
);
SELECT throws_ok(
  $$ SELECT * FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo
Facultad de Ciencias,2026-11-20 13:00,2026-11-20 14:00,30
Facultad Inventada,2026-11-20 13:00,2026-11-20 14:00,30
$csv$, true) $$,
  '23514', NULL, 'Con errores, aplicar lanza excepción'
);
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 3, 'Con errores no se aplicó ninguna fila');

-- El cupo no puede bajar de los asientos tomados
RESET ROLE;
UPDATE public.tour_sessions SET seats_taken = 5 WHERE capacity = 40;
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT action FROM public.import_tour_sessions('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
$csv$facultad,inicio,fin,cupo,punto_encuentro
Facultad de Ciencias,2026-11-20 09:00,2026-11-20 10:00,3,Puerta 1
$csv$)),
  'error',
  'No se puede bajar el cupo por debajo de los asientos tomados'
);

-- Vista pública: sin datos de inscripciones
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.tour_sessions), 0, 'anon no lee tour_sessions directamente');
SELECT is((SELECT count(*)::int FROM public.v_tour_availability), 3, 'anon lee la disponibilidad por la vista');
SELECT is(
  (SELECT seats_remaining FROM public.v_tour_availability WHERE capacity = 40),
  35,
  'seats_remaining = cupo - asientos tomados'
);
RESET ROLE;
SELECT hasnt_column('public', 'v_tour_availability', 'seats_taken', 'La vista no expone seats_taken');

SELECT * FROM finish();
ROLLBACK;
