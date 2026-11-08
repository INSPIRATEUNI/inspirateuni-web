-- 🐧
-- Test: Flujo E2E Completo del Open Day (Issue 1.5.9)
-- Valida de extremo a extremo:
-- 1. Flujo completo de Colegio (con observación del staff y subsanación).
-- 2. Flujo completo de Persona Libre (menor con apoderado y adulto independiente).
-- 3. Vencimiento de las 48 h y liberación automática de cupos por el job de pg_cron.

BEGIN;
SELECT plan(54);

CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid);

-- 1. Datos iniciales de prueba -----------------------------------------------------------------
INSERT INTO public.events (
  id, name, event_date, venue, registration_open,
  registration_opens_at, registration_closes_at, docs_close_at,
  hold_minutes, reservation_hours, students_per_chaperone,
  max_visitors_per_registration, max_drafts_per_email
) VALUES (
  'e0000000-0000-0000-0000-000000000001', 'Open Day E2E Test', current_date + 30, 'Campus UNI', true,
  now() - interval '1 hour', now() + interval '10 days', now() + interval '12 days',
  30, 48, 10, 100, 5
);

INSERT INTO public.event_faculties (id, event_id, faculty_id, tier)
SELECT v.id::uuid, 'e0000000-0000-0000-0000-000000000001', f.id, v.tier::public.tour_tier
FROM (VALUES
  ('fa000000-0000-0000-0000-000000000001', 'Facultad de Ciencias', 'high'),
  ('fa000000-0000-0000-0000-000000000002', 'Facultad de Ingeniería Civil', 'mid'),
  ('fa000000-0000-0000-0000-000000000003', 'Facultad de Ingeniería Mecánica', 'low')
) AS v (id, name, tier)
JOIN public.faculties f ON f.name = v.name;

-- Sesiones populares y complementarias
INSERT INTO public.tour_sessions (id, event_faculty_id, starts_at, ends_at, capacity, status, meeting_point) VALUES
  ('5a000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001',
   (current_date + 30 + time '09:00') at time zone 'America/Lima', (current_date + 30 + time '10:00') at time zone 'America/Lima',
   25, 'open', 'Puerta 3 - Ciencias'),
  ('5a000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002',
   (current_date + 30 + time '10:30') at time zone 'America/Lima', (current_date + 30 + time '11:30') at time zone 'America/Lima',
   25, 'open', 'Pabellón Civil'),
  ('5a000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000003',
   (current_date + 30 + time '13:00') at time zone 'America/Lima', (current_date + 30 + time '14:00') at time zone 'America/Lima',
   25, 'open', 'Plaza Mecánica'),
  ('5a000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000001',
   (current_date + 30 + time '14:30') at time zone 'America/Lima', (current_date + 30 + time '15:30') at time zone 'America/Lima',
   5, 'open', 'Laboratorio Popular');

-- Usuarios auth de prueba
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data) VALUES
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'director@colegio-e2e.pe', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'menor@libre-e2e.pe', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'adulto@libre-e2e.pe', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'expira@libre-e2e.pe', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'staff.e2e@uni.pe', '{"first_name":"Staff","last_name":"Directiva"}'::jsonb);

-- Asignación de rol de Directiva (board) al usuario staff
INSERT INTO public.management_periods (id, name, start_date, end_date, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Periodo E2E', '2026-01-01', '2027-12-31', 'active');
INSERT INTO public.organizational_roles (id, name, access_level, is_global)
VALUES ('d0000000-0000-0000-0000-000000000001', 'Directiva E2E', 'board', false);
INSERT INTO public.position_assignments (profile_id, role_id, period_id, status)
VALUES ('10000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'active');

-- Colegio de prueba
INSERT INTO public.schools (id, name, district, ugel)
VALUES ('a1000000-0000-0000-0000-000000000001', 'Colegio Nacional E2E', 'Rímac', 'UGEL 02');

-- ==============================================================================================
-- 2. FLUJO COMPLETO DE COLEGIO CON OBSERVACIÓN Y REEMPLAZO DE DOCUMENTOS
-- ==============================================================================================
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 2.1 Iniciar inscripción de colegio (15 visitantes declarados)
INSERT INTO ids SELECT 'school_reg', (public.start_registration(
  'e0000000-0000-0000-0000-000000000001', 'school', 'a1000000-0000-0000-0000-000000000001',
  15, 'Prof. Manuel Pardo', 'director@colegio-e2e.pe'
) ->> 'id')::uuid;

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'draft'::public.registration_status,
  '[Colegio] La inscripción se crea en estado draft'
);

-- 2.2 Retener recorridos en los 3 tiers (high, mid, low) sin cruces
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'school_reg'), '5a000000-0000-0000-0000-000000000001') $$,
  '[Colegio] Retención de sesión tier high'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'school_reg'), '5a000000-0000-0000-0000-000000000002') $$,
  '[Colegio] Retención de sesión tier mid'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'school_reg'), '5a000000-0000-0000-0000-000000000003') $$,
  '[Colegio] Retención de sesión tier low'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'held'::public.registration_status,
  '[Colegio] Con retenciones activas pasa a estado held'
);

SELECT is(
  (SELECT seats_taken FROM public.tour_sessions WHERE id = '5a000000-0000-0000-0000-000000000001'),
  15,
  '[Colegio] Los 15 cupos se reservan atómicamente en la sesión high'
);

-- 2.3 Confirmar selección de recorridos
SELECT lives_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'school_reg')) $$,
  '[Colegio] confirm_selection bloquea la selección de recorridos'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'reserved'::public.registration_status,
  '[Colegio] Estado cambia a reserved tras confirmar recorridos'
);

SELECT ok(
  (SELECT docs_deadline FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')) > now() + interval '47 hours',
  '[Colegio] Se activa el plazo docs_deadline de 48 horas'
);

-- 2.4 Cargar lista de asistentes: 15 visitantes + 2 profesores acompañantes (proporción >= 1:10)
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'school_reg'), $j$[
    {"doc_type":"dni","doc_number":"70000001","first_name":"Alumno","last_name":"01","birth_date":"2009-03-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000002","first_name":"Alumno","last_name":"02","birth_date":"2009-03-02","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000003","first_name":"Alumno","last_name":"03","birth_date":"2009-03-03","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000004","first_name":"Alumno","last_name":"04","birth_date":"2009-03-04","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000005","first_name":"Alumno","last_name":"05","birth_date":"2009-03-05","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000006","first_name":"Alumno","last_name":"06","birth_date":"2009-03-06","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000007","first_name":"Alumno","last_name":"07","birth_date":"2009-03-07","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000008","first_name":"Alumno","last_name":"08","birth_date":"2009-03-08","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000009","first_name":"Alumno","last_name":"09","birth_date":"2009-03-09","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000010","first_name":"Alumno","last_name":"10","birth_date":"2009-03-10","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000011","first_name":"Alumno","last_name":"11","birth_date":"2009-03-11","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000012","first_name":"Alumno","last_name":"12","birth_date":"2009-03-12","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000013","first_name":"Alumno","last_name":"13","birth_date":"2009-03-13","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000014","first_name":"Alumno","last_name":"14","birth_date":"2009-03-14","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"70000015","first_name":"Alumno","last_name":"15","birth_date":"2009-03-15","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"80000001","first_name":"Profesor","last_name":"A","birth_date":"1980-01-01","attendee_role":"chaperone","relationship":"Tutor"},
    {"doc_type":"dni","doc_number":"80000002","first_name":"Profesor","last_name":"B","birth_date":"1982-05-15","attendee_role":"chaperone","relationship":"Coordinador"}
  ]$j$::jsonb) ->> 'ok'),
  'true',
  '[Colegio] set_attendees registra con éxito a los 17 asistentes (15 visitantes + 2 chaperones)'
);

-- 2.5 Cargar opciones de logística
SELECT lives_ok(
  $$ SELECT public.set_logistics((SELECT id FROM ids WHERE k = 'school_reg'), '[{"option_code":"bus","quantity":1,"notes":"Bus escolar de 30 asientos"}]'::jsonb) $$,
  '[Colegio] set_logistics registra el requerimiento de transporte'
);

-- 2.6 Subir documento PDF consolidado
INSERT INTO ids SELECT 'doc_school_v1', public.record_registration_document(
  (SELECT id FROM ids WHERE k = 'school_reg'),
  '10000000-0000-0000-0000-000000000001',
  'school_consolidated'::public.document_kind,
  'drive_file_school_001',
  'expediente_colegio_firmado.pdf',
  2500000
);

-- 2.7 Enviar inscripción completa
SELECT lives_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'school_reg'), 'v1.0') $$,
  '[Colegio] submit_registration envía la inscripción completa'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'submitted'::public.registration_status,
  '[Colegio] La inscripción pasa a submitted'
);

-- 2.8 Staff (directiva) revisa y OBSERVA los documentos
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.observe_documents(
    (SELECT id FROM ids WHERE k = 'school_reg'),
    'Falta sello y firma del director en la página 3 del expediente',
    now() + interval '3 days'
  ) $$,
  '[Staff] observe_documents registra la observación de documentos'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'docs_observed'::public.registration_status,
  '[Colegio] La inscripción transiciona a docs_observed'
);

SELECT is(
  (SELECT reason FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'school_reg') AND event_type = 'docs_observed'),
  'Falta sello y firma del director en la página 3 del expediente',
  '[Staff] El motivo de la observación se audita en registration_events'
);

-- 2.9 El colegio intenta reenviar sin haber reemplazado el documento (debe fallar)
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.resubmit_registration((SELECT id FROM ids WHERE k = 'school_reg')) $$,
  'P0001',
  'Aún hay documentos observados sin reemplazar',
  '[Colegio] resubmit_registration rechaza el reenvío si no se corrigió el documento'
);

-- 2.10 El colegio sube el documento subsanado (reemplaza/supersedes al anterior)
INSERT INTO ids SELECT 'doc_school_v2', public.record_registration_document(
  (SELECT id FROM ids WHERE k = 'school_reg'),
  '10000000-0000-0000-0000-000000000001',
  'school_consolidated'::public.document_kind,
  'drive_file_school_002_corregido',
  'expediente_colegio_corregido.pdf',
  2600000
);

SELECT is(
  (SELECT count(*)::int FROM public.registration_documents WHERE id = (SELECT id FROM ids WHERE k = 'doc_school_v1') AND superseded_at IS NOT NULL),
  1,
  '[Documentos] El documento anterior queda marcado como superseded'
);

-- 2.11 Reenvío exitoso
SELECT lives_ok(
  $$ SELECT public.resubmit_registration((SELECT id FROM ids WHERE k = 'school_reg')) $$,
  '[Colegio] resubmit_registration reenvía la inscripción tras la subsanación'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'submitted'::public.registration_status,
  '[Colegio] La inscripción vuelve al estado submitted'
);

-- 2.12 Staff (directiva) confirma la inscripción y emite pases
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.confirm_registration(
    (SELECT id FROM ids WHERE k = 'school_reg'),
    'Puerta 3 - Av. Túpac Amaru',
    (current_date + 30 + time '08:30') at time zone 'America/Lima'
  ) $$,
  '[Staff] confirm_registration asigna puerta, hora y emite pases'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'school_reg')),
  'confirmed'::public.registration_status,
  '[Colegio] La inscripción queda en estado confirmed'
);

SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'school_reg') AND pass_id IS NOT NULL),
  17,
  '[Colegio] Se emite un pase activo por cada uno de los 17 asistentes (alumnos y chaperones)'
);

SELECT is(
  (SELECT count(DISTINCT p.access_code)::int
   FROM public.event_attendees ea
   JOIN public.event_passes p ON p.id = ea.pass_id
   WHERE ea.registration_id = (SELECT id FROM ids WHERE k = 'school_reg')),
  17,
  '[Colegio] Todos los códigos de acceso de pases emitidos son únicos (Crockford base32)'
);

-- ==============================================================================================
-- 3. FLUJO COMPLETO DE PERSONA LIBRE (MENOR DE EDAD CON APODERADO Y ADULTO)
-- ==============================================================================================

-- 3.1 Menor de edad con apoderado
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000002", "role": "authenticated"}';

INSERT INTO ids SELECT 'minor_reg', (public.start_registration(
  'e0000000-0000-0000-0000-000000000001', 'individual', NULL, 1, 'Juancito Pérez', 'menor@libre-e2e.pe'
) ->> 'id')::uuid;

SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'minor_reg'), '5a000000-0000-0000-0000-000000000001') $$,
  '[Persona Libre Menor] Retiene sesión high'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'minor_reg'), '5a000000-0000-0000-0000-000000000002') $$,
  '[Persona Libre Menor] Retiene sesión mid'
);
SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'minor_reg'), '5a000000-0000-0000-0000-000000000003') $$,
  '[Persona Libre Menor] Retiene sesión low'
);
SELECT lives_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'minor_reg')) $$,
  '[Persona Libre Menor] Confirma selección de recorridos'
);

-- Si es menor de edad y se envía sin apoderado, debe fallar
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'minor_reg'), $j$[
    {"doc_type":"dni","doc_number":"71111111","first_name":"Juan","last_name":"Pérez","birth_date":"2010-06-01","attendee_role":"visitor"}
  ]$j$::jsonb) ->> 'ok'),
  'true',
  '[Persona Libre Menor] Registra visitante escolar menor de edad'
);

-- Insertar documentos requeridos para probar validación de apoderado
INSERT INTO public.registration_documents (registration_id, kind, drive_file_id, file_name)
VALUES
  ((SELECT id FROM ids WHERE k = 'minor_reg'), 'consent', 'drive_c1', 'consent.pdf'),
  ((SELECT id FROM ids WHERE k = 'minor_reg'), 'commitment_letter', 'drive_c2', 'carta.pdf'),
  ((SELECT id FROM ids WHERE k = 'minor_reg'), 'guardian_declaration', 'drive_c3', 'declaracion.pdf');

SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'minor_reg'), 'v1.0') $$,
  'P0001',
  'Un visitante menor de edad debe ir con un adulto acompañante',
  '[Persona Libre Menor] Menor de edad exige al menos un adulto apoderado'
);

-- Agregar el apoderado (>= 18 años)
SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'minor_reg'), $j$[
    {"doc_type":"dni","doc_number":"71111111","first_name":"Juan","last_name":"Pérez","birth_date":"2010-06-01","attendee_role":"visitor"},
    {"doc_type":"dni","doc_number":"41111111","first_name":"Carlos","last_name":"Pérez","birth_date":"1978-04-12","attendee_role":"guardian","relationship":"Padre"}
  ]$j$::jsonb) ->> 'ok'),
  'true',
  '[Persona Libre Menor] Registra visitante menor + apoderado'
);

SELECT lives_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'minor_reg'), 'v1.0') $$,
  '[Persona Libre Menor] Envío exitoso con menor y apoderado'
);

-- 3.2 Adulto independiente
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated"}';

INSERT INTO ids SELECT 'adult_reg', (public.start_registration(
  'e0000000-0000-0000-0000-000000000001', 'individual', NULL, 1, 'Rosa Postulante', 'adulto@libre-e2e.pe'
) ->> 'id')::uuid;

SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'adult_reg'), '5a000000-0000-0000-0000-000000000001') $$, '[Adulto] Retiene high');
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'adult_reg'), '5a000000-0000-0000-0000-000000000002') $$, '[Adulto] Retiene mid');
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'adult_reg'), '5a000000-0000-0000-0000-000000000003') $$, '[Adulto] Retiene low');
SELECT lives_ok($$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'adult_reg')) $$, '[Adulto] Confirma selección');

SELECT is(
  (SELECT public.set_attendees((SELECT id FROM ids WHERE k = 'adult_reg'), $j$[
    {"doc_type":"dni","doc_number":"72222222","first_name":"Rosa","last_name":"Postulante","birth_date":"2004-01-10","attendee_role":"visitor"}
  ]$j$::jsonb) ->> 'ok'),
  'true',
  '[Adulto] Registra visitante mayor de edad'
);

-- Adulto solo requiere consent y commitment_letter
INSERT INTO public.registration_documents (registration_id, kind, drive_file_id, file_name)
VALUES
  ((SELECT id FROM ids WHERE k = 'adult_reg'), 'consent', 'drive_a1', 'consent_adult.pdf'),
  ((SELECT id FROM ids WHERE k = 'adult_reg'), 'commitment_letter', 'drive_a2', 'carta_adult.pdf');

SELECT lives_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'adult_reg'), 'v1.0') $$,
  '[Adulto] Envío exitoso con solo 1 adulto sin necesidad de tutor'
);

-- Confirmación de ambos por Staff
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.confirm_registration((SELECT id FROM ids WHERE k = 'minor_reg'), 'Puerta 1', now() + interval '30 days') $$,
  '[Staff] Confirmación de inscripción de menor'
);
SELECT lives_ok(
  $$ SELECT public.confirm_registration((SELECT id FROM ids WHERE k = 'adult_reg'), 'Puerta 1', now() + interval '30 days') $$,
  '[Staff] Confirmación de inscripción de adulto'
);

SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'minor_reg') AND pass_id IS NOT NULL),
  2,
  '[Persona Libre Menor] Se emiten 2 pases (menor y apoderado)'
);
SELECT is(
  (SELECT count(*)::int FROM public.event_attendees WHERE registration_id = (SELECT id FROM ids WHERE k = 'adult_reg') AND pass_id IS NOT NULL),
  1,
  '[Persona Libre Adulto] Se emite 1 pase (solo adulto)'
);

-- ==============================================================================================
-- 4. FLUJO DE VENCIMIENTO DE 48 HORAS Y LIBERACIÓN AUTOMÁTICA DE CUPOS
-- ==============================================================================================
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub": "10000000-0000-0000-0000-000000000004", "role": "authenticated"}';

-- Usar la sesión popular que tiene capacidad máxima de 5
INSERT INTO ids SELECT 'exp_reg', (public.start_registration(
  'e0000000-0000-0000-0000-000000000001', 'individual', NULL, 1, 'Candidato Expirado', 'expira@libre-e2e.pe'
) ->> 'id')::uuid;

SELECT lives_ok(
  $$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'exp_reg'), '5a000000-0000-0000-0000-000000000004') $$,
  '[Expiración 48h] Retiene cupo en sesión popular (capacidad 5)'
);
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'exp_reg'), '5a000000-0000-0000-0000-000000000002') $$, '[Expiración 48h] Retiene mid');
SELECT lives_ok($$ SELECT public.hold_tour((SELECT id FROM ids WHERE k = 'exp_reg'), '5a000000-0000-0000-0000-000000000003') $$, '[Expiración 48h] Retiene low');
SELECT lives_ok(
  $$ SELECT public.confirm_selection((SELECT id FROM ids WHERE k = 'exp_reg')) $$,
  '[Expiración 48h] Confirma selección y pasa a reserved'
);

SELECT is(
  (SELECT seats_taken FROM public.tour_sessions WHERE id = '5a000000-0000-0000-0000-000000000004'),
  1,
  '[Expiración 48h] El cupo de la sesión popular pasa de 0 a 1'
);

SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'exp_reg')),
  'reserved'::public.registration_status,
  '[Expiración 48h] La inscripción está reserved esperando datos y documentos'
);

-- Simular el transcurso de las 48 horas modificando docs_deadline al pasado
UPDATE public.event_registrations
SET docs_deadline = now() - interval '5 minutes'
WHERE id = (SELECT id FROM ids WHERE k = 'exp_reg');

-- Ejecutar el trabajo programado de pg_cron
SELECT public.job_expire_holds();

-- Validaciones de expiración
SELECT is(
  (SELECT status FROM public.event_registrations WHERE id = (SELECT id FROM ids WHERE k = 'exp_reg')),
  'expired'::public.registration_status,
  '[Expiración 48h] job_expire_holds() marca la inscripción como expired'
);

SELECT is(
  (SELECT count(*)::int FROM public.tour_enrollments WHERE registration_id = (SELECT id FROM ids WHERE k = 'exp_reg') AND status <> 'released'),
  0,
  '[Expiración 48h] Todos los recorridos de la inscripción pasan al estado released'
);

SELECT is(
  (SELECT seats_taken FROM public.tour_sessions WHERE id = '5a000000-0000-0000-0000-000000000004'),
  0,
  '[Expiración 48h] Los asientos tomados de la sesión popular regresan atómicamente a 0 (cupos liberados)'
);

SELECT is(
  (SELECT count(*)::int FROM public.email_outbox WHERE registration_id = (SELECT id FROM ids WHERE k = 'exp_reg') AND template = 'reservation_expired'),
  1,
  '[Expiración 48h] Se encola el correo reservation_expired en email_outbox'
);

SELECT is(
  (SELECT reason FROM public.registration_events WHERE registration_id = (SELECT id FROM ids WHERE k = 'exp_reg') AND event_type = 'expired'),
  'Venció el plazo de 48 h',
  '[Expiración 48h] Se registra el evento expired con el motivo exacto en registration_events'
);

-- Intentar enviar una inscripción expirada debe ser rechazado
SELECT throws_ok(
  $$ SELECT public.submit_registration((SELECT id FROM ids WHERE k = 'exp_reg'), 'v1.0') $$,
  'P0001',
  'Esta inscripción no se puede enviar',
  '[Expiración 48h] Una inscripción expirada no puede enviarse'
);

SELECT * FROM finish();
ROLLBACK;
